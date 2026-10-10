# Week 9 Report — Script-Sourced Rich Information (SSRI)

**Project:** CellRoute / FiberPay  
**Recorded execution date:** 10 October 2026  
**Status:** Read-only Devnet implementation and runtime demonstration completed. Mutation authorization tests and production deployment are outside this report's scope.

## Objective

Understand how SSRI exposes script-defined information, implement a client that discovers methods and decodes their results, and integrate a read-only inspector into CellRoute. Keep SSRI queries separate from on-chain validation and wallet signing authority.

## What SSRI means in this implementation

SSRI lets a caller execute a supported script method in an explicit execution context and receive a result encoded by that script. The inspector uses **Code context only**; it does not supply Script, Cell or Transaction context.

Before calling SSRI, the client checks the expected Devnet genesis, committed deployment transaction, output index and CKB hash of the deployed code bytes. These checks establish which code the configured node provides. They do not cryptographically attest the execution service. The observed tip is diagnostic and does not pin the server to a chain snapshot.

A returned token name, pause status or assembled transaction does not authorize spending or replace contract validation.

## Delivered work

- `/ssri` portal route and sidebar entry, available without connecting a wallet.
- Pinned client profile with method discovery, encoding and explicit result decoders.
- Identity verification before script execution.
- Request deadlines, response-size limits, cancellation, schema validation and explicit retry.
- Decoded output, raw JSON-RPC receipts, public receipt export and a Devnet feature console.
- Fixed local Vite dev/preview proxy for the legacy server, which does not provide CORS.
- Public deployment metadata, reproducible commands, runtime receipts, screenshots and audit notes.

The inspector does not sign transactions or automatically apply returned metadata to Token Lab. Contract build artifacts remain under the ignored `contracts/build/ssri/` directory, separate from the React portal.

## Source versions and compatibility

| Component                    | Selected version / revision                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| SSRI server                  | `ckb-devrel/ssri-server` at `2bbe85ae68dac0019ee5f7c27e6e7ca25db7ce22`             |
| Prototype contract           | `Hanssen0/ssri-test` at `b71dd50d031e4e6e86eb9689658ed766d52ad0d6`                 |
| Prototype SDK                | Vendored `ckb-ssri` and `ckb-ssri-proc-macro` 0.1.0 at the same prototype revision |
| Contract dependency          | `ckb-std` 0.15.3                                                                   |
| Published SDK reading        | `ckb-ssri-std` 0.0.1, recorded in the source pins; not used by this prototype      |
| Pausable UDT source reviewed | `Alive24/pausable-udt` at `38f11ef0529e65dc7c5ecf37541a57ca923e9852`               |

The selected server supports the prototype's legacy syscall 2103 and returns a hex string. The inspected newer server revision uses different syscalls and a different result schema. Those versions cannot be interchanged without adaptation.

Method paths are the first eight bytes of the CKB personalized Blake2b hash of the UTF-8 method name. Pagination arguments are u64 little endian. This prototype returns raw concatenated eight-byte discovery paths, raw UTF-8 names, one-byte decimals/version and a little-endian u128 balance. These decoders are specific to the pinned profile.

## Deployment identity

| Field            | Recorded value                                                       |
| ---------------- | -------------------------------------------------------------------- |
| Network          | Local OffCKB Devnet                                                  |
| Genesis          | `0xb15fa8a50781f3a8bf84759682e2ce4027b7ae5361df45e8b68855ee413104be` |
| Code transaction | `0xe07f30bcce7621deb905906606e7d787ade578115668da963916ad3c30da2979` |
| Output index     | `0`                                                                  |
| Code hash        | `0x5824889298b5b3ad937090e4c503b1fb67992dc4e872332fe491a8e03b968983` |
| Node RPC         | `http://127.0.0.1:28114`                                             |
| SSRI server      | `http://127.0.0.1:9090`                                              |

The deployment was committed, and the client verified the code data hash. SSRI queries themselves are not transactions and have no transaction commitment status. These local identities must not be reused for another network or deployment.

## Recorded results

