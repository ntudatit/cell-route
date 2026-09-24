# Script runtime and debugging

The contract runtime lab is in `contracts/runtime-lab`. It implements the compilation exercise from [Class 4](https://docs.nervos.org/docs/script-course/intro-to-script-4) and a controlled C debugging example based on [Class 5](https://docs.nervos.org/docs/script-course/intro-to-script-5). It is a local development tool, independent of the React portal and public networks.

## Run

From `contracts` on Windows x64, with Node.js 22+ and native `ckb-debugger` installed:

```powershell
npm ci
npm run runtime:setup
npm run runtime:test
```

Setup downloads roughly 472 MB of pinned compiler/WABT archives, verifies SHA-256 checksums, then extracts them under ignored `build/toolchains`. It does not alter system PATH. Install the CKB debugger with `offckb install ckb-debugger` if needed; the runner discovers its standard Windows location or respects `CKB_DEBUGGER`.

For existing installations or other platforms, set `RISCV_CC`, `RISCV_GDB`, `WASM2C` to the executable paths and `WABT_ROOT` to the WABT distribution containing `include/wasm-rt.h`. Automatic download/extraction is Windows x64 only. Tool versions and source release commits are pinned in [toolchain.json](../contracts/runtime-lab/toolchain.json). Versions outside these pins require revalidation of generated interfaces.

Commands can also be run separately:

| Command | Purpose |
| --- | --- |
| `npm run runtime:build` | AssemblyScript → WASM → generated C → RISC-V; debug-symbol C variants; controlled missing binding |
| `npm run runtime:verify` | Parser tests, WASM reference checks, CKB-VM executions and fresh Simple Lock fixtures |
| `npm run runtime:debug` | Local GDB session against the failing C fixture, with assertions on observed state |

`runtime:test` runs these three in order and fails on an unexpected result. GDB binds to loopback port 29997; override `RUNTIME_GDB_PORT` if occupied. No wallet, private key, node funding or deployment is required.

## Compilation and runtime boundaries

`fib.ts` exports the course's shifted Fibonacci function, plus an input-checked export that deliberately retains the `env.abort` import. WABT 1.0.42 emits the `w2c_env_abort` function interface; `main.c` supplies it. The build first omits this binding in a controlled variant, requires the expected linker failure, then builds the working program. This differs from the older function-pointer interface shown in the course.

The C adapter supports only this module's single fixed 64 KiB memory. It supplies initialization, memory and trap functions, with no grow, tables, threads, WASI or general allocator. Bounds checks remain enabled; stack-exhaustion tracking is explicitly disabled for this nonrecursive example. It is **not a general WASM runtime or production contract template**. The linker/startup code targets RV64IMC/LP64 and CKB's exit syscall. GCC's libc provides basic memory operations.

The RISC-V wrapper accepts decimal inputs 0–10. This keeps results within the signed 8-bit VM exit range. `ckb-debugger --bin` receives an explicit `argv[0]`:

```powershell
& $env:CKB_DEBUGGER --bin build/runtime-lab/fib -- fib 5
& $env:CKB_DEBUGGER --bin build/runtime-lab/fib -- fib 10
```

Expected script results are **8** and **89**. Debugger 1.1.1 returns host process status **254** for these nonzero results. That is expected for this computation experiment, not successful transaction validation. Invalid wrapper inputs return 2. The scripts record process status, script result and cycles separately.

| Runtime | Input / execution |
| --- | --- |
| Fibonacci lab | AssemblyScript WASM translated to C, compiled to RISC-V, run in CKB-VM |
| Simple Lock | JS bytecode interpreted by CKB JS VM, itself running in CKB-VM |
| Browser Fiber | Fiber WASM hosted by the browser; no implication about CKB script acceptance |

## C debugging

The `carrot.c` fixture rejects output data beginning with `carrot`. `CARROT_BUG` deliberately reverses the `memcmp` condition. Both variants use `-g -O0` so local variables remain inspectable. The syscall is `ckb_load_cell_data` over transaction outputs; there are no signing secrets in the synthetic fixture.

`runtime:debug` starts the native debugger in GDB mode, loads the matching ELF symbols, breaks immediately before the decision and inspects `cmp`, `len`, `index` and `buffer`. For an empty output, the observed comparison is nonzero and the first byte is zero. The buggy branch rejects this harmless output; the fixed branch checks equality and length. The local tests require:

| Variant / output | Script result |
| --- | ---: |
| Buggy / empty | -1 |
| Fixed / empty | 0 |
| Fixed / `carrot` | -1 |

The generated `carrot.gdb` file contains the exact breakpoint and commands. `gdb-session.json` includes the real transcript, and `gdb-verification.json` binds it to binary/fixture hashes. A missing GDB executable or failed breakpoint is an error; ordinary test logs do not substitute for a GDB session.

## Simple Lock and validation scope

The verifier rebuilds Simple Lock and creates fresh correct/wrong/missing-witness fixtures. Expected results are **0/7/6**. A fourth fixture inserts an unrelated input before the lock group; its valid group witness must still produce 0. Each debugger call selects the exact group explicitly.

CKB resolves inputs and code dependencies, then runs the input Lock groups and input/output Type groups. A group is identified by the complete Script, including args. Passing one isolated group does not validate all groups, capacity rules, or transaction commitment. Only a node's transaction status can establish `committed`; this lab never labels local results that way.

## Generated output

All run output lives under ignored `contracts/build/runtime-lab/`:

- `manifest.json`: actual compiler versions, release provenance, imports and SHA-256 hashes for sources, WASM, generated C/header and ELF files.
- `assemblyscript.json`, `wasm2c.json`, `riscv-build.json`: actual commands and build output.
- `missing-binding.json`: controlled linker error before supplying `env.abort`.
- `verification.json` and individual execution JSON files: measured results, host statuses, cycles and local-only scope.
- `*-tx.json`: complete synthetic fixtures for direct debugger reuse.
- `gdb-session.json`, `gdb-server.log`, `gdb-verification.json`: GDB observations and provenance.

These files are regenerated from the current sources, not copied from an earlier exercise. Retain them locally when diagnosing a failure. Contract source stays separate from the portal; there is no additional portal page for this lab.
