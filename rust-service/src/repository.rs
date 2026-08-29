use crate::{
    error::ApiResult,
    models::{TrackTransactionRequest, TrackedTransactionResponse},
};
use chrono::{Duration, Utc};
use sqlx::PgPool;

#[derive(Clone)]
pub struct TransactionRepository {
    pool: PgPool,
}

impl TransactionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn upsert(
        &self,
        request: &TrackTransactionRequest,
        status: &str,
        network: &str,
    ) -> ApiResult<TrackedTransactionResponse> {
        let now = Utc::now();

        let tx = sqlx::query_as::<_, TrackedTransactionResponse>(
            r#"
            INSERT INTO tracked_transactions (
                tx_hash, wallet_address, recipient, amount_ckb,
                direction, status, network, created_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
            ON CONFLICT (tx_hash)
            DO UPDATE SET
                wallet_address = EXCLUDED.wallet_address,
                recipient = EXCLUDED.recipient,
                amount_ckb = EXCLUDED.amount_ckb,
                direction = EXCLUDED.direction,
                status = EXCLUDED.status,
                network = EXCLUDED.network,
                updated_at = EXCLUDED.updated_at
            RETURNING
                tx_hash, wallet_address, recipient, amount_ckb,
                direction, status, network, created_at, updated_at
            "#,
        )
        .bind(&request.tx_hash)
        .bind(&request.wallet_address)
        .bind(&request.recipient)
        .bind(&request.amount_ckb)
        .bind(request.direction.as_deref().unwrap_or("SEND"))
        .bind(status)
        .bind(network)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(tx)
    }

    pub async fn update_status(
        &self,
        tx_hash: &str,
        status: &str,
    ) -> ApiResult<Option<TrackedTransactionResponse>> {
        Ok(sqlx::query_as::<_, TrackedTransactionResponse>(
            r#"
            UPDATE tracked_transactions
            SET status = $2, updated_at = NOW()
            WHERE tx_hash = $1
            RETURNING
                tx_hash, wallet_address, recipient, amount_ckb,
                direction, status, network, created_at, updated_at
            "#,
        )
        .bind(tx_hash)
        .bind(status)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn recent_by_wallet(
        &self,
        address: &str,
        limit: i64,
    ) -> ApiResult<Vec<TrackedTransactionResponse>> {
        Ok(sqlx::query_as::<_, TrackedTransactionResponse>(
            r#"
            SELECT
                tx_hash, wallet_address, recipient, amount_ckb,
                direction, status, network, created_at, updated_at
            FROM tracked_transactions
            WHERE wallet_address = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(address)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn count_by_wallet(&self, address: &str) -> ApiResult<i64> {
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*)::BIGINT FROM tracked_transactions WHERE wallet_address = $1",
        )
        .bind(address)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }
}

use crate::models::{AssetEventResponse, CreateAssetEventRequest};

#[derive(Clone)]
pub struct AssetEventRepository {
    pool: PgPool,
}

impl AssetEventRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        request: &CreateAssetEventRequest,
        network: &str,
    ) -> ApiResult<AssetEventResponse> {
        Ok(sqlx::query_as::<_, AssetEventResponse>(
            r#"
            INSERT INTO asset_events (
                asset_kind, action, asset_id, owner_address, display_name,
                symbol, amount, tx_hash, metadata_json, network
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (tx_hash, asset_kind, asset_id, action)
            DO UPDATE SET
                owner_address = EXCLUDED.owner_address,
                display_name = EXCLUDED.display_name,
                symbol = EXCLUDED.symbol,
                amount = EXCLUDED.amount,
                metadata_json = EXCLUDED.metadata_json
            RETURNING id, asset_kind, action, asset_id, owner_address,
                display_name, symbol, amount, tx_hash, metadata_json, network, created_at
            "#,
        )
        .bind(&request.asset_kind)
        .bind(&request.action)
        .bind(&request.asset_id)
        .bind(&request.owner_address)
        .bind(&request.display_name)
        .bind(&request.symbol)
        .bind(&request.amount)
        .bind(&request.tx_hash)
        .bind(&request.metadata_json)
        .bind(network)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn recent_by_owner(
        &self,
        owner: &str,
        limit: i64,
    ) -> ApiResult<Vec<AssetEventResponse>> {
        Ok(sqlx::query_as::<_, AssetEventResponse>(
            r#"
            SELECT id, asset_kind, action, asset_id, owner_address,
                display_name, symbol, amount, tx_hash, metadata_json, network, created_at
            FROM asset_events
            WHERE owner_address = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(owner)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?)
    }
}

use crate::models::{AuthChallengeResponse, IndexedAssetResponse, IndexedAssetUpsert};
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthRepository {
    pool: PgPool,
}

impl AuthRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_challenge(
        &self,
        wallet_address: &str,
        ttl_seconds: i64,
        network: &str,
    ) -> ApiResult<AuthChallengeResponse> {
        let nonce = Uuid::new_v4();
        let expires_at = Utc::now() + Duration::seconds(ttl_seconds);
        let message = format!(
            "CKB Asset Studio authentication\nNetwork: {network}\nWallet: {wallet_address}\nNonce: {nonce}\nExpires: {}",
            expires_at.to_rfc3339()
        );

        Ok(sqlx::query_as::<_, AuthChallengeResponse>(
            r#"
            INSERT INTO wallet_auth_challenges (nonce, wallet_address, message, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING nonce, wallet_address, message, expires_at
            "#,
        )
        .bind(nonce)
        .bind(wallet_address)
        .bind(message)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn get_valid_challenge(
        &self,
        nonce: Uuid,
        wallet_address: &str,
    ) -> ApiResult<Option<AuthChallengeResponse>> {
        Ok(sqlx::query_as::<_, AuthChallengeResponse>(
            r#"
            SELECT nonce, wallet_address, message, expires_at
            FROM wallet_auth_challenges
            WHERE nonce = $1
              AND wallet_address = $2
              AND consumed_at IS NULL
              AND expires_at > NOW()
            "#,
        )
        .bind(nonce)
        .bind(wallet_address)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn consume_challenge(
        &self,
        nonce: Uuid,
        wallet_address: &str,
    ) -> ApiResult<Option<AuthChallengeResponse>> {
        Ok(sqlx::query_as::<_, AuthChallengeResponse>(
            r#"
            UPDATE wallet_auth_challenges
            SET consumed_at = NOW()
            WHERE nonce = $1
              AND wallet_address = $2
              AND consumed_at IS NULL
              AND expires_at > NOW()
            RETURNING nonce, wallet_address, message, expires_at
            "#,
        )
        .bind(nonce)
        .bind(wallet_address)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn delete_expired(&self) -> ApiResult<u64> {
        let result = sqlx::query(
            "DELETE FROM wallet_auth_challenges WHERE expires_at < NOW() - INTERVAL '1 day'",
        )
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }
}

#[derive(Clone)]
pub struct IndexerRepository {
    pool: PgPool,
}

impl IndexerRepository {
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn mark_owner_snapshot_stale(&self, owner: &str, network: &str) -> ApiResult<()> {
        sqlx::query(
            "UPDATE indexed_assets SET is_live = FALSE WHERE owner_address = $1 AND network = $2",
        )
        .bind(owner)
        .bind(network)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn upsert(
        &self,
        asset: &IndexedAssetUpsert,
        network: &str,
    ) -> ApiResult<IndexedAssetResponse> {
        Ok(sqlx::query_as::<_, IndexedAssetResponse>(
            r#"
            INSERT INTO indexed_assets (
                owner_address, asset_kind, asset_id, type_code_hash, type_hash_type,
                type_args, amount_raw, output_data, tx_hash, output_index,
                block_number, network, is_live
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
            ON CONFLICT (network, tx_hash, output_index)
            DO UPDATE SET
                owner_address = EXCLUDED.owner_address,
                asset_kind = EXCLUDED.asset_kind,
                asset_id = EXCLUDED.asset_id,
                type_code_hash = EXCLUDED.type_code_hash,
                type_hash_type = EXCLUDED.type_hash_type,
                type_args = EXCLUDED.type_args,
                amount_raw = EXCLUDED.amount_raw,
                output_data = EXCLUDED.output_data,
                block_number = EXCLUDED.block_number,
                is_live = TRUE,
                last_seen_at = NOW()
            RETURNING id, owner_address, asset_kind, asset_id, type_code_hash,
                type_hash_type, type_args, amount_raw, output_data, tx_hash,
                output_index, block_number, network, is_live, first_seen_at, last_seen_at
            "#,
        )
        .bind(&asset.owner_address)
        .bind(&asset.asset_kind)
        .bind(&asset.asset_id)
        .bind(&asset.type_code_hash)
        .bind(&asset.type_hash_type)
        .bind(&asset.type_args)
        .bind(&asset.amount_raw)
        .bind(&asset.output_data)
        .bind(&asset.tx_hash)
        .bind(asset.output_index)
        .bind(asset.block_number)
        .bind(network)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn live_by_owner(
        &self,
        owner: &str,
        network: &str,
    ) -> ApiResult<Vec<IndexedAssetResponse>> {
        Ok(sqlx::query_as::<_, IndexedAssetResponse>(
            r#"
            SELECT id, owner_address, asset_kind, asset_id, type_code_hash,
                type_hash_type, type_args, amount_raw, output_data, tx_hash,
                output_index, block_number, network, is_live, first_seen_at, last_seen_at
            FROM indexed_assets
            WHERE owner_address = $1 AND network = $2 AND is_live = TRUE
            ORDER BY last_seen_at DESC
            "#,
        )
        .bind(owner)
        .bind(network)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn begin_run(&self, owner: &str, network: &str) -> ApiResult<i64> {
        let (id,): (i64,) = sqlx::query_as(
            "INSERT INTO indexer_runs(owner_address, network, status) VALUES ($1,$2,'RUNNING') RETURNING id",
        )
        .bind(owner)
        .bind(network)
        .fetch_one(&self.pool)
        .await?;
        Ok(id)
    }

    pub async fn finish_run(
        &self,
        id: i64,
        scanned_cells: i32,
        indexed_assets: i32,
        status: &str,
        error_message: Option<&str>,
    ) -> ApiResult<()> {
        sqlx::query(
            r#"
            UPDATE indexer_runs
            SET scanned_cells=$2, indexed_assets=$3, status=$4,
                error_message=$5, completed_at=NOW()
            WHERE id=$1
            "#,
        )
        .bind(id)
        .bind(scanned_cells)
        .bind(indexed_assets)
        .bind(status)
        .bind(error_message)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
