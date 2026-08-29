use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMerchantOrderRequest {
    pub customer_reference: Option<String>,
    pub amount_raw: String,
    pub asset_kind: Option<String>,
    pub description: Option<String>,
    pub payment_hash: Option<String>,
    pub invoice_address: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMerchantOrderRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentAttemptRequest {
    pub payment_hash: Option<String>,
    pub status: String,
    pub fee_raw: Option<String>,
    pub route_parts: Option<i32>,
    pub failure: Option<String>,
    #[serde(default)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MerchantOrderResponse {
    pub id: uuid::Uuid,
    pub merchant_wallet: String,
    pub customer_reference: Option<String>,
    pub amount_raw: String,
    pub asset_kind: String,
    pub description: Option<String>,
    pub status: String,
    pub payment_hash: Option<String>,
    pub invoice_address: Option<String>,
    pub network: String,
    pub paid_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackTransactionRequest {
    pub tx_hash: String,
    pub wallet_address: String,
    pub recipient: Option<String>,
    pub amount_ckb: Option<String>,
    pub direction: Option<String>,
}

impl TrackTransactionRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.wallet_address.trim().is_empty() {
            return Err("walletAddress is required".into());
        }

        if self.tx_hash.len() != 66
            || !self.tx_hash.starts_with("0x")
            || !self.tx_hash[2..].chars().all(|c| c.is_ascii_hexdigit())
        {
            return Err("txHash must be a 32-byte 0x-prefixed hash".into());
        }

        if let Some(direction) = &self.direction {
            if direction != "SEND" && direction != "RECEIVE" {
                return Err("direction must be SEND or RECEIVE".into());
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackedTransactionResponse {
    pub tx_hash: String,
    pub wallet_address: String,
    pub recipient: Option<String>,
    pub amount_ckb: Option<String>,
    pub direction: String,
    pub status: String,
    pub network: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionStatusResponse {
    pub tx_hash: String,
    pub status: String,
    pub block_hash: Option<String>,
    pub reason: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardResponse {
    pub network: String,
    pub tip_block_number: String,
    pub tracked_transactions: i64,
    pub recent_transactions: Vec<TrackedTransactionResponse>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetEventRequest {
    pub asset_kind: String,
    pub action: String,
    pub asset_id: String,
    pub owner_address: String,
    pub display_name: Option<String>,
    pub symbol: Option<String>,
    pub amount: Option<String>,
    pub tx_hash: String,
    pub metadata_json: Option<String>,
}

impl CreateAssetEventRequest {
    pub fn validate(&self) -> Result<(), String> {
        if !matches!(self.asset_kind.as_str(), "XUDT" | "SPORE" | "CLUSTER") {
            return Err("assetKind must be XUDT, SPORE, or CLUSTER".into());
        }
        if !matches!(
            self.action.as_str(),
            "CREATE" | "MINT" | "TRANSFER" | "MELT"
        ) {
            return Err("action must be CREATE, MINT, TRANSFER, or MELT".into());
        }
        if self.asset_id.trim().is_empty() || self.owner_address.trim().is_empty() {
            return Err("assetId and ownerAddress are required".into());
        }
        if self.tx_hash.len() != 66
            || !self.tx_hash.starts_with("0x")
            || !self.tx_hash[2..].chars().all(|c| c.is_ascii_hexdigit())
        {
            return Err("txHash must be a 32-byte 0x-prefixed hash".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AssetEventResponse {
    pub id: i64,
    pub asset_kind: String,
    pub action: String,
    pub asset_id: String,
    pub owner_address: String,
    pub display_name: Option<String>,
    pub symbol: Option<String>,
    pub amount: Option<String>,
    pub tx_hash: String,
    pub metadata_json: Option<String>,
    pub network: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthChallengeRequest {
    pub wallet_address: String,
}

impl AuthChallengeRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.wallet_address.trim().is_empty() {
            return Err("walletAddress is required".into());
        }
        if !(self.wallet_address.starts_with("ckt1") || self.wallet_address.starts_with("ckb1")) {
            return Err("walletAddress must be a CKB mainnet/testnet address".into());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AuthChallengeResponse {
    pub nonce: uuid::Uuid,
    pub wallet_address: String,
    pub message: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthVerifyRequest {
    pub wallet_address: String,
    pub nonce: uuid::Uuid,
    pub signature: String,
    pub sign_type: String,
}

impl AuthVerifyRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.wallet_address.trim().is_empty() {
            return Err("walletAddress is required".into());
        }
        if self.signature.trim().is_empty() {
            return Err("signature is required".into());
        }
        if self.sign_type != "CkbSecp256k1" {
            return Err("This Rust verifier currently supports CCC CkbSecp256k1 message signatures. Use a native CKB signer for authenticated API actions.".into());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub wallet_address: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct IndexedAssetResponse {
    pub id: i64,
    pub owner_address: String,
    pub asset_kind: String,
    pub asset_id: String,
    pub type_code_hash: String,
    pub type_hash_type: String,
    pub type_args: String,
    pub amount_raw: Option<String>,
    pub output_data: Option<String>,
    pub tx_hash: String,
    pub output_index: i64,
    pub block_number: Option<i64>,
    pub network: String,
    pub is_live: bool,
    pub first_seen_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerSyncRequest {
    pub wallet_address: String,
}

impl IndexerSyncRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.wallet_address.trim().is_empty() {
            return Err("walletAddress is required".into());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerSyncResponse {
    pub wallet_address: String,
    pub network: String,
    pub scanned_cells: usize,
    pub indexed_assets: usize,
    pub cursor: Option<String>,
    pub assets: Vec<IndexedAssetResponse>,
}

#[derive(Debug, Clone)]
pub struct IndexedAssetUpsert {
    pub owner_address: String,
    pub asset_kind: String,
    pub asset_id: String,
    pub type_code_hash: String,
    pub type_hash_type: String,
    pub type_args: String,
    pub amount_raw: Option<String>,
    pub output_data: Option<String>,
    pub tx_hash: String,
    pub output_index: i64,
    pub block_number: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionLifecycleEvent {
    pub tx_hash: String,
    pub status: String,
    pub block_hash: Option<String>,
    pub observed_at: DateTime<Utc>,
    pub terminal: bool,
}
