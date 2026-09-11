use crate::{
    auth,
    error::{ApiError, ApiResult},
    indexer,
    models::{
        AssetEventResponse, AuthChallengeRequest, AuthChallengeResponse, AuthTokenResponse,
        AuthVerifyRequest, CreateAssetEventRequest, CreateMerchantOrderRequest,
        CreatePaymentAttemptRequest, DashboardResponse, IndexedAssetResponse, IndexerSyncRequest,
        IndexerSyncResponse, MerchantOrderResponse, TrackTransactionRequest,
        TrackedTransactionResponse, TransactionLifecycleEvent, TransactionStatusResponse,
        UpdateMerchantOrderRequest,
    },
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
    response::sse::{Event, KeepAlive, Sse},
};
use chrono::Utc;
use futures_util::Stream;
use serde_json::{Value, json};
use std::{convert::Infallible, time::Duration};

pub async fn health() -> Json<Value> {
    Json(json!({ "status": "UP" }))
}

pub async fn readiness(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let tip = state.rpc.tip_block_number().await?;
    Ok(Json(json!({
        "status": "READY",
        "network": state.config.ckb_network,
        "tipBlockNumber": tip.to_string(),
        "service": state.config.otel_service_name,
        "otlpConfigured": state.config.otel_exporter_otlp_endpoint.is_some()
    })))
}

pub async fn network(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "network": state.config.ckb_network,
        "rpcUrl": state.config.ckb_rpc_url,
        "indexerUrl": state.config.ckb_indexer_url
    }))
}

pub async fn auth_challenge(
    State(state): State<AppState>,
    Json(request): Json<AuthChallengeRequest>,
) -> ApiResult<Json<AuthChallengeResponse>> {
    request.validate().map_err(ApiError::BadRequest)?;
    auth::validate_wallet_network(&request.wallet_address, &state.config.ckb_network)?;
    let _ = state.auth.delete_expired().await;
    Ok(Json(
        state
            .auth
            .create_challenge(
                request.wallet_address.trim(),
                state.config.auth_challenge_ttl_seconds,
                &state.config.ckb_network,
            )
            .await?,
    ))
}

pub async fn auth_verify(
    State(state): State<AppState>,
    Json(request): Json<AuthVerifyRequest>,
) -> ApiResult<Json<AuthTokenResponse>> {
    request.validate().map_err(ApiError::BadRequest)?;
    auth::validate_wallet_network(&request.wallet_address, &state.config.ckb_network)?;

    let challenge = state
        .auth
        .get_valid_challenge(request.nonce, request.wallet_address.trim())
        .await?
        .ok_or_else(|| {
            ApiError::Unauthorized("Challenge is missing, expired, or already consumed".into())
        })?;

    auth::verify_ckb_secp256k1_message(
        request.wallet_address.trim(),
        &challenge.message,
        request.signature.trim(),
    )?;

    let consumed = state
        .auth
        .consume_challenge(request.nonce, request.wallet_address.trim())
        .await?;
    if consumed.is_none() {
        return Err(ApiError::Unauthorized(
            "Challenge was already consumed".into(),
        ));
    }

    let access_token = auth::issue_token(&state, request.wallet_address.trim())?;
    Ok(Json(AuthTokenResponse {
        access_token,
        token_type: "Bearer".into(),
        expires_in: state.config.jwt_ttl_seconds,
        wallet_address: request.wallet_address.trim().to_owned(),
    }))
}

pub async fn auth_me(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let claims = auth::authorize(&state, &headers)?;
    Ok(Json(json!({
        "walletAddress": claims.sub,
        "network": claims.network,
        "expiresAt": claims.exp
    })))
}

