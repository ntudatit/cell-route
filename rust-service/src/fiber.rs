use crate::error::{ApiError, ApiResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Duration;

#[derive(Clone)]
pub struct FiberRpcService {
    client: Client,
    endpoint: String,
    biscuit_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FiberNodeSummary {
    pub endpoint: String,
    pub version: Option<String>,
    pub commit_hash: Option<String>,
    pub node_name: Option<String>,
    pub pubkey: Option<String>,
    pub features: Vec<String>,
    pub addresses: Vec<String>,
    pub chain_hash: Option<String>,
    pub reachable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FiberCompatibility {
    pub reachable: bool,
    pub expected_version: String,
    pub actual_version: Option<String>,
    pub compatible: bool,
    pub rpc_endpoint: String,
    pub notes: Vec<String>,
}

impl FiberRpcService {
    pub fn new(endpoint: String, biscuit_token: Option<String>, timeout: Duration) -> Self {
        let client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("reqwest client");
        Self {
            client,
            endpoint,
            biscuit_token,
        }
    }

    pub async fn call(&self, method: &str, params: Value) -> ApiResult<Value> {
        let mut req = self.client.post(&self.endpoint).json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }));
        if let Some(token) = &self.biscuit_token {
            req = req.bearer_auth(token);
        }
        let response = req.send().await.map_err(|e| {
            ApiError::Upstream(format!("Fiber RPC unavailable at {}: {e}", self.endpoint))
        })?;
        let status = response.status();
        let body: Value = response.json().await.map_err(|e| {
            ApiError::Upstream(format!(
                "Invalid Fiber RPC response from {}: {e}",
                self.endpoint
            ))
        })?;
        if !status.is_success() {
            return Err(ApiError::Upstream(format!(
                "Fiber RPC HTTP {status}: {body}"
            )));
        }
        if let Some(error) = body.get("error") {
            return Err(ApiError::Upstream(format!(
                "Fiber RPC method {method} failed: {error}"
            )));
        }
        Ok(body.get("result").cloned().unwrap_or(Value::Null))
    }

    pub async fn node_summary(&self) -> FiberNodeSummary {
        match self.call("node_info", json!([])).await {
            Ok(v) => FiberNodeSummary {
                endpoint: self.endpoint.clone(),
                version: str_field(&v, "version"),
                commit_hash: str_field(&v, "commit_hash"),
                node_name: str_field(&v, "node_name"),
                pubkey: str_field(&v, "pubkey"),
                features: string_array(&v, "features"),
                addresses: string_array(&v, "addresses"),
                chain_hash: str_field(&v, "chain_hash"),
                reachable: true,
            },
            Err(_) => FiberNodeSummary {
                endpoint: self.endpoint.clone(),
                version: None,
                commit_hash: None,
                node_name: None,
                pubkey: None,
                features: vec![],
                addresses: vec![],
                chain_hash: None,
                reachable: false,
            },
        }
    }

    pub async fn compatibility(&self, expected_version: &str) -> FiberCompatibility {
        let node = self.node_summary().await;
        let actual = node.version.clone();
        let compatible = node.reachable
            && actual
                .as_deref()
                .map(|v| normalize_version(v).starts_with(&normalize_version(expected_version)))
                .unwrap_or(false);
        let mut notes = Vec::new();
        if !node.reachable {
            notes.push(
                "FNN JSON-RPC is not reachable. Start fnn v0.9.0 and expose RPC on 127.0.0.1:8227."
                    .into(),
            );
        } else if !compatible {
            notes.push(format!(
                "FiberOps is validated against fnn v{expected_version}; detected {}.",
                actual.as_deref().unwrap_or("unknown")
            ));
        } else {
            notes.push("FNN v0.9.0 RPC compatibility check passed.".into());
        }
        notes.push("Fiber Testnet should use the bundled testnet config / CKB Testnet RPC, not an OffCKB devnet.".into());
        FiberCompatibility {
            reachable: node.reachable,
            expected_version: expected_version.into(),
            actual_version: actual,
            compatible,
            rpc_endpoint: self.endpoint.clone(),
            notes,
        }
    }

    pub async fn new_invoice(
        &self,
        amount: u128,
        description: Option<String>,
        expiry: Option<u64>,
        currency: &str,
    ) -> ApiResult<Value> {
        let mut p = serde_json::Map::new();
        p.insert("amount".into(), json!(format!("0x{amount:x}")));
        p.insert("currency".into(), json!(currency));
        if let Some(d) = description {
            p.insert("description".into(), json!(d));
        }
        if let Some(e) = expiry {
            p.insert("expiry".into(), json!(format!("0x{e:x}")));
        }
        self.call("new_invoice", json!([Value::Object(p)])).await
    }

    pub async fn get_invoice(&self, payment_hash: &str) -> ApiResult<Value> {
        self.call("get_invoice", json!([{ "payment_hash": payment_hash }]))
            .await
    }

    pub async fn send_invoice_payment(&self, invoice: &str) -> ApiResult<Value> {
        self.call("send_payment", json!([{ "invoice": invoice }]))
            .await
    }

    pub async fn dry_run_invoice_payment(&self, invoice: &str) -> ApiResult<Value> {
        self.call(
            "send_payment",
            json!([{ "invoice": invoice, "dry_run": true }]),
        )
        .await
    }

    pub async fn get_payment(&self, payment_hash: &str) -> ApiResult<Value> {
        self.call("get_payment", json!([{ "payment_hash": payment_hash }]))
            .await
    }

    pub async fn list_channels(&self, include_closed: bool) -> ApiResult<Value> {
        self.call(
            "list_channels",
            json!([{ "include_closed": include_closed }]),
        )
        .await
    }

    pub async fn list_peers(&self) -> ApiResult<Value> {
        self.call("list_peers", json!([])).await
    }
}

fn str_field(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn string_array(v: &Value, key: &str) -> Vec<String> {
    v.get(key)
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn normalize_version(v: &str) -> String {
    v.trim().trim_start_matches('v').to_ascii_lowercase()
}
