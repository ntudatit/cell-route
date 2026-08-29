CREATE TABLE IF NOT EXISTS tracked_transactions (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    wallet_address VARCHAR(256) NOT NULL,
    recipient VARCHAR(256),
    amount_ckb VARCHAR(80),
    direction VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    network VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_wallet_created
    ON tracked_transactions(wallet_address, created_at DESC);
