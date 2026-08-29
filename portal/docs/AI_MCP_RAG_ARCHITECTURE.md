# FiberOps AI v1.4 — AI Copilot + RAG + MCP

## Product boundary

Fiber remains the primary protocol/runtime. AI is an operations layer, not a replacement for Fiber validation.

- Browser: `@nervosnetwork/fiber-js@0.9.0` owns the Fiber WASM node and keys.
- Portal: gathers sanitized telemetry and provides the AI Copilot UI.
- Rust/Axum: RAG, LLM orchestration, audit, cached WASM telemetry, and read-only MCP tools.
- PostgreSQL: knowledge chunks, runtime snapshots, incidents, AI chat audit.

## AI endpoints

- `POST /api/ai/chat`
- `GET /api/ai/knowledge/search?q=...`
- `POST /api/fiber/runtime/snapshot`
- `POST /mcp`

## LLM configuration

The service works without an LLM using deterministic RAG mode.

```env
AI_PROVIDER=disabled
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

To use an OpenAI-compatible chat-completions provider:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:1234/v1
AI_API_KEY=
AI_MODEL=your-model
```

The server calls `${AI_BASE_URL}/chat/completions`.

## MCP tools

- `fiberops_latest_snapshot`
- `fiberops_list_incidents`
- `fiberops_search_knowledge`
- `fiberops_explain`

All tools are read-only. Set `MCP_API_KEY` outside local development.

## Safety

1. Fiber private keys never leave wallet/browser runtime.
2. The LLM receives sanitized operational state only.
3. No send-payment, force-close, abandon, rebalance or settlement MCP tools.
4. AI recommendations never count as execution.
5. Future write tools require policy checks, idempotency keys and operator approval.
