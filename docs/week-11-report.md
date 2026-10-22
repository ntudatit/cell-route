# Week 11 Report — xUDT Extensions and Custom Validation

**Project:** CellRoute / FiberPay  
**Execution date:** 22 October 2026  
**Status:** Local extension exercise implemented and verified in CKB-VM. No extension deployment or signed on-chain transaction. Token Lab's optional extension adapter remains design-only.

## Objective and outcome

This week extends the study of basic xUDT from Week 6 to a custom validation rule. I built a marker extension, ran positive and negative fixtures against the pinned deployed xUDT binary, and investigated owner-mode behavior and an input-lock shortcut.

The main result is **31 passing VM cases**, including a valid/invalid witness pair with identical token accounting. The work keeps the existing basic xUDT builder unchanged and does not imply support for arbitrary xUDT extensions in CellRoute.

## What I learned

An xUDT extension adds validation through an exported `validate` function. Its invocation depends on the selected flags, extension encoding and implementation branches. A token's accounting rules and an extension's policy are separate checks.

In the pinned implementation, authenticated owner mode bypasses token accounting, allowing issuance. It does not automatically skip the regular extension call: the marker still rejects invalid witnesses in the tested input-lock, input-type and output-type owner routes.

A separate input-lock shortcut can skip the extension call when the extension's full Script hash matches a validated input lock. Therefore, this extension cannot be described as a policy that runs for every transaction.

## Implementation

The local marker library exports the official interface:

```c
int validate(int is_owner_mode, size_t extension_index,
             const uint8_t *args, size_t args_len);
```

The lab supports one extension with a one-byte expected marker in its args. Its witness data must contain the same byte in the matching `extension_data` entry. The implementation uses the pinned Molecule schema, supports input-group and output-only witness placement, and bounds witness reads to 4096 bytes.

The marker is public and copyable. It is not a signature, ownership credential or cryptographic proof. A deliberately permissive standalone lock entry exists only to reproduce the input-lock shortcut. **This artifact must not protect funds.**

Implementation and tools:

- [Extension source](../contracts/xudt-extension-lab/marker.c).
- [Pinned source configuration](../contracts/xudt-extension-lab/pins.json).
- [Setup, build, verification and export scripts](../contracts/scripts/xudt-extension/).
- [Operator guide and adapter design](xudt-extension-lab.md).

## Source versions and artifacts

| Component                  | Recorded version / identity                                          |
| -------------------------- | -------------------------------------------------------------------- |
| RFC 0052 source revision   | `53b2c5eb7dd82968327999534be74d7975865b9d`                           |
| ckb-production-scripts     | `abdcb117b512e35910fa8e30241a7a354e5cacf0`                           |
| C standard library         | `f2631670b655d23630de384245062cf6e121710d`                           |
| VM / debugger              | CKB-VM v1 / ckb-debugger 1.1.1                                       |
| Compiler / linker          | xPack RISC-V GCC 15.2.0 / LLD 22.1.8                                 |
| Contracts CCC / testtool   | 1.12.2 / 1.0.5                                                       |
| Marker binary size         | 8,448 bytes                                                          |
| Marker code hash (`data1`) | `0x1b05cec41fb93461a1cd3bd7951ab7d700f4111c8bc2802cf111c3c6043a81c2` |
| Marker SHA-256             | `c965be4ab0733f9c4786a0785e2e26d0bba1383c34fda7a23025afbdb6996a73`   |

The xUDT artifact has data hash `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`. It was obtained through a read-only public RPC from Mainnet transaction `0xc07844ce21b38e4b071dd0e1ee3b0e27afd8d7532491327f39b786343f558ab7`, output 0, and checked before use in local fixtures. This is not an extension deployment, and xUDT itself was not rebuilt locally.

Archive hashes, exact compiler/linker commands and artifact identities are retained in [environment.json](evidence/week-11/environment.json). Repeated local builds produced the same marker code hash under the recorded toolchain.

## Actual VM results

