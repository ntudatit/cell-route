# FiberOps Control Center v1.3 — Browser WASM Node

This edition no longer requires `fnn`, the Fiber source repository, Docker, or a local JSON-RPC endpoint on port 8227 for normal FiberOps use.

## Runtime

```text
Browser / React
  ├─ @nervosnetwork/fiber-js 0.9.0
  ├─ Fiber WASM Worker
  ├─ IndexedDB node state
  └─ WSS ──> Fiber Testnet public peers

Rust / Axum
  ├─ application auth / PostgreSQL / CKB indexer
  └─ no native Fiber polling when FIBER_RUNTIME=wasm
```

## Local run

```powershell
# terminal 1
cd rust-service
copy .env.example .env
cargo run

# terminal 2
cd portal
copy .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/fiber-node.html` first. Vite sends COOP/COEP only for this dedicated entry, enabling `SharedArrayBuffer` without breaking wallet popups in the main portal.

Then use `/fiber-ops`, `/fiber-ops/readiness`, `/fiber-ops/channels`, `/fiber-ops/reconciliation`, and `/fiber-merchant`.

## Deployment requirement

Fiber WASM requires `crossOriginIsolated === true`. Deploy the portal on a host that supports response headers such as Cloudflare Pages, Netlify, Vercel, Nginx, or another configurable static host. The repository includes `public/_headers` and `vercel.json`.

Plain GitHub Pages cannot set the required COOP/COEP response headers, so it is not a suitable production host for the WASM entry page.

## Security

The demo/testnet browser identity is persisted in IndexedDB. For a production wallet product, prefer Fiber's external-funding flow rather than placing the user's external wallet private key inside the WASM node.
