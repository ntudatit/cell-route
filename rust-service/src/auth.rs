use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::http::{HeaderMap, header::AUTHORIZATION};
use chrono::Utc;
use ckb_hash::blake2b_256;
use ckb_sdk::{Address, constants::SIGHASH_TYPE_HASH};
use ckb_types::packed::Script;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use secp256k1::{
    Message, Secp256k1,
    ecdsa::{RecoverableSignature, RecoveryId},
};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub network: String,
    pub iat: usize,
    pub exp: usize,
}

pub fn issue_token(state: &AppState, wallet_address: &str) -> ApiResult<String> {
    let now = Utc::now().timestamp();
    let claims = Claims {
        sub: wallet_address.to_owned(),
        network: state.config.ckb_network.clone(),
        iat: now as usize,
        exp: (now + state.config.jwt_ttl_seconds) as usize,
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(format!("JWT encode failed: {e}")))
}

pub fn authorize(state: &AppState, headers: &HeaderMap) -> ApiResult<Claims> {
    let value = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Missing Authorization: Bearer token".into()))?;

    let token = value
        .strip_prefix("Bearer ")
        .ok_or_else(|| ApiError::Unauthorized("Authorization must use Bearer scheme".into()))?;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| ApiError::Unauthorized("Invalid or expired access token".into()))?;

    if data.claims.network != state.config.ckb_network {
        return Err(ApiError::Unauthorized(
            "JWT network does not match service network".into(),
        ));
    }

    Ok(data.claims)
}

pub fn verify_ckb_secp256k1_message(
    wallet_address: &str,
    message: &str,
    signature_hex: &str,
) -> ApiResult<()> {
    let address = Address::from_str(wallet_address)
        .map_err(|e| ApiError::BadRequest(format!("Invalid CKB address: {e}")))?;

    let lock = Script::from(address.payload());

    if lock.code_hash().raw_data().as_ref() != SIGHASH_TYPE_HASH.as_bytes() {
        return Err(ApiError::BadRequest(
            "Wallet auth currently supports native Secp256k1Blake160 CKB addresses only".into(),
        ));
    }

    let expected_args = lock.args().raw_data();
    if expected_args.len() != 20 {
        return Err(ApiError::BadRequest(
            "Expected a 20-byte Secp256k1Blake160 lock arg".into(),
        ));
    }

    let signature_bytes = hex::decode(signature_hex.trim_start_matches("0x"))
        .map_err(|_| ApiError::BadRequest("Signature must be hex encoded".into()))?;
    if signature_bytes.len() != 65 {
        return Err(ApiError::BadRequest(
            "CkbSecp256k1 signature must be 65 bytes".into(),
        ));
    }

    let rec_id = normalize_recovery_id(signature_bytes[64])?;
    let signature = RecoverableSignature::from_compact(&signature_bytes[..64], rec_id)
        .map_err(|e| ApiError::BadRequest(format!("Invalid recoverable signature: {e}")))?;

    let digest = blake2b_256(format!("Nervos Message:{message}").as_bytes());
    let secp_message = Message::from_digest(digest);
    let secp = Secp256k1::verification_only();
    let pubkey = secp.recover_ecdsa(&secp_message, &signature).map_err(|e| {
        ApiError::Unauthorized(format!("Unable to recover signing public key: {e}"))
    })?;
    let lock_arg = &blake2b_256(&pubkey.serialize())[0..20];

    if lock_arg != expected_args.as_ref() {
        return Err(ApiError::Unauthorized(
            "Signature does not belong to the requested wallet address".into(),
        ));
    }

    Ok(())
}

fn normalize_recovery_id(value: u8) -> ApiResult<RecoveryId> {
    let normalized = match value {
        0..=3 => value,
        27..=30 => value - 27,
        _ => return Err(ApiError::BadRequest("Unsupported recovery id".into())),
    };
    RecoveryId::try_from(normalized as i32)
        .map_err(|e| ApiError::BadRequest(format!("Invalid recovery id: {e}")))
}

#[cfg(test)]
mod tests {
    use super::normalize_recovery_id;

    #[test]
    fn accepts_ckb_and_legacy_recovery_ids() {
        assert!(normalize_recovery_id(0).is_ok());
        assert!(normalize_recovery_id(1).is_ok());
        assert!(normalize_recovery_id(27).is_ok());
        assert!(normalize_recovery_id(28).is_ok());
        assert!(normalize_recovery_id(99).is_err());
    }
}
