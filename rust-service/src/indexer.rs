use crate::{
    error::{ApiError, ApiResult},
    models::{IndexedAssetResponse, IndexedAssetUpsert, IndexerSyncResponse},
    state::AppState,
};
use ckb_sdk::Address;
use ckb_types::packed::Script;
use serde_json::{Value, json};
use std::str::FromStr;

const PAGE_LIMIT_HEX: &str = "0x64"; // 100
const MAX_PAGES_PER_SYNC: usize = 20;

pub async fn sync_wallet(state: &AppState, wallet_address: &str) -> ApiResult<IndexerSyncResponse> {
    let search_key = lock_search_key(wallet_address)?;
    let run_id = state
        .indexer
        .begin_run(wallet_address, &state.config.ckb_network)
        .await?;

    let result = collect_assets(state, wallet_address, search_key).await;
    match result {
        Ok((scanned_cells, discovered, cursor)) => {
            state
                .indexer
                .mark_owner_snapshot_stale(wallet_address, &state.config.ckb_network)
                .await?;

            let mut persisted = Vec::with_capacity(discovered.len());
            for asset in &discovered {
                persisted.push(
                    state
                        .indexer
                        .upsert(asset, &state.config.ckb_network)
                        .await?,
                );
            }

            state
                .indexer
                .finish_run(
                    run_id,
                    scanned_cells as i32,
                    persisted.len() as i32,
                    "COMPLETED",
                    None,
                )
                .await?;

            Ok(IndexerSyncResponse {
                wallet_address: wallet_address.to_owned(),
                network: state.config.ckb_network.clone(),
                scanned_cells,
                indexed_assets: persisted.len(),
                cursor,
                assets: persisted,
            })
        }
        Err(error) => {
            let message = error.to_string();
            let _ = state
                .indexer
                .finish_run(run_id, 0, 0, "FAILED", Some(&message))
                .await;
            Err(error)
        }
    }
}

pub async fn live_assets(
    state: &AppState,
    wallet_address: &str,
) -> ApiResult<Vec<IndexedAssetResponse>> {
    state
        .indexer
        .live_by_owner(wallet_address, &state.config.ckb_network)
        .await
}

async fn collect_assets(
    state: &AppState,
    wallet_address: &str,
    search_key: Value,
) -> ApiResult<(usize, Vec<IndexedAssetUpsert>, Option<String>)> {
    let mut cursor: Option<String> = None;
    let mut scanned = 0usize;
    let mut assets = Vec::new();

    for _ in 0..MAX_PAGES_PER_SYNC {
        let page = state
            .rpc
            .get_cells(search_key.clone(), "asc", PAGE_LIMIT_HEX, cursor.as_deref())
            .await?;

        let objects = page
            .get("objects")
            .and_then(Value::as_array)
            .ok_or_else(|| ApiError::Upstream("Indexer response missing objects[]".into()))?;

        scanned += objects.len();
        for cell in objects {
            if let Some(asset) = parse_typed_cell(state, wallet_address, cell)? {
                assets.push(asset);
            }
        }

        let next_cursor = page
            .get("last_cursor")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);

        if objects.len() < 100 || next_cursor == cursor {
            cursor = next_cursor;
            break;
        }
        cursor = next_cursor;
    }

    Ok((scanned, assets, cursor))
}

fn lock_search_key(wallet_address: &str) -> ApiResult<Value> {
    let address = Address::from_str(wallet_address)
        .map_err(|e| ApiError::BadRequest(format!("Invalid CKB address: {e}")))?;
    let script: Script = address.payload().into();

    Ok(json!({
        "script": {
            "code_hash": hex0x(script.code_hash().raw_data().as_ref()),
            "hash_type": hash_type_name(script.hash_type().as_slice()[0]),
            "args": hex0x(script.args().raw_data().as_ref())
        },
        "script_type": "lock",
        "script_search_mode": "exact",
        "with_data": true
    }))
}

fn parse_typed_cell(
    state: &AppState,
    wallet_address: &str,
    cell: &Value,
) -> ApiResult<Option<IndexedAssetUpsert>> {
    let output = cell.get("output").unwrap_or(&Value::Null);
    let type_script = output.get("type").filter(|v| !v.is_null());
    let Some(type_script) = type_script else {
        return Ok(None);
    };

    let code_hash = required_str(type_script, "code_hash")?.to_ascii_lowercase();
    let hash_type = required_str(type_script, "hash_type")?.to_owned();
    let args = required_str(type_script, "args")?.to_owned();
    let data = cell
        .get("output_data")
        .and_then(Value::as_str)
        .unwrap_or("0x")
        .to_owned();

    let kind = classify_kind(state, &code_hash);
    let amount_raw = if kind == "XUDT" {
        parse_xudt_amount(&data)
    } else {
        None
    };

    let out_point = cell
        .get("out_point")
        .ok_or_else(|| ApiError::Upstream("Indexer cell missing out_point".into()))?;
    let tx_hash = required_str(out_point, "tx_hash")?.to_owned();
    let output_index = parse_hex_i64(required_str(out_point, "index")?)?;
    let block_number = cell
        .get("block_number")
        .and_then(Value::as_str)
        .map(parse_hex_i64)
        .transpose()?;

    Ok(Some(IndexedAssetUpsert {
        owner_address: wallet_address.to_owned(),
        asset_kind: kind,
        asset_id: args.clone(),
        type_code_hash: code_hash,
        type_hash_type: hash_type,
        type_args: args,
        amount_raw,
        output_data: Some(data),
        tx_hash,
        output_index,
        block_number,
    }))
}

fn classify_kind(state: &AppState, code_hash: &str) -> String {
    let eq = |configured: &Option<String>| {
        configured
            .as_ref()
            .map(|value| value.eq_ignore_ascii_case(code_hash))
            .unwrap_or(false)
    };
    if eq(&state.config.xudt_code_hash) {
        "XUDT".into()
    } else if eq(&state.config.spore_code_hash) {
        "SPORE".into()
    } else if eq(&state.config.spore_cluster_code_hash) {
        "CLUSTER".into()
    } else {
        "TYPED_CELL".into()
    }
}

fn parse_xudt_amount(data: &str) -> Option<String> {
    let bytes = hex::decode(data.trim_start_matches("0x")).ok()?;
    let amount: [u8; 16] = bytes.get(..16)?.try_into().ok()?;
    Some(u128::from_le_bytes(amount).to_string())
}

fn required_str<'a>(value: &'a Value, field: &str) -> ApiResult<&'a str> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::Upstream(format!("Indexer field {field} missing")))
}

fn parse_hex_i64(value: &str) -> ApiResult<i64> {
    i64::from_str_radix(value.trim_start_matches("0x"), 16)
        .map_err(|e| ApiError::Upstream(format!("Invalid indexer hex number {value}: {e}")))
}

fn hash_type_name(value: u8) -> &'static str {
    match value {
        0 => "data",
        1 => "type",
        2 => "data1",
        4 => "data2",
        _ => "type",
    }
}

fn hex0x(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::parse_xudt_amount;

    #[test]
    fn parses_u128_little_endian_amount() {
        assert_eq!(
            parse_xudt_amount("0x01000000000000000000000000000000"),
            Some("1".into())
        );
    }
}
