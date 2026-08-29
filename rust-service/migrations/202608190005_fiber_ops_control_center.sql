CREATE TABLE IF NOT EXISTS fiber_channel_snapshots (
    id BIGSERIAL PRIMARY KEY,
    node_pubkey VARCHAR(130),
    channel_id VARCHAR(130) NOT NULL,
    peer_pubkey VARCHAR(130),
    state VARCHAR(96) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    local_balance_raw VARCHAR(78) NOT NULL DEFAULT '0',
    remote_balance_raw VARCHAR(78) NOT NULL DEFAULT '0',
    outbound_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
    pending_tlcs INTEGER NOT NULL DEFAULT 0,
    health VARCHAR(16) NOT NULL,
    diagnosis TEXT,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    network VARCHAR(32) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(network, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_fiber_channel_health
    ON fiber_channel_snapshots(network, health, observed_at DESC);

CREATE TABLE IF NOT EXISTS fiber_incidents (
    id BIGSERIAL PRIMARY KEY,
    fingerprint VARCHAR(180) NOT NULL,
    incident_type VARCHAR(80) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    subject_type VARCHAR(32) NOT NULL,
    subject_id VARCHAR(180) NOT NULL,
    title VARCHAR(255) NOT NULL,
    diagnosis TEXT NOT NULL,
    recommendation TEXT,
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    network VARCHAR(32) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    UNIQUE(network, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_fiber_incidents_open
    ON fiber_incidents(network, status, severity, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS fiber_reconciliation_runs (
    id BIGSERIAL PRIMARY KEY,
    payment_hash VARCHAR(130) NOT NULL,
    invoice_status VARCHAR(64),
    payment_status VARCHAR(64),
    cch_status VARCHAR(64),
    consistent BOOLEAN NOT NULL,
    severity VARCHAR(16) NOT NULL,
    diagnosis TEXT NOT NULL,
    recommended_action TEXT,
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    network VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiber_reconciliation_hash
    ON fiber_reconciliation_runs(network, payment_hash, created_at DESC);