| Case                        | Evidence layer                  | Actual outcome                                                           |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `SSRI.get_methods`          | Real server RPC                 | Eight methods discovered                                                 |
| `UDT.name`                  | Real server RPC                 | Decoded `Test`                                                           |
| `UDT.decimals`              | Real server RPC                 | Decoded `8`                                                              |
| Repeated `UDT.name`         | Real server RPC                 | Returned `Test` again in Code context                                    |
| Unsupported method          | Real server RPC                 | JSON-RPC rejection                                                       |
| Unavailable code OutPoint   | Real server RPC                 | JSON-RPC rejection                                                       |
| Wrong code hash             | Client plus real node lookup    | Identity rejection before SSRI execution                                 |
| Discovery offset 0, limit 1 | Real server RPC                 | Five paths returned; upstream pagination defect recorded                 |
| Portal tests                | Unit/fixture tests              | 81 tests passed across 14 files, including six focused SSRI tests        |
| Portal build                | TypeScript and Vite             | Passed; existing large-chunk warning remains                             |
| Browser flow                | Edge / Playwright with real RPC | Wrong identity rejected; correct query rendered; Devnet console verified |

Fixture tests cover encoding, decoding, incompatible schemas, credential-bearing URLs, response bounds, request correlation, timeout and cancellation. They are reported separately from real server execution.

## Reproduction

The [project guide](docs/ssri-inspector.md) contains the pinned contract/server build, OffCKB deployment and startup commands. The recorded build used Rust/Cargo 1.98.0 and RISC-V GCC 15.2.0.

After starting the local node and pinned server, update `portal/public/ssri.devnet.json` with your deployment identity. Run from `portal/`:

```powershell
npm ci
npm test
npm run build
node scripts/ssri-evidence.mjs
npm run preview -- --host 127.0.0.1
```

In a second terminal, from `portal/`, run `node scripts/ssri-ui-check.mjs` with Edge installed, or open `http://127.0.0.1:4173/ssri`. The evidence helper writes public receipts to the evidence directory. It validates the configured genesis before querying.

## Investigated issues

The newer server and historical contract used incompatible syscall and response conventions. Pinning a compatible server preserved the prototype's actual API instead of accepting a different schema as success.

The OffCKB daemon exited under the command session. Running the existing node in a persistent foreground session restored RPC availability without resetting chain data.

The prototype's discovery pagination returns five paths for limit 1. This behavior is recorded as a defect, not interpreted as correct pagination. Its symbol is also `Test`, and its balance is a static example value rather than evidence of token holdings.

## Pausable UDT and audit review

All 11 PDF pages were read. The ScaleBit report is dated 18 December 2024 and covers `ckb-devrel/pausable-udt` revision `dc6c164b8956072180b97e0e3ce225c21aff70a9`, including `main.rs`, `error.rs`, `fallback.rs`, `modules.rs` and `utils.rs`.

Finding **MAI-1: Centralization Risk** is Informational and Acknowledged, not fixed. The report discusses privileged pause and mint controls and recommends multisignature administration.

The audited revision differs from the source reviewed for this exercise. The audit does not certify CellRoute. Source review distinguishes pause queries and transaction assembly from the input-lock, owner-mode and token-amount checks performed during validation. No pause/unpause mutation or authorization execution test was performed. See the [audit notes](docs/evidence/week-9/audit-notes.md) for the document fingerprint and scope details.

## Evidence and limitations

- [Environment and source pins](docs/evidence/week-9/environment.json)
- [Encoded requests, raw responses and decoded values](docs/evidence/week-9/method-calls.json)
- [Verification log](docs/evidence/week-9/verification.md)
- [Inspector screenshot](docs/evidence/week-9/inspector.png)
- [Live console screenshot](docs/evidence/week-9/console.png)

This is a trusted local Devnet lab, not a production SSRI service. Browser timeout does not stop server-side VM execution. Unknown methods are not callable through the inspector profile, and no chain-dependent snapshot invariance is claimed. No private key or seed phrase was added to the implementation or evidence.
