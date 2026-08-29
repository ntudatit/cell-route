use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{Json, extract::State, http::HeaderMap};
use serde_json::{Value, json};

fn authorized(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(expected) = state.config.mcp_api_key.as_deref() else {
        return true;
    };
    headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == expected)
        .unwrap_or(false)
        || headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == format!("Bearer {expected}"))
            .unwrap_or(false)
}

fn result(id: Value, value: Value) -> Json<Value> {
    Json(json!({"jsonrpc":"2.0","id":id,"result":value}))
}
fn tool_text(value: Value) -> Value {
    json!({"content":[{"type":"text","text":serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string())}],"isError":false})
}

pub async fn endpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<Value>,
) -> ApiResult<Json<Value>> {
    if !authorized(&state, &headers) {
        return Err(ApiError::Unauthorized("Invalid MCP API key".into()));
    }
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let method = request.get("method").and_then(Value::as_str).unwrap_or("");
    match method {
        "initialize" => Ok(result(
            id,
            json!({
                "protocolVersion": request.pointer("/params/protocolVersion").and_then(Value::as_str).unwrap_or("2024-11-05"),
                "capabilities":{"tools":{"listChanged":false}},
                "serverInfo":{"name":"fiberops-mcp","version":"1.4.0"},
                "instructions":"Read-only FiberOps tools. Payment/channel mutation is intentionally excluded."
            }),
        )),
        "notifications/initialized" => Ok(result(id, json!({}))),
        "ping" => Ok(result(id, json!({}))),
        "tools/list" => Ok(result(
            id,
            json!({"tools":[
                {"name":"fiberops_latest_snapshot","description":"Get the latest browser Fiber WASM telemetry snapshot synced to FiberOps.","inputSchema":{"type":"object","properties":{}}},
                {"name":"fiberops_list_incidents","description":"List open FiberOps incidents.","inputSchema":{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100}}}},
                {"name":"fiberops_search_knowledge","description":"Search the FiberOps RAG knowledge base.","inputSchema":{"type":"object","required":["query"],"properties":{"query":{"type":"string"},"limit":{"type":"integer","minimum":1,"maximum":10}}}},
                {"name":"fiberops_explain","description":"Ask the FiberOps AI copilot to explain an operational question using latest telemetry and RAG. Read-only.","inputSchema":{"type":"object","required":["message"],"properties":{"message":{"type":"string"}}}}
            ]}),
        )),
        "tools/call" => {
            let name = request
                .pointer("/params/name")
                .and_then(Value::as_str)
                .unwrap_or("");
            let args = request
                .pointer("/params/arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            let value = match name {
                "fiberops_latest_snapshot" => state
                    .ai
                    .latest_snapshot(&state.config.ckb_network)
                    .await?
                    .unwrap_or_else(|| json!({"status":"no snapshot"})),
                "fiberops_list_incidents" => {
                    state
                        .ai
                        .list_open_incidents(
                            args.get("limit").and_then(Value::as_i64).unwrap_or(20),
                        )
                        .await?
                }
                "fiberops_search_knowledge" => {
                    let q = args.get("query").and_then(Value::as_str).unwrap_or("");
                    serde_json::to_value(
                        state
                            .ai
                            .search_knowledge(
                                q,
                                args.get("limit").and_then(Value::as_i64).unwrap_or(5),
                            )
                            .await?,
                    )
                    .unwrap_or_else(|_| json!([]))
                }
                "fiberops_explain" => {
                    let message = args.get("message").and_then(Value::as_str).unwrap_or("");
                    serde_json::to_value(
                        state
                            .ai
                            .chat(
                                &state.config.ckb_network,
                                &crate::ai::AiChatRequest {
                                    message: message.into(),
                                    runtime_context: None,
                                    wallet_address: None,
                                    max_chunks: Some(5),
                                },
                            )
                            .await?,
                    )
                    .unwrap_or_else(|_| json!({}))
                }
                _ => {
                    return Ok(result(
                        id,
                        json!({"content":[{"type":"text","text":format!("Unknown tool: {name}")}],"isError":true}),
                    ));
                }
            };
            Ok(result(id, tool_text(value)))
        }
        _ => Ok(Json(
            json!({"jsonrpc":"2.0","id":id,"error":{"code":-32601,"message":format!("Method not found: {method}")}}),
        )),
    }
}
