# Week 12 Report — iCKB, NervosDAO and Conversion Checks

**Project:** CellRoute / FiberPay

**Execution date:** 31 October 2026

**Status:** Read-only inspector, independent conversion checks and SDK construction experiment implemented. Funded preparation and the signed deposit/redeem lifecycle remain unperformed.

## Outcome

I added `/ickb` to CellRoute with public snapshot checks, exact amount handling, separate receipt accounting and indicative pricing, an unfunded deposit/receipt construction preview, receipt export and a feature-specific Dev Console. Inputs start empty and no signing or submission controls are exposed.

The reference SDK is isolated from the React application. `@ickb/sdk` 9001.0.0 requires Node 26 and CCC 1.23.0, while the existing portal keeps its current toolchain. The handbook SDK URL returned 404; the official iCKB website points to the stack repository. Registry provenance metadata identifies stack commit `5d00050d53f450951d40c8a564535b63a599bc76`, which is pinned alongside package integrity and comparison-module hashes.

## Source versions

| Component | Pinned version / revision |
| --- | --- |
| iCKB SDK | `@ickb/sdk` 9001.0.0 |
| SDK source (`ickb/stack`) | `5d00050d53f450951d40c8a564535b63a599bc76` |
| Isolated verification runtime | Node 26.13.0, CCC 1.23.0 |
| Portal CCC | 1.19.1; not upgraded for the SDK checks |
| iCKB whitepaper | `3e0ffbdc1a776150439ab322018d61da03c27481` |
| DAO RFC 0023 | `37d0c2537bfb7bc9285b1715632c7ffbd785dfa9` |
| Contract review snapshot | `c951927e35fb5d4a13e28c5e55687d49cea7ca05` |
| Contract revision identified by the reviews | `454cfa966052a621c4e8b67001718c29ee8191a2` |

See [protocol sources](evidence/week-12/protocol-sources.json), [SDK provenance](evidence/week-12/sdk-provenance.json) and [environment](evidence/week-12/environment.json). Inspecting registry provenance metadata is not independent verification of its Sigstore signatures.

## Protocol understanding

An iCKB receipt represents deposits with a value tied to their commitment block's DAO accumulated rate. Accounting uses free capacity after the 82 CKB occupied portion. It applies floor division and a per-deposit discount above the soft cap. This is different from the SDK's gross exchange ratio and ceiling-rounded order pricing.

A calculated iCKB-to-CKB price does not identify a mature pool deposit or authorize a DAO withdrawal. Pool availability, selection margins, header dependencies, lock constraints and actual fees still matter. Ordinary input-minus-output accounting must not be blindly reused for DAO reward withdrawal fees.

## Executed work and evidence

| Check | Actual result |
| --- | --- |
| Live Testnet snapshot | Genesis, header content hash/canonicality and live iCKB/DAO deployment identities checked |
| SDK / independent arithmetic and negative cases | 47 checks passed |
| Deposit constructor comparison | Serialized output skeleton matched the pinned SDK byte-for-byte |
| Portal unit suite | 139 tests passed across 23 files, including 15 iCKB tests |
| iCKB browser checks | 2 passed, including recorded-response replay, review invalidation, network switching and outage/mobile behavior |
| Production build | Passed; existing large-chunk warning remains |
| Funded wallet preparation | Not performed |
| VM execution / signing / broadcast / commitment | Not performed for the deposit construction |
| Live deposit/redeem lifecycle | Not performed |

The Testnet capture is anchored at header `0xc81960cdc1169df82496ad826d26529ae006a4fc25a65296af64fedbc52ad321`, block `0x15dc1f2`, with accumulated rate `11944065912622031`. Observed at `2026-10-31T09:58:04.415Z`.

The public construction uses a synthetic 20-byte lock args solely for structural comparison. For 1,000 free CKB it contains a 1,082 CKB deposit and a 208 CKB receipt reserve, totaling 1,290 CKB before funding and network fees. It has no inputs and is not a valid funded transaction. No private keys or seed phrases were generated or stored.

SDK checks include soft-cap boundaries, integer round trips, fee/amount bounds, insufficient-balance builder guards, malformed data, stale/cross-network state and controlled withdrawal-window cases. The timing cases verify SDK selection policy rather than actual pool spendability.

Evidence: [environment](evidence/week-12/environment.json), [snapshot](evidence/week-12/snapshot-testnet.json), [vectors](evidence/week-12/conversion-vectors.json), [construction](evidence/week-12/deposit-construction.json), [UI screenshot](evidence/week-12/inspector.png), and [verification log](evidence/week-12/verification.md).

## Issue investigated

A real deployed dependency contains enough public code/data to exceed the shared 1 MiB response limit. The initial read failed explicitly. The iCKB reader now uses a bounded 4 MiB override, with per-request and overall deadlines; other features keep the original limit. The live SDK run then completed successfully.

The inspector and SDK runner also distinguish historical replay from new RPC observations. Replaying the recorded snapshot evaluates freshness at its original observation time and writes separate ignored results, preserving the actual capture.

## Audit scope and integration decision

I reviewed the ScaleBit report's version, scope, findings and limitations, including its acknowledged pool-availability and limit-order concerns, and inspected the later versioned contract review. These reviews cover specified L1 scripts, not CellRoute or SDK 9001.0.0. They are not production certification. See [audit notes](evidence/week-12/audit-notes.md).

This integration excludes limit-order execution and signing. It uses pinned internal SDK helpers only as test oracles; those helpers are not imported into the portal and are not presented as stable public APIs. The public SDK's builder experiments exercise rejection guards without accessing a wallet.

## Reproduce and next steps

From the repository root, install dependencies and build the independent comparison bridge:

```powershell
npm --prefix portal ci
npm --prefix contracts/ickb-checks ci --ignore-scripts
npm --prefix portal run ickb:bridge
npm exec --yes --package=node@26.13.0 -- node contracts/ickb-checks/verify.mjs testnet --replay
npm --prefix portal test
npm --prefix portal run build
```

The SDK verification must execute under Node 26. The `--replay` command uses the recorded snapshot and writes historical replay results into ignored build storage; it neither refreshes the chain observation nor overwrites its public evidence. Omit `--replay` only when deliberately collecting a new live Testnet snapshot.

Follow the [iCKB guide](ickb-inspector.md) for exact setup, source references, formulas and commands. It documents live collection and historical replay separately.

The core study exercise has actual SDK and preview outcomes. Completing the optional lifecycle requires funded Testnet wallets, live account/pool selection, fully funded preparation, DAO-aware review, a wallet signature, node commitment and post-state checks. None is inferred from the current quote or construction.

The [advanced evidence index](advanced-evidence-index.md) summarizes Weeks 9–12 by verification layer and remaining work without treating every planned chain action as completed.
