ALTER TABLE merchant_orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_order_idempotency
    ON merchant_orders(merchant_wallet, network, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

UPDATE merchant_orders SET status='PAYMENT_PENDING' WHERE status IN ('OPEN','INFLIGHT');
UPDATE merchant_orders SET status='ORDER_CREATED' WHERE status='CREATED';

CREATE TABLE IF NOT EXISTS fiberpay_outbox_events (
    id UUID PRIMARY KEY,
    tenant_key TEXT NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type VARCHAR(96) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiberpay_outbox_pending
    ON fiberpay_outbox_events(status, available_at, created_at) WHERE status='PENDING';
