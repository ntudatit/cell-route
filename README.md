# FiberPay Platform

Scalable payment infrastructure and operations tooling built on Nervos Fiber and CKB.

## Services

- `portal`: React/Vite checkout, merchant console, FiberOps and browser Fiber WASM node
- `rust-service`: Rust/Axum API, PostgreSQL state, authentication, reconciliation, audit and MCP
- `docker-compose.yml`: production-oriented single-host deployment

## Development

See [portal/README.md](portal/README.md) and [rust-service/README.md](rust-service/README.md).

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Start from `.env.deploy.example`; never commit the populated `.env.deploy` file.

For a testnet demo using free hosting, follow [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md).
