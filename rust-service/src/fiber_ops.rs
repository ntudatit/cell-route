use crate::{
    error::{ApiError, ApiResult},
    fiber::FiberRpcService,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};

#[derive(Clone)]
pub struct FiberOpsService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelHealth {
    pub channel_id: String,
    pub peer_pubkey: Option<String>,
    pub state: String,
    pub enabled: bool,
    pub local_balance_raw: String,
    pub remote_balance_raw: String,
    pub outbound_ratio: f64,
    pub pending_tlcs: usize,
    pub health: String,
    pub diagnosis: Vec<String>,
    pub recommendations: Vec<String>,
    pub raw: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelHealthResponse {
    pub scanned: usize,
    pub healthy: usize,
    pub warning: usize,
    pub critical: usize,
    pub total_local_balance_raw: String,
    pub total_remote_balance_raw: String,
    pub channels: Vec<ChannelHealth>,
    pub observed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentReadinessRequest {
    pub invoice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentReadinessResponse {
    pub status: String,
    pub payable: bool,
    pub fee_raw: Option<String>,
    pub route_count: usize,
    pub failure: Option<String>,
    pub recommendations: Vec<String>,
    pub dry_run: Value,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileRequest {
    pub payment_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationResponse {
    pub payment_hash: String,
    pub invoice_status: Option<String>,
    pub payment_status: Option<String>,
    pub cch_status: Option<String>,
    pub consistent: bool,
    pub severity: String,
    pub diagnosis: String,
    pub recommended_action: String,
    pub snapshot: Value,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FiberIncident {
    pub id: i64,
    pub fingerprint: String,
    pub incident_type: String,
    pub severity: String,
    pub status: String,
    pub subject_type: String,
    pub subject_id: String,
    pub title: String,
    pub diagnosis: String,
    pub recommendation: Option<String>,
    pub context_json: Value,
    pub network: String,
    pub first_seen_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsOverview {
    pub node_reachable: bool,
    pub node_version: Option<String>,
    pub node_pubkey: Option<String>,
    pub peers: usize,
    pub channels: usize,
    pub healthy_channels: usize,
    pub warning_channels: usize,
    pub critical_channels: usize,
    pub open_incidents: usize,
    pub critical_incidents: usize,
    pub total_local_balance_raw: String,
    pub total_remote_balance_raw: String,
    pub generated_at: DateTime<Utc>,
}

impl FiberOpsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn analyze_channels(
        &self,
        rpc: &FiberRpcService,
        network: &str,
        persist_incidents: bool,
    ) -> ApiResult<ChannelHealthResponse> {
        let node = rpc.node_summary().await;
        let result = rpc.list_channels(false).await?;
        let raw_channels = result
            .get("channels")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut channels = Vec::with_capacity(raw_channels.len());
        let mut total_local = 0u128;
        let mut total_remote = 0u128;

        for raw in raw_channels {
            let channel = analyze_channel(&raw);
            total_local = total_local.saturating_add(parse_u128(&channel.local_balance_raw));
            total_remote = total_remote.saturating_add(parse_u128(&channel.remote_balance_raw));
            self.upsert_snapshot(node.pubkey.as_deref(), &channel, network)
                .await?;
            if persist_incidents {
                self.sync_channel_incident(&channel, network).await?;
            }
            channels.push(channel);
        }

        let healthy = channels.iter().filter(|c| c.health == "HEALTHY").count();
        let warning = channels.iter().filter(|c| c.health == "WARNING").count();
        let critical = channels.iter().filter(|c| c.health == "CRITICAL").count();

        Ok(ChannelHealthResponse {
            scanned: channels.len(),
            healthy,
            warning,
            critical,
            total_local_balance_raw: total_local.to_string(),
            total_remote_balance_raw: total_remote.to_string(),
            channels,
            observed_at: Utc::now(),
        })
    }

    pub async fn payment_readiness(
        &self,
        rpc: &FiberRpcService,
        invoice: &str,
    ) -> ApiResult<PaymentReadinessResponse> {
        if invoice.trim().is_empty() {
            return Err(ApiError::BadRequest("invoice is required".into()));
        }
        let dry_run = rpc.dry_run_invoice_payment(invoice.trim()).await;

        match dry_run {
            Ok(value) => {
                let status = value
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("Ready");
                let failed = value
                    .get("failed_error")
                    .and_then(value_to_string)
                    .filter(|s| !s.is_empty());
                let routers = value
                    .get("routers")
                    .and_then(Value::as_array)
                    .map(|v| v.len())
                    .unwrap_or(0);
                let fee_raw = value.get("fee").and_then(value_to_string);
                let payable = failed.is_none() && !status.eq_ignore_ascii_case("failed");
                let mut recommendations = Vec::new();
                if routers > 1 {
                    recommendations.push(
                        "MPP route is available; monitor per-route liquidity during execution."
                            .into(),
                    );
                }
                if routers == 0 {
                    recommendations.push("Dry-run succeeded but no route details were returned; verify FNN version/capabilities.".into());
                }
                if payable {
                    recommendations.push("Safe to proceed with the real payment after confirming amount and invoice expiry.".into());
                }
                Ok(PaymentReadinessResponse {
                    status: if payable {
                        "READY".into()
                    } else {
                        "RISKY".into()
                    },
                    payable,
                    fee_raw,
                    route_count: routers,
                    failure: failed,
                    recommendations,
                    dry_run: value,
                    checked_at: Utc::now(),
                })
            }
            Err(error) => {
                let message = error.to_string();
                let recommendations = classify_payment_failure(&message);
                Ok(PaymentReadinessResponse {
                    status: "UNPAYABLE".into(),
                    payable: false,
                    fee_raw: None,
                    route_count: 0,
                    failure: Some(message.clone()),
                    recommendations,
                    dry_run: json!({ "error": message }),
                    checked_at: Utc::now(),
                })
            }
        }
    }

    pub async fn reconcile(
        &self,
        rpc: &FiberRpcService,
        network: &str,
        payment_hash: &str,
    ) -> ApiResult<ReconciliationResponse> {
        if !payment_hash.starts_with("0x") || payment_hash.len() < 10 {
            return Err(ApiError::BadRequest(
                "a valid paymentHash is required".into(),
            ));
        }

        let (invoice, payment, cch) = tokio::join!(
            rpc.get_invoice(payment_hash),
            rpc.get_payment(payment_hash),
            rpc.call("get_cch_order", json!([{ "payment_hash": payment_hash }]))
        );
        let invoice_v = invoice.ok();
        let payment_v = payment.ok();
        let cch_v = cch.ok();

        let invoice_status = invoice_v
            .as_ref()
            .and_then(|v| extract_status(v, &["status"]));
        let payment_status = payment_v
            .as_ref()
            .and_then(|v| extract_status(v, &["status"]));
        let cch_status = cch_v.as_ref().and_then(|v| extract_status(v, &["status"]));

        let (consistent, severity, diagnosis, action) = reconcile_states(
            invoice_status.as_deref(),
            payment_status.as_deref(),
            cch_status.as_deref(),
        );
        let snapshot = json!({ "invoice": invoice_v, "payment": payment_v, "cchOrder": cch_v });
        let response = ReconciliationResponse {
            payment_hash: payment_hash.to_owned(),
            invoice_status,
            payment_status,
            cch_status,
            consistent,
            severity: severity.into(),
            diagnosis: diagnosis.into(),
            recommended_action: action.into(),
            snapshot: snapshot.clone(),
            checked_at: Utc::now(),
        };

        sqlx::query(
            r#"INSERT INTO fiber_reconciliation_runs
            (payment_hash, invoice_status, payment_status, cch_status, consistent, severity, diagnosis, recommended_action, snapshot_json, network)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)"#,
        )
        .bind(&response.payment_hash).bind(&response.invoice_status).bind(&response.payment_status)
        .bind(&response.cch_status).bind(response.consistent).bind(&response.severity)
        .bind(&response.diagnosis).bind(&response.recommended_action).bind(&snapshot).bind(network)
        .execute(&self.pool).await?;

        if !consistent {
            self.upsert_incident(
                &format!("reconciliation:{}", payment_hash),
                "PAYMENT_RECONCILIATION",
                &response.severity,
                "PAYMENT",
                payment_hash,
                "Fiber payment state mismatch",
                &response.diagnosis,
                Some(&response.recommended_action),
                &snapshot,
                network,
            )
            .await?;
        } else {
            self.resolve_incident(&format!("reconciliation:{}", payment_hash), network)
                .await?;
        }

        Ok(response)
    }

    pub async fn incidents(
        &self,
        network: &str,
        include_resolved: bool,
    ) -> ApiResult<Vec<FiberIncident>> {
        let rows = if include_resolved {
            sqlx::query_as::<_, FiberIncident>(r#"
                SELECT id, fingerprint, incident_type, severity, status, subject_type, subject_id,
                    title, diagnosis, recommendation, context_json, network,
                    first_seen_at, last_seen_at, resolved_at
                FROM fiber_incidents WHERE network=$1
                ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
                    last_seen_at DESC LIMIT 200"#)
                .bind(network).fetch_all(&self.pool).await?
        } else {
            sqlx::query_as::<_, FiberIncident>(r#"
                SELECT id, fingerprint, incident_type, severity, status, subject_type, subject_id,
                    title, diagnosis, recommendation, context_json, network,
                    first_seen_at, last_seen_at, resolved_at
                FROM fiber_incidents WHERE network=$1 AND status='OPEN'
                ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
                    last_seen_at DESC LIMIT 200"#)
                .bind(network).fetch_all(&self.pool).await?
        };
        Ok(rows)
    }

    pub async fn overview(&self, rpc: &FiberRpcService, network: &str) -> ApiResult<OpsOverview> {
        let node = rpc.node_summary().await;
        let peers = rpc
            .list_peers()
            .await
            .ok()
            .and_then(|v| v.get("peers").and_then(Value::as_array).map(|a| a.len()))
            .unwrap_or(0);
        let (channels, healthy, warning, critical, local_total, remote_total): (
            i64,
            i64,
            i64,
            i64,
            String,
            String,
        ) = sqlx::query_as(
            r#"
              SELECT COUNT(*)::BIGINT,
                COUNT(*) FILTER (WHERE health='HEALTHY')::BIGINT,
                COUNT(*) FILTER (WHERE health='WARNING')::BIGINT,
                COUNT(*) FILTER (WHERE health='CRITICAL')::BIGINT,
                COALESCE(SUM(local_balance_raw::numeric),0)::text,
                COALESCE(SUM(remote_balance_raw::numeric),0)::text
              FROM fiber_channel_snapshots WHERE network=$1"#,
        )
        .bind(network)
        .fetch_one(&self.pool)
        .await?;
        let incidents = self.incidents(network, false).await?;
        Ok(OpsOverview {
            node_reachable: node.reachable,
            node_version: node.version,
            node_pubkey: node.pubkey,
            peers,
            channels: channels as usize,
            healthy_channels: healthy as usize,
            warning_channels: warning as usize,
            critical_channels: critical as usize,
            open_incidents: incidents.len(),
            critical_incidents: incidents
                .iter()
                .filter(|i| i.severity == "CRITICAL" || i.severity == "HIGH")
                .count(),
            total_local_balance_raw: local_total,
            total_remote_balance_raw: remote_total,
            generated_at: Utc::now(),
        })
    }

    async fn upsert_snapshot(
        &self,
        node_pubkey: Option<&str>,
        c: &ChannelHealth,
        network: &str,
    ) -> ApiResult<()> {
        sqlx::query(r#"
            INSERT INTO fiber_channel_snapshots
            (node_pubkey, channel_id, peer_pubkey, state, enabled, local_balance_raw, remote_balance_raw,
             outbound_ratio, pending_tlcs, health, diagnosis, raw_json, network, observed_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
            ON CONFLICT (network, channel_id) DO UPDATE SET
             node_pubkey=EXCLUDED.node_pubkey, peer_pubkey=EXCLUDED.peer_pubkey, state=EXCLUDED.state,
             enabled=EXCLUDED.enabled, local_balance_raw=EXCLUDED.local_balance_raw,
             remote_balance_raw=EXCLUDED.remote_balance_raw, outbound_ratio=EXCLUDED.outbound_ratio,
             pending_tlcs=EXCLUDED.pending_tlcs, health=EXCLUDED.health, diagnosis=EXCLUDED.diagnosis,
             raw_json=EXCLUDED.raw_json, observed_at=NOW()"#)
            .bind(node_pubkey).bind(&c.channel_id).bind(&c.peer_pubkey).bind(&c.state).bind(c.enabled)
            .bind(&c.local_balance_raw).bind(&c.remote_balance_raw).bind(c.outbound_ratio)
            .bind(c.pending_tlcs as i32).bind(&c.health).bind(c.diagnosis.join("; "))
            .bind(&c.raw).bind(network).execute(&self.pool).await?;
        Ok(())
    }

    async fn sync_channel_incident(&self, c: &ChannelHealth, network: &str) -> ApiResult<()> {
        let fingerprint = format!("channel-health:{}", c.channel_id);
        if c.health == "HEALTHY" {
            return self.resolve_incident(&fingerprint, network).await;
        }
        let severity = if c.health == "CRITICAL" {
            "CRITICAL"
        } else {
            "WARNING"
        };
        self.upsert_incident(
            &fingerprint,
            "CHANNEL_HEALTH",
            severity,
            "CHANNEL",
            &c.channel_id,
            &format!("Channel {} is {}", short_id(&c.channel_id), c.health),
            &c.diagnosis.join("; "),
            Some(&c.recommendations.join("; ")),
            &c.raw,
            network,
        )
        .await
    }

    async fn upsert_incident(
        &self,
        fingerprint: &str,
        incident_type: &str,
        severity: &str,
        subject_type: &str,
        subject_id: &str,
        title: &str,
        diagnosis: &str,
        recommendation: Option<&str>,
        context: &Value,
        network: &str,
    ) -> ApiResult<()> {
        sqlx::query(r#"
            INSERT INTO fiber_incidents
            (fingerprint, incident_type, severity, status, subject_type, subject_id, title, diagnosis,
             recommendation, context_json, network)
            VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (network, fingerprint) DO UPDATE SET
              incident_type=EXCLUDED.incident_type, severity=EXCLUDED.severity, status='OPEN',
              title=EXCLUDED.title, diagnosis=EXCLUDED.diagnosis, recommendation=EXCLUDED.recommendation,
              context_json=EXCLUDED.context_json, last_seen_at=NOW(), resolved_at=NULL"#)
            .bind(fingerprint).bind(incident_type).bind(severity).bind(subject_type).bind(subject_id)
            .bind(title).bind(diagnosis).bind(recommendation).bind(context).bind(network)
            .execute(&self.pool).await?;
        Ok(())
    }

    async fn resolve_incident(&self, fingerprint: &str, network: &str) -> ApiResult<()> {
        sqlx::query("UPDATE fiber_incidents SET status='RESOLVED', resolved_at=NOW(), last_seen_at=NOW() WHERE fingerprint=$1 AND network=$2 AND status='OPEN'")
            .bind(fingerprint).bind(network).execute(&self.pool).await?;
        Ok(())
    }
}

fn analyze_channel(raw: &Value) -> ChannelHealth {
    let channel_id = raw
        .get("channel_id")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_owned();
    let peer_pubkey = raw
        .get("pubkey")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let state = channel_state(raw.get("state"));
    let enabled = raw.get("enabled").and_then(Value::as_bool).unwrap_or(true);
    let local = raw
        .get("local_balance")
        .and_then(value_to_string)
        .unwrap_or_else(|| "0".into());
    let remote = raw
        .get("remote_balance")
        .and_then(value_to_string)
        .unwrap_or_else(|| "0".into());
    let local_n = parse_u128(&local);
    let remote_n = parse_u128(&remote);
    let total = local_n.saturating_add(remote_n);
    let ratio = if total == 0 {
        0.0
    } else {
        local_n as f64 / total as f64
    };
    let pending = raw
        .get("pending_tlcs")
        .and_then(Value::as_array)
        .map(|v| v.len())
        .unwrap_or(0);
    let failure = raw
        .get("failure_detail")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty());
    let mut diagnosis = Vec::new();
    let mut recommendations = Vec::new();
    let mut score = 0u8;

    if failure.is_some() {
        score = 3;
        diagnosis.push(format!("Opening failure: {}", failure.unwrap()));
        recommendations
            .push("Inspect funding/peer state before retrying. Do not retry blindly.".into());
    }
    if state == "Closed" {
        score = score.max(2);
        diagnosis.push("Channel is closed and cannot route payments.".into());
        recommendations
            .push("Open or select another healthy channel if payment capacity is required.".into());
    } else if state != "ChannelReady" {
        score = score.max(2);
        diagnosis.push(format!("Channel is not ready: {state}."));
        recommendations.push("Check peer connectivity and funding confirmation; escalate if state remains unchanged.".into());
    }
    if !enabled {
        score = score.max(2);
        diagnosis.push("Channel is disabled for forwarding.".into());
        recommendations.push("Review channel policy before re-enabling forwarding.".into());
    }
    if total > 0 && ratio < 0.15 {
        score = score.max(2);
        diagnosis.push(format!("Low outbound liquidity ({:.1}%).", ratio * 100.0));
        recommendations
            .push("Consider rebalancing or opening additional outbound capacity.".into());
    } else if total > 0 && ratio < 0.30 {
        score = score.max(1);
        diagnosis.push(format!(
            "Outbound liquidity is getting low ({:.1}%).",
            ratio * 100.0
        ));
        recommendations.push("Plan a rebalance before larger payments arrive.".into());
    }
    if pending >= 10 {
        score = 3;
        diagnosis.push(format!("High pending TLC count ({pending})."));
        recommendations.push(
            "Inspect payment/TLC lifecycle and peer acknowledgements before adding more load."
                .into(),
        );
    } else if pending >= 3 {
        score = score.max(1);
        diagnosis.push(format!("Pending TLCs detected ({pending})."));
        recommendations.push("Monitor pending TLC age and payment failures.".into());
    }
    if diagnosis.is_empty() {
        diagnosis.push(
            "Channel is ready with acceptable local liquidity and no unusual pending TLC pressure."
                .into(),
        );
    }

    ChannelHealth {
        channel_id,
        peer_pubkey,
        state,
        enabled,
        local_balance_raw: local_n.to_string(),
        remote_balance_raw: remote_n.to_string(),
        outbound_ratio: ratio,
        pending_tlcs: pending,
        health: match score {
            0 => "HEALTHY",
            1 => "WARNING",
            2 => "WARNING",
            _ => "CRITICAL",
        }
        .into(),
        diagnosis,
        recommendations,
        raw: raw.clone(),
    }
}

fn channel_state(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Object(map)) => map
            .get("state_name")
            .or_else(|| map.get("stateName"))
            .and_then(Value::as_str)
            .unwrap_or_else(|| map.keys().next().map(String::as_str).unwrap_or("Unknown"))
            .to_owned(),
        _ => "Unknown".into(),
    }
}

fn value_to_string(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn parse_u128(raw: &str) -> u128 {
    let s = raw.trim();
    if let Some(hex) = s.strip_prefix("0x") {
        u128::from_str_radix(hex, 16).unwrap_or(0)
    } else {
        s.parse().unwrap_or(0)
    }
}

fn extract_status(v: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| v.get(*k).and_then(value_to_string))
}

fn classify_payment_failure(message: &str) -> Vec<String> {
    let lower = message.to_ascii_lowercase();
    let mut out = Vec::new();
    if lower.contains("route") || lower.contains("path") {
        out.push("No usable route was found. Inspect channel graph, peer connectivity, and trampoline/MPP options.".into());
    }
    if lower.contains("liquid") || lower.contains("balance") || lower.contains("capacity") {
        out.push(
            "Outbound liquidity may be insufficient. Rebalance or add channel capacity.".into(),
        );
    }
    if lower.contains("expiry") || lower.contains("expired") {
        out.push("Invoice/TLC expiry constraints may be invalid. Refresh the invoice and verify final expiry delta.".into());
    }
    if lower.contains("unauthorized") || lower.contains("biscuit") {
        out.push("Check Biscuit token permissions and distinguish permanent auth failures from transient RPC middleware limits.".into());
    }
    if out.is_empty() {
        out.push("Inspect the raw FNN error and run Channel Health before retrying. Avoid repeated blind retries.".into());
    }
    out
}

fn reconcile_states(
    invoice: Option<&str>,
    payment: Option<&str>,
    cch: Option<&str>,
) -> (bool, &'static str, &'static str, &'static str) {
    let i = invoice.unwrap_or("UNKNOWN").to_ascii_uppercase();
    let p = payment.unwrap_or("UNKNOWN").to_ascii_uppercase();
    let c = cch.unwrap_or("NONE").to_ascii_uppercase();
    if i == "PAID" && p == "SUCCESS" && (c == "SUCCESS" || c == "NONE") {
        return (
            true,
            "INFO",
            "Invoice and payment agree on successful settlement.",
            "No action required.",
        );
    }
    if p == "FAILED" && i == "PAID" {
        return (
            false,
            "CRITICAL",
            "Payment is Failed while invoice is Paid; state requires manual investigation before retry.",
            "Block automatic retry, inspect payment attempts and invoice settlement/preimage state.",
        );
    }
    if c == "FAILED" && (p == "INFLIGHT" || p == "SUCCESS") {
        return (
            false,
            "CRITICAL",
            "CCH order failed while Fiber payment is still active/successful.",
            "Freeze duplicate retries and inspect CCH order plus both incoming/outgoing legs.",
        );
    }
    if i == "CANCELLED" && p == "INFLIGHT" {
        return (
            false,
            "HIGH",
            "Invoice is cancelled but payment remains in flight.",
            "Monitor TLC resolution and do not create a replacement payment until this attempt terminates.",
        );
    }
    if p == "SUCCESS" && i != "PAID" && i != "UNKNOWN" {
        return (
            false,
            "HIGH",
            "Payment reports Success but invoice is not Paid.",
            "Re-query invoice after a short delay; if mismatch persists, create an operator incident.",
        );
    }
    if p == "INFLIGHT" || c == "OUTGOINGINFLIGHT" || c == "INCOMINGACCEPTED" {
        return (
            true,
            "INFO",
            "Payment is progressing through a non-terminal state.",
            "Continue monitoring; escalate only when progress exceeds the operational timeout.",
        );
    }
    (
        true,
        "INFO",
        "No contradictory terminal state was detected with the data currently available.",
        "Continue normal monitoring.",
    )
}

fn short_id(v: &str) -> String {
    if v.len() <= 18 {
        v.into()
    } else {
        format!("{}…{}", &v[..10], &v[v.len() - 6..])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_low_liquidity() {
        let c = analyze_channel(&json!({
            "channel_id":"0x1", "pubkey":"02abc", "state":{"state_name":"ChannelReady"},
            "enabled":true, "local_balance":"0x0a", "remote_balance":"0x5a", "pending_tlcs":[]
        }));
        assert_eq!(c.health, "WARNING");
        assert!(c.diagnosis.iter().any(|d| d.contains("liquidity")));
    }

    #[test]
    fn finds_reconciliation_mismatch() {
        let (ok, severity, _, _) = reconcile_states(Some("Paid"), Some("Failed"), None);
        assert!(!ok);
        assert_eq!(severity, "CRITICAL");
    }
}
