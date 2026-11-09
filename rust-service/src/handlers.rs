use crate::{
    auth,
    error::{ApiError, ApiResult},
    indexer,
    models::{
        AssetEventResponse, AuthChallengeRequest, AuthChallengeResponse, AuthTokenResponse,
        AuthVerifyRequest, CreateAssetEventRequest, CreatePaymentAttemptRequest, DashboardResponse,
        IndexedAssetResponse, IndexerSyncRequest, IndexerSyncResponse, MerchantOrderResponse,
        TrackTransactionRequest, TrackedTransactionResponse, TransactionLifecycleEvent,
        TransactionStatusResponse,
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
    let check_database = async {
        sqlx::query("SELECT 1")
            .execute(state.indexer.pool())
            .await?;
        Ok(())
    };
    let (_, _, tip) = tokio::time::timeout(Duration::from_secs(5), async {
        tokio::try_join!(
            check_database,
            state.rpc.check_chain(&state.config.ckb_network),
            state.rpc.tip_block_number()
        )
    })
    .await
    .map_err(|_| ApiError::Unavailable("Readiness check timed out".into()))?
    .map_err(|error| match error {
        ApiError::Unavailable(_) => error,
        _ => ApiError::Unavailable("Database or CKB RPC is unavailable".into()),
    })?;
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
        "network": state.config.ckb_network
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
    headers: HeaderMap,
) -> ApiResult<Json<Vec<AssetEventResponse>>> {
    auth::authorize_wallet(&state, &headers, &address)?;
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
    headers: HeaderMap,
) -> ApiResult<Json<Vec<IndexedAssetResponse>>> {
    auth::authorize_wallet(&state, &headers, &address)?;
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
    let permit = state
        .stream_permits
        .clone()
        .try_acquire_owned()
        .map_err(|_| ApiError::Unavailable("Too many active event streams".into()))?;

    let stream = async_stream::stream! {
        let mut previous = String::new();
        let _permit = permit;
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
                Err(_) => {
                    let payload = json!({
                        "txHash": tx_hash_for_stream.clone(),
                        "status": "rpc_error",
                        "message": "CKB RPC could not read transaction status",
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
    headers: HeaderMap,
) -> ApiResult<Json<DashboardResponse>> {
    auth::authorize_wallet(&state, &headers, &address)?;
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

pub async fn merchant_orders_list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<MerchantOrderResponse>>> {
    let claims = crate::merchant::merchant(&state, &headers)?;
    let orders = sqlx::query_as::<_, MerchantOrderResponse>(r#"SELECT *
        FROM merchant_orders WHERE merchant_wallet=$1 AND network=$2 ORDER BY created_at DESC LIMIT 100"#)
        .bind(&claims.sub).bind(&state.config.ckb_network).fetch_all(state.indexer.pool()).await?;
    Ok(Json(orders))
}

pub async fn merchant_payment_attempt_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(order_id): Path<uuid::Uuid>,
    Json(request): Json<CreatePaymentAttemptRequest>,
) -> ApiResult<Json<Value>> {
    let claims = crate::merchant::merchant(&state, &headers)?;
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM merchant_orders WHERE id=$1 AND merchant_wallet=$2 AND network=$3)",
    )
    .bind(order_id)
    .bind(&claims.sub)
    .bind(&state.config.ckb_network)
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
    let permit = state
        .stream_permits
        .clone()
        .try_acquire_owned()
        .map_err(|_| ApiError::Unavailable("Too many active event streams".into()))?;
    let stream = async_stream::stream! {
        let _permit = permit;
        let mut previous = String::new();
        for _ in 0..30 {
            match state_for_stream.fiber_ops.overview(&state_for_stream.fiber, &state_for_stream.config.ckb_network).await {
                Ok(overview) => {
                    let payload = serde_json::to_string(&overview).unwrap_or_else(|_| "{}".into());
                    if payload != previous {
                        yield Ok(Event::default().event("fiber-ops").data(payload.clone()));
                        previous = payload;
                    }
                }
                Err(_) => {
                    yield Ok(Event::default().event("fiber-ops-error").data(json!({
                        "message": "Fiber operations data unavailable", "observedAt": Utc::now()
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
    axum::Extension(claims): axum::Extension<auth::Claims>,
    Json(mut request): Json<crate::ai::AiChatRequest>,
) -> ApiResult<Json<crate::ai::AiChatResponse>> {
    request.wallet_address = Some(claims.sub);
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
