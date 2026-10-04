# Week 8 — Spore/DOB & Script Performance

**Project:** CellRoute / FiberPay Platform  
**Date:** 04 Oct 2026  
**Scope:** Existing React portal and contract runtime lab. No separate application.

## Status and evidence boundaries

Implemented: shared transaction preparation/review/signing/observation, live Spore reading, Cluster authorization checks, bounded DOB/0 Worker preview and a reproducible CKB-VM benchmark.

Tested locally: 75 unit tests, production build, four browser tests, runtime verification and benchmark. Detailed command results appear below.

Verified by read-only Testnet RPC: genesis, live V2 Spore/Cluster deployment code hashes, and the DOB/0 decoder binary's code hash. This does **not** prove any new object was minted.

| Chain action                                  | Status       |
| --------------------------------------------- | ------------ |
| CREATE                                        | NOT EXECUTED |
| READ of a newly created object                | NOT EXECUTED |
| TRANSFER A → B / old-owner rejection on chain | NOT EXECUTED |
| MELT by B                                     | NOT EXECUTED |
| CLUSTER create / linked mint                  | NOT EXECUTED |

These operations require funded interactive wallets A/B and signed, reviewed transactions. No transaction hash or committed receipt has been invented. [Evidence directory](evidence/week-8/) contains separate records for each action.

## Environment and repository inventory

Package manager: npm, with separate portal and contracts lockfiles. Portal uses CCC `Transaction`, `Cell`, `Script` and `Signer`; no other SDK's transaction skeleton is introduced.

| Component             | Version                                        |
| --------------------- | ---------------------------------------------- |
| Node                  | 24.19.0                                        |
| Portal CCC core       | 1.19.1                                         |
| CCC connector-react   | 1.1.9                                          |
| CCC Spore             | 1.6.9, pinned in package manifest and lockfile |
| Contracts CCC core    | 1.12.2, unchanged                              |
| Vitest / Playwright   | 4.1.11 / 1.62.1                                |
| AssemblyScript / WABT | 0.27.31 / 1.0.42                               |
| xPack RISC-V GCC      | 15.2.0-1                                       |
| ckb-debugger          | 1.1.1                                          |

Existing commands were retained: `runtime:setup`, `runtime:build`, `runtime:verify`, `runtime:debug`, `runtime:test`. The added `runtime:benchmark` compiles both variants and saves measurements. The runtime remains the Week 7 AssemblyScript → WASM → generated C → RISC-V pipeline; `fib.ts` is iterative.

The portal defaults to Testnet through `VITE_CKB_NETWORK`. The selected connector client and signer client must agree on network and canonical genesis. Mainnet-configured builds cannot switch this workflow to Testnet. In a Testnet-configured build the connector can select Mainnet explicitly; the review displays that selection. Both clients' genesis and live code dependencies are checked before preparation and signing. Devnet is rejected because this project has no verified Spore deployment configuration for it.

[environment.json](evidence/week-8/environment.json) records exact code hashes, data1 hash types, code OutPoints, depTypes, sanitized RPC origin and observation time. Supported contract version is the installed SDK's **V2 deployment**; this is not an invented upstream release tag. Mainnet code dependencies are checked when used but were not probed during this task.

## Architecture and transaction review

Implementation: [lifecycle.ts](../portal/src/features/spore/lifecycle.ts), [Studio.tsx](../portal/src/features/spore/Studio.tsx). Both `/dob-spore` and `/spore-clusters` use this infrastructure; the guide directs users to it instead of maintaining another direct-send implementation.

```text
prepare → review → signOnlyTransaction → broadcast → observe
                                                   ├─ pending / proposed
                                                   ├─ committed → verify live state
                                                   └─ rejected / timeout
```

Preparation uses actual CCC Spore builders, completes capacity and fee, and prepares signer witnesses before review. Review contains chain identity, operation, owner/recipient locks, asset IDs, content MIME/byte count/hash, full input/output models, input/output capacity, object capacity, untyped change, fee in shannons and serialized bytes. Melt has an explicit irreversible confirmation checkbox.

The review expires after five minutes. Inputs must still be live. Changing the wallet or network invalidates the review. Raw transaction hashes must match before and after signing. A signed transaction that exceeds the reviewed fee budget is rejected before broadcast. Form fields remain frozen until the review closes. Observation uses uncached node transaction state, with a three-minute deadline; a timeout is not proof of rejection. The original public broadcast receipt can be retained, and commitment verification can be retried without resubmitting.

## Create, read, transfer and melt

Create accepts public text or a file, limited to **16 KiB by this product**, not by a claim about Spore's theoretical maximum. Text is UTF-8 encoded; Vietnamese fixtures exercise byte counts and content hashing. The default text uses `text/plain`, with no `immortal` flag.

Read finds the indexed V2 Spore by ID and cross-checks its current OutPoint/data using the node. It displays lock, type, capacity, decoded bytes, MIME, content hash and Cluster reference. An absent indexer result is not treated as proof of melt. Original create-review bytes/hash are compared automatically while retained in the same wallet/network session; after reload, compare against the exported creation receipt. Read evidence is exportable separately.

