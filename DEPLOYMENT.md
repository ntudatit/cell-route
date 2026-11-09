# FiberPay deployment

## Prerequisites

- Docker Engine 25+ with Docker Compose v2
- A public HTTPS domain for production
- A PostgreSQL backup policy
- Public CKB RPC/indexer endpoints

Browser Fiber requires a secure context and COOP/COEP headers. HTTPS is mandatory outside localhost.

## Option A: Docker Compose

Copy and edit the deployment environment:

```powershell
Copy-Item .env.deploy.example .env.deploy
```

Generate strong secrets and replace every `CHANGE_ME` value. Set `PUBLIC_ORIGIN` to the exact public portal origin, without a trailing slash.

Validate and start:

```powershell
./scripts/validate-deployment.ps1
docker compose --env-file .env.deploy config --quiet
docker compose --env-file .env.deploy up -d --build
docker compose --env-file .env.deploy ps
```

The portal is available on `PORTAL_PORT` (default `8088`). In production, put a TLS load balancer, Cloudflare proxy, Caddy, Traefik, or ingress controller in front of this port. Preserve the response headers emitted by Nginx.

Health checks:

```powershell
Invoke-WebRequest http://localhost:8088/healthz
Invoke-WebRequest http://localhost:8088/api/health
Invoke-WebRequest http://localhost:8088/api/ready
$env:FIBERPAY_URL="http://localhost:8088"
Set-Location portal
npm run verify:isolation
```

Compose and Render set `APP_ENV=production`, which requires a strong `JWT_SECRET` even on Testnet. Set the same environment explicitly for a standalone API. Leave `MCP_API_KEY` empty if MCP is unused. Keep RPC and indexer overrides empty to inherit the selected chain defaults, or supply two matching endpoints.

`/api/health` checks API liveness. `/api/ready` checks PostgreSQL and the CKB node within five seconds, including the expected genesis on Mainnet and Testnet. A separately configured indexer or Fiber node requires its own preflight.

Database migrations are embedded in the Rust binary and run during API startup. Deploy one API instance first when introducing new migrations, then scale horizontally after it becomes healthy.

## Option B: Vercel or Netlify portal + Render API

Portal build settings:

```text
Root directory: portal
Build command: npm ci && npm run build
Output directory: dist
```

Build environment:

```text
VITE_API_URL=https://api.example.com/api
VITE_CKB_NETWORK=testnet
VITE_FIBER_NETWORK=testnet
VITE_FIBER_CONFIG_PATH=/fiber-config/testnet.yml
VITE_FIBER_EXPECTED_VERSION=0.9.0
VITE_FIBER_DATABASE_PREFIX=fiberpay:testnet:browser-node-v1
```

`portal/vercel.json` and `portal/public/_headers` configure SPA routing and Fiber WASM isolation. After deployment, run `npm run verify:isolation` with `FIBERPAY_URL` set to the portal origin.

Deploy `rust-service/render.yaml` from the `rust-service` root. Set `CORS_ORIGIN=https://pay.example.com`. Never place secrets in Vite variables.

## Staging Fiber checkout

The local staging run on 9 November 2026 verified a funded payment through the merchant API and two native Fiber nodes. The browser portal served the checkout route with isolation headers. See the [settlement evidence](docs/evidence/fiber-testnet-checkout.json).

For private local staging, set `API_BIND_IP=127.0.0.1` when launching the API directly. The default bind address for container deployments is `0.0.0.0`.

Use a dedicated Testnet deployment and a native receiver node you operate. The payer can use the browser Fiber node. Both require ready Testnet channels with enough outbound and inbound liquidity for the chosen route and amount. The browser's local receive invoices are separate from server-backed merchant orders.

1. Set `APP_ENV=production`, `CKB_NETWORK=testnet` and `VITE_CKB_NETWORK=testnet`. Provision a dedicated PostgreSQL database and back up any existing merchant records before migration. Legacy order statuses become `PAYMENT_UNVERIFIED` where applicable. Previously reported paid states are preserved in the audit log and require manual review.
2. Set `FIBER_RPC_URL` to the receiver's private RPC endpoint. Configure `FIBER_MERCHANT_NODE_PUBKEY` from the receiver's `node_info` and set `FIBER_MERCHANT_WALLET` to the Testnet wallet allowed to create and reconcile merchant orders. Set `FIBER_BISCUIT_TOKEN` through your secret manager if required. Give this token only `node_info`, `new_invoice` and `get_invoice` permissions for checkout. Keep the RPC private. Leaving both merchant settings empty disables merchant checkout.
3. Authenticate as that merchant on `/fiber-merchant`. Create a low-value merchant invoice and verify the order shows `PAYMENT_PENDING`. The order API requires an `Idempotency-Key`. Repeat the same request with the same key and confirm the same order ID and payment hash.
4. On a separate funded browser Fiber node, open `/checkout`, choose **Pay invoice**, paste the merchant invoice and run **Check & pay**. Verify the payment hash and amount in the payer node and check that its final payment status is `Success`.
5. Back on the merchant page, choose **Verify settlement**. Match the receiver node's `get_invoice` result to the order. The order should show `PAID` only when the receiver reports `Paid`. Record order ID, payment hash, amount, network, and both observed statuses. Keep tokens, private keys and invoice preimages out of evidence. Exercise backup restore against a disposable staging database before promotion.

### API access and limits

- Merchant orders require the configured receiver wallet and a network-matched wallet JWT. Asset records and wallet activity require the record owner's JWT. AI, shared telemetry, and backend Fiber operations require a JWT for a wallet in the comma-separated `OPERATOR_WALLETS` allowlist. Old public telemetry is excluded from shared lookups. MCP requires `MCP_API_KEY` and is disabled when it is empty.
- The API uses a weighted 60-second budget of 240 units per peer and 6,000 per instance. Login, AI, dashboard, indexer sync, SSE and MCP cost 12 units, Fiber and merchant requests cost 6, and ordinary requests cost 1. Throttled requests return `429` and `Retry-After`. The service also caps active SSE streams at 64 per instance.
- The API ignores forwarded IP headers by default. When there is a single ingress that **overwrites** `X-Real-IP`, set `API_TRUSTED_PROXY_IP` to that ingress's exact socket IP as seen by the API. Without it, proxied requests share the ingress's peer budget. Compose's Nginx also enforces edge per-address limits. For multiple replicas, enforce a shared quota at the edge and restrict direct access to the API origin.

## Production checklist

See the [Handbook coverage and release review](docs/production-readiness.md) for evidence, feature boundaries, and open release gates.

- DNS and TLS are valid.
- `npm run verify:isolation` passes every Fiber route.
- `/healthz`, `/api/health`, and `/api/ready` return success.
- PostgreSQL is private and has automated backups.
- `JWT_SECRET` and `POSTGRES_PASSWORD` are unique random values. If MCP is enabled, set a separate random `MCP_API_KEY`.
- CORS allows only the exact portal origin.
- Testnet is validated before changing to mainnet.
- Logs and alerts cover API health, payment failures, liquidity and reconciliation mismatches.
- Wallet private keys never appear in backend environment variables or logs.

## Operations

```powershell
docker compose --env-file .env.deploy logs -f api
docker compose --env-file .env.deploy up -d --build
docker compose --env-file .env.deploy exec postgres pg_dump -U fiberpay fiberpay
```

Do not use `docker compose down -v` in production; `-v` deletes the PostgreSQL volume.
