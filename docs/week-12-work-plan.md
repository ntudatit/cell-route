# Week 12 — iCKB, NervosDAO and Conversion Checks

**Status:** Core read-only inspector and local SDK experiment implemented (31 October 2026). See the [implementation guide](ickb-inspector.md), [report](week-12-report.md) and [verification](evidence/week-12/verification.md). Funded preparation and signed lifecycle remain unperformed. Follow the [shared rules](advanced-weeks-9-12.md). This is a technical protocol exercise, not an investment plan or promise of returns.

## Objective

Understand how iCKB represents NervosDAO-related positions and test conversions/transactions with deterministic data. The main exercise verifies the SDK and builds a comparable preview; signed Testnet deposit/redeem is optional when prerequisites are met.

CellRoute can add iCKB to asset/transaction review after confirming units, rates, timing and script identity. Renaming a UI token does not make iCKB a 1:1 representation of CKB.

## Study material

- [iCKB website — labeled Whitepaper by the handbook](https://ickb.org/): at planning time this opened a DApp overview. Locate and pin the actual protocol/specification before quoting formulas.
- [GitHub organization](https://github.com/ickb/) and [SDK](https://github.com/ickb/sdk).
- [Audit linked by the handbook](https://scalebit.xyz/reports/20240911-ICKB-Final-Audit-Report.pdf): read scope, version and findings. A script audit is not an audit of CellRoute or the entire DApp.
- [Nervos: Unlocking CKB Liquidity](https://www.nervos.org/knowledge-base/Unlocking_CKB_Liquidity_iCKB).
- Review the [DAO deposit/withdraw RFC](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md) before the exercise.

The iCKB website describes the token as a liquid representation of deposits and offers a Testnet option. Actual redemption still requires checking protocol state and conditions; do not promise immediate processing in every case. [Source](https://ickb.org/).

**SDK verified during implementation:** the handbook repository returns 404. The official website links to `ickb/stack`; the pinned published SDK is 9001.0.0 at commit `5d00050d53f450951d40c8a564535b63a599bc76`. Its Node 26 checks package is isolated from the portal. See the guide for public APIs versus pinned internal test oracles.

## Five-hour plan

| Block | Budget | Output |
| --- | --- | --- |
| Review DAO, protocol and audit scope | 75 minutes | Lifecycle diagram and unit/rate/timing notes |
| Verify SDK and reference data | 60 minutes | Version, source and network/script metadata |
| Conversion fixtures and transaction preview | 105 minutes | Expected/actual accounting and failure cases |
| Reviewer walkthrough / weekly log | 60 minutes | Evidence, limitations and integration decision |

## Practical work

- [x] Identify RPC/genesis, deployed script versions and compatible packages/APIs from pinned sources.
- [x] Obtain a public snapshot with the required block/header references; distinguish CKB shannons, raw iCKB amounts and display decimals.
- [x] Identify formulas, rounding direction and fees from the SDK/specification. Compare SDK output with independent integer arithmetic on the same snapshot.
- [x] Create boundary fixtures: small amounts, round-trip conversion, out-of-range values, insufficient balance, stale state and unmet withdrawal conditions.
- [ ] Prepare a transaction with the SDK if supported by the environment. Review inputs/outputs, capacity, token amounts, fees, dependencies and constraints. Without broadcast, record prepared-only status.
- [x] Record relevant audit findings and the revisions to which they apply.

Optional extension: deposit and redeem through the Testnet lifecycle with an appropriately funded wallet. If maturity/liquidity or a service is unavailable, record pending/blocked status and a recheck timestamp. Do not shorten protocol conditions to complete a report.

## Reviewer invariants / variants

| Case | Invariant | Variant / expected outcome |
| --- | --- | --- |
| Conversion | Amount/rate/unit/rounding use the same specification and snapshot | Identical inputs produce reproducible integer results |
| Boundary / round trip | Error follows documented rounding rules without creating value | Vary amounts around boundaries; derive expected deltas from the specification |
| Network identity | Scripts and state belong to the selected chain | Reject incorrect genesis/dependencies |
| Deposit/receipt | Assets/claims are created under the selected protocol | UI balance alone does not establish redemption rights |
| Withdrawal timing | Spend only when protocol/DAO conditions are met | Unmet conditions produce pending status or rejection at the correct layer |
| Capacity accounting | Use appropriate DAO rules and header dependencies | Do not blindly apply ordinary input-minus-output fee accounting to DAO reward withdrawals |
| Stale quote/state | Preview is not a guarantee of execution | Refresh state and review again before signing |
| Submission | A hash is not a committed receipt | Query node status and compare outputs after commitment |

## Evidence and completion criteria

Store protocol/SDK revisions, environment, snapshot references, conversion vectors, any previews, logs and audit-scope notes under `docs/evidence/week-12/`. Actual result: 47 SDK/reference checks passed with an actual Testnet snapshot. The construction is unfunded; no signed lifecycle is claimed.

Complete the main exercise when formulas/units are identified from source, vectors are reproducible, and preview/SDK experiments have actual outcomes or clear blockers. Mark the live lifecycle complete only after all required steps commit and their resulting states are checked. Reading the DApp or passing unit tests does not replace this evidence.

The weekly report should cover DAO/iCKB lessons, implemented code, executed checks, signed operations performed or not performed, and remaining work. Summarize the four weeks with an evidence index rather than combining them into four late completion reports.
