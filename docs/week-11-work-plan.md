# Week 11 — xUDT Extensions and Custom Validation

**Status:** Implemented as a local-only VM lab (22 October 2026). See [implementation and reproducible commands](xudt-extension-lab.md) and the [actual mode matrix](evidence/week-11/mode-matrix.md). The optional portal adapter remains design-only; no extension deployment is claimed. Follow the [shared rules](advanced-weeks-9-12.md).

## Objective

Progress from Week 6's **basic xUDT** to understanding and testing an extension with an additional rule. Do not rewrite the Week 6 report to imply extension support: review the existing builder before extending it.

## Study material

- [xUDT introduction](https://docs.nervos.org/docs/tech-explanation/xudt).
- [How xUDT works](https://docs.nervos.org/docs/ecosystem-scripts/xudt#how-xudt-works).
- [Enhance sUDT's Programmability with xUDT](https://blog.cryptape.com/enhance-sudts-programmability-with-xudt).
- [RFC 0052](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md): determine flags, extension encoding, owner modes and invocation behavior for the exercise.

Read the RFC alongside the pinned implementation. Extensions add custom validation; do not assume every owner mode invokes extensions or has identical semantics. [Source: RFC 0052](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md).

## Five-hour plan

| Block | Budget | Output |
| --- | --- | --- |
| RFC and Week 6 baseline | 60 minutes | Mode/flags/args/data/dependency table |
| Select and build a minimal extension | 90 minutes | Source, rule, binary and code hash |
| Native VM fixtures | 90 minutes | Baseline, extension pass/fail and bypass analysis |
| Regression and weekly log | 60 minutes | Results, compatibility and integration decision |

## Practical work

- [x] Record deployment/VM versions and select a compatible official extension reference. Do not assume witness layout or method signatures.
- [x] Write a small extension specification, such as additional witness proof through the supported interface. State that it is a lab, not production governance.
- [x] Create two fixtures with identical token accounting that differ only in the extension condition; confirm an actual VM pass and failure.
- [x] Check implementation owner/normal modes. Document any extension bypass and limit claims; do not describe the extension as a rule applied to every transaction.
- [x] Check missing/incorrect dependencies and malformed extension encoding.
- [x] Retain a zero-extension basic xUDT fixture as a regression control. Measure cycles in the same environment without automatically interpreting them as fees.

Optional extension: an opt-in Token Lab adapter accepting verified extension configuration and displaying the rule/dependencies before signing. Do not silently make the default builder accept arbitrary extensions or trailing data. If time is limited, provide fixtures and an adapter design only.

## Reviewer invariants / variants

| Case | Invariant | Variant / expected outcome |
| --- | --- | --- |
| Basic baseline | Week 6 behavior remains unchanged | No extension: control passes |
| Extension invocation | Overall result reflects the additional rule in the selected mode | Valid proof passes; invalid proof fails |
| Inflation | Normal mode cannot create unauthorized tokens | Output exceeding input is rejected even with a valid extension |
| Transfer/burn | Distinguish contract conservation rules from UI policy | Transfer UI preserves totals; explicit burn reduces the exact amount |
| Owner behavior | Disclose protocol-permitted bypasses | Test each mode and identify branches that invoke extensions |
| Missing dependency | Never fall back to basic token validation and omit the rule | Reject or return an explicit error |
| Unknown flags/data | Never discard unrecognized data | Builder rejection or script validation as applicable |
| Review mutation | Sign the transaction that was reviewed | Changing extensions/args/dependencies invalidates review |

## Evidence and checks

Store RFC/source revisions, the extension specification, artifact hashes, complete public fixtures, mode matrix, VM output/cycles and limitations under `docs/evidence/week-11/`. Actual result: 31 VM cases passed; see the [mode matrix](evidence/week-11/mode-matrix.md). Network deployment and the UI adapter are not implemented.

After adding fixtures, run their targeted tests and baseline token tests. For portal changes, run `npm test` and `npm run build` from `portal/`, plus targeted encoding/review tests. Implemented contracts commands: `xudt:setup`, `xudt:build`, `xudt:test`, `xudt:evidence`; see the [guide](xudt-extension-lab.md).

Complete the exercise when one extension rule has actual VM pass/fail outcomes, owner behavior is explained, basic token regression is checked and a reviewer can reproduce the results. Mark undeployed work local-only. One extension lab does not mean CellRoute supports all xUDT extensions.

Next: [iCKB](week-12-work-plan.md), applying token knowledge and reviewing DAO before preparing transactions.
