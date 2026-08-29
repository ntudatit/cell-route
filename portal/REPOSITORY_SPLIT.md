# Runtime split

The project is intentionally split into the two FiberOps runtime boundaries:

| Repository | Runtime | Owns |
|---|---|---|
| `portal` | Browser / GitHub Pages | React UI, CCC wallet integration |
| `rust-service` | Server / Render or container | REST API, CKB RPC, transaction persistence |
The portal communicates with `rust-service` over HTTP. On-chain CKB contract development is outside the FiberOps source boundary.
