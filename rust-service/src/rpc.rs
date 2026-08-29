use crate::{
    error::{ApiError, ApiResult},
    models::TransactionStatusResponse,
};
use ckb_sdk::rpc::CkbRpcClient;
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::{task, time::sleep};

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
        let url = self.rpc_url.to_string();
        task::spawn_blocking(move || {
            let client = CkbRpcClient::new(&url);
            client
                .get_tip_block_number()
                .map(|value| value.value())
                .map_err(|e| ApiError::Upstream(format!("CKB RPC: {e}")))
        })
        .await
        .map_err(|e| ApiError::Internal(format!("RPC task failed: {e}")))?
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
                        ApiError::Upstream(format!("Invalid CKB RPC response: {e}"))
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
                    last_error = Some(format!("CKB RPC request failed: {error}"));
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
