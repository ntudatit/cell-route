# Week 10 — RGB++ and Bitcoin UTXO / CKB Cell Binding

**Status:** Read-only core implemented (15 October 2026). Proof not verified; transfer not performed. Follow the [shared rules](advanced-weeks-9-12.md).

## Objective

Understand the RGB++ asset model, the relationship between Bitcoin UTXOs and CKB Cells, and the role of transaction commitments/proofs in validation. The main exercise reproduces a public reference; a test-network transfer is optional. An explorer entry does not prove full protocol verification.

## Study material

- [Introduction](https://rgbpp.com/docs/introduction) and [light paper](https://talk.nervos.org/t/rgb-protocol-light-paper-translation/7790).
- [Resource Hub](https://rgbpp.com/docs/resources): locate version-compatible script standards, Bitcoin SPV and APIs.
- [CCC RGB++ SDK branch linked by the handbook](https://github.com/ckb-devrel/ccc/tree/rgbpp-sdk): confirm availability and pin its commit. If replaced, document an official migration source before using a different API.
- [RGB++ Explorer](https://explorer.rgbpp.io/en): useful for comparison, but not a substitute for node/proof validation.

The introduction describes RGB++ as using CKB programmability for Bitcoin-related assets. Identify which data and evidence belong to each chain. [Source](https://rgbpp.com/docs/introduction).

## Five-hour plan

| Block | Budget | Output |
| --- | --- | --- |
| Light paper and flow diagram | 60 minutes | Actors, UTXO, Cell, commitment, proof and states |
| Check environment/SDK and obtain reference data | 60 minutes | Revisions, network pair and public provenance |
| Check reference data and negative fixtures | 120 minutes | Inspector/test script and logs |
| Reviewer walkthrough | 60 minutes | Per-chain evidence and limitations |

## Main practical work

- [ ] Verify the Bitcoin/CKB test-network pair, APIs, deployment hashes and version-compatible proof service. Never mix Bitcoin Mainnet with CKB Testnet.
- [x] Select an official transaction/fixture with provenance; record Bitcoin txid:vout, CKB transaction/OutPoint and script identity.
- [x] Decode binding/commitment fields according to the selected standard. Map data source to expected and actual values.
- [x] Check UTXO and live Cell status at specific blocks/tips; distinguish historical data from current state.
- [x] Separate syntax/linkage checks from proof verification. Only label proof verified after running a compatible verifier with recorded inputs and outputs.
- [x] Mutate vout, commitment or network in fixtures to demonstrate mismatch detection. Do not broadcast invalid transactions merely to produce negative cases.

Optional extension: use two appropriately funded test wallets to prepare, review and submit a transfer. Track each chain separately and record the confirmation policy from the selected configuration/protocol. If wallet/proof/service prerequisites are incomplete, stop at inspection and record that no transfer occurred.

## Reviewer invariants / variants

| Case | Invariant | Variant / expected outcome |
| --- | --- | --- |
| Asset binding | UTXO/Cell pair follows the standard's encoding | Detect incorrect txid/vout |
| Commitment | Committed data matches the transaction under inspection | Relevant data mutation produces mismatch |
| Proof | Proof belongs to the correct transaction/header/network | Incorrect or missing proof is never labeled verified |
| Ownership/spend | Historical data does not establish current spendability | Accurately display spent UTXOs or dead Cells |
| Confirmation | Determine each chain's status independently | One pending chain cannot imply cross-chain completion |
| Service failure | Explorer/API unavailability does not imply asset absence | Unknown state with an error source |
| Reorg fixture | Do not retain finalized status after confirmation assumptions fail | Refresh/reconcile under the recorded policy |

## Evidence and completion criteria

Store environment/version information, binding maps, public fixture hashes, raw responses with secrets removed, proof results or **not verified**, screenshots and a negative-case table under `docs/evidence/week-10/`. Initial planning status: **Not run**.

The main exercise is complete when a reviewer can reproduce reference decoding/comparison and mismatch tests and identify which proofs were or were not verified. Mark an on-chain transfer complete only with corresponding evidence from both chains under the selected workflow. Two transaction hashes do not imply atomic completion.

Suggested CellRoute integration: a read-only RGB++ asset inspector. Keep it separate from ordinary CKB transfers until the protocol flow is checked. Next: [Week 11 — xUDT extensions](week-11-work-plan.md).

## Implementation evidence — 15 October 2026

Core read-only exercise implemented: see the [project guide](rgbpp-inspector.md), [Week 10 report](../README-WEEK-10.md) and [verification](evidence/week-10/verification.md). Public reference data and mismatch cases are reproducible. Public API observations are recorded separately. Proof is not verified; no signed transfer was attempted.

The network pair, public APIs and RGB++ deployment were checked. Compatible proof service/verifier prerequisites remain unconfirmed; the pinned API is documented, and no proof verification is claimed.
