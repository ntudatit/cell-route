# Fiber WASM deployment

`@nervosnetwork/fiber-js` uses Web Workers and `SharedArrayBuffer`. Every HTML document that starts the browser Fiber node must therefore be cross-origin isolated.

## Required response headers

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

The repository applies these headers to all WASM workspaces (`/checkout`, `/merchant`, and `/fiber-*`) in:

- Vite development server
- Vite preview server
- Netlify-compatible `public/_headers`
- Vercel `vercel.json`

Enter isolated routes through a normal document navigation or reload the route. A React client-side transition cannot change the headers of the document that is already loaded.

## Local development

```powershell
npm run dev
```

Open `http://localhost:5173/checkout` or `http://localhost:5173/fiber-node` directly.

## Production preview

```powershell
npm run build
npm run preview
npm run verify:isolation
```

To verify a deployed environment:

```powershell
$env:FIBERPAY_URL="https://your-fiberpay-host.example"
npm run verify:isolation
```

The verification command checks the status and all three required headers on every Fiber WASM route.

## Browser verification

```js
crossOriginIsolated === true
typeof SharedArrayBuffer === "function"
```

Plain GitHub Pages cannot configure these response headers and is not suitable for Fiber WASM. Popup wallets may also be incompatible with strict COOP because it intentionally separates opener contexts; keep wallet popup/redirect flows on a non-isolated surface or use a connector flow that does not depend on `window.opener`.
