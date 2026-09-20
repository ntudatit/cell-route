# Token Lab

The `/fungible-token` page supports sUDT and basic xUDT: mint, transfer, explicit burn, live token Cells and transaction review. Amounts use BigInt and uint128 little-endian encoding. Names, symbols and decimals are display metadata.

## Transaction flow

Connect a wallet on the selected network, select the token standard, then generate issuer args or enter existing token args. Set the amount and recipient, prepare the transaction and review inputs, outputs, token change and fees before signing. Burning requires an explicit confirmation. Refresh the live balance after commitment.

The builder verifies genesis, live code dependencies and token accounting. Submission checks the wallet identity, unchanged transaction preview and live inputs. sUDT args contain the owner lock hash; basic xUDT adds zero extension flags and uses its own code dependency. Extended token data is unsupported.

## Local development

Prerequisites: Node.js 22+, OffCKB CLI 0.4.12 and ckb-debugger. Run `npm ci` in both `portal` and `contracts`. Start `offckb node` in a separate terminal.

From the repository root:

```sh
offckb system-scripts --output contracts/deployment/week6-system-scripts.json
```

From `contracts`, use the existing package commands:

```sh
npm run week6:build
npm run week6:export
npm run week6:test
npm run week6:demo
```

These command names are retained for compatibility. The demo uses ephemeral in-memory wallets and local Devnet funds to exercise mint, transfer, burn and unauthorized mint rejection. Set `OFFCKB_CLI` to the CLI's `build/index.js` if it is outside the default Windows npm installation; set `CKB_DEBUGGER` for a custom debugger path.

In `portal`, set `VITE_CKB_NETWORK=devnet`, then run `npm run dev`. Run `npm test` and `npm run build` for frontend validation. The feature's Dev Console exposes operation and wallet/RPC logs.

## Backend and deployment

Use a separate database for each network. Set `SUDT_CODE_HASH` to the selected network's deployed script hash so the indexer recognizes sUDT. The asset-events migration adds the SUDT type; run `cargo test` with Docker available for PostgreSQL migration integration tests.

`contracts/deployment/token.devnet.json` records genesis, code OutPoints and checksums; its public copy is consumed by the portal. Export fresh metadata after resetting Devnet, then rebuild the portal.

The artifact build command verifies and stages a pinned executable; it does not compile C source. See [binary provenance and source-build limitations](../contracts/vendor/sudt/README.md). Keep contract artifacts outside the React source tree.
