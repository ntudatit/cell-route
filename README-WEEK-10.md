# Week 10 Report — RGB++ and Bitcoin UTXO / CKB Cell Binding

Latest consolidated report: [Week 10 report](docs/week-10-report.md), updated 16 October 2026 with live Mainnet/Testnet lookup and final validation. The checkpoint below records the initial implementation on 15 October.

**Project:** CellRoute / FiberPay  
**Execution date:** 15 October 2026  
**Status:** Core read-only exercise implemented and reproduced. **Proof not verified. Transfer not performed.**

## Objective and implementation

Week 10 connects the Bitcoin single-use seal model with CKB asset Cells and distinguishes data linkage from protocol proof verification. The new `/rgbpp` inspector decodes a public sample, recomputes its virtual transaction commitment, reports individual checks, observes each chain separately and exports a public receipt. It is available without connecting a wallet and has a dedicated Testnet Dev Console.

The inspector never uses the normal CKB transfer flow to imply RGB++ support. No wallets, private keys or seed phrases were required, and no transactions were signed or broadcast by this exercise.

## Sources and selected profile

The handbook's `ckb-devrel/ccc` branch `rgbpp-sdk` remains accessible and was pinned to `1016ee901cef3b1aa5d4e25ae736b109c6f2717b`. The implementation ports its read-only encoding algorithm using the portal's existing CCC core; the workspace SDK package was not installed. No migration is claimed.

The script standard is pinned to `RGBPlusPlus/RGBPlusPlus-design` revision `5ebbf37d2dc8bd36729ba62392b2f6379b933538`. The public mocked Cell/UTXO data and unsigned transaction snapshot come from `RGBPlusPlus/rgbpp-sdk` revision `ee21eb9735c1adeb277e3a02b7f6c2f6fd1d0556`. The SPV service source is pinned to `e9aa85a3e6ae3e5ac122a68c2fe4fb6d1ed69450`.

Exact versions, deployment identities, tool version and hashes are recorded in [environment.json](docs/evidence/week-10/environment.json). [Source provenance](docs/evidence/week-10/fixture-provenance.json) records SHA-256 hashes and confirms that the tracked public-data projection matches immutable upstream source without retaining account objects.

## Public sample and linkage

| Field | Selected sample |
| --- | --- |
| Network pair | Bitcoin Testnet3 / CKB Testnet |
| Bitcoin txid | `fd16aafb86ef05a373e59d2b812fcb117c65b647aa899085136913961127efca` |
| Bitcoin vout | `0` |
| CKB transaction | `0x6adafca165f29c713d15da4e9415d610c02c1b8ce585cc4f5430aa5de3e0e239` |
| CKB output index | `0x0` |
| RGB++ lock identity | `0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248`, hash type `type` |
| Expected / computed virtual commitment | `e2614965809a619bfa47b36631c3896fca24780336a8d524930dd61ef4e67d11` |

Lock args encode a little-endian uint32 output index followed by the Bitcoin txid in reverse display-byte order. The selected unsigned Bitcoin transaction spends that seal, while the virtual CKB transaction consumes the selected Cell. The commitment matches both the official expected value and its OP_RETURN output. Eleven offline linkage/commitment checks passed.

The snapshot is an upstream test fixture, not evidence of a transfer submitted by CellRoute. Its historical Cell and seal are separately identifiable on the test networks.

## Actual chain observations

The recorded public API/node run checked both genesis hashes and confirmed the configured RGB++ deployment transaction and type-script identity.

- Bitcoin API reported the selected UTXO as **spent**, with spending transaction `0da44932270292fd3a4165f1f7ab81abf69b951e1e7d3b5c012e00a291c6b222`.
- CKB RPC reported the historical transaction as **committed** and its containing block canonical, with Cell contents matching the fixture.
- `get_live_cell` returned **unknown**. The inspector preserves that response instead of inventing a dead/live label.
- The CKB tip advanced during the recorded read, so the capture is not an atomic snapshot. Each chain's tips and confirmation assessment are kept separately.

See [observations.json](docs/evidence/week-10/observations.json) for exact tips, timestamps and raw public responses. These are trusted API observations, not independent Bitcoin/CKB proof verification. The six-confirmation Bitcoin threshold is taken from the pinned SDK configuration and is not a finality guarantee.

## Verification and variants

| Validation | Recorded result |
| --- | --- |
| Immutable upstream public projection | Matched |
| Unit tests | 101 passed across 16 files, including 20 RGB++ checker/observer tests |
| Browser tests | 4 passed: readonly flow, stale-result invalidation/wrong vout, API outage, mobile layout |
| TypeScript / Vite production build | Passed; existing large-bundle warning remains |
| Negative and policy evidence | 10 cases recorded |
| SPV / header proof verifier | Not run; proof not verified |
| Signed transfer | Not performed |

Negative fixtures change txid, vout, commitment, output data, network and CKB OutPoint. They are rejected without broadcast. Additional cases cover missing proof, API outage, reorg and pending confirmations. Unit tests also distinguish spent/unspent and dead/live/unknown, test network mismatch, exercise independent chain failures, and enforce request bounds.

One implementation issue investigated was Node Buffer view offsets during Bitcoin decoding: reading a DataView from the underlying buffer without its byte offset could misread vout. Converting to independent Uint8Arrays resolved the discrepancy; the official sample now reproduces the expected seal and commitment in Node and the browser.

## Proof boundary and remaining work

The pinned service documents `getTxProof(txid, tx-index, confirmations)`, but no compatible SPV verifier/client-state execution was performed. Receiving proof bytes would not itself verify them. The UI and receipts always say **not verified**, including when input data attempts to supply a verified label.

Full typed-input coverage, token conservation, signatures and contract execution are outside this checker. Time locks and leap workflows are unsupported. API failures produce unknown state; no result is called cross-chain complete. The test-wallet, funding and proof-service prerequisites for a signed transfer were not established, so that extension was not attempted.

## Reproduce and review

Follow the [project guide](docs/rgbpp-inspector.md) for commands, network identities, encoding and source pins. Reviewers can replay the included fixture offline, verify its upstream projection, run the mismatch tests and optionally refresh public API observations. Offline fixtures, unit/browser tests and live observations remain distinct evidence layers.

Evidence: [binding map](docs/evidence/week-10/binding-map.json), [negative cases](docs/evidence/week-10/negative-cases.json), [verification log](docs/evidence/week-10/verification.md), [browser check](docs/evidence/week-10/browser-check.json), [inspector](docs/evidence/week-10/inspector.png), [chain observations](docs/evidence/week-10/observations.png), [console](docs/evidence/week-10/console.png).

Next: [Week 11 — xUDT extensions](docs/week-11-work-plan.md). A future RGB++ transfer requires a separately reviewed workflow, compatible proof infrastructure and evidence from both chains under an explicit confirmation policy.
