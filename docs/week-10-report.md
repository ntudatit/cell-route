# Week 10 — RGB++ and Bitcoin UTXO / CKB Cell Binding

**Project:** CellRoute / FiberPay  
**Report date:** 16 October 2026  
**Network observations:** 15 October 2026  
**Status:** Read-only inspection and mismatch tests implemented and reproduced. Full RGB++ proof verification and signed transfer remain incomplete.

## Objective

Understand how an RGB++ asset Cell on CKB is bound to a Bitcoin UTXO, how transaction commitments connect the two chains, and which evidence is required before claiming protocol validation or completion.

In my understanding, the Bitcoin UTXO acts as a single-use seal. The CKB Cell carries asset data and a lock that references that seal. Decoding this reference establishes a data relationship; it does not prove authorization, Bitcoin consensus, or successful RGB++ contract execution. A transaction commitment binds selected transaction data, while a compatible proof and contract validation establish additional conditions that a simple lookup cannot establish.

## Implemented in CellRoute

The `/rgbpp` page now opens a live, read-only inspector. Users can select Bitcoin Mainnet / CKB Mainnet or Bitcoin Testnet3 / CKB Testnet and provide their own CKB OutPoint or Bitcoin txid/vout. No bundled example is required to start a lookup.

The client checks network genesis and deployment identity, decodes RGB++ lock args, observes UTXO spend state and Cell live status, and exports a receipt with public responses and observation times. UTXO searches support paginated CKB indexer results and node rechecks. Empty indexer results do not prove that an asset never existed.

The original public fixture remains available under advanced regression tools. It reproduces the virtual transaction commitment and supports deliberate mismatch checks without broadcasting invalid transactions. Arbitrary live commitment reconstruction is not claimed by the live lookup.

Bitcoin inclusion checking recomputes the block header hash and the transaction Merkle branch against the supplied header. The header chain is not independently validated. The interface therefore keeps full RGB++ proof status as **not verified** and never marks the result cross-chain complete.

Requests have time and response-size limits, explicit cancellation, schema validation and error reporting. Editing inputs clears stale results. Provider URLs can be configured with public environment variables, and the feature console follows the selected inspector network.

## Sources and compatibility

| Source | Pinned revision | Purpose |
| --- | --- | --- |
| `ckb-devrel/ccc`, `rgbpp-sdk` branch | `1016ee901cef3b1aa5d4e25ae736b109c6f2717b` | Encoding reference; branch was accessible when checked |
| `RGBPlusPlus/RGBPlusPlus-design` | `5ebbf37d2dc8bd36729ba62392b2f6379b933538` | Script standard |
| `RGBPlusPlus/rgbpp-sdk` | `ee21eb9735c1adeb277e3a02b7f6c2f6fd1d0556` | Public fixture and unsigned transaction snapshot |
| Bitcoin SPV service source | `e9aa85a3e6ae3e5ac122a68c2fe4fb6d1ed69450` | Proof-service API reference; verifier not executed |

The implementation uses the portal's existing CCC core and ports the required read-only encoding logic. It does not install the historical branch package or claim a migration to another RGB++ SDK.

Exact identities and source hashes: [environment](evidence/week-10/environment.json), [fixture provenance](evidence/week-10/fixture-provenance.json), and [implementation guide](rgbpp-inspector.md).

## Reproduced fixture

| Field | Value |
| --- | --- |
| Network pair | Bitcoin Testnet3 / CKB Testnet |
| Bitcoin seal | `fd16aafb86ef05a373e59d2b812fcb117c65b647aa899085136913961127efca:0` |
| CKB OutPoint | `0x6adafca165f29c713d15da4e9415d610c02c1b8ce585cc4f5430aa5de3e0e239:0` |
| RGB++ lock code hash | `0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248` (`type`) |
| Expected and computed commitment | `e2614965809a619bfa47b36631c3896fca24780336a8d524930dd61ef4e67d11` |

Lock args contain a little-endian uint32 vout followed by the Bitcoin txid in reverse display-byte order. The fixture's unsigned Bitcoin transaction spends the selected seal; its virtual CKB transaction consumes the selected Cell. Eleven linkage checks passed, including comparison with the expected commitment and OP_RETURN output.

This is an upstream test snapshot, not a transfer submitted by CellRoute. [Binding map](evidence/week-10/binding-map.json) records expected and actual values.

## Actual public-chain observations

