# Week 10 verification

Execution date: 2026-10-15 (Asia/Bangkok). This directory separates reproducible offline checks, deliberate fixtures and dated public API observations.

| Command (from portal) | Layer | Actual outcome |
| --- | --- | --- |
| `npm run rgbpp:verify-source` | Immutable upstream source comparison | Exact public projection matched; account objects excluded |
| `npm run rgbpp:evidence -- --live` | Offline checks + actual public APIs | 11 linkage checks passed; 10 negative/policy cases recorded; both genesis hashes checked |
| `npm test` | Unit/fixture tests | 101 passed across 16 files |
| `npm run build` | TypeScript and Vite | Passed; large-chunk warning remains |
| `npm run test:e2e:rgbpp` with installed Edge | Browser tests, including mocked API outage | 4 passed |
| `node scripts/rgbpp-ui-check.mjs` | Actual browser against public APIs | See browser-check.json and screenshots |

The Bitcoin UTXO is observed spent. The historical CKB transaction is committed/canonical and its Cell contents match, but get_live_cell returns unknown. Tips and refresh times are in observations.json; reads are sequential and not an atomic cross-chain snapshot. Neither a spent UTXO nor historical fixture metadata establishes current spendability.

Proof: **not verified**. No compatible SPV/header verifier ran. Transfer: **not performed**. No broadcast was used for negative cases. Exact field expectations and actual values are in binding-map.json; mismatch/policy layers are in negative-cases.json. Missing API data is unknown, not absence or success.

Fixture provenance and source hashes are in fixture-provenance.json. environment.json records local file hashes, selected source versions, endpoints and the execution mode. An offline-only rerun does not refresh observations.json; use its own observedAt field.
