# FiberPay Portal — Fiber WASM and Operations

The portal now embeds Fiber directly in the browser using `@nervosnetwork/fiber-js@0.9.0`. It no longer requires a locally installed `fnn` binary or localhost Fiber RPC.

## Run

```powershell
copy .env.example .env
npm install
npm run dev
```

Open:

```text
http://localhost:5173/checkout
http://localhost:5173/fiber-node
```

Start/refresh the browser node, then use the FiberOps dashboard pages. Vite is configured with COOP/COEP headers so `SharedArrayBuffer` is available.

## Architecture

```text
React / Vite
  -> fiber-js 0.9.0
  -> Fiber WASM Worker
  -> IndexedDB
  -> WSS Fiber Testnet peers

Rust API
  -> PostgreSQL / auth / CKB indexer
  -> no native FNN required
```

## Deployment

Fiber WASM routes must be cross-origin isolated. Vite dev/preview, `public/_headers`, and `vercel.json` are configured. Run `npm run verify:isolation` against preview or set `FIBERPAY_URL` to check a deployed host. See `docs/WASM_DEPLOYMENT.md`.

## Existing UI

The blockchain-style FiberOps dashboard, merchant flow, CKB wallet/features, Spore/xUDT pages, and CKB Script Lab remain in the project.
