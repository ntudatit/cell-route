# Verification — 22 October 2026

## Actual executed checks

| Command from repository root | Layer | Result |
| --- | --- | --- |
| `npm --prefix contracts run xudt:setup` | Checksum-pinned source extraction | Passed using Windows tar.exe |
| `npm --prefix contracts run xudt:build` | GCC compilation + LLVM ELF linking | Passed; repeated build produced the same marker code hash |
| `npm --prefix contracts run xudt:test` | Actual CKB-VM execution | 31 cases passed; all locks and applicable type groups executed |
| `npm --prefix contracts run xudt:evidence` | Export with artifact/fixture hash checks | 31 complete public fixtures and receipts exported |
| `npm --prefix contracts run week6:test -- --roots tests` | Baseline sUDT VM regression | 11 passed |
| `npm --prefix portal test -- src/utils/token.test.ts` | Token encoding/accounting/review tests | 12 passed |
| `npm --prefix portal test` | Portal unit suite | 125 passed across 21 files |

`npm --prefix portal run build`: passed after the final TypeScript correction; the existing large-chunk warning remains. No portal runtime/UI code changed for this lab, so no new browser execution is claimed.

## Investigation and corrections

- Bare-metal GNU ld did not support shared/PIE linking. GCC object compilation plus the installed LLVM ELF linker built a dynamic library.
- The first linked extension crashed at an invalid instruction because its executable segment was incompatible with the old dynamic loader's page-copy expectations. `--no-rosegment` fixed the segment layout. A crash was not counted as an expected contract rejection.
- Malformed XudtWitnessInput was rejected by xUDT with exit 7 before extension invocation; the expected value reflects the actual pinned implementation. An empty witness is separately rejected by the extension with 92.
- Initial source setup via Windows PowerShell's archive module failed to load in this environment. Setup now uses built-in tar.exe and was rerun successfully.
- The initial broad Jest scan found an obsolete snapshot in an unrelated ignored build directory. The targeted baseline was rerun with `--roots tests`; all 11 tests passed with exit status 0, without deleting that unrelated snapshot.

## Boundaries

These are local resolved mock transactions. Mock locks/authority scripts are deliberately permissive. No node consensus, deployed extension, real wallet authorization, broadcast or committed transaction is claimed. The deployed xUDT artifact was obtained through a read-only public RPC and its data hash was checked; it was not rebuilt locally.

See [extension spec](extension-spec.md), [mode matrix](mode-matrix.md), [artifact/source environment](environment.json) and [raw VM outputs](vm-results.json). The marker and permissive standalone lock must not protect funds. The opt-in Token Lab adapter remains a design, and basic xUDT behavior stays unchanged.
