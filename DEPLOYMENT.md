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
docker compose --env-file .env.deploy config
docker compose --env-file .env.deploy up -d --build
docker compose --env-file .env.deploy ps
```

The portal is available on `PORTAL_PORT` (default `8088`). In production, put a TLS load balancer, Cloudflare proxy, Caddy, Traefik, or ingress controller in front of this port. Preserve the response headers emitted by Nginx.

Health checks:

```powershell
Invoke-WebRequest http://localhost:8088/healthz
Invoke-WebRequest http://localhost:8088/api/health
$env:FIBERPAY_URL="http://localhost:8088"
Set-Location portal
npm run verify:isolation
```

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

## Production checklist

- DNS and TLS are valid.
- `npm run verify:isolation` passes every Fiber route.
- `/healthz`, `/api/health`, and `/api/ready` return success.
- PostgreSQL is private and has automated backups.
- `JWT_SECRET`, `POSTGRES_PASSWORD`, and `MCP_API_KEY` are unique random values.
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
