# SSRI Inspector

The current /ssri route accepts actual service/code identities and arbitrary method arguments. The historical pinned prototype procedure below remains a reproducible regression profile. See [Live Labs](live-labs.md).

The `/ssri` route is a read-only **Devnet, Code-context** inspector for the pinned historical prototype. It verifies genesis, committed code transaction/output, and CKB code hash before method discovery. It does not sign, construct transactions, update Token Lab metadata, or attest the server's VM execution. The observed tip is diagnostic, not an enforced snapshot.

## Compatibility

Pins are in `portal/src/features/ssri/pins.json`. Prototype `b71dd50d031e4e6e86eb9689658ed766d52ad0d6` uses vendored ckb-ssri/proc-macro 0.1.0 and ckb-std 0.15.3. Server `2bbe85ae68dac0019ee5f7c27e6e7ca25db7ce22` implements its legacy syscall 2103 and returns a hex string. Current server `3ee55286749aea831134a05283e8232b48b9bce4` uses pipe/write syscalls and a different response schema; it is not interchangeable. Published ckb-ssri-std 0.0.1 is reading material, not this fixture's SDK.

Method paths are the first eight bytes of CKB personalized Blake2b over the UTF-8 method name. Pagination args are u64 little endian. Discovery returns raw concatenated eight-byte paths; metadata is raw UTF-8; decimals/version are one byte; balance is u128 little endian. These are this revision's schemas, not a universal SSRI decoder.

## Reproduce locally

Fetch the repositories at the exact commits above into ignored `contracts/build/ssri/` (Git checkout or GitHub commit archives). Install Rust target `riscv64imac-unknown-none-elf` and a RISC-V bare-metal GCC. From the prototype directory in PowerShell:

```powershell
rustup target add riscv64imac-unknown-none-elf
$env:TARGET_CC = '<toolchain>/bin/riscv-none-elf-gcc.exe'
$env:TARGET_AR = '<toolchain>/bin/riscv-none-elf-ar.exe'
$env:RUSTFLAGS = '-C target-feature=+zba,+zbb,+zbc,+zbs'
cargo build --locked --release --target riscv64imac-unknown-none-elf -p ssri-test
```

From the selected server directory: `cargo build --locked`. Run OffCKB with `offckb node --network devnet`. Deploy the prototype binary with `offckb deploy --network devnet --target <binary> --output <ignored-output> --yes`; this uses local development funding only. Run the server executable with arguments `http://127.0.0.1:28114 127.0.0.1:9090`.

Update public deployment metadata and the evidence helper's identity for your own deployment. Do not reuse the evidence OutPoint on another genesis. In `portal/`: `npm ci`, `node scripts/ssri-evidence.mjs`, `npm run dev`; open `/ssri`. Vite dev/preview provides a fixed `/ssri-rpc` proxy to loopback9090 because the selected server has no CORS. Production hosting must provide an explicitly configured trusted service; this development proxy is not production infrastructure.

## Bounds and known limits

Client requests have a 10-second timeout (maximum30 seconds), 256KiB response cap (4MiB for code transaction verification), strict JSON-RPC ID/schema validation, cancellation and explicit retry. Timeout does not terminate server-side execution. This historical server must only execute trusted local scripts; it is not hardened for public or adversarial use.

The prototype returns five methods for offset0/limit1 rather than one (recorded actual RPC). UDT.symbol also returns Test, and balance is a static demonstration value. No real token holdings should be inferred. Unknown paths are displayed as unknown and are not callable through this profile.

Evidence: [environment](evidence/week-9/environment.json), [calls](evidence/week-9/method-calls.json), [verification](evidence/week-9/verification.md).
