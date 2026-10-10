# Week 9 verification / report

Executed 2026-10-10 against local OffCKB Devnet and pinned legacy SSRI server. See environment.json for exact identities and source pins; method-calls.json stores encoded requests, raw JSON-RPC results and decoded values.

- Actual discovery: eight methods.
- Actual UDT.name: Test; UDT.decimals: 8.
- Unsupported method: JSON-RPC rejection.
- Unavailable code OutPoint: JSON-RPC rejection.
- Wrong code hash: client identity rejection after actual node lookup, before SSRI invocation.
- Pagination offset0/limit1: actual response contains five paths, demonstrating an upstream prototype bug.
- Deployment was committed and code data hash verified by the client. SSRI calls are queries, not transactions or on-chain validation.
- Portal TypeScript/Vite build passed. All 81 portal tests passed, including six focused SSRI tests; these use fixtures and are separate from the runtime calls above.

SSRI lets a caller execute a supported method in a selected context to obtain script-provided information. The caller must use the revision's encoding, check the code identity, and trust the execution service. A name, pause status or assembled transaction returned by SSRI does not grant signing authority or replace the contract's input/output validation.

One investigated failure: current server and historical prototype use different syscalls and result encodings. Selected the compatible legacy server instead of interpreting modern responses as legacy success. Another local issue was the daemon exiting under the command session; foreground OffCKB made RPC available without resetting chain data.

All11 audit pages were read and source/query/validation boundaries reviewed: see audit-notes.md. The inspected and audited revisions differ. No mutation authorization execution is claimed. Week9 readonly runtime demo is complete. Next: follow the Week10 work plan, with separate authorization tests required before any pause mutation. No production readiness claim is made.

Actual browser check: installed Edge via Playwright rendered a real UDT.name receipt through the fixed Vite proxy; inspector.png was inspected visually. Header network refers to the portal wallet; the inspector and its console use explicit Devnet context.


Build environment: Rust1.98.0, Cargo1.98.0, RISC-V GCC15.2.0; prototype ELF SHA256 3b9ee5251fde888da5ddc9f7aae3368b34a19bec0b472614e4a3e2f0efc4c6e7 (28320 bytes). Repeated UDT.name query returned Test in Code context; no chain-state invariance is inferred.


Final UI verification also rejected wrong code hash, cleared stale diagnostics on edit, rendered a correct query, and displayed the Devnet console. Run from portal: node scripts/ssri-ui-check.mjs (requires installed Edge and Vite preview4173 plus local RPC/server).

