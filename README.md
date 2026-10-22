# FiberPay Platform

Scalable payment infrastructure and operations tooling built on Nervos Fiber and CKB.

## Services

- `portal`: React/Vite checkout, merchant console, FiberOps and browser Fiber WASM node
- `rust-service`: Rust/Axum API, PostgreSQL state, authentication, reconciliation, audit and MCP
- `docker-compose.yml`: production-oriented single-host deployment

## Development

CKBuilder Advanced work plans: [Week 9–12 roadmap](docs/advanced-weeks-9-12.md), covering [SSRI](docs/week-9-work-plan.md), [RGB++](docs/week-10-work-plan.md), [xUDT extensions](docs/week-11-work-plan.md), and [iCKB](docs/week-12-work-plan.md). These are plans with reviewer checks and evidence requirements, not completion reports.

See [portal/README.md](portal/README.md) and [rust-service/README.md](rust-service/README.md).

Each portal feature has a live Dev Console with isolated history, filtering, pause and JSONL export. See [developer console usage and instrumentation](docs/dev-console.md).

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Start from `.env.deploy.example`; never commit the populated `.env.deploy` file.

For a testnet demo using free hosting, follow [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md).

## Simple Lock Lab

Open /simple-lock for hash-lock address derivation, local funding, live capacity and unlocking. See [contract build and Devnet workflow](contracts/README.md). Contract source and artifacts are separate from the React portal.

## Mainnet

Run the portal with `npm run dev:mainnet` or build with `npm run build:mainnet` from `portal`. See [Mainnet configuration and verification](docs/mainnet.md).

## Token Lab

Open `/fungible-token` for sUDT/xUDT mint, transfer, explicit burn and transaction review. See [Token Lab configuration and development](docs/token-lab.md).

See the [Week 6 report](README-WEEK-6.md) for implementation and recorded Devnet results, and the [Token Lab guide](docs/token-lab.md) for current wallet workflows and validation commands.

SSRI: [Readonly inspector and local reproduction](docs/ssri-inspector.md). See the [Week 9 report](README-WEEK-9.md) for source versions, implementation, recorded results and audit scope.

RGB++: [Readonly Bitcoin/CKB inspector](docs/rgbpp-inspector.md) and [Week 10 report](README-WEEK-10.md).

Live Labs: [operator configuration, supported workflows and validation](docs/live-labs.md).

xUDT extensions: [local VM lab, owner-mode behavior and reproduction](docs/xudt-extension-lab.md). Basic Token Lab support remains unchanged.
