CREATE TABLE IF NOT EXISTS fiber_payment_records (
    id BIGSERIAL PRIMARY KEY,
    merchant_wallet VARCHAR(255) NOT NULL,
    direction VARCHAR(16) NOT NULL CHECK (direction IN ('INCOMING','OUTGOING')),
    payment_hash VARCHAR(130),
    invoice_address TEXT,
    amount_raw VARCHAR(78) NOT NULL,
    description TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'OPEN',
    network VARCHAR(32) NOT NULL,
    fiber_node_pubkey VARCHAR(130),
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiber_payment_records_wallet_created
    ON fiber_payment_records(merchant_wallet, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiber_payment_hash
    ON fiber_payment_records(payment_hash) WHERE payment_hash IS NOT NULL;
