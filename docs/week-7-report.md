# Week 7 Report — CKB Script Runtime, WebAssembly and Debugging

**Project:** CellRoute  
**Implementation and verification date:** 24 September 2026  
**Status:** Completed the local WASM-to-RISC-V exercise, C debugging with GDB, and Simple Lock verification. No deployment or on-chain transaction confirmation was performed within this scope.

## 1. Objectives and outcomes

This week focused on understanding execution in CKB-VM, compiling an AssemblyScript program through WASM and C into RISC-V, and using a debugger to explain a failed execution.

Implemented deliverables:

- Fibonacci source, C wrapper, runtime adapter, startup code and linker script in [`contracts/runtime-lab`](../contracts/runtime-lab/).
- A build pipeline with pinned tooling, download checksum verification and artifact SHA-256 recording.
- A deliberately missing `env.abort` binding and a working build with the binding supplied.
- Buggy and fixed versions of the `carrot` C example, transaction fixtures and an actual GDB session.
- Simple Lock checks covering correct, incorrect and missing witnesses, plus an unrelated input preceding the Script group.
- [Technical documentation](script-runtime.md) and npm commands for reproducing the exercises.

## 2. Environment and toolchain provenance

| Component | Actual version |
| --- | --- |
| Operating system | Windows x64 |
| Node.js | 24.19.0 |
| AssemblyScript | 0.27.31 |
| WABT / wasm2c | 1.0.42 |
| RISC-V GCC | 15.2.0, xPack distribution 15.2.0-1 |
| GDB | 16.3 |
| CKB runner | ckb-debugger 1.1.1, script version 2 |

The compiler and GDB were installed as portable tools inside the project's build directory. The implemented pipeline does not require Docker and does not modify the system PATH.

Source commits associated with the releases:

| Component | Commit |
| --- | --- |
| AssemblyScript | `285afb1ffe1cf9b3a187b8f070d8d6a87b869751` |
| WABT | `ff0ef7e0009402740c805a9744c09b05be063e48` |
| xPack distribution recipe | `67154c02dda3f88ad8ad2b3412d226b94b7ec98a` |

The xPack commit identifies the packaging recipe, not an upstream GCC commit. Checksums are recorded in [`toolchain.json`](../contracts/runtime-lab/toolchain.json).

## 3. WASM → C → RISC-V exercise

The following pipeline was executed:

```text
fib.ts → AssemblyScript → fib.wasm
       → WABT wasm2c → fib.c + fib.h
       → GCC + wrapper/runtime/startup → RISC-V ELF
       → ckb-debugger → script result + cycles
```

The Fibonacci function follows the course convention: input 5 returns 8, and input 10 returns 89. The `checkedFib` export adds input validation to retain an explicit `env.abort` import for the binding exercise.

The current WABT version generates the `w2c_env_abort` interface, which differs from the function-pointer interface in the historical example. A build with `OMIT_ABORT_BINDING` failed as expected:

```text
undefined reference to `w2c_env_abort'
collect2.exe: error: ld returned 1 exit status
```

This was a controlled failure. Supplying the binding in `main.c` allowed the binary to build successfully. The wrapper restricts inputs to 0–10 to avoid ambiguity between an i32 result and the VM's 8-bit exit code.

Another adjustment was to pass `argv[0]` explicitly to the runner: `-- fib 5`. Calling it with only `-- 5` returned 2 because the wrapper received too few arguments; correcting the invocation produced 8.

### Measured artifact hashes

The following SHA-256 values identify the build used for verification:

| Artifact | SHA-256 |
| --- | --- |
| `fib.wasm` | `bc7983e82748314a422217ce2b2ed6c1ca654f4948372a5ba2ce6986af381bb6` |
| Generated `fib.c` | `58646d3cc2d342987c2f52961efc6dfa7c16f5bc27d8541bb234b9aa5a775719` |
| Generated `fib.h` | `fa03b64e2f0885e94723c479fe3e75a069d706505664d875434328804e876685` |
| RISC-V `fib` | `f7c007feab85df4efd0dfd88b7c7601d1ea2635753dbee0a4f74715293430c67` |
| `carrot-bug` | `abca4aa14eb1dc77787fe9708ad4527ccd598c2128d42db1badc97a8f8f2c4b3` |
| `carrot-fixed` | `a341de896fd5a9805f12cadb0139aa145f0a78747ab6544697c1489988a1039f` |

## 4. Execution and Script group results

Data source: `contracts/build/runtime-lab/verification.json`, measured at **10:55:59 on 24 September 2026, UTC+7**. All 12 cases below matched their expected results.

| Test case | Script result | Process exit status | Cycles |
| --- | ---: | ---: | ---: |
| Fibonacci input 5 | 8 | 254 | 34,961 |
| Fibonacci input 10 | 89 | 254 | 35,021 |
| Invalid input: -1 | 2 | 254 | 1,612 |
| Out-of-range input: 11 | 2 | 254 | 1,645 |
| Nonnumeric input: abc | 2 | 254 | 1,612 |
| Buggy carrot, empty output | -1 | 254 | 2,178 |
| Fixed carrot, empty output | 0 | 0 | 2,751 |
| Fixed carrot, `carrot` output | -1 | 254 | 2,259 |
| Simple Lock: correct witness | 0 | 0 | 13,136,726 |
| Simple Lock: incorrect witness | 7 | 254 | 13,082,167 |
| Simple Lock: missing witness | 6 | 254 | 13,014,624 |
| Simple Lock: preceding unrelated input | 0 | 0 | 13,136,726 |

`254` is the debugger's process exit status when the program returns a nonzero result; it is not the contract's application error code. Fibonacci returning 8/89 demonstrates correct computation, but does not indicate that a transaction script was accepted.

Cycle counts were measured again during this exercise. They reflect the specific fixtures and build configuration, rather than a general performance benchmark or the cost of an entire transaction.

## 5. C debugging session with GDB

The `carrot` example is intended to reject outputs whose data begins with `carrot`. The buggy version uses `if (cmp)` after `memcmp`, causing it to reject empty output as well.

At **10:56:01 on 24 September 2026, UTC+7**, GDB connected to the native debugger, loaded the ELF with debug symbols and stopped at `runtime-lab/carrot.c:28`:

```text
Breakpoint 1, main () at runtime-lab/carrot.c:28
28    if (cmp) return -1;
OBSERVED cmp=-99 len=0 first=0
$1 = 0
0x3fffc0: 0 0 0 0 0 0
#0 main () at runtime-lab/carrot.c:28
BREAKPOINT_CHECK_PASSED
[Inferior 1 (process 1) exited with code 0377]
```

`$1` is the value of `index`. The observations show that the first output contains empty data; its zero-initialized buffer differs from `carrot`. Since `memcmp` returns a nonzero value when the data differs, the faulty branch executes. The fixed version checks `len >= 6 && cmp == 0`; fixtures confirm that empty output is accepted and `carrot` is rejected.

These are actual GDB observations, not conclusions drawn solely from test logs. The transcript and binary/fixture hashes are stored in `gdb-session.json` and `gdb-verification.json`.

## 6. Testing and application to CellRoute

The following commands completed successfully during implementation:

- `npm run typecheck`: TypeScript checking for the contracts project.
- `npm test`: **19 contract tests passed**, covering Simple Lock and sUDT.
- `npm run runtime:test`: build, **4 parser tests passed**, 12 execution cases matched expectations, and the GDB session passed.

The parser tests ensure that process status is not substituted for script result, negative codes are preserved, and missing measurements or interrupted debugger executions are rejected.

The exercises were connected to the project as follows:

1. **Validation lifecycle:** resolve input Cells and code dependencies, execute Lock/Type groups, read witnesses/data and return a script result. Groups are distinguished by the complete Script, including args.
2. **Simple Lock:** JS bytecode runs through CKB JS VM; the fixture with a preceding input confirms that the witness is read relative to the group.
3. **Token Lab:** the Type Script enforces asset rules; checking one group alone does not prove that the entire transaction is valid.
4. **Fiber WASM:** runs in the browser, unlike this exercise's pipeline that compiles WASM into RISC-V. Success in one runtime does not establish correctness in another.

## 7. Limitations and completion scope

- The runtime adapter supports only the Fibonacci module with one fixed 64 KiB memory. It has no memory growth, tables, threads, WASI or general allocator. It is not a general-purpose WASM runtime or a production contract template.
- Stack-exhaustion tracking is disabled for this nonrecursive example; bounds checks remain enabled.
- ELF hashes identify the artifacts from this build. Byte-for-byte reproducibility across machines or operating systems has not been verified.
- Script group tests run locally. No transactions were submitted, no Mainnet deployment was performed, and no new `committed` status was recorded.
- These exercises require no private keys or seed phrases.
- No portal page was added because the scope was contract build/debug tooling.

The main Week 7 exercise requirements have measured results. Deployment, on-chain verification and production hardening are outside the completed scope.

## 8. Reproduction and evidence location

From `contracts`, on Windows x64 with Node.js 22+ and native ckb-debugger:

```powershell
npm ci
npm run runtime:setup
npm run runtime:test
```

Set `CKB_DEBUGGER` if the debugger is outside its default location. Alternative toolchain configuration is documented in [Script runtime and debugging](script-runtime.md).

Artifacts, build commands, controlled failure logs, fixtures and transcripts are generated in `contracts/build/runtime-lab/`. This directory is ignored by Git; a fresh checkout must rerun the commands to generate the evidence files. This report preserves measurements from the completed run, while generated build files are updated by subsequent runs.
