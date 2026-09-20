ALTER TABLE asset_events DROP CONSTRAINT asset_kind_check;
ALTER TABLE asset_events ADD CONSTRAINT asset_kind_check CHECK (asset_kind IN ('SUDT', 'XUDT', 'SPORE', 'CLUSTER'));
