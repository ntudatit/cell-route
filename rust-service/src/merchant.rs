use crate::{
    auth,
    error::{ApiError, ApiResult},
    fiber::{InvoiceStatus, check_invoice, invoice_hash},
    models::{CreateMerchantOrderRequest, MerchantOrderResponse, UpdateMerchantOrderRequest},
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub fn merchant(state: &AppState, headers: &HeaderMap) -> ApiResult<auth::Claims> {
    let claims = auth::authorize(state, headers)?;
    match state.config.fiber_merchant_wallet.as_deref() {
        Some(wallet) if wallet == claims.sub => Ok(claims),
        Some(_) => Err(ApiError::Forbidden(
            "Merchant receiver access is required".into(),
        )),
        None => Err(ApiError::Unavailable(
            "Merchant receiver is not configured".into(),
        )),
    }
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateMerchantOrderRequest>,
) -> ApiResult<Json<MerchantOrderResponse>> {
    let claims = merchant(&state, &headers)?;
    let key = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .filter(|key| !key.trim().is_empty() && key.len() <= 128)
        .ok_or_else(|| {
            ApiError::BadRequest("Idempotency-Key is required (1 to 128 characters)".into())
        })?;
    let amount = request
        .amount_raw
        .parse::<u128>()
        .ok()
        .filter(|amount| *amount > 0)
        .ok_or_else(|| ApiError::BadRequest("amountRaw must be a positive integer".into()))?;
    if request.asset_kind.as_deref().unwrap_or("CKB") != "CKB"
        || request.payment_hash.is_some()
        || request.invoice_address.is_some()
    {
        return Err(ApiError::BadRequest(
            "Orders require a server-issued CKB invoice".into(),
        ));
    }
    if request.description.as_ref().is_some_and(|v| v.len() > 256)
        || request
            .customer_reference
            .as_ref()
            .is_some_and(|v| v.len() > 128)
    {
        return Err(ApiError::BadRequest(
            "Order description or customer reference is too long".into(),
        ));
    }
    let amount_raw = amount.to_string();
    let network = &state.config.ckb_network;
    let mut tx = state.indexer.pool().begin().await?;
    // Serialize issuance for this receiver without queueing a connection behind an RPC.
    let acquired: bool =
        sqlx::query_scalar("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(format!("fiber-merchant:{network}:{}", claims.sub))
            .fetch_one(&mut *tx)
            .await?;
    if !acquired {
        return Err(ApiError::Conflict(
            "Order creation is in progress; retry with the same key".into(),
        ));
    }
    let existing = sqlx::query_as::<_, MerchantOrderResponse>(
        "SELECT * FROM merchant_orders WHERE merchant_wallet=$1 AND network=$2 AND idempotency_key=$3")
        .bind(&claims.sub).bind(network).bind(key).fetch_optional(&mut *tx).await?;
    if let Some(order) = existing {
        if order.amount_raw != amount_raw
            || order.description != request.description
            || order.customer_reference != request.customer_reference
            || order.fiber_receiver_pubkey.is_none()
        {
            return Err(ApiError::Conflict(
                "Idempotency-Key belongs to a different or legacy order".into(),
            ));
        }
        tx.commit().await?;
        return Ok(Json(order));
    }
    let currency = state.fiber.check_receiver(network).await?;
    let invoice = state
        .fiber
        .new_invoice(amount, request.description.clone(), Some(900), currency)
        .await?;
    let hash = invoice_hash(&invoice)
        .ok_or_else(|| ApiError::Upstream("Missing Fiber invoice hash".into()))?;
    let address = invoice
        .get("invoice_address")
        .and_then(|v| v.as_str())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ApiError::Upstream("Missing Fiber invoice address".into()))?;
    let receiver = state.fiber.receiver_pubkey()?;
    check_invoice(&invoice, hash, address, amount, currency, receiver)?;
    let order = sqlx::query_as::<_, MerchantOrderResponse>(r#"INSERT INTO merchant_orders
        (id,merchant_wallet,customer_reference,amount_raw,description,status,payment_hash,invoice_address,network,idempotency_key,fiber_receiver_pubkey)
        VALUES($1,$2,$3,$4,$5,'PAYMENT_PENDING',$6,$7,$8,$9,$10) RETURNING *"#)
        .bind(Uuid::new_v4()).bind(&claims.sub).bind(&request.customer_reference)
        .bind(&amount_raw).bind(&request.description).bind(hash).bind(address)
        .bind(network).bind(key).bind(receiver).fetch_one(&mut *tx).await?;
    audit(&mut tx, &order, "ORDER_CREATED").await?;
    tx.commit().await?;
    Ok(Json(order))
}

pub async fn reconcile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<MerchantOrderResponse>> {
    let claims = merchant(&state, &headers)?;
    let network = &state.config.ckb_network;
    let pool = state.indexer.pool();
    let order = sqlx::query_as::<_, MerchantOrderResponse>(
        "SELECT * FROM merchant_orders WHERE id=$1 AND merchant_wallet=$2 AND network=$3",
    )
    .bind(id)
    .bind(&claims.sub)
    .bind(network)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("Merchant order not found".into()))?;
    if order.status == "PAYMENT_UNVERIFIED" {
        return Err(ApiError::Conflict(
            "Legacy invoice has no verified receiver binding".into(),
        ));
    }
    if order.status != "PAYMENT_PENDING" {
        return Ok(Json(order));
    }
    let receiver = state.fiber.receiver_pubkey()?;
    let (Some(hash), Some(address)) = (&order.payment_hash, &order.invoice_address) else {
        return Err(ApiError::Conflict(
            "Order has no bound Fiber invoice".into(),
        ));
    };
    if order.asset_kind != "CKB" || order.fiber_receiver_pubkey.as_deref() != Some(receiver) {
        return Err(ApiError::Conflict(
            "Order receiver or asset does not match configuration".into(),
        ));
    }
    let amount = order
        .amount_raw
        .parse::<u128>()
        .map_err(|_| ApiError::Internal("Invalid stored order amount".into()))?;
    let currency = state.fiber.check_receiver(network).await?;
    let invoice = state.fiber.get_invoice(hash).await?;
    check_invoice(&invoice, hash, address, amount, currency, receiver)?;
    let status = match InvoiceStatus::read(&invoice)? {
        InvoiceStatus::Open | InvoiceStatus::Received => return Ok(Json(order)),
        InvoiceStatus::Paid => "PAID",
        InvoiceStatus::Cancelled => "CANCELLED",
        InvoiceStatus::Expired => "EXPIRED",
    };

    let mut tx = pool.begin().await?;
    let updated = sqlx::query_as::<_, MerchantOrderResponse>(
        r#"UPDATE merchant_orders
        SET status=$4, paid_at=CASE WHEN $4='PAID' THEN NOW() END,
            settlement_verified_at=CASE WHEN $4='PAID' THEN NOW() END, updated_at=NOW()
        WHERE id=$1 AND merchant_wallet=$2 AND network=$3 AND status='PAYMENT_PENDING'
        RETURNING *"#,
    )
    .bind(id)
    .bind(&claims.sub)
    .bind(network)
    .bind(status)
    .fetch_optional(&mut *tx)
    .await?;
    let updated = match updated {
        Some(updated) => {
            audit(&mut tx, &updated, "FIBER_INVOICE_VERIFIED").await?;
            updated
        }
        None => sqlx::query_as::<_, MerchantOrderResponse>(
            "SELECT * FROM merchant_orders WHERE id=$1 AND merchant_wallet=$2 AND network=$3",
        )
        .bind(id)
        .bind(&claims.sub)
        .bind(network)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| ApiError::NotFound("Merchant order not found".into()))?,
    };
    tx.commit().await?;
    Ok(Json(updated))
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateMerchantOrderRequest>,
) -> ApiResult<Json<MerchantOrderResponse>> {
    let claims = merchant(&state, &headers)?;
    let previous = match request.status.as_str() {
        "FULFILLMENT_PENDING" => "PAID",
        "COMPLETED" => "FULFILLMENT_PENDING",
        _ => {
            return Err(ApiError::BadRequest(
                "Payment status is set only by Fiber reconciliation".into(),
            ));
        }
    };
    let mut tx = state.indexer.pool().begin().await?;
    let updated = sqlx::query_as::<_, MerchantOrderResponse>(
        r#"UPDATE merchant_orders
        SET status=$4, updated_at=NOW()
        WHERE id=$1 AND merchant_wallet=$2 AND network=$3 AND status=$5
          AND settlement_verified_at IS NOT NULL RETURNING *"#,
    )
    .bind(id)
    .bind(&claims.sub)
    .bind(&state.config.ckb_network)
    .bind(&request.status)
    .bind(previous)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ApiError::Conflict(
            "Order is unavailable or has not reached the required verified status".into(),
        )
    })?;
    audit(&mut tx, &updated, "ORDER_STATUS_CHANGED").await?;
    tx.commit().await?;
    Ok(Json(updated))
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    order: &MerchantOrderResponse,
    action: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"INSERT INTO audit_logs(actor_wallet,action,subject_type,subject_id,context,network)
        VALUES($1,$2,'MERCHANT_ORDER',$3,$4,$5)"#,
    )
    .bind(&order.merchant_wallet)
    .bind(action)
    .bind(order.id.to_string())
    .bind(json!({"status": order.status, "paymentHash": order.payment_hash}))
    .bind(&order.network)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