Transfer checks the live owner's lock against the connected wallet's addresses. The builder output must preserve type/ID and the exact serialized data while changing to the intended recipient. Following commitment, verification checks consumed inputs, the new indexed OutPoint, output data/lock and node liveness. The old-owner negative unit test checks the actual Cell lock supplied to the service, not a UI ownership flag; a live A → B → failed A sequence remains NOT EXECUTED.

Melt consumes the Spore Cell. **It does not erase blockchain history.** After node commitment, verification checks the consumed inputs, absence of a recreated Spore output, indexer absence and `sum(inputs) − sum(outputs) = reviewed fee`. If the indexer lags, the UI reports verification pending and offers recheck. Returned capacity includes funding/change where applicable; it is not assumed to equal the original object capacity minus fee in isolation.

## Cluster behavior

`clusterCell` mode consumes and recreates the Cluster with unchanged data, type, lock and capacity. The SDK adds its code dependency, Cluster OutPoint dependency and cobuild transfer action. The application requires the wallet to own the Cluster lock and checks the preserved output/input/dependency. Unknown or malformed Cluster IDs fail; the requested link is never dropped.

The optional pinned-DOB mint additionally requires the selected Cluster description to match the official basic-loot pattern and decoder reference exactly. Create this Cluster first, confirm its node commitment and live state, then use its ID to mint the linked Spore.

## DOB/0 fixture and decoder safety

