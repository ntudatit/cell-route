# Live Labs — operator setup and verification

The portal's Labs now accept actual deployment, asset and wallet inputs. Regression fixtures remain available only as explicit test tools; they are not the default RGB++ or DOB workflow. Configuration readiness is separate from evidence that a funded transaction has committed.

## Supported workflows

| Lab | Current live behavior | Required input / infrastructure |
| --- | --- | --- |
| RGB++ | Lookup any standard Cell OutPoint or Bitcoin UTXO; discover indexed live Cells; query spend state; verify Bitcoin Merkle inclusion against the supplied header; export raw receipts | Bitcoin Testnet3 / CKB Testnet or Bitcoin / CKB Mainnet public APIs; no wallet required |
| Simple Lock | Load a deployment manifest; verify genesis and live executable identities; derive, fund, build and submit an unlock with a size-based fee | Your deployed lock/VM, matching RPC and wallet for funding; user-retained preimage |
| SSRI | Query a user-selected method/encoded arguments on an identified script; accept legacy hex and modern VmResult envelopes; export a receipt | Compatible SSRI service connected to the same chain; code OutPoint/hash and method ABI |
| Token Lab | Existing sUDT/xUDT mint, transfer and explicit burn through the connected wallet, live Cells and transaction review | Supported deployed token standard and matching funded wallet; actual args/amount; display metadata entered by the user |
| Spore / Cluster | Existing create, transfer and melt flows use node/indexer state, ownership checks, review and wallet signing | Supported V2 deployment on selected network and funded wallet |
| DOB | Read DNA, Cluster pattern and decoder identity from live Cells; bounded supported DOB/0 trait preview; mint with user-supplied or freshly generated DNA | Actual DOB Spore ID for reading; supported decoder/pattern; wallet/Cluster for creation |
| Fiber two-node | Connect configured relays, create node-issued invoices, parse pasted invoices through the node, route/dry-run/pay and check real payment state | Configured Fiber network, two browser identities, compatible WSS relays and funded channels |
| Script Runtime | Execute a selected RISC-V binary or selected script group from a supplied transaction dump with explicit cycle/exit expectations | Installed ckb-debugger and your compiled artifact or complete transaction dump |

Token/Spore transaction pipelines were already live; their educational default names/content have been removed. Wallet context changes clear Token previews/balances, and the existing submit path rechecks account, deployment and live inputs. Fiber no longer reuses a stale payment hash when an invoice changes, isolates shared invoice state by network, rejects malformed storage and reports failed actions without a trailing success event.

## RGB++

Open `/rgbpp`, choose the network pair and lookup kind, then enter a transaction ID and output index. No sample ID is prefilled. UTXO discovery uses exact lock args and ten candidates per indexer page, with node checks. An empty page does not prove that no historical/dead asset exists. OutPoint lookup works on historical transactions as well as live Cells.

Merkle verification checks the supplied header hash, branch, position and Merkle root; it is not independent header-chain validation or execution of RGB++ lock/SPV contracts. Output and spend data remain API observations. Full RGB++ proof status remains not verified; no cross-chain completion is inferred.

From the repository root:

```powershell
node portal/scripts/rgbpp-live.mjs testnet3 cell <ckb-transaction-hash> <index>
node portal/scripts/rgbpp-live.mjs mainnet utxo <bitcoin-txid> <vout>
```

The CLI writes dated public receipts under `docs/evidence/live-labs/`. Real observations were recorded for both network pairs, including a Mainnet live Cell/unspent UTXO with matching Bitcoin Merkle inclusion. Public state can change; refresh it.

## Simple Lock deployment manifest

Open `/simple-lock` and upload a public JSON manifest. It must identify `network` (`devnet`, `offckb-devnet`, `testnet` or `mainnet`), `rpcUrl`, `genesisHash`, `code`, `vm` and optionally `knownScripts`. Each executable has a code hash, hash type and one explicit `code` Cell dependency. The current contract deployment exporter produces this shape:

