use crate::{
    error::{ApiError, ApiResult},
    models::TransactionStatusResponse,
};
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::time::sleep;

pub fn public_genesis(network: &str) -> Option<&'static str> {
    match network {
        "mainnet" => Some("0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5"),
        "testnet" => Some("0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606"),
        _ => None,
    }
}

#[derive(Clone)]
pub struct CkbRpcService {
    rpc_url: Arc<String>,
    indexer_url: Arc<String>,
    http: reqwest::Client,
}

impl CkbRpcService {
    pub fn new(rpc_url: String, indexer_url: String, timeout: Duration) -> Self {
        let http = reqwest::Client::builder()
            .timeout(timeout)
            .pool_idle_timeout(Duration::from_secs(30))
            .build()
            .expect("reqwest client");
        Self {
            rpc_url: Arc::new(rpc_url),
            indexer_url: Arc::new(indexer_url),
            http,
        }
    }

    pub async fn tip_block_number(&self) -> ApiResult<u64> {
        let result = self
            .call(self.rpc_url.as_str(), "get_tip_block_number", json!([]))
            .await?;
        result
            .as_str()
            .and_then(|value| value.strip_prefix("0x"))
            .and_then(|value| u64::from_str_radix(value, 16).ok())
            .ok_or_else(|| ApiError::Upstream("Invalid CKB tip block number".into()))
    }

    pub async fn check_chain(&self, network: &str) -> ApiResult<()> {
        let Some(expected) = public_genesis(network) else {
            return Ok(());
        };
        let genesis = self
            .call(self.rpc_url.as_str(), "get_block_hash", json!(["0x0"]))
            .await?;
        if genesis.as_str() != Some(expected) {
            return Err(ApiError::Unavailable(
                "CKB RPC genesis does not match CKB_NETWORK".into(),
            ));
        }
        Ok(())
    }

    pub async fn transaction(&self, tx_hash: &str) -> ApiResult<Value> {
        self.call(self.rpc_url.as_str(), "get_transaction", json!([tx_hash]))
            .await
    }

    pub async fn transaction_status(&self, tx_hash: &str) -> ApiResult<TransactionStatusResponse> {
        let result = self.transaction(tx_hash).await?;
        if result.is_null() {
            return Ok(TransactionStatusResponse {
                tx_hash: tx_hash.to_owned(),
                status: "not_found".into(),
                block_hash: None,
                reason: None,
            });
        }

        let tx_status = result.get("tx_status").cloned().unwrap_or(Value::Null);
        Ok(TransactionStatusResponse {
            tx_hash: tx_hash.to_owned(),
            status: tx_status
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_owned(),
            block_hash: tx_status
                .get("block_hash")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned),
            reason: tx_status.get("reason").filter(|v| !v.is_null()).cloned(),
        })
    }

    pub async fn get_cells(
        &self,
        search_key: Value,
        order: &str,
        limit_hex: &str,
        cursor: Option<&str>,
    ) -> ApiResult<Value> {
        let mut params = vec![search_key, json!(order), json!(limit_hex)];
        if let Some(cursor) = cursor {
            params.push(json!(cursor));
        }
        self.call(self.indexer_url.as_str(), "get_cells", Value::Array(params))
            .await
    }

    async fn call(&self, url: &str, method: &str, params: Value) -> ApiResult<Value> {
        let mut last_error = None;
        for attempt in 0..3u64 {
            let result = self
                .http
                .post(url)
                .json(&json!({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": params.clone()
                }))
                .send()
                .await;

            match result {
                Ok(response) if response.status().is_success() => {
                    let body: Value = response.json().await.map_err(|e| {
                        ApiError::Upstream(format!("Invalid CKB RPC response: {}", e.without_url()))
                    })?;
                    if let Some(error) = body.get("error").filter(|v| !v.is_null()) {
                        return Err(ApiError::Upstream(format!("CKB RPC error: {error}")));
                    }
                    return Ok(body.get("result").cloned().unwrap_or(Value::Null));
                }
                Ok(response) => {
                    last_error = Some(format!("CKB RPC HTTP {}", response.status()));
                }
                Err(error) => {
                    last_error = Some(format!("CKB RPC request failed: {}", error.without_url()));
                }
            }

            if attempt < 2 {
                sleep(Duration::from_millis(150 * (attempt + 1))).await;
            }
        }

        Err(ApiError::Upstream(
            last_error.unwrap_or_else(|| "CKB RPC request failed".into()),
        ))
    }
}
