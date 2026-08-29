use crate::error::{ApiError, ApiResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::time::Duration;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshotRequest {
    pub overview: Value,
    pub channels: Value,
    pub incidents: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkResourcesRequest {
    pub resources: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub message: String,
    #[serde(default)]
    pub runtime_context: Option<Value>,
    #[serde(default)]
    pub wallet_address: Option<String>,
    #[serde(default)]
    pub max_chunks: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeChunk {
    pub id: i64,
    pub source: String,
    pub title: String,
    pub content: String,
    pub source_url: Option<String>,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub answer: String,
    pub provider: String,
    pub model: Option<String>,
    pub sources: Vec<KnowledgeChunk>,
    pub safety: Value,
}

#[derive(Clone)]
pub struct AiService {
    pool: PgPool,
    client: Client,
    provider: String,
    base_url: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
}

impl AiService {
    pub fn new(
        pool: PgPool,
        provider: String,
        base_url: Option<String>,
        api_key: Option<String>,
        model: Option<String>,
        timeout: Duration,
    ) -> Self {
        Self {
            pool,
            client: Client::builder()
                .timeout(timeout)
                .build()
                .unwrap_or_default(),
            provider,
            base_url,
            api_key,
            model,
        }
    }

    pub async fn save_snapshot(
        &self,
        network: &str,
        snapshot: &RuntimeSnapshotRequest,
    ) -> ApiResult<()> {
        sqlx::query(
            r#"INSERT INTO fiber_runtime_snapshots(network,runtime,overview,channels,incidents)
               VALUES($1,'wasm',$2,$3,$4)"#,
        )
        .bind(network)
        .bind(&snapshot.overview)
        .bind(&snapshot.channels)
        .bind(&snapshot.incidents)
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"DELETE FROM fiber_runtime_snapshots
               WHERE network=$1 AND id NOT IN (
                 SELECT id FROM fiber_runtime_snapshots WHERE network=$1 ORDER BY captured_at DESC LIMIT 100
               )"#,
        )
        .bind(network)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn latest_snapshot(&self, network: &str) -> ApiResult<Option<Value>> {
        let row = sqlx::query(
            "SELECT overview,channels,incidents,captured_at FROM fiber_runtime_snapshots WHERE network=$1 ORDER BY captured_at DESC LIMIT 1",
        )
        .bind(network)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|r| {
            json!({
                "overview": r.get::<Value,_>("overview"),
                "channels": r.get::<Value,_>("channels"),
                "incidents": r.get::<Value,_>("incidents"),
                "capturedAt": r.get::<chrono::DateTime<chrono::Utc>,_>("captured_at")
            })
        }))
    }

    pub async fn save_network_resources(&self, network: &str, resources: &Value) -> ApiResult<()> {
        sqlx::query("INSERT INTO fiber_network_resource_snapshots(network,runtime,resources) VALUES($1,'wasm',$2)")
            .bind(network)
            .bind(resources)
            .execute(&self.pool)
            .await?;
        sqlx::query(
            r#"DELETE FROM fiber_network_resource_snapshots
               WHERE network=$1 AND id NOT IN (
                 SELECT id FROM fiber_network_resource_snapshots WHERE network=$1 ORDER BY captured_at DESC LIMIT 100
               )"#,
        )
        .bind(network)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn latest_network_resources(&self, network: &str) -> ApiResult<Option<Value>> {
        let row = sqlx::query(
            "SELECT resources,captured_at FROM fiber_network_resource_snapshots WHERE network=$1 ORDER BY captured_at DESC LIMIT 1",
        )
        .bind(network)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|row| {
            json!({
                "network": network,
                "runtime": "wasm",
                "resources": row.get::<Value,_>("resources"),
                "capturedAt": row.get::<chrono::DateTime<chrono::Utc>,_>("captured_at")
            })
        }))
    }

    pub async fn search_knowledge(
        &self,
        query: &str,
        limit: i64,
    ) -> ApiResult<Vec<KnowledgeChunk>> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(vec![]);
        }
        let rows = sqlx::query(
            r#"SELECT id,source,title,content,source_url,
               ts_rank(search_vector, plainto_tsquery('english',$1)) AS score
               FROM ai_knowledge_chunks
               WHERE search_vector @@ plainto_tsquery('english',$1)
                  OR title ILIKE '%' || $1 || '%'
                  OR content ILIKE '%' || $1 || '%'
               ORDER BY score DESC, updated_at DESC
               LIMIT $2"#,
        )
        .bind(query)
        .bind(limit.clamp(1, 10))
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| KnowledgeChunk {
                id: r.get("id"),
                source: r.get("source"),
                title: r.get("title"),
                content: r.get("content"),
                source_url: r.get("source_url"),
                score: r.try_get::<f32, _>("score").unwrap_or(0.0),
            })
            .collect())
    }

    pub async fn list_open_incidents(&self, limit: i64) -> ApiResult<Value> {
        let rows = sqlx::query(
            r#"SELECT id, incident_type, severity, status, subject_type, subject_id,
               title, diagnosis, recommendation, context_json, last_seen_at
               FROM fiber_incidents WHERE status='OPEN'
               ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
                        last_seen_at DESC LIMIT $1"#,
        )
        .bind(limit.clamp(1, 100))
        .fetch_all(&self.pool)
        .await?;
        let values: Vec<Value> = rows
            .into_iter()
            .map(|r| {
                json!({
                    "id": r.get::<i64,_>("id"),
                    "incidentType": r.get::<String,_>("incident_type"),
                    "severity": r.get::<String,_>("severity"),
                    "status": r.get::<String,_>("status"),
                    "subjectType": r.get::<String,_>("subject_type"),
                    "subjectId": r.get::<String,_>("subject_id"),
                    "title": r.get::<String,_>("title"),
                    "diagnosis": r.get::<String,_>("diagnosis"),
                    "recommendation": r.get::<Option<String>,_>("recommendation"),
                    "context": r.get::<Value,_>("context_json"),
                    "lastSeenAt": r.get::<chrono::DateTime<chrono::Utc>,_>("last_seen_at")
                })
            })
            .collect();
        Ok(Value::Array(values))
    }

    pub async fn chat(&self, network: &str, req: &AiChatRequest) -> ApiResult<AiChatResponse> {
        let message = req.message.trim();
        if message.is_empty() {
            return Err(ApiError::BadRequest("message is required".into()));
        }
        if message.len() > 12_000 {
            return Err(ApiError::BadRequest("message is too long".into()));
        }

        let sources = self
            .search_knowledge(message, req.max_chunks.unwrap_or(5))
            .await?;
        let runtime = match &req.runtime_context {
            Some(v) => v.clone(),
            None => self
                .latest_snapshot(network)
                .await?
                .unwrap_or_else(|| json!({"status":"no-runtime-snapshot"})),
        };
        let safety = json!({
            "readOnly": true,
            "privateKeysSentToLlm": false,
            "automaticPayments": false,
            "operatorApprovalRequiredForRecovery": true
        });

        let answer = if self.provider.eq_ignore_ascii_case("disabled")
            || self.base_url.is_none()
            || self.model.is_none()
        {
            self.deterministic_answer(message, &runtime, &sources)
        } else {
            self.call_openai_compatible(message, &runtime, &sources)
                .await?
        };

        let provider = if self.provider.eq_ignore_ascii_case("disabled")
            || self.base_url.is_none()
            || self.model.is_none()
        {
            "deterministic-rag".to_string()
        } else {
            self.provider.clone()
        };

        let source_audit: Vec<Value> = sources
            .iter()
            .map(|s| json!({"id":s.id,"source":s.source,"title":s.title}))
            .collect();
        sqlx::query("INSERT INTO ai_chat_audit(wallet_address,question,provider,model,retrieved_sources) VALUES($1,$2,$3,$4,$5)")
            .bind(req.wallet_address.as_deref())
            .bind(message)
            .bind(&provider)
            .bind(self.model.as_deref())
            .bind(Value::Array(source_audit))
            .execute(&self.pool).await?;

        Ok(AiChatResponse {
            answer,
            provider,
            model: self.model.clone(),
            sources,
            safety,
        })
    }

    fn deterministic_answer(
        &self,
        message: &str,
        runtime: &Value,
        sources: &[KnowledgeChunk],
    ) -> String {
        let overview = runtime.get("overview").unwrap_or(runtime);
        let channels = overview
            .get("channels")
            .and_then(Value::as_u64)
            .map(|v| v.to_string())
            .unwrap_or_else(|| "unknown".into());
        let incidents = overview
            .get("openIncidents")
            .and_then(Value::as_u64)
            .map(|v| v.to_string())
            .unwrap_or_else(|| "unknown".into());
        let titles = if sources.is_empty() {
            "No matching knowledge chunks were found.".into()
        } else {
            sources
                .iter()
                .map(|s| s.title.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        };
        format!(
            "FiberOps AI is running in deterministic RAG mode because no external LLM is configured.\n\nQuestion: {message}\n\nCurrent runtime summary: channels={channels}, open incidents={incidents}.\n\nRelevant knowledge: {titles}\n\nRecommended workflow: validate the issue with deterministic Fiber/WASM telemetry first, inspect channel/payment state, then use the retrieved guidance. Any payment, channel close, rebalance, retry, or settlement action requires explicit operator approval."
        )
    }

    async fn call_openai_compatible(
        &self,
        message: &str,
        runtime: &Value,
        sources: &[KnowledgeChunk],
    ) -> ApiResult<String> {
        let base = self
            .base_url
            .as_deref()
            .ok_or_else(|| ApiError::Internal("AI_BASE_URL is missing".into()))?
            .trim_end_matches('/');
        let endpoint = format!("{base}/chat/completions");
        let docs = sources
            .iter()
            .enumerate()
            .map(|(i, s)| {
                format!(
                    "[{}] {}\n{}\nSource: {}",
                    i + 1,
                    s.title,
                    s.content,
                    s.source_url.as_deref().unwrap_or("internal")
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n");
        let system = format!(
            "You are FiberOps AI, an operations copilot for Nervos Fiber. Use deterministic telemetry and retrieved knowledge, not guesses. Never request or reveal private keys. Never claim that an action was executed. Side-effecting actions require operator approval. If evidence is insufficient, say what telemetry is missing.\n\nRUNTIME SNAPSHOT:\n{}\n\nRETRIEVED KNOWLEDGE:\n{}",
            serde_json::to_string_pretty(runtime).unwrap_or_else(|_| "{}".into()),
            docs
        );
        let mut request = self.client.post(endpoint).json(&json!({
            "model": self.model,
            "temperature": 0.2,
            "messages": [
                {"role":"system","content":system},
                {"role":"user","content":message}
            ]
        }));
        if let Some(key) = &self.api_key {
            request = request.bearer_auth(key);
        }
        let response = request
            .send()
            .await
            .map_err(|e| ApiError::Upstream(format!("LLM request failed: {e}")))?;
        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|e| ApiError::Upstream(format!("Invalid LLM response: {e}")))?;
        if !status.is_success() {
            return Err(ApiError::Upstream(format!("LLM returned {status}: {body}")));
        }
        body.pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| {
                ApiError::Upstream("LLM response did not contain choices[0].message.content".into())
            })
    }
}
