CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, title)
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_search ON ai_knowledge_chunks USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS fiber_runtime_snapshots (
    id BIGSERIAL PRIMARY KEY,
    network TEXT NOT NULL,
    runtime TEXT NOT NULL DEFAULT 'wasm',
    overview JSONB NOT NULL DEFAULT '{}'::jsonb,
    channels JSONB NOT NULL DEFAULT '{}'::jsonb,
    incidents JSONB NOT NULL DEFAULT '[]'::jsonb,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiber_runtime_snapshots_network_time ON fiber_runtime_snapshots(network, captured_at DESC);

CREATE TABLE IF NOT EXISTS ai_chat_audit (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT,
    question TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    retrieved_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_knowledge_chunks(source,title,content,source_url,tags) VALUES
('fiberops','Payment readiness','Always run Fiber send_payment with dry_run=true before committing funds when an invoice is available. Treat route construction, fee estimation, MPP availability, expiry and liquidity as deterministic checks. The LLM may explain the result but must not override protocol validation.','https://www.fiber.world/docs/api-reference/payments/payment',ARRAY['payment','dry-run','routing']),
('fiberops','Channel liquidity','A channel can be connected and still be unable to route an outbound payment when local liquidity is insufficient. Use local and remote balances, channel readiness, enabled state and pending TLC pressure when diagnosing payment risk.','https://www.fiber.world/docs/concept/routing/multi-hop',ARRAY['channel','liquidity','tlc']),
('fiberops','Safe recovery policy','AI recommendations are advisory. Force-close, abandon-channel, settle hold invoice, rebalance and payment retry actions must require deterministic validation and explicit operator approval. Never expose private keys to the LLM.','',ARRAY['security','approval','recovery']),
('fiberops','Reconciliation','Before retrying a failed or cross-chain payment, compare invoice, payment and CCH order states. If states disagree, create an incident and block duplicate retry until the operator understands both payment legs.','',ARRAY['reconciliation','cch','incident']),
('fiberops','Browser WASM runtime','FiberOps v1.4 runs Fiber through @nervosnetwork/fiber-js in the browser. The node identity and state are stored in IndexedDB and peers use WSS. The Rust backend receives sanitized runtime snapshots for AI/RAG and MCP read-only tools.','https://www.fiber.world/docs/build/sdk/wasm-node',ARRAY['wasm','browser','fiber-js']),
('fiberops','MCP safety boundary','The MCP surface is read-only by default. It exposes current snapshots, incidents and knowledge retrieval. Side-effecting payment or channel tools should be added only behind explicit approval, idempotency keys and policy checks.','',ARRAY['mcp','security','tools'])
ON CONFLICT (source,title) DO UPDATE SET content=EXCLUDED.content, source_url=EXCLUDED.source_url, tags=EXCLUDED.tags, updated_at=NOW();