```powershell
cd contracts
npm run export:metadata
```

Use your deployment's actual hashes and RPC, not another network's exported OutPoints. The UI verifies code Cells before deriving or spending, checks wallet genesis for funding, allows a funding amount and estimates unlock fees from transaction size. At most100 plain capacity Cells are listed. Manifest files containing signing-material fields or credential-bearing URLs are rejected.

The hash-lock is a bearer contract: anyone with its preimage can spend it, and the preimage is public on submission. Code/deployment verification does not make this educational contract audited. This update did not deploy it or spend funds on Mainnet.

## SSRI

Open `/ssri`. Enter the node URL, SSRI service URL, expected genesis, code hash, transaction hash/index and method name. Arguments are an explicit JSON array of encoded hex strings. The client never substitutes prototype metadata or a success result when the service is absent. Result bytes and optional UTF-8 text are displayed; script-defined ABI schemas are not guessed.

Public defaults can be supplied with `VITE_SSRI_NODE_URL` and `VITE_SSRI_SERVER_URL`. Never put API secrets into browser environment variables. Operate a compatible service with CORS or a suitable operator-controlled reverse proxy. The service and node must use the same network. The browser checks node code identity but does not cryptographically attest remote execution.

## Spore, DOB and Token inputs

Token names, symbols and decimals are display metadata; real contract args and live Cells determine the asset. New operations start with empty user input instead of a Week6 token name/amount. Existing prepared-transaction fingerprint, account and live-input checks remain in place.

Spore content and Cluster name/description start empty. Standard Spore and Cluster signing flows remain unchanged. The optional supported DOB/0 creation template accepts user DNA or generates fresh eight-byte DNA. On-chain DOB preview loads the Spore and Cluster, rechecks both through the node, checks the decoder identity and supports bounded options/range/raw-number traits. Unsupported decoders/modes are reported instead of returning sample attributes. The deployed RISC-V DOB decoder is not executed by this local reference preview.

## Fiber and Runtime

Set public relay addresses with `VITE_FIBER_RELAY_A` and `VITE_FIBER_RELAY_B`, or enter them in `/fiber-lab`. Browser Fiber still requires its configured network, cross-origin-isolated route and actual funded channels. Mainnet startup remains explicitly configured; selecting a CKB Mainnet wallet alone does not configure Fiber.

A pasted invoice is parsed by the node before sending or verifying, so its payment hash is not inherited from a previous invoice. Dry-run remains clearly distinct from an actual payment.

Run arbitrary compiled runtime inputs from the repository root:

```powershell
node contracts/scripts/runtime-inspect.mjs binary <artifact> --cycles 10000000 --expect 0 -- <program-args>
node contracts/scripts/runtime-inspect.mjs transaction <complete-dump.json> --script input.0.lock --cycles 10000000 --expect 0
```

Artifacts are bounded to4MiB, execution to30seconds and an explicit cycle limit. Binary mode executes standalone CKB-VM code; transaction mode evaluates the selected group in the supplied dump. Neither proves node commitment. The report distinguishes VM exit code from debugger process exit status. Receipt: ignored `contracts/build/runtime-lab/runtime-inspection.json`.

## Validation and remaining prerequisites

This change is verified through unit tests, browser tests, actual public RGB++ queries and an actual local VM execution. See [verification](evidence/live-labs/verification.md).

The update does not claim a newly funded Simple Lock/Token/Spore transaction, SSRI execution on an operator's unconfigured service, a funded Fiber payment or full RGB++ SPV verification. Those require the user's deployment/service/wallet/funds and their own resulting receipts. No private key, seed phrase or generated wallet secret is stored in these public evidence files.

RGB++ provider URLs can be configured with VITE_RGBPP_TESTNET_CKB_RPC, VITE_RGBPP_TESTNET_BTC_API, VITE_RGBPP_MAINNET_CKB_RPC and VITE_RGBPP_MAINNET_BTC_API. Use public HTTP endpoints without embedded credentials; genesis and deployment identity checks still apply when changing providers.
