CREATE TABLE IF NOT EXISTS merchant_orders (
    id UUID PRIMARY KEY,
    merchant_wallet TEXT NOT NULL,
    customer_reference TEXT,
    amount_raw VARCHAR(78) NOT NULL,
    asset_kind VARCHAR(32) NOT NULL DEFAULT 'CKB',
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    payment_hash VARCHAR(130),
    invoice_address TEXT,
    network VARCHAR(32) NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(payment_hash)
);
CREATE INDEX IF NOT EXISTS idx_merchant_orders_wallet_created ON merchant_orders(merchant_wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS fiber_payment_attempts (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES merchant_orders(id) ON DELETE CASCADE,
    payment_hash VARCHAR(130),
    status VARCHAR(32) NOT NULL,
    fee_raw VARCHAR(78),
    route_parts INTEGER NOT NULL DEFAULT 0,
    failure TEXT,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiber_payment_attempts_order ON fiber_payment_attempts(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_wallet TEXT NOT NULL,
    action TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    network VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time ON audit_logs(actor_wallet, created_at DESC);
