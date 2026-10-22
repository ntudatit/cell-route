# Advanced roadmap — Weeks 9–12

**Status:** Plan, not a completion report. The four topics follow the Advanced section of the supplied handbook; the handbook does not prescribe these week numbers. Record actual execution dates and time spent when work begins.

CellRoute / FiberPay already has CKB asset flows, Token Lab and Spore/DOB. These four weeks focus on protocol study and reproducible experiments; they do not imply that every protocol is integrated into the application.

| Week | Topic | Minimum exercise | Optional extension |
| --- | --- | --- | --- |
| [9](week-9-work-plan.md) | SSRI | Query an identified script through a local server, decode the response and test failures | Read-only SSRI inspector in CellRoute |
| [10](week-10-work-plan.md) | RGB++ | Analyze a Bitcoin UTXO / CKB Cell pair, its binding and proof status | Transfer on an SDK-supported test network |
| [11](week-11-work-plan.md) | Advanced xUDT | One extension with positive and negative VM fixtures | Opt-in transaction builder in Token Lab |
| [12](week-12-work-plan.md) | iCKB | Check conversion/rounding and prepare a transaction with a verified SDK version | Testnet deposit/redeem when prerequisites are met |

## Shared execution rules

- Budget 4–5 hours per week. If setup takes longer, record the blocker and completed work; do not present objectives as results.
- Pin source commits, SDK/server/tool versions, lockfiles and artifact hashes. A branch or audit link does not prove that the artifact uses the audited version.
- Use fixtures, a local chain or a test network for signed exercises. Writing a plan does not deploy, sign or transfer assets.
- Distinguish reading, unit tests/mocks, VM execution, RPC observations, broadcast and node commitment. Success at one layer does not establish success at another.
- Reviewer tables must record the invariant, input/state variant, expected/actual outcome and evidence. Store only public information; never store keys, seeds, access tokens or wallet storage.
- Weekly reports must reflect work actually performed, lessons learned, issues, evidence and next steps. Do not publish four plans as completed reports.

## Shared evidence template

Create `docs/evidence/week-N/` during execution; do not fabricate receipts while planning.

| Field | Required content |
| --- | --- |
| Case / date / source revision | Case identifier, execution date and source revision |
| Environment | Network/genesis, tool versions, script/code identity and RPC origin with secrets removed |
| Input / expectation | Public inputs and the rule being checked |
| Actual status | Not run / pass / fail / blocked, with the verification layer |
| Evidence | Command, log, fixture hash, screenshot or transaction/proof identifier |
| Limitation | Mock data, missing node/wallet, pending confirmation or unsupported version |

Sources are linked in each weekly plan. Some handbook URLs are historical; check compatibility before copying commands. Creating these plans does not itself execute tests or chain actions.
