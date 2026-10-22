# CellRoute / FiberPay: CKB asset workflows, script inspection, and Fiber payment tooling

## Project Summary

CellRoute (also branded FiberPay in the UI) is a wallet-connected web application for working with CKB assets and inspecting transaction behavior. It brings CKB transfers, sUDT/basic xUDT, Spore/DOB workflows, script labs, and read-only SSRI/RGB++ inspection into one interface. It also includes browser-based Fiber payment tooling. The goal is to make transaction construction, review, submission, and evidence understandable to users and developers. This is an evolving CKBuilder project; I would appreciate feedback on both correctness and which workflow should become its primary product focus.

## Tools used

- React, TypeScript, Vite, and React Router.
- CCC: `@ckb-ccc/core`, `@ckb-ccc/connector-react`, and `@ckb-ccc/spore`.
- `@nervosnetwork/fiber-js` for the browser Fiber runtime.
- Rust/Axum and PostgreSQL for backend state, authentication, indexing, and operations data.
- OffCKB, CKB JS VM, and `ckb-debugger`; AssemblyScript, WABT, and a RISC-V toolchain for the runtime lab.
- Vitest and Playwright for local verification.

## Current features

- **CKB and tokens:** CKB transfer/data tools; sUDT and basic xUDT mint, transfer, and explicit burn with live Cell collection and transaction review. The recorded Week 6 Devnet demo includes six committed token transactions and unauthorized mint rejection.
- **Spore / Cluster:** preparation, review, signing, broadcast, and commitment observation; live ownership/content checks; transfer preservation and explicit melt confirmation. DOB preview supports a bounded subset of DOB/0, not arbitrary decoder execution.
- **Simple Lock:** an educational bearer hash-lock with deployment identity checks, address derivation, funding, and unlock construction. Knowing the preimage permits spending; this contract does not bind a recipient.
- **SSRI inspector:** method calls against an identified script with encoded arguments, response handling, and public receipt export. A compatible operator-provided service and method ABI are required. Code identity checks do not attest the remote execution service.
- **RGB++ inspector:** read-only CKB OutPoint / Bitcoin UTXO lookup, network/deployment checks, per-chain observations, and Bitcoin Merkle inclusion checking against a supplied header. Full header-chain/SPV and RGB++ contract verification remain incomplete; no signed RGB++ transfer is claimed.
- **Fiber tooling:** browser-node setup, invoices, readiness/payment workflows, and two-node tooling. Usable relays, node identities, and funded channels are prerequisites; a hosted UI alone is not a working payment network.
- **Developer tooling:** per-feature Dev Console, public evidence exports, and a reproducible WASM-to-RISC-V/debugging lab.

## Planned features

- Complete and publish the outstanding signed Testnet Spore lifecycle evidence using two wallets, including old-owner rejection after transfer.
- Improve DOB execution conformance beyond the bounded local reference preview.
- Establish a compatible full RGB++ proof-verification path before attempting signed transfers.
- Explore xUDT extensions and iCKB after the current workflows are reviewed.
- Narrow the product focus based on feedback: asset transaction workspace, protocol inspection tools, or Fiber merchant workflows.

## Deployed on

The frontend is hosted on Vercel. Feature support and verification vary by network:

- **Local Devnet:** recorded Simple Lock/token exercises and SSRI runtime demonstration; local services/deployment metadata are required.
- **CKB Testnet:** the intended environment for funded reviewer transaction exercises using supported deployments.
- **Mainnet:** read-only RGB++ observations have been recorded. Mainnet configuration exists, but this review request does not claim production readiness or verification of all Mainnet signing flows.

Please start with read-only inspection or Testnet. Some labs require operator services or a local checkout; the hosted frontend does not supply every dependency. Setup and support boundaries are documented in [Live Labs](https://github.com/ntudatit/cell-route/blob/main/docs/live-labs.md).

## Link to repository

https://github.com/ntudatit/cell-route

## Link to hosted version of project

https://cellroute.vercel.app/

Suggested entry points: `/rgbpp`, `/ssri`, `/dob-spore`, and `/fungible-token`. Read-only inspectors do not require a wallet; transaction preparation/signing requires a matching wallet and supported network.

## Screenshots

Recorded development screenshots from the repository; the current UI may differ as inputs and live configuration evolve.

![RGB++ inspector](https://github.com/ntudatit/cell-route/blob/main/docs/evidence/week-10/inspector.png?raw=true)

![SSRI inspector](https://github.com/ntudatit/cell-route/blob/main/docs/evidence/week-9/inspector.png?raw=true)

## Request for feedback

### Review priorities and expected invariants

| Area | What reviewers should check |
| --- | --- |
| Transaction review | Wallet/network changes, stale inputs, or transaction mutation should invalidate the prepared review. Submission must not be presented as commitment. |
| Token accounting | Transfers preserve token quantity; explicit burns reduce it by the requested amount; unauthorized normal-mode inflation fails. Capacity fees are accounted for separately from tokens. |
| Spore lifecycle | Transfer preserves ID/type and content while changing the owner lock. Melt consumes the live object without claiming to erase history. An indexer miss alone must not prove melt. |
| SSRI | Responses remain associated with the selected code/context; unknown ABI, service failure, and malformed output must not become trusted metadata or spending authority. |
| RGB++ | API observations, commitment checks, Merkle inclusion, and full protocol verification remain distinct. Missing proof or an unknown Cell state must not be promoted to verified/live. |

### Specific questions

1. Are there gaps in the CCC transaction review/sign/broadcast flow, especially wallet changes, witness handling, input liveness, and fee checks?
2. Are the Spore/Cluster preservation checks and the supported DOB preview scope appropriate? Which conformance tests should be added first?
3. Is the SSRI client/service separation reasonable, and what is the recommended compatibility path for maintained SSRI tooling?
4. For RGB++, which verifier/client-state integration should I prioritize to move beyond read-only linkage and Merkle inclusion checks?
5. Which part offers the clearest value to CKB users, and which features should be simplified or separated before further expansion?

### How to review

1. Start with the hosted read-only inspectors and the Live Labs setup guide. Supply public asset identifiers and verify that each displayed status states its evidence source.
2. For transaction testing, use a supported Testnet wallet with test funds, inspect the review, then compare node commitment and resulting live state. Record the network, operation, public identifier, and expected versus actual behavior when reporting an issue.
3. For reproducible local work, follow the report-specific commands and evidence links below. Historical test results are not a claim that every hosted workflow was freshly verified today.

### Reports and evidence boundaries

- [Week 6: Token Lab](https://github.com/ntudatit/cell-route/blob/main/README-WEEK-6.md)
- [Week 7: Runtime and debugging](https://github.com/ntudatit/cell-route/blob/main/docs/week-7-report.md)
- [Week 8: Spore/DOB and performance](https://github.com/ntudatit/cell-route/blob/main/docs/week-8-report.md) — distinguishes local tests from outstanding signed lifecycle evidence.
- [Week 9: SSRI](https://github.com/ntudatit/cell-route/blob/main/README-WEEK-9.md) — records the local runtime demonstration and version-specific limitations.
- [Week 10: RGB++](https://github.com/ntudatit/cell-route/blob/main/docs/week-10-report.md) — distinguishes observations from full proof verification and transfer.

Thanks to Neon for suggesting this review request. Feedback from CKB core developers and the wider community would be very welcome.
