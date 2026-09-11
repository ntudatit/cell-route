# Week 5 — CKB Script Fundamentals

## Implementation and language choice

CellRoute now includes a Simple Lock Lab at `/simple-lock`. The TypeScript contract and VM tests live under `contracts/`, while the React portal contains only transaction helpers and public deployment metadata.

We chose TypeScript on CKB JS VM to reuse CellRoute's CCC/TypeScript transaction stack and the installed OffCKB workflow. Rust offers a smaller execution footprint; this small educational contract prioritizes a directly inspectable build/test/deploy flow. The native debugger measured 13,136,726 cycles for the successful fixture. The build produces JS bytecode loaded by a RISC-V VM code Cell, not a native Rust binary. See [Language Choices](https://docs.nervos.org/docs/script-course/intro-to-script-10), [Rust quick start](https://docs.nervos.org/docs/script/rust/rust-quick-start), and [JavaScript quick start](https://docs.nervos.org/docs/script/js/js-quick-start).

## Validation lifecycle

An input references a live Cell by OutPoint (transaction hash plus output index). Consuming it makes that Cell dead. Outputs describe new Cells with capacity, lock, optional type, and corresponding data. Nodes resolve inputs and code dependencies, check transaction structure and capacity rules, and execute required Script groups before accepting the transaction.

Scripts with identical code hash, hash type, and args form a group. Input Lock Scripts execute once per group; output locks do not execute merely because funding creates an output. Type Scripts, when present, execute across both input and output groups. All groups must succeed. This explains why funding can succeed before an invalid lock is discovered at spending time. [Validation Model](https://docs.nervos.org/docs/script-course/intro-to-script-1).

The VM resolves executable code using the Script's code hash/hash type and transaction dependencies. For this JavaScript implementation the outer executable is CKB JS VM; the args also identify our deployed bytecode. Witnesses supply transaction validation data and are not stored in the resulting Cell. They are public transaction data. The lock reads witness index 0 relative to its input group, so preceding unrelated inputs do not change which witness it reads. [Script Basics](https://docs.nervos.org/docs/script-course/intro-to-script-2).

Simple Lock checks the args length, loads a nonempty raw witness of at most 1024 bytes, hashes it using CKB-personalized BLAKE2b-256, and compares the digest with the final 32 args bytes. Exit 0 accepts; 5 rejects malformed args; 6 rejects a missing/empty witness; 7 rejects a wrong preimage; 8 rejects an oversized witness. Any nonzero result rejects the entire transaction. A successful submission can be pending or proposed before inclusion; only a queried `committed` status is counted as completion.

## Recorded Devnet evidence

Verified on 2026-09-09. Full machine-readable evidence: `contracts/deployment/week5-evidence.json`.

- Bytecode code hash: `0x191a12efda778478ac4173a4b4c0218e8676d0e2fc568dbb6500862f6d14d273`
- Code OutPoint: `0xd6e697ad00741fae4027c352f31ffd51cd243bedafe577d30905901e39152a08:0`
- Funding transaction: `0xe11568d8b55c4aace03f6eb120df92d4d651f58a99d3c470bb3fa1490ebaa409`
- Unlock transaction: `0x0a6013948b1026a13b76839b2aec7ce3de25d7799be989ff9d172fc05cca72cc`
- Observed status: **committed**
- Node rejection checks: wrong preimage **7**; missing witness **6**.

The eight contract tests exercise the actual VM with complete transaction fixtures. Portal helper tests cover witness construction, dependencies, fee/recipient preservation, byte limits, malformed digests, wrong preimages, and wrong-genesis rejection. Build and debugging commands are in `contracts/README.md`.

The Windows WASM debugger could not resolve its transaction fixture path; using the native debugger resolved this tooling problem. CCC also required the Devnet DAO metadata for transaction fee handling; the exported metadata now includes it alongside the standard funding lock.

## Limits and key handling

This lab intentionally demonstrates a bearer hash-lock, not recipient authorization. A disclosed preimage authorizes anyone to spend Cells with the same digest; the contract does not restrict destination outputs. The portal keeps the preimage in React memory and does not persist it. Use local Devnet funds only. No private key or seed phrase is stored in the added source or deployment artifacts; funding/deployment resolve OffCKB's development account outside the repository. Stored deployment records are chain-specific and must be regenerated after a Devnet reset.

Final validation: 8/8 native VM contract tests, 13/13 portal tests, TypeScript checks, the production portal build, and 1/1 Chromium browser test passed. The rebuilt bytecode matches the recorded deployed code hash.
