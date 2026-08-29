CREATE TABLE IF NOT EXISTS fiber_network_resource_snapshots (
    id BIGSERIAL PRIMARY KEY,
    network TEXT NOT NULL,
    runtime TEXT NOT NULL DEFAULT 'wasm',
    resources JSONB NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiber_network_resources_network_time
    ON fiber_network_resource_snapshots(network, captured_at DESC);
