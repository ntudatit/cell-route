# xUDT extension lab

**Scope:** Local CKB-VM experiment, implemented 22 October 2026. No extension has been deployed. Token Lab continues to support basic xUDT only.

## Rule and trust boundary

The marker extension is adapted from the official `tests/xudt_rce/extension_script_0.c` ABI in the pinned production-scripts source. It exports:

```c
int validate(int is_owner_mode, size_t extension_index,
             const uint8_t *args, size_t args_len);
```

This lab supports one extension. Its args must contain exactly one byte (`a5` in the fixtures). The first group witness must contain a Molecule `WitnessArgs`. Its `input_type` (or `output_type` for output-only groups) contains the implementation's `XudtWitnessInput`, whose `extension_data` has one Bytes entry containing the same marker. Reads are bounded to 4096 witness bytes. Missing, malformed and incorrect markers fail explicitly.

The marker is public and copyable. It is not a cryptographic proof, signature, ownership check or production governance mechanism. The library also has a deliberately permissive standalone `_start` lock entry, solely to test the protocol's already-validated-input-lock shortcut. **Never deploy this artifact to protect funds.**

The RFC calls the witness table `XudtWitness` and its third field `extension_scripts`; the pinned implementation names them `XudtWitnessInput` and `raw_extension_data`. The lab follows the implementation's generated schema and field order. It does not guess an ABI from a method name.

## Compatibility and build

The deployed xUDT binary is staged in `contracts/vendor/xudt/xudt_rce`. Its CKB data hash is `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`. It is used as `data1`, selecting CKB-VM v1. This lab does not rebuild xUDT itself or establish an audit of its own extension.

Source pins are in [pins.json](../contracts/xudt-extension-lab/pins.json). The implementation is `ckb-production-scripts` revision `abdcb117b512e35910fa8e30241a7a354e5cacf0`, the build reference named by RFC 0052. The C stdlib submodule is pinned to `f2631670b655d23630de384245062cf6e121710d`. Setup verifies SHA-256 of both source archives before extraction into the ignored build directory.

Observed toolchain: xPack RISC-V GCC 15.2.0 and LLD 22.1.8 (installed Rust toolchain's `rust-lld`), with ckb-debugger 1.1.1, CCC core 1.12.2 and ckb-testtool 1.0.5. Compiler/linker versions and exact commands are captured with the artifacts. For identical binaries use the recorded versions and source bytes; other compiler versions can change hashes and cycles.

Run from the repository root:

```powershell
# Install the existing contracts dependencies first if needed:
npm --prefix contracts ci
# Existing Windows compiler setup, if GCC is unavailable:
npm --prefix contracts run runtime:setup
# Set RISCV_CC, RISCV_LD and CKB_DEBUGGER for non-default installations.
# RISCV_LD must be LLVM ld.lld / rust-lld with the GNU ELF backend.
npm --prefix contracts run xudt:setup
npm --prefix contracts run xudt:build
npm --prefix contracts run xudt:test
npm --prefix contracts run xudt:evidence
```

Windows setup uses the built-in `tar.exe` ZIP support; other hosts need `unzip`. The build locates an installed Windows Rust linker when `RISCV_LD` is unset; elsewhere it defaults to `ld.lld`. Rust toolchain installation is not automated by this lab. Bare-metal GNU ld from the existing xPack package does not support `-shared` or `-pie`, so the extension uses GCC compilation and LLVM ELF linking.

The legacy xUDT dynamic loader expects compatible executable segment layout. LLD's `--no-rosegment` keeps the code segment aligned for this loader; without it, the first attempt faulted with an invalid instruction despite successful linking. `-Bsymbolic` resolves local references and `_start` is the standalone entry. Build commands record these choices.

## Encoding and behavior

| Mode / field | Encoding and observed behavior |
| --- | --- |
| Basic xUDT | 32-byte owner hash + `00000000`; no extensions; baseline conserves tokens |
| Inline extension | Low 29 flag bits = 1; Molecule ScriptVec follows the flags |
| Witness extension | Low bits = 2; first 20 bytes of the ScriptVec's CKB Blake2b hash in args; actual vector in witness |
| Amount | First 16 data bytes: little-endian uint128 |
| Dependencies | Deployed xUDT binary, marker library, and fixture lock/authority code; public mock OutPoints |
| Normal mode | Input sum must be at least output sum; explicit burn is contract-valid; inflation returns -52 |
| Input-lock owner | Enabled by default; bit 0x20000000 disables this owner route |
| Input-type owner | Enabled by bit 0x80000000 |
| Output-type owner | Enabled by bit 0x40000000 |
| Witness owner | Matching owner-script hash plus successful dynamic owner validation enables owner mode; failures fall back to normal mode |

Owner mode bypasses token accounting in this implementation. It does **not** automatically bypass this normal extension invocation: valid owner mint passes, invalid marker still returns 94 for the input-lock/input-type/output-type cases. Enhanced owner validation initially receives `is_owner_mode=0`; once successful, the regular extension receives 1. The deliberately public marker used in the witness-owner fixture is not a safe owner credential.

There is a separate shortcut: when a non-RCE extension's full Script hash matches an input lock hash, xUDT treats it as already validated after loading its function. The lab's permissive lock entry lets the shortcut fixture pass with a wrong marker and no marker trace from the type group. Therefore this marker rule must not be described as a rule applied to every transaction. The built-in RCE branch has different priority; RCE itself is not exercised here.

Unknown low flag bits are rejected by this xUDT binary. Trailing Cell data is accepted in the tested VM case; this does not mean it is understood. The existing Token Lab refuses extended Cell data and nonzero flags/trailing args rather than discarding them.

## Verification

The runner creates complete public resolved mock transactions and executes all input locks, auxiliary authority type scripts, and the xUDT type group in CKB-VM. It records each group's numeric exit code, debugger process status, raw stdout/stderr and cycles. A VM crash or missing result cannot be counted as an expected validation failure.

The positive/incorrect-marker pair differs only in witness content. The runner asserts equality of all other transaction and resolved-cell fields. Artifact and fixture hashes are checked before evidence export. An interrupted run is marked running rather than leaving the previous passing results in place.

See [mode matrix](evidence/week-11/mode-matrix.md), [raw VM results](evidence/week-11/vm-results.json), [environment and artifact hashes](evidence/week-11/environment.json), and [extension spec](evidence/week-11/extension-spec.md).

Cycles are measurements of the selected type group in this exact VM/toolchain. They are not transaction fees or network-finality evidence. These mock fixtures use permissive locks, public synthetic OutPoints and controlled capacities; node consensus, real signatures, wallet authorization and deployment are outside the verification layer.

## Token Lab integration decision

The default builder is unchanged: it only accepts the zero-extension profile and known 16-byte token data. Existing accounting, live-input checks and transaction review fingerprints remain in place. Regression tests also reject post-review mutations to args, extension configuration and dependencies before signing.

The optional adapter is **designed, not implemented**. A future opt-in profile must bind a verified network/genesis, xUDT code identity, extension code hash/OutPoint, exact flags and schema, supported owner routes and rule version. Preparation must verify live code dependencies, reject unknown/trailing data, and show rule, dependencies and bypass conditions in review. Any account, args, extension witness or dependency mutation must invalidate that review. This public marker artifact is ineligible for funding or production adapter registration.

The lab does not add arbitrary extension support to CellRoute or change the claims in the Week 6 report. Next: [Week 12 — iCKB](week-12-work-plan.md).
