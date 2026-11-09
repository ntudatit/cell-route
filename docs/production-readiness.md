# CKBuilder Handbook coverage and production readiness

Reviewed 9 November 2026. Scope is the CellRoute repository and its recorded evidence. The Handbook is a learning pathway with a prototype and a contemporaneous GitHub dev log. This review maps practical work and identifies evidence gaps. Course participation, weekly submission dates and programme completion are for the builder and reviewer to confirm. [CKBuilder Handbook](https://docs.google.com/document/d/1aFHXU1ZL1MyIbBAIVRjG6stqdWwPUPyHV90O1QNwY-M/edit?usp=sharing)

## Curriculum coverage

| Handbook area | CellRoute evidence | Outstanding verification |
| --- | --- | --- |
| Introduction and Beginner setup, CCC, CKB transfer and Cell data | [Reviewer guide](../OVERVIEW.md), wallet-connected flows and [Mainnet operation notes](mainnet.md). OffCKB setup and contract exercise commands are in the [contracts guide](../contracts/README.md). | The repository does not record individual Academy lesson completion or separate funded Testnet receipts for every basic exercise. |
| Beginner fungible token and Simple Lock | [Token Lab](token-lab.md) covers sUDT and basic xUDT. [Devnet token evidence](../contracts/deployment/week6-evidence.json) records mint, transfer and burn. The [Simple Lock receipt](../contracts/deployment/week5-evidence.json) records committed funding and unlock, wrong preimage exit 7 and missing witness exit 6. | The hash-lock is an educational bearer script. Mainnet operation would need a separate review and deployment. |
| Beginner application and payment channels | CellRoute combines wallet and asset flows with browser Fiber invoices, checkout and node diagnostics. [Deployment guide](../DEPLOYMENT.md). | A funded local Testnet checkout and receiver reconciliation are recorded in the [settlement evidence](evidence/fiber-testnet-checkout.json). Perun is a Handbook resource without a CellRoute integration. |
| Intermediate script course and tooling | The Simple Lock and token tests exercise lock/type validation, witnesses and VM exit codes. [Script runtime](script-runtime.md) and [runtime report](week-7-report.md) cover WASM, RISC-V, debugger traces and JavaScript comparisons. [Performance evidence](week-8-report.md) records cycle measurements. | No standalone Type ID lifecycle, Molecule conformance exercise or dedicated exercise for each Duktape/Rust scripting lesson was identified. |
| Intermediate Nervos DAO | [iCKB report](week-12-report.md) documents DAO accumulated rate and withdrawal timing in conversion checks. | A direct Nervos DAO deposit, withdrawal request and final unlock lifecycle is not recorded. |
| Beginner DOB and Intermediate Spore | [Spore/DOB report](week-8-report.md) links deployment observations, lifecycle checks, Cluster preparation and restricted DOB/0 preview. | Funded create, transfer, old-owner rejection and melt on Testnet are pending. Official decoder binary conformance is pending. |
| Advanced SSRI | [Method evidence](evidence/week-9/verification.md) records local runtime discovery, metadata decoding and negative cases. | Public service compatibility and Pausable UDT mutation authorization remain outside the demonstrated query flow. |
| Advanced RGB++ | [Binding evidence](evidence/week-10/verification.md) and [public-chain observations](evidence/live-labs/verification.md) cover decoding, network selection and partial proof checks. | Independent header-chain/SPV verification and signed cross-chain transfer are pending. |
| Advanced xUDT extensions | [VM evidence](evidence/week-11/verification.md) records 31 cases, including extension rejection, owner modes and the input-lock shortcut. | The witness marker is a local teaching rule. Deployment and integration into Token Lab were outside the demonstrated exercise. |
| Advanced iCKB | [Conversion evidence](evidence/week-12/verification.md) records a live Testnet snapshot, 47 SDK/reference checks and byte-for-byte unfunded deposit construction. | Funded deposit, commitment, receipt consumption and redemption are pending. |

The [advanced evidence index](advanced-evidence-index.md) and [project review issue draft](ckbuilder-project-review-issue.md) are reviewer entry points. Preserve dated reports and receipts when reorganizing source.

## Changes for deployment

- Removed the legacy server-side Fiber payment POST route. A wallet JWT established the caller's wallet identity but gave any authenticated caller a path to spend from the same backend Fiber node. Browser Fiber payment routes still use the caller's browser node.
- Removed configured upstream URLs from public network and Fiber status payloads. HTTP errors now return generic messages for upstream, database and internal failures. The transaction stream omits raw RPC errors.
- Added PostgreSQL and canonical public-chain checks to the existing readiness endpoint. The five-second deadline covers both dependencies. Devnet has no fixed genesis in this check. Validate custom indexer endpoints separately.
- Compose and Render enforce deployment secret validation via `APP_ENV=production`, including on Testnet. The API image runs as a non-root user and excludes local environment files from its build context.
- Updated the portal lockfile to `follow-redirects` 1.16.3 to address the redirect credential-handling advisories. [Upstream advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
- Contract Jest discovery is scoped to tracked test sources. Rust CI uses the committed lockfile for Clippy and tests.

## Review checks

- The portal passed 139 unit tests, nine Playwright lab checks and its production build. Vite still reports large chunks.
- The contract suite rebuilt Simple Lock with `ckb-debugger` 1.1.1 and passed all 19 Simple Lock and sUDT cases. The xUDT extension passed all 31 local VM cases.
- Rust formatting and strict Clippy passed. All nine backend unit tests and the clean PostgreSQL 17 migration test passed.
- Docker Compose configuration parsed successfully. This check covers configuration syntax. Deployment, failure recovery and capacity remain staging checks.
- The production dependency audit found no moderate or higher advisories after the lockfile patch. It still reports 21 low-severity entries in the Elliptic dependency chain.
- iCKB Playwright screenshots now go to the test output directory so routine runs preserve the archived Handbook screenshot.

## Fiber checkout follow-up

The API integration test exercised invoice issuance, idempotency replay, direct `PAID` rejection, wrong-wallet access, missing MCP authorization, a pending `Received` invoice, rejection of a mismatched amount, concurrent reconciliation and one settlement audit row. It used PostgreSQL 17 and a controlled Fiber RPC fixture. The API also returned `429` despite varying forwarded-IP headers.

On 9 November 2026, two private Fiber v0.9.1 nodes reached `ChannelReady` on CKB Testnet. A 1 CKB payment through the native payer RPC produced payer `Success`, receiver `Paid`, and a persisted CellRoute `PAID` with one settlement audit event. The browser route was checked for HTTP availability and isolation headers. The payment itself used native RPC. See the [recorded settlement](evidence/fiber-testnet-checkout.json). Follow the [staging checkout runbook](../DEPLOYMENT.md#staging-fiber-checkout). [Fiber Testnet nodes](https://github.com/nervosnetwork/fiber/blob/develop/docs/public-nodes.md)

## Release gates

| Priority | Gate | Acceptance evidence |
| --- | --- | --- |
| Staging verification | Limit API abuse and restrict shared operations data | Weighted API and Nginx edge limits, owner access and operator allowlists are implemented. Verify the deployed ingress IP settings and quotas at the intended load. |
| Staging verification | Derive merchant settlement from trusted payment evidence | Orders use invoices issued by the configured receiver. Reconciliation checks identity, chain, asset, amount, hash and exact status. The local funded Testnet run confirmed payer and receiver settlement. Repeat on the intended deployment before enabling fulfilment. |
| Before enabling affected wallets | Review the remaining wallet dependency advisory | Identify whether deployed wallet flows invoke the affected Elliptic signing path. Validate an upstream migration or a supported wallet configuration before accepting the residual risk. [Elliptic advisory](https://github.com/advisories/GHSA-848j-6mx2-7j84) |
| Blocker | Test a production-shaped staging deployment | Verify PostgreSQL migrations, restore a backup, check liveness and readiness during dependency failures, validate TLS and Fiber isolation headers and repeat funded checkout through the browser payer on the intended deployment. |
| Before promoting optional modules | Verify each funded feature independently | Record the missing signed lifecycles in the coverage table. Present SSRI, RGB++ and iCKB results with their current inspection boundaries. |
| Before scaling | Measure capacity and recovery | Load-test HTTP, SSE and database use against a stated target. Record tail latency, errors and resource usage, and exercise rollback. The browser Fiber runtime is lazy-loaded but remains large. |

Use the [deployment runbook](../DEPLOYMENT.md) for commands. The review supports a staged release decision. Funded Mainnet operation requires evidence from the release gates.
