CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
    nonce UUID PRIMARY KEY,
    wallet_address VARCHAR(256) NOT NULL,
    message TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_wallet
    ON wallet_auth_challenges(wallet_address, created_at DESC);

CREATE TABLE IF NOT EXISTS indexed_assets (
    id BIGSERIAL PRIMARY KEY,
    owner_address VARCHAR(256) NOT NULL,
    asset_kind VARCHAR(24) NOT NULL,
    asset_id VARCHAR(256) NOT NULL,
    type_code_hash VARCHAR(66) NOT NULL,
    type_hash_type VARCHAR(16) NOT NULL,
    type_args TEXT NOT NULL,
    amount_raw VARCHAR(80),
    output_data TEXT,
    tx_hash VARCHAR(66) NOT NULL,
    output_index BIGINT NOT NULL,
    block_number BIGINT,
    network VARCHAR(32) NOT NULL,
    is_live BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_indexed_cell UNIQUE (network, tx_hash, output_index)
);
CREATE INDEX IF NOT EXISTS idx_indexed_assets_owner_live
    ON indexed_assets(owner_address, is_live, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_indexed_assets_identity
    ON indexed_assets(network, asset_kind, asset_id);

CREATE TABLE IF NOT EXISTS indexer_runs (
    id BIGSERIAL PRIMARY KEY,
    owner_address VARCHAR(256) NOT NULL,
    network VARCHAR(32) NOT NULL,
    scanned_cells INTEGER NOT NULL DEFAULT 0,
    indexed_assets INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_indexer_runs_owner
    ON indexer_runs(owner_address, started_at DESC);
