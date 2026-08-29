# FiberOps Rust Service v1.3

This service is the application backend for FiberOps Control Center: PostgreSQL, wallet/JWT authentication, CKB RPC/indexer integration, transaction tracking, and operational persistence.

## Fiber runtime mode

The default is:

```env
FIBER_RUNTIME=wasm
```

In this mode the backend **does not start or poll a native FNN**. Fiber runs in the React portal via `@nervosnetwork/fiber-js` and uses IndexedDB + Web Workers + WSS peers. Therefore no `fnn.exe`, Docker Fiber container, Fiber source checkout, or local port `8227` is required.

A legacy/native adapter remains in the codebase for future server-node deployments, but it is disabled unless `FIBER_RUNTIME=native` is explicitly selected.

## Local run

```powershell
copy .env.example .env
cargo run
```

Expected API:

```text
http://localhost:8080/api/health
http://localhost:8080/api/ready
```

Then run the portal and open `/fiber-node.html` to start the isolated browser WASM node.

## Database

Set `DATABASE_URL` to PostgreSQL. SQLx migrations run on startup.

## CKB

The backend uses CKB Testnet by default:

```env
CKB_NETWORK=testnet
CKB_RPC_URL=https://testnet.ckbapp.dev/
CKB_INDEXER_URL=https://testnet.ckbapp.dev/
```
