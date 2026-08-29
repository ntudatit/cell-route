# FiberOps Blockchain UI

The FiberOps operator console uses a Web3 infrastructure design language rather than an exchange/NFT-marketplace theme.

## Visual principles

- Dark operator-console shell with subtle blockchain/network grid.
- Mint/cyan protocol accents for live state; amber/red reserved for warning/critical conditions.
- Monospace typography for hashes, protocol labels, telemetry and status pills.
- Data-dense panels for channels, liquidity, incidents and reconciliation.
- No hard-coded production telemetry: dashboard values come from FiberOps API endpoints.
- Network mesh renders actual channel rows returned by `/api/fiber/ops/channels/health`.

## Reference

See `fiberops-dashboard-ui-reference.png` for the target visual direction. The implementation is intentionally data-driven, so the exact number of nodes/cards can differ from the design mockup depending on the connected FNN state.
