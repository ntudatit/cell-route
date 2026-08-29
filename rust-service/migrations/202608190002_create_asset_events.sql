CREATE TABLE IF NOT EXISTS asset_events (
    id BIGSERIAL PRIMARY KEY,
    asset_kind VARCHAR(16) NOT NULL,
    action VARCHAR(24) NOT NULL,
    asset_id VARCHAR(256) NOT NULL,
    owner_address VARCHAR(256) NOT NULL,
    display_name VARCHAR(128),
    symbol VARCHAR(32),
    amount VARCHAR(80),
    tx_hash VARCHAR(66) NOT NULL,
    metadata_json TEXT,
    network VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_event UNIQUE (tx_hash, asset_kind, asset_id, action),
    CONSTRAINT asset_kind_check CHECK (asset_kind IN ('XUDT', 'SPORE', 'CLUSTER'))
);

CREATE INDEX IF NOT EXISTS idx_asset_events_owner_created
    ON asset_events(owner_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_events_asset
    ON asset_events(asset_kind, asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_events_tx_hash
    ON asset_events(tx_hash);
