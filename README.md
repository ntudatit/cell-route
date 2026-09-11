# FiberPay Platform

Scalable payment infrastructure and operations tooling built on Nervos Fiber and CKB.

## Services

- `portal`: React/Vite checkout, merchant console, FiberOps and browser Fiber WASM node
- `rust-service`: Rust/Axum API, PostgreSQL state, authentication, reconciliation, audit and MCP
- `docker-compose.yml`: production-oriented single-host deployment

## Development

See [portal/README.md](portal/README.md) and [rust-service/README.md](rust-service/README.md).

Each portal feature has a live Dev Console with isolated history, filtering, pause and JSONL export. See [developer console usage and instrumentation](docs/dev-console.md).

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Start from `.env.deploy.example`; never commit the populated `.env.deploy` file.

For a testnet demo using free hosting, follow [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md).

## Week 5: Simple Lock Lab

Open /simple-lock for hash-lock address derivation, local funding, live capacity and unlocking. See [contract build and Devnet workflow](contracts/README.md) and the [Week 5 report](docs/week-5-report.md). Contract source and artifacts are separate from the React portal.

## Mainnet

Run the portal with `npm run dev:mainnet` or build with `npm run build:mainnet` from `portal`. See [Mainnet configuration and verification](docs/mainnet.md).