The runner executes every input lock, auxiliary authority type and xUDT type group in complete resolved mock transactions. It records numeric script exits separately from debugger process status. Crashes or missing measurements cannot count as expected validation failures.

| Case                                    | Actual exit                             | xUDT type-group cycles |
| --------------------------------------- | --------------------------------------- | ---------------------- |
| Basic zero-extension control            | 0                                       | 19,383                 |
| Correct marker                          | 0                                       | 36,753                 |
| Incorrect marker                        | 94                                      | 36,753                 |
| Missing witness                         | 92                                      | 32,029                 |
| Malformed witness                       | 7, rejected before extension invocation | 16,381                 |
| Incorrect extension args                | 91                                      | 33,792                 |
| Normal-mode inflation                   | -52                                     | 19,457                 |
| Explicit burn                           | 0                                       | 36,753                 |
| Input-lock owner mint                   | 0                                       | 30,366                 |
| Input-lock owner with invalid marker    | 94                                      | 30,366                 |
| Input-lock shortcut with invalid marker | 0; extension call skipped               | 34,119                 |
| Witness-hashed extension                | 0                                       | 45,428                 |
| Witness ScriptVec hash mismatch         | 49                                      | 21,501                 |
| Missing / incorrect dependency          | 1 / 1                                   | 22,796 / 23,333        |
| Malformed ScriptVec / unknown flags     | 47 / 44                                 | 13,582 / 13,578        |

Additional cases cover input-type/output-type owner routes, disabled owner flags, enhanced witness-owner behavior, output-only minting, short args/data and trailing Cell data. The complete [mode matrix](evidence/week-11/mode-matrix.md) lists all 31 cases and links each fixture. [Raw results](evidence/week-11/vm-results.json) include stdout, branch traces, per-group results and fixture hashes.

The runner asserts that the correct/incorrect-marker pair differs only in witness content. Cycles are measurements for the selected type group and toolchain; they are not transaction fees or evidence of network commitment.

## Regression and integration decision

At the extension implementation checkpoint:

- 31 extension VM cases passed.
- 11 baseline sUDT VM tests passed.
- 12 targeted Token Lab tests passed, including extension/args/dependency mutation rejection after review.
- The portal suite passed 125 tests across 21 files, and the production build passed.

The subsequent source cleanup removed retired example tests and added custom DOB pattern checks. That later portal checkpoint passed **124 tests across 21 files**, seven browser checks after correcting an outage-message assertion, and the production build. These are broader project checks, not additional extension VM cases. The existing large-bundle warning remains.

Token Lab still accepts only its basic zero-extension profile and supported token data. A future opt-in adapter must verify network/code/dependency identities, disclose owner routes and bypasses, show the rule before signing, and invalidate review after any relevant mutation. The adapter is documented but not implemented.

## Issue investigated

The existing bare-metal GNU linker could not build shared/PIE artifacts. I used GCC for object compilation and LLVM's ELF linker for the extension library.

The first successfully linked artifact still crashed in the VM because its executable segment layout was incompatible with the older dynamic loader's page-copy behavior. Adding `--no-rosegment` fixed the layout. The crash was investigated rather than mislabeled as a valid negative test.

Source extraction also needed a change from an unavailable PowerShell archive module to Windows `tar.exe`. The corrected setup command was rerun successfully. Details are in the [verification log](evidence/week-11/verification.md).

## Reproduction

From the repository root, with the documented compiler/linker and debugger installed:

```powershell
npm --prefix contracts run xudt:setup
npm --prefix contracts run xudt:build
npm --prefix contracts run xudt:test
npm --prefix contracts run xudt:evidence
npm --prefix contracts run week6:test -- --roots tests
npm --prefix portal test
npm --prefix portal run build
```

Set `RISCV_CC`, `RISCV_LD` and `CKB_DEBUGGER` for non-default installations. [Setup prerequisites](xudt-extension-lab.md) explain the required LLVM linker and supported extraction tools.
