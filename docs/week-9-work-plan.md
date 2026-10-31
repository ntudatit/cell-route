# Week 9 — Script-Sourced Rich Information (SSRI)

**Status:** Planned. Follow the [shared rules and evidence template](advanced-weeks-9-12.md).

## Objective

Learn how SSRI queries information and behavior from scripts, then build a small client that invokes a method and decodes its result. In CellRoute, this could display token/script information without relying exclusively on manually entered metadata. An SSRI response does not replace on-chain validation or wallet signing authority.

## Study material

1. [SSRI introduction](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256/2).
2. [ckb-ssri-std SDK](https://crates.io/crates/ckb-ssri-std) and the [version 0.0.1 documentation linked by the handbook](https://docs.rs/ckb-ssri-std/0.0.1/ckb_ssri_std/). Select a version compatible with the implementation; do not assume 0.0.1 is current.
3. [Prototype contract](https://github.com/Hanssen0/ssri-test) and [SSRI server](https://github.com/ckb-devrel/ssri-server).
4. [Pausable UDT](https://github.com/Alive24/pausable-udt) and the [audit linked by the handbook](https://github.com/Alive24/pausable-udt/blob/master/20241224-Pausable-UDT-Final-Audit-Report.pdf): study the application and audit scope; this is not certification of CellRoute code.

The server README demonstrates `run_script_level_code` and the method path for `SSRI.get_methods`. Determine the API/encoding from the pinned revision and use the code OutPoint from your environment instead of copying a sample hash. [Source](https://github.com/ckb-devrel/ssri-server).

## Five-hour plan

| Block | Time | Output |
| --- | --- | --- |
| Read protocol/SDK and select revisions | 60 minutes | Method/context/encoding and compatibility notes |
| Run the server and reference script | 90 minutes | An actual method call, raw response and decoded value |
| Test variants and failures | 90 minutes | Actual outcomes for the cases below |
| Pausable UDT/audit and report | 60 minutes | Trust boundaries, evidence and conclusions |

## Practical work

- [ ] Record the server, contract and SDK commits; determine how the selected version builds and deploys/loads code.
- [ ] Confirm code hash, code OutPoint and network; list supported methods and contexts.
- [ ] Run method discovery, then query information the script actually provides. Save encoded parameters, raw results and the decoding schema.
- [ ] Bound client execution time and response size. Handle HTTP/JSON-RPC errors, invalid output schemas and unsupported methods.
- [ ] Read Pausable UDT to distinguish queryable information from contract-enforced pause/unpause rules and authorization. Record method names from source rather than inventing an API.
- [ ] Record audit version, scope and relevant findings. If the full audit has not been read, mark that review incomplete.

Optional extension: a read-only CellRoute inspector displaying code identity, method, context and result. Do not automatically sign transactions based on responses. Updating Token Lab or rewriting the SSRI server is outside this exercise.

## Reviewer invariants / variants

| Case | Invariant | Variant and expected outcome |
| --- | --- | --- |
| Valid method | Response belongs to the identified script and execution context | Change valid parameters; decode using the pinned schema |
| Repeated context | Results follow the method's semantics | Pin the same chain snapshot for state-dependent methods |
| Unsupported method | No fabricated metadata or empty success | Show an explicit error and retain public raw diagnostics |
| Incorrect code/OutPoint | Do not use another script's result | Reject identity mismatch or unavailable code |
| Timeout/invalid schema | Client/UI does not hang or imply validation success | Bounded failure with deliberate retry |
| Pause information | Reading state does not authorize changing it | Separate authorization tests for mutations |

## Evidence and completion criteria

Store `environment.json`, `method-calls.json`, `verification.md`, screenshots and audit notes under `docs/evidence/week-9/`. Initial planning status: **Not run**.

Complete the exercise when one real method executes, its response is decoded, at least three negative cases have outcomes, and a reviewer can distinguish SSRI queries from on-chain validation. If server/toolchain setup is blocked, record reading/fixture progress separately and do not mark the runtime demonstration complete.

Weekly report: objective, source versions, SSRI explained in your own words, commands/results, one investigated issue, limitations and the [Week 10 plan](week-10-work-plan.md).

## Implementation evidence

Read-only SSRI Inspector and real Devnet demonstration implemented. See the [project guide](ssri-inspector.md) and [verification/report](evidence/week-9/verification.md). Source pins, raw calls, negative cases, audit notes and screenshots are stored together. This does not claim mutation authorization tests or production deployment.