pub async fn create_asset_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateAssetEventRequest>,
) -> ApiResult<Json<AssetEventResponse>> {
    request.validate().map_err(ApiError::BadRequest)?;
    auth::validate_wallet_network(&request.owner_address, &state.config.ckb_network)?;
    let claims = auth::authorize(&state, &headers)?;
    if claims.sub != request.owner_address {
        return Err(ApiError::Unauthorized(
            "JWT wallet does not match ownerAddress".into(),
        ));
    }
    Ok(Json(
        state
            .assets
            .create(&request, &state.config.ckb_network)
            .await?,
    ))
}

pub async fn asset_events(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> ApiResult<Json<Vec<AssetEventResponse>>> {
    auth::validate_wallet_network(&address, &state.config.ckb_network)?;
    if address.trim().is_empty() {
        return Err(ApiError::BadRequest("address is required".into()));
    }
    Ok(Json(state.assets.recent_by_owner(&address, 100).await?))
}

pub async fn sync_indexer(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<IndexerSyncRequest>,
) -> ApiResult<Json<IndexerSyncResponse>> {
    request.validate().map_err(ApiError::BadRequest)?;
    auth::validate_wallet_network(&request.wallet_address, &state.config.ckb_network)?;
    let claims = auth::authorize(&state, &headers)?;
    if claims.sub != request.wallet_address {
        return Err(ApiError::Unauthorized(
            "JWT wallet does not match walletAddress".into(),
        ));
    }
    Ok(Json(
        indexer::sync_wallet(&state, &request.wallet_address).await?,
    ))
}

pub async fn indexed_assets(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> ApiResult<Json<Vec<IndexedAssetResponse>>> {
    auth::validate_wallet_network(&address, &state.config.ckb_network)?;
    if address.trim().is_empty() {
        return Err(ApiError::BadRequest("address is required".into()));
    }
    Ok(Json(indexer::live_assets(&state, &address).await?))
}

pub async fn tip(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let decimal = state.rpc.tip_block_number().await?;
    Ok(Json(json!({
        "hex": format!("0x{decimal:x}"),
        "decimal": decimal.to_string()
    })))
}

pub async fn get_transaction(
    State(state): State<AppState>,
    Path(tx_hash): Path<String>,
) -> ApiResult<Json<Value>> {
    validate_hash(&tx_hash)?;
    Ok(Json(state.rpc.transaction(&tx_hash).await?))
}

pub async fn track_transaction(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<TrackTransactionRequest>,
) -> ApiResult<Json<TrackedTransactionResponse>> {
    request.validate().map_err(ApiError::BadRequest)?;
    auth::validate_wallet_network(&request.wallet_address, &state.config.ckb_network)?;
    let claims = auth::authorize(&state, &headers)?;
    if claims.sub != request.wallet_address {
        return Err(ApiError::Unauthorized(
            "JWT wallet does not match walletAddress".into(),
        ));
    }

    let chain_status = state.rpc.transaction_status(&request.tx_hash).await.ok();
    let status = normalize_status(chain_status.as_ref().map(|s| s.status.as_str()));
    let tracked = state
        .transactions
        .upsert(&request, &status, &state.config.ckb_network)
        .await?;
    Ok(Json(tracked))
}

pub async fn transaction_status(
    State(state): State<AppState>,
    Path(tx_hash): Path<String>,
) -> ApiResult<Json<TransactionStatusResponse>> {
    validate_hash(&tx_hash)?;
    let status = state.rpc.transaction_status(&tx_hash).await?;
    let normalized = normalize_status(Some(&status.status));
    let _ = state
        .transactions
        .update_status(&tx_hash, &normalized)
        .await?;
    Ok(Json(TransactionStatusResponse {
        status: normalized,
        ..status
    }))
}

pub async fn transaction_events(
    State(state): State<AppState>,
    Path(tx_hash): Path<String>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    validate_hash(&tx_hash)?;

    let poll_interval = state.config.sse_poll_interval_ms;
    let max_polls = state.config.sse_max_polls;
    let state_for_stream = state.clone();
    let tx_hash_for_stream = tx_hash.clone();

    let stream = async_stream::stream! {
        let mut previous = String::new();
        for _ in 0..max_polls {
            let chain_status = state_for_stream.rpc.transaction_status(&tx_hash_for_stream).await;
            match chain_status {
                Ok(status) => {
                    let normalized = normalize_status(Some(&status.status));
                    let terminal = is_final(&normalized);
                    if normalized != previous || terminal {
                        let _ = state_for_stream.transactions.update_status(&tx_hash_for_stream, &normalized).await;
                        let event = TransactionLifecycleEvent {
                            tx_hash: tx_hash_for_stream.clone(),
                            status: normalized.clone(),
                            block_hash: status.block_hash,
                            observed_at: Utc::now(),
                            terminal,
                        };
                        let payload = serde_json::to_string(&event).unwrap_or_else(|_| "{}".into());
                        yield Ok(Event::default().event("transaction-status").data(payload));
                        previous = normalized;
                    }
                    if terminal {
                        break;
                    }
                }
                Err(error) => {
                    let payload = json!({
                        "txHash": tx_hash_for_stream.clone(),
                        "status": "rpc_error",
                        "message": error.to_string(),
                        "observedAt": Utc::now()
                    }).to_string();
                    yield Ok(Event::default().event("transaction-error").data(payload));
                }
            }
            tokio::time::sleep(Duration::from_millis(poll_interval)).await;
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}

pub async fn dashboard(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> ApiResult<Json<DashboardResponse>> {
    auth::validate_wallet_network(&address, &state.config.ckb_network)?;
    if address.trim().is_empty() {
        return Err(ApiError::BadRequest("address is required".into()));
    }

    let mut recent = state.transactions.recent_by_wallet(&address, 10).await?;
    for tx in &mut recent {
        if is_final(&tx.status) {
            continue;
        }
        if let Ok(chain_status) = state.rpc.transaction_status(&tx.tx_hash).await {
            let next = normalize_status(Some(&chain_status.status));
            if next != tx.status {
                if let Some(updated) = state.transactions.update_status(&tx.tx_hash, &next).await? {
                    *tx = updated;
                }
            }
        }
    }

    let tracked_transactions = state.transactions.count_by_wallet(&address).await?;
    let tip = state.rpc.tip_block_number().await?;
    Ok(Json(DashboardResponse {
        network: state.config.ckb_network,
        tip_block_number: tip.to_string(),
        tracked_transactions,
        recent_transactions: recent,
    }))
}

fn validate_hash(tx_hash: &str) -> ApiResult<()> {
    if tx_hash.len() != 66
        || !tx_hash.starts_with("0x")
        || !tx_hash[2..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(ApiError::BadRequest(
            "txHash must be a 32-byte 0x-prefixed hash".into(),
        ));
    }
    Ok(())
}

fn normalize_status(status: Option<&str>) -> String {
    match status.unwrap_or("pending").to_ascii_lowercase().as_str() {
        "" | "not_found" | "unknown" => "pending".into(),
        value => value.to_owned(),
    }
}

fn is_final(status: &str) -> bool {
    matches!(
        status.to_ascii_lowercase().as_str(),
        "committed" | "rejected"
    )
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FiberCreateInvoiceRequest {
    pub merchant_wallet: String,
    pub amount_raw: String,
    pub description: Option<String>,
    pub expiry_seconds: Option<u64>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FiberSendPaymentRequest {
    pub wallet_address: String,
    pub invoice: String,
}

pub async fn fiber_node(State(state): State<AppState>) -> Json<crate::fiber::FiberNodeSummary> {
    Json(state.fiber.node_summary().await)
}

pub async fn fiber_compatibility(
    State(state): State<AppState>,
) -> Json<crate::fiber::FiberCompatibility> {
    Json(
        state
            .fiber
            .compatibility(&state.config.fiber_expected_version)
            .await,
    )
}

pub async fn fiber_create_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<FiberCreateInvoiceRequest>,
) -> ApiResult<Json<Value>> {
    let claims = auth::authorize(&state, &headers)?;
    if claims.sub != request.merchant_wallet {
        return Err(ApiError::Unauthorized(
            "JWT wallet does not match merchantWallet".into(),
        ));
    }
    let amount = request
        .amount_raw
        .parse::<u128>()
        .map_err(|_| ApiError::BadRequest("amountRaw must be an unsigned integer".into()))?;
    if amount == 0 {
        return Err(ApiError::BadRequest(
            "amountRaw must be greater than zero".into(),
        ));
    }
    let currency = match state.config.ckb_network.to_ascii_lowercase().as_str() {
        "mainnet" => "Fibb",
        "testnet" => "Fibt",
        _ => "Fibd",
    };
    let result = state
        .fiber
        .new_invoice(
            amount,
            request.description.clone(),
            request.expiry_seconds,
            currency,
        )
        .await?;
    let invoice_address = result
        .get("invoice_address")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let payment_hash = result
        .pointer("/invoice/data/payment_hash")
        .and_then(Value::as_str)
        .or_else(|| {
            result
                .pointer("/invoice/payment_hash")
                .and_then(Value::as_str)
        })
        .map(str::to_owned);
    let node = state.fiber.node_summary().await;
    sqlx::query(r#"INSERT INTO fiber_payment_records
        (merchant_wallet,direction,payment_hash,invoice_address,amount_raw,description,status,network,fiber_node_pubkey,raw_json)
        VALUES ($1,'INCOMING',$2,$3,$4,$5,'OPEN',$6,$7,$8)
        ON CONFLICT (payment_hash) WHERE payment_hash IS NOT NULL DO UPDATE SET raw_json=EXCLUDED.raw_json, updated_at=NOW()"#)
        .bind(&request.merchant_wallet).bind(&payment_hash).bind(&invoice_address)
        .bind(amount.to_string()).bind(&request.description).bind(&state.config.ckb_network)
        .bind(node.pubkey).bind(&result).execute(state.indexer.pool()).await?;
    Ok(Json(
        json!({"invoiceAddress": invoice_address, "paymentHash": payment_hash, "amountRaw": amount.to_string(), "fiber": result}),
    ))
}

pub async fn fiber_get_invoice(
    State(state): State<AppState>,
    Path(payment_hash): Path<String>,
) -> ApiResult<Json<Value>> {
    let result = state.fiber.get_invoice(&payment_hash).await?;
    let status = result
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("UNKNOWN");
    let _ = sqlx::query("UPDATE fiber_payment_records SET status=$2, raw_json=$3, updated_at=NOW() WHERE payment_hash=$1")
        .bind(&payment_hash).bind(status).bind(&result).execute(state.indexer.pool()).await;
    Ok(Json(result))
}

pub async fn fiber_send_payment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<FiberSendPaymentRequest>,
) -> ApiResult<Json<Value>> {
    let claims = auth::authorize(&state, &headers)?;
    if claims.sub != request.wallet_address {
        return Err(ApiError::Unauthorized(
            "JWT wallet does not match walletAddress".into(),
        ));
    }
    if request.invoice.trim().is_empty() {
        return Err(ApiError::BadRequest("invoice is required".into()));
    }
    Ok(Json(
        state
            .fiber
            .send_invoice_payment(request.invoice.trim())
            .await?,
    ))
}

pub async fn fiber_get_payment(
    State(state): State<AppState>,
    Path(payment_hash): Path<String>,
) -> ApiResult<Json<Value>> {
    Ok(Json(state.fiber.get_payment(&payment_hash).await?))
}

pub async fn merchant_order_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateMerchantOrderRequest>,
) -> ApiResult<Json<MerchantOrderResponse>> {
    let claims = auth::authorize(&state, &headers)?;
    let idempotency_key = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    if idempotency_key.as_ref().is_some_and(|key| key.len() > 128) {
        return Err(ApiError::BadRequest(
            "Idempotency-Key must not exceed 128 characters".into(),
        ));
    }
    if let Some(key) = &idempotency_key {
        if let Some(existing) = sqlx::query_as::<_, MerchantOrderResponse>(r#"SELECT id,merchant_wallet,customer_reference,amount_raw,asset_kind,description,status,payment_hash,invoice_address,network,paid_at,created_at,updated_at
            FROM merchant_orders WHERE merchant_wallet=$1 AND network=$2 AND idempotency_key=$3"#)
            .bind(&claims.sub).bind(&state.config.ckb_network).bind(key)
            .fetch_optional(state.indexer.pool()).await? {
            return Ok(Json(existing));
        }
    }
    let amount = request
        .amount_raw
        .parse::<u128>()
        .map_err(|_| ApiError::BadRequest("amountRaw must be an unsigned integer".into()))?;
    if amount == 0 {
        return Err(ApiError::BadRequest(
            "amountRaw must be greater than zero".into(),
        ));
    }
    if let Some(hash) = &request.payment_hash {
        if !is_payment_hash(hash) {
            return Err(ApiError::BadRequest(
                "paymentHash must be a 32-byte 0x-prefixed hash".into(),
            ));
        }
    }
    let id = uuid::Uuid::new_v4();
    let order = sqlx::query_as::<_, MerchantOrderResponse>(r#"INSERT INTO merchant_orders
        (id,merchant_wallet,customer_reference,amount_raw,asset_kind,description,status,payment_hash,invoice_address,network,idempotency_key)
        VALUES($1,$2,$3,$4,$5,$6,'PAYMENT_PENDING',$7,$8,$9,$10)
        RETURNING id,merchant_wallet,customer_reference,amount_raw,asset_kind,description,status,payment_hash,invoice_address,network,paid_at,created_at,updated_at"#)
        .bind(id).bind(&claims.sub).bind(&request.customer_reference).bind(amount.to_string())
        .bind(request.asset_kind.as_deref().unwrap_or("CKB")).bind(&request.description)
        .bind(&request.payment_hash).bind(&request.invoice_address).bind(&state.config.ckb_network).bind(&idempotency_key)
        .fetch_one(state.indexer.pool()).await?;
    write_audit(
        &state,
        &claims.sub,
        "ORDER_CREATED",
        "MERCHANT_ORDER",
        &id.to_string(),
        json!({"paymentHash":request.payment_hash,"amountRaw":amount.to_string()}),
    )
    .await?;
    Ok(Json(order))
}

pub async fn merchant_orders_list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<MerchantOrderResponse>>> {
    let claims = auth::authorize(&state, &headers)?;
    let orders = sqlx::query_as::<_, MerchantOrderResponse>(r#"SELECT id,merchant_wallet,customer_reference,amount_raw,asset_kind,description,status,payment_hash,invoice_address,network,paid_at,created_at,updated_at
        FROM merchant_orders WHERE merchant_wallet=$1 AND network=$2 ORDER BY created_at DESC LIMIT 100"#)
        .bind(&claims.sub).bind(&state.config.ckb_network).fetch_all(state.indexer.pool()).await?;
    Ok(Json(orders))
}

pub async fn merchant_order_update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(order_id): Path<uuid::Uuid>,
    Json(request): Json<UpdateMerchantOrderRequest>,
) -> ApiResult<Json<MerchantOrderResponse>> {
    let claims = auth::authorize(&state, &headers)?;
    let status = request.status.to_ascii_uppercase();
    let current: Option<String> =
        sqlx::query_scalar("SELECT status FROM merchant_orders WHERE id=$1 AND merchant_wallet=$2")
            .bind(order_id)
            .bind(&claims.sub)
            .fetch_optional(state.indexer.pool())
            .await?;
    let current = current.ok_or_else(|| ApiError::NotFound("Merchant order not found".into()))?;
    if !valid_order_transition(&current, &status) {
        return Err(ApiError::BadRequest("Unsupported order status".into()));
    }
    let order = sqlx::query_as::<_, MerchantOrderResponse>(r#"UPDATE merchant_orders SET status=$3,paid_at=CASE WHEN $3='PAID' THEN COALESCE(paid_at,NOW()) ELSE paid_at END,updated_at=NOW()
        WHERE id=$1 AND merchant_wallet=$2 RETURNING id,merchant_wallet,customer_reference,amount_raw,asset_kind,description,status,payment_hash,invoice_address,network,paid_at,created_at,updated_at"#)
        .bind(order_id).bind(&claims.sub).bind(&status).fetch_optional(state.indexer.pool()).await?
        .ok_or_else(|| ApiError::NotFound("Merchant order not found".into()))?;
    write_audit(
        &state,
        &claims.sub,
        "ORDER_STATUS_CHANGED",
        "MERCHANT_ORDER",
        &order_id.to_string(),
        json!({"status":status}),
    )
    .await?;
    Ok(Json(order))
}

fn valid_order_transition(from: &str, to: &str) -> bool {
    from == to
        || matches!(
            (from, to),
            ("ORDER_CREATED", "PAYMENT_PENDING")
                | ("PAYMENT_PENDING", "PAID")
                | ("PAYMENT_PENDING", "CANCELLED")
                | ("PAYMENT_PENDING", "EXPIRED")
                | ("PAID", "FULFILLMENT_PENDING")
                | ("FULFILLMENT_PENDING", "COMPLETED")
        )
}

pub async fn merchant_payment_attempt_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(order_id): Path<uuid::Uuid>,
    Json(request): Json<CreatePaymentAttemptRequest>,
) -> ApiResult<Json<Value>> {
    let claims = auth::authorize(&state, &headers)?;
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM merchant_orders WHERE id=$1 AND merchant_wallet=$2)",
    )
    .bind(order_id)
    .bind(&claims.sub)
    .fetch_one(state.indexer.pool())
    .await?;
    if !owns {
        return Err(ApiError::NotFound("Merchant order not found".into()));
    }
    let id: i64 = sqlx::query_scalar(r#"INSERT INTO fiber_payment_attempts(order_id,payment_hash,status,fee_raw,route_parts,failure,raw_json)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id"#).bind(order_id).bind(&request.payment_hash).bind(request.status.to_ascii_uppercase())
        .bind(&request.fee_raw).bind(request.route_parts.unwrap_or(0)).bind(&request.failure).bind(&request.raw).fetch_one(state.indexer.pool()).await?;
    write_audit(
        &state,
        &claims.sub,
        "PAYMENT_ATTEMPT_RECORDED",
        "MERCHANT_ORDER",
        &order_id.to_string(),
        json!({"attemptId":id,"status":request.status}),
    )
    .await?;
    Ok(Json(
        json!({"id":id,"orderId":order_id,"status":"recorded"}),
    ))
}

fn is_payment_hash(value: &str) -> bool {
    value.len() == 66
        && value.starts_with("0x")
        && value[2..].chars().all(|c| c.is_ascii_hexdigit())
}
async fn write_audit(
    state: &AppState,
    actor: &str,
    action: &str,
    subject_type: &str,
    subject_id: &str,
    context: Value,
) -> ApiResult<()> {
    sqlx::query("INSERT INTO audit_logs(actor_wallet,action,subject_type,subject_id,context,network) VALUES($1,$2,$3,$4,$5,$6)")
        .bind(actor).bind(action).bind(subject_type).bind(subject_id).bind(context).bind(&state.config.ckb_network).execute(state.indexer.pool()).await?;
    Ok(())
}

pub async fn fiber_ops_overview(
    State(state): State<AppState>,
) -> ApiResult<Json<crate::fiber_ops::OpsOverview>> {
    Ok(Json(
        state
            .fiber_ops
            .overview(&state.fiber, &state.config.ckb_network)
            .await?,
    ))
}

pub async fn fiber_channel_health(
    State(state): State<AppState>,
) -> ApiResult<Json<crate::fiber_ops::ChannelHealthResponse>> {
    Ok(Json(
        state
            .fiber_ops
            .analyze_channels(&state.fiber, &state.config.ckb_network, true)
            .await?,
    ))
}

pub async fn fiber_payment_readiness(
    State(state): State<AppState>,
    Json(request): Json<crate::fiber_ops::PaymentReadinessRequest>,
) -> ApiResult<Json<crate::fiber_ops::PaymentReadinessResponse>> {
    Ok(Json(
        state
            .fiber_ops
            .payment_readiness(&state.fiber, &request.invoice)
            .await?,
    ))
}

pub async fn fiber_reconcile(
    State(state): State<AppState>,
    Json(request): Json<crate::fiber_ops::ReconcileRequest>,
) -> ApiResult<Json<crate::fiber_ops::ReconciliationResponse>> {
    Ok(Json(
        state
            .fiber_ops
            .reconcile(
                &state.fiber,
                &state.config.ckb_network,
                &request.payment_hash,
            )
            .await?,
    ))
}

pub async fn fiber_incidents(
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<crate::fiber_ops::FiberIncident>>> {
    Ok(Json(
        state
            .fiber_ops
            .incidents(&state.config.ckb_network, false)
            .await?,
    ))
}

pub async fn fiber_ops_events(
    State(state): State<AppState>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let state_for_stream = state.clone();
    let stream = async_stream::stream! {
        let mut previous = String::new();
        loop {
            match state_for_stream.fiber_ops.overview(&state_for_stream.fiber, &state_for_stream.config.ckb_network).await {
                Ok(overview) => {
                    let payload = serde_json::to_string(&overview).unwrap_or_else(|_| "{}".into());
                    if payload != previous {
                        yield Ok(Event::default().event("fiber-ops").data(payload.clone()));
                        previous = payload;
                    }
                }
                Err(error) => {
                    yield Ok(Event::default().event("fiber-ops-error").data(json!({
                        "message": error.to_string(), "observedAt": Utc::now()
                    }).to_string()));
                }
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    };
    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}

#[derive(Debug, serde::Deserialize)]
pub struct AiKnowledgeQuery {
    pub q: String,
    pub limit: Option<i64>,
}

pub async fn ai_chat(
    State(state): State<AppState>,
    Json(request): Json<crate::ai::AiChatRequest>,
) -> ApiResult<Json<crate::ai::AiChatResponse>> {
    Ok(Json(
        state.ai.chat(&state.config.ckb_network, &request).await?,
    ))
}

pub async fn ai_knowledge_search(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<AiKnowledgeQuery>,
) -> ApiResult<Json<Vec<crate::ai::KnowledgeChunk>>> {
    Ok(Json(
        state
            .ai
            .search_knowledge(&query.q, query.limit.unwrap_or(5))
            .await?,
    ))
}

pub async fn fiber_runtime_snapshot(
    State(state): State<AppState>,
    Json(request): Json<crate::ai::RuntimeSnapshotRequest>,
) -> ApiResult<Json<Value>> {
    state
        .ai
        .save_snapshot(&state.config.ckb_network, &request)
        .await?;
    Ok(Json(
        json!({"status":"stored","network":state.config.ckb_network,"runtime":"wasm"}),
    ))
}

pub async fn fiber_network_resources_store(
    State(state): State<AppState>,
    Json(request): Json<crate::ai::NetworkResourcesRequest>,
) -> ApiResult<Json<Value>> {
    state
        .ai
        .save_network_resources(&state.config.ckb_network, &request.resources)
        .await?;
    Ok(Json(
        json!({"status":"stored","network":state.config.ckb_network,"runtime":"wasm"}),
    ))
}

pub async fn fiber_network_resources_latest(
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let value = state
        .ai
        .latest_network_resources(&state.config.ckb_network)
        .await?
        .ok_or_else(|| {
            crate::error::ApiError::NotFound(
                "No Fiber network resource snapshot is available".into(),
            )
        })?;
    Ok(Json(value))
}