The following are dated observations, not a promise of current spendability. Reads were sequential rather than an atomic cross-chain snapshot.

| Lookup | Bitcoin observation | CKB observation | Inclusion / proof |
| --- | --- | --- | --- |
| Testnet3 fixture OutPoint above | Bound UTXO spent | Historical transaction committed; current Cell status unknown | Merkle inclusion matched supplied header; full proof not verified |
| Mainnet OutPoint below | Bound UTXO unspent, 546 sats | Cell live, 354 CKB | Merkle inclusion matched supplied header; full proof not verified |

Mainnet CKB OutPoint: `0x5c7fb5fc421a1d8b7321de2333c656487d741f973346c109afc72745770de954:0`.

Bound Bitcoin UTXO: `65b56e43e222e517071525b6a0247d546c5fe7a1e01e5cf29f420ac45b722705:0`.

The Mainnet Bitcoin transaction was observed in block 879635, at transaction position 2009. Exact headers, tips, raw responses and timestamps are retained in the [Mainnet receipt](evidence/live-labs/rgbpp-mainnet-cell.json) and [Testnet3 receipt](evidence/live-labs/rgbpp-testnet3-cell.json). These observations depend on the selected API/node providers.

## Tests and reviewer cases

| Check | Result |
| --- | --- |
| Latest portal unit/fixture suite | 121 passed across 21 files |
| Latest dedicated Labs browser suite | 9 passed |
| TypeScript / Vite production build | Passed; large-chunk warning remains |
| Runtime parser suite, broader Labs work | 4 passed; separate from RGB++ verification |
| Original Week 10 source projection | Matched immutable upstream public data |
| Original Week 10 fixture checks | 11 passed; 10 negative/policy cases recorded |
| Full RGB++ SPV / lock verifier | Not executed |
| Signed RGB++ transfer | Not performed |

The 121 unit tests and 9 browser tests cover the broader updated Labs, not RGB++ alone. Browser coverage includes captured Mainnet response replay with local Merkle calculation; that replay is not a new network observation. The earlier Week 10 checkpoint recorded 101 unit tests and 4 RGB++ browser tests. Both checkpoints retain their own evidence.

Negative cases include changed txid/vout, commitment, output data, CKB OutPoint and network; malformed or tampered Merkle data; missing proof; API failure; reorg and pending-confirmation fixtures. Wrong linkage is rejected, missing data remains unknown, and missing proof cannot produce a verified label. No invalid transaction was broadcast to create these cases.

Evidence: [negative-case table](evidence/week-10/negative-cases.json), [initial verification](evidence/week-10/verification.md), [latest Labs verification](evidence/live-labs/verification.md), and [original browser screenshots](evidence/week-10/inspector.png).

## Issue investigated

Bitcoin decoding initially mishandled Node Buffer view offsets. Constructing a DataView from the underlying buffer without accounting for the view offset could decode the wrong vout. Converting to independent Uint8Arrays resolved the discrepancy. The selected upstream seal and commitment now reproduce in Node and browser checks.

## Reproduction

Run from the repository root:

```powershell
npm --prefix portal test
npm --prefix portal run build
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix portal run test:e2e:labs
npm --prefix portal run rgbpp:verify-source
npm --prefix portal run rgbpp:evidence -- --live
node portal/scripts/rgbpp-live.mjs mainnet cell 0x5c7fb5fc421a1d8b7321de2333c656487d741f973346c109afc72745770de954 0
```

Use an installed Playwright browser/channel available on your machine. Public API commands require network access and may produce different current statuses. See [Live Labs](live-labs.md) for provider configuration and prerequisites.

## Limits and next work

The read-only exercise is reproducible: reviewers can inspect provenance, decode the fixture, compare commitments and run mismatch tests. The live inspector additionally handles user-supplied identifiers on both supported network pairs.

Full RGB++ proof verification remains incomplete. Matching a Merkle branch against an API-supplied header does not validate that header's consensus history, execute the RGB++ lock, verify signatures or establish token conservation. No RGB++ transfer was signed or broadcast; wallet, funding and compatible proof-service prerequisites were not established. No private key or seed phrase was added to the repository or public evidence.

Next steps are compatible SPV/client-state verification, followed by a separately reviewed test-network transfer with receipts from both chains and an explicit confirmation policy. Week 11 continues with [xUDT extensions](week-11-work-plan.md).
