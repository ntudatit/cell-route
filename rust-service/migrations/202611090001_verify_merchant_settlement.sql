ALTER TABLE fiber_runtime_snapshots ADD COLUMN operator_submitted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE fiber_network_resource_snapshots ADD COLUMN operator_submitted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE merchant_orders
    ADD COLUMN fiber_receiver_pubkey TEXT,
    ADD COLUMN settlement_verified_at TIMESTAMPTZ;

-- Preserve the legacy status as audit history. Legacy invoice references came
-- from the browser and cannot establish ownership of a receiver invoice.
INSERT INTO audit_logs(actor_wallet, action, subject_type, subject_id, context, network)
SELECT merchant_wallet, 'LEGACY_SETTLEMENT_UNVERIFIED', 'MERCHANT_ORDER', id::text,
       jsonb_build_object('previousStatus', status, 'previousPaidAt', paid_at), network
FROM merchant_orders
WHERE status IN ('PAID', 'FULFILLMENT_PENDING', 'COMPLETED');

UPDATE merchant_orders
SET status = 'PAYMENT_UNVERIFIED', paid_at = NULL, updated_at = NOW()
WHERE status IN ('ORDER_CREATED', 'PAYMENT_PENDING', 'PAID', 'FULFILLMENT_PENDING', 'COMPLETED');

ALTER TABLE merchant_orders ADD CONSTRAINT merchant_paid_requires_verified_invoice
CHECK (status NOT IN ('PAID', 'FULFILLMENT_PENDING', 'COMPLETED') OR
       (fiber_receiver_pubkey IS NOT NULL AND settlement_verified_at IS NOT NULL AND paid_at IS NOT NULL));
