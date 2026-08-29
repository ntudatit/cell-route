# Deploy FiberPay for free

Recommended hobby/testnet stack:

- PostgreSQL: Neon Free
- Rust API: Render Free Web Service
- Portal: Vercel Hobby

This is suitable for a testnet demo, not production payment infrastructure. Render Free sleeps after inactivity and the first request after sleep can take about one minute.

## 1. Push the repository to GitHub

Create an empty GitHub repository, then from the project root:

```powershell
git init
git add .
git commit -m "Prepare FiberPay deployment"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

Confirm `.env`, `.env.deploy`, API keys and database passwords are not present on GitHub.

## 2. Create the free Neon database

1. Sign in at `https://console.neon.tech`.
2. Create a project named `fiberpay-testnet`.
3. Choose a region close to the Render region you will use.
4. Open **Connect** and select the pooled connection string.
5. Copy the complete PostgreSQL URL. It should include `sslmode=require`.

No manual migration command is needed. The Rust API runs all embedded SQL migrations when it starts.

## 3. Deploy the Rust API to Render

1. Sign in at `https://dashboard.render.com` and connect GitHub.
2. Select **New → Web Service**.
3. Choose the FiberPay repository.
4. Configure:

```text
Name: fiberpay-api-YOUR_NAME
Root Directory: rust-service
Runtime: Docker
Dockerfile Path: ./Dockerfile
Instance Type: Free
Health Check Path: /api/health
```

5. Add these environment variables:

```text
DATABASE_URL=<Neon pooled connection string>
CORS_ORIGIN=https://temporary.invalid
CKB_NETWORK=testnet
CKB_RPC_URL=https://testnet.ckbapp.dev/
CKB_INDEXER_URL=https://testnet.ckbapp.dev/
JWT_SECRET=<at least 32 random characters>
JWT_TTL_SECONDS=3600
AUTH_CHALLENGE_TTL_SECONDS=300
FIBER_RUNTIME=wasm
FIBER_EXPECTED_VERSION=0.9.0
LOG_JSON=true
OTEL_SERVICE_NAME=fiberpay-api
AI_PROVIDER=disabled
MCP_API_KEY=<another random secret>
```

Do not add private wallet keys.

6. Deploy and wait for `/api/health` to become healthy.
7. Copy the Render URL, for example:

```text
https://fiberpay-api-your-name.onrender.com
```

Test it:

```powershell
Invoke-RestMethod https://fiberpay-api-your-name.onrender.com/api/health
Invoke-RestMethod https://fiberpay-api-your-name.onrender.com/api/ready
```

## 4. Deploy the portal to Vercel

1. Sign in at `https://vercel.com` with GitHub.
2. Select **Add New → Project** and import the same repository.
3. Configure:

```text
Framework Preset: Vite
Root Directory: portal
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

4. Add these environment variables for Production and Preview:

```text
VITE_API_URL=https://fiberpay-api-your-name.onrender.com/api
VITE_CKB_NETWORK=testnet
VITE_FIBER_NETWORK=testnet
VITE_FIBER_CONFIG_PATH=/fiber-config/testnet.yml
VITE_FIBER_EXPECTED_VERSION=0.9.0
VITE_FIBER_DATABASE_PREFIX=fiberpay:testnet:browser-node-v1
```

These Vite values are public browser configuration. Never put database credentials, JWT secrets, AI keys or MCP keys in a `VITE_*` variable.

5. Deploy and copy the production URL, for example:

```text
https://fiberpay-your-name.vercel.app
```

## 5. Finish CORS configuration

Return to Render → FiberPay API → Environment and replace:

```text
CORS_ORIGIN=https://temporary.invalid
```

with the exact Vercel production origin:

```text
CORS_ORIGIN=https://fiberpay-your-name.vercel.app
```

Do not add a trailing slash. Save and redeploy the API.

## 6. Verify the deployment

From the local `portal` directory:

```powershell
$env:FIBERPAY_URL="https://fiberpay-your-name.vercel.app"
npm run verify:isolation
```

All Fiber routes must report `PASS`. Then test:

1. Open `/checkout` directly.
2. Confirm Cross-Origin Isolated is enabled.
3. Start the browser Fiber node.
4. Connect to a WSS Fiber peer.
5. Open a testnet channel or use the two-node lab.
6. Create an invoice from one node.
7. Run readiness and pay from the other node.
8. Authenticate Merchant Console and verify the order history.
9. Open FiberOps and verify channel health and incidents.

## 7. Free-tier limitations

- Render Free sleeps after 15 minutes without inbound traffic; cold start can take about one minute.
- Neon Free compute scales to zero when idle and is limited by monthly compute, storage and transfer quotas.
- Vercel Hobby is intended for personal/non-commercial projects and has usage limits.
- Browser Fiber identity and channels are stored in that browser profile's IndexedDB.
- Use testnet only. A free sleeping backend is not suitable for real funds, merchant SLAs or always-on webhook delivery.

## 8. Updating the app

Push to `main`:

```powershell
git add .
git commit -m "Update FiberPay"
git push
```

Vercel and Render redeploy automatically. Environment variable changes require a new deployment.
