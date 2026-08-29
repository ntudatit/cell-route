# FiberOps AI v1.4

FiberOps AI extends the browser-WASM FiberOps Control Center with:

- AI Operations Copilot (`/fiber-ai`)
- PostgreSQL RAG knowledge base
- sanitized Browser Fiber WASM telemetry snapshots
- read-only MCP JSON-RPC endpoint (`POST /mcp`)
- AI chat audit trail
- deterministic RAG fallback when no LLM provider is configured

## Run

### 1. PostgreSQL + Rust API

```powershell
cd rust-service
copy .env.example .env
cargo run
```

Migrations automatically create the AI/RAG tables and seed FiberOps runbook chunks.

### 2. Portal

```powershell
cd portal
copy .env.example .env
npm install
npm run dev
```

Open:

- `http://localhost:5173/fiber-node.html` to start/inspect the isolated Fiber WASM node
- `http://localhost:5173/fiber-ops` for operations telemetry
- `http://localhost:5173/fiber-ai` for the AI Copilot

### 3. Optional LLM

Default `.env` runs without an external LLM:

```env
AI_PROVIDER=disabled
```

For an OpenAI-compatible endpoint:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:1234/v1
AI_API_KEY=
AI_MODEL=your-model
```

The Rust service calls `${AI_BASE_URL}/chat/completions`.

### 4. MCP

Protect MCP outside local development:

```env
MCP_API_KEY=replace-with-long-random-secret
```

Endpoint:

```text
POST http://localhost:8080/mcp
```

Tools are read-only:

- `fiberops_latest_snapshot`
- `fiberops_list_incidents`
- `fiberops_search_knowledge`
- `fiberops_explain`

Test on Windows:

```powershell
$env:MCP_API_KEY="replace-with-long-random-secret"
.\scripts\test-mcp.ps1
```

## Security model

The Fiber private key and CKB key stay inside the browser WASM runtime/IndexedDB. Only sanitized operational telemetry is synced to the Rust service. LLM/MCP cannot send payments, close channels, rebalance, settle invoices or execute recovery actions.