Cookbook source: [basic-loot at 969db44523c7bad75ebc126a513353163843c3df](https://github.com/sporeprotocol/dob-cookbook/blob/969db44523c7bad75ebc126a513353163843c3df/examples/dob0/0.basic-loot.ts). Its MIT license and unmodified example are retained in [upstream](evidence/week-8/upstream/).

Reference semantics: [official decoder source at a592680c9a507a014ebf505075cbef0b21382799](https://github.com/sporeprotocol/spore-dob-0/blob/a592680c9a507a014ebf505075cbef0b21382799/src/decoder/mod.rs). The deployed decoder identity is `0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c` (CKB code hash).

The Cookbook's randomly generated DNA is replaced by fixed **0102030405060708** for reproducibility. Pattern is unchanged:

| Trait           | DNA bytes          | Rule                                  | Expected value |
| --------------- | ------------------ | ------------------------------------- | -------------- |
| BackgroundColor | offset 0, length 1 | options modulo 5                      | blue           |
| Type            | offset 1, length 1 | range [10, 50), exclusive upper bound | 12             |
| Timestamp       | offset 2, length 4 | little-endian raw number              | 100992003      |

On chain, Spore Molecule data contains MIME `dob/0`, JSON `{ "dna": "…" }` bytes and Cluster ID. Cluster description contains the serialized DOB/0 pattern and decoder reference. Decoder bytes reside in a separately referenced Cell. This example uses no external image/font/HTML resource. Before minting, the Studio preview is only local data.

The portal contains a **restricted TypeScript reference port**, not a general interpreter and not execution of downloaded RISC-V. It accepts only the pinned pattern and eight-byte DNA. A fresh Worker is terminated after completion, error or a two-second timeout. Responses are capped at 4 KiB and schema validated. Unknown patterns, malformed DNA, disabled/unavailable workers, oversized output and malformed response schema fail explicitly. Attributes render as escaped React text; raw metadata remains visible on error. No decoder URL, eval, arbitrary HTML or main-API-process execution is supported.

The actual on-chain decoder binary was downloaded and its hash verified in the read-only probe. Local execution with ckb-debugger 1.1.1 failed with `invalid instruction pc=0x18c70 instruction=0x44e6a7af`. [dob-fixture.json](evidence/week-8/dob-fixture.json) preserves that result with status **UNAVAILABLE**, not a successful decode. Worker tests check source-derived expected values; binary-vs-Worker execution conformance remains unverified until a compatible decoder runner is available.

## Script baseline, optimization and measurements

`runtime.c` originally clears a fixed 64 KiB memory page on every allocation, including its initial use. The candidate enables `LAB_SKIP_INITIAL_ZERO`: rely on the ELF loader's initial BSS zero bytes once; retain explicit clearing for all reuse, even across free/init. Bounds checks and Fibonacci semantics remain unchanged. This optimization is specific to this single-memory runtime, not a generic allocator or a Duktape optimization.

Both builds use the same `-O2`, target architecture, generated C and runtime flags; only that define changes. `-g` remains enabled, so binary sizes are full debug-bearing ELF sizes, not stripped deployment sizes. Evidence includes GCC command/flags, tool versions, source HEAD plus SHA-256 hashes for modified sources/artifacts, fixture hash, binary hash, raw debugger output and five runs per input. Source HEAD alone does not identify uncommitted modifications; the recorded source hashes do.

| Metric                  | Baseline | Optimized |   Delta | Delta % |
| ----------------------- | -------: | --------: | ------: | ------: |
| CKB-VM cycles, fib(10)  |   35,021 |     2,161 | −32,860 | −93.83% |
| Binary bytes, debug ELF |   28,480 |    28,608 |    +128 |  +0.45% |

Correctness: all inputs 0–10 plus −1, 11 and `abc`, five repetitions each, in both variants. Output for input 10 remains 89; invalid inputs remain result 2. Each variant also passes a full-page initial-zero and free/reallocation-zero check. These are **local standalone VM programs**, not committed transactions. Nonzero Fibonacci results are expected return values, not contract rejection evidence.

Transaction bytes and fees are **not measured for this benchmark** and remain null. Lower cycles do not establish a lower fee. RPC latency, browser latency, binary bytes, serialized transaction bytes and node commitment are separate observations.

## Reproduction and validation

Executed results:

| Command                                                                                       | Result                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `portal: npm test`                                                                            | PASS — 75 tests in 13 files, including 21 new Spore/DOB cases                           |
| `portal: npm run build`                                                                       | PASS — TypeScript + Vite; existing large-chunk warning remains                          |
| `portal: npx playwright test e2e/spore-week8.spec.ts e2e/dev-console.spec.ts --reporter=line` | PASS — 4 browser tests; desktop/mobile screenshots inspected                            |
| `portal: node scripts/week8-environment.mjs`                                                  | PASS — read-only Testnet genesis/deployment/decoder hashes                              |
| `contracts: npm run runtime:test`                                                             | PASS — parser tests, runtime fixtures, Simple Lock cases, GDB breakpoint check          |
| `contracts: npm run runtime:benchmark`                                                        | PASS — 140 VM fixture executions plus 2 memory checks                                   |
| `contracts: node scripts/dob-verify.mjs`                                                      | UNAVAILABLE / exit 1 — official decoder instruction unsupported; failure evidence saved |

The initial browser run exposed the wallet-only route guard; readonly Studios now open without a wallet, while preparation/signing still require one. Backend asset audit recording is retained as an optional asynchronous step; it never blocks observation or replaces commitment evidence.

From `portal/`:

```powershell
npm ci
npm test
npm run build
npx playwright test e2e/spore-week8.spec.ts e2e/dev-console.spec.ts --reporter=line
node scripts/week8-environment.mjs
```

From `contracts/`:

```powershell
npm ci
npm run runtime:setup
npm run runtime:test
npm run runtime:benchmark
node scripts/dob-verify.mjs
```

`runtime:setup` is needed on a fresh machine; it downloads pinned tools. Existing local tools were reused here. `dob-verify.mjs` intentionally returns exit 1 on the documented unsupported-instruction failure and writes truthful evidence. Run the environment probe first to obtain the verified decoder binary under ignored `contracts/build/`.

Unit coverage includes Unicode/limits/hash, review capacity/fee fields, malformed/unknown Cluster IDs, deployment/network mismatch, live-lock authorization, transfer preservation, melt confirmation, transaction mutation, node status/timeout/rejection and indexer/node distinction. DOB covers deterministic expected attributes, malformed DNA/pattern, unavailable, timeout, response size/schema and Worker termination. Existing Dev Console tests cover network/feature isolation and redaction.

## Dev Console and evidence

Events use the existing feature/network scopes and static operation labels: prepare, review, sign-start, broadcast, tx-hash, observe, committed, read-live-cell, transfer, melt, cluster and dob-decode. Uncached RPC observations and signOnlyTransaction are now instrumented. Arguments, signatures, raw payloads and signing secrets are excluded; JSONL export uses the existing store. A completed prepare log means preparation completed, not chain commitment.

Evidence JSON files contain public deployment metadata and explicit operation statuses. The broadcast receipt records unverified submission; verified export requires node commitment, consumed inputs and indexed state checks. Browser/unit test mocks are not blockchain evidence.

## Remaining work requiring external interaction

Use funded Testnet wallets A and B to create/read/transfer/melt and create/link a Cluster. Export each review, broadcast receipt, node-verified evidence and scoped JSONL. Record actual old-owner failure after transfer. Keep the specific consumed OutPoint and fee reconciliation in melt evidence. Do not count an indexer miss as success.

A compatible official DOB runner is still required for binary conformance. Mainnet wallet flows and Devnet deployment are not verified. DOB/1, SVG rendering, arbitrary decoders and broad protocol-version support remain optional extensions outside this implementation.

## Protocol references

- [Nervos Spore explanation](https://docs.nervos.org/docs/tech-explanation/spore-protocol)
- [Spore documentation](https://docs.spore.pro/), [transfer](https://docs.spore.pro/recipes/Transfer/transfer-spore), [melt](https://docs.spore.pro/recipes/Melt/melt-spore), [contracts](https://docs.spore.pro/resources/contracts), [DOB Cookbook](https://docs.spore.pro/dob/dob-cookbook)
- [Performant WASM](https://docs.nervos.org/docs/script-course/intro-to-script-8), [Duktape cycle reductions](https://docs.nervos.org/docs/script-course/intro-to-script-9), [Molecule serialization](https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb)
