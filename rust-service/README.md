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
# Create this dedicated database once, using your PostgreSQL account:
createdb -h localhost -U postgres cellroute_testnet
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

## Startup failures

Cargo's `process didn't exit successfully ... (exit code: 1)` is only a summary. Read the `Error:` and `Caused by:` lines above it.

- **Migration previously applied but modified:** `DATABASE_URL` points to a database whose SQLx migration checksums differ from this checkout. Do not edit checksums or delete migration records. Use the correct checkout for that database, or create an isolated empty database and update the ignored `.env`. The generic PostgreSQL `postgres` database may contain migration history from another project.
- **Database does not exist / connection failed:** create the selected database and check PostgreSQL, credentials and port. SQLx creates tables, not the database itself.
- **Invalid Mainnet JWT secret:** use a randomly generated secret of at least 32 bytes in the ignored `.env` or deployment secret store.
- **Address already in use:** choose an available `PORT` and point the portal's `VITE_API_URL` to it.

The local default database is now `cellroute_testnet`, `cellroute_mainnet`, or `cellroute_devnet`, matching `CKB_NETWORK`. Explicit `DATABASE_URL` overrides this. For Mainnet setup, see [the Mainnet guide](../docs/mainnet.md).
