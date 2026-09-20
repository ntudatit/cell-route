# Mainnet operation

CellRoute now has an explicit CKB Mainnet build. It selects only Mainnet in the wallet connector, shows the selected client network and tip, and uses that client for transaction status and explorer queries. Mainnet broadcasts verify the canonical genesis hash first, including when a custom RPC is configured.

## Run the portal

```sh
cd portal
npm ci
npm run dev:mainnet
# Production artifact:
npm run build:mainnet
```

Public defaults are in `.env.mainnet`. Copy `.env.mainnet.example` to `.env.mainnet.local` to set your production `VITE_API_URL` and optional dedicated `VITE_CKB_MAINNET_RPC_URL`. Vite variables are included in the browser bundle: never put private keys, API secrets, or credential-bearing RPC URLs in them. The `.local` file is ignored by Git. Environment variables already set in the shell take precedence over mode files.

A custom RPC must support both CKB node and indexer methods. It has no automatic public fallback. Otherwise CCC's built-in Mainnet endpoints and official Script metadata are used. [CCC clients](https://docs.ckbccc.com/en/docs/concepts/client).

## Configure the backend

Use `rust-service/.env.mainnet.example` as a template for an ignored local `.env`. Set your database connection, CORS origin, and a randomly generated JWT secret. Use a separate Mainnet database. Set `CKB_NETWORK=mainnet`; RPC and indexer defaults now follow that network instead of silently remaining on Testnet. Explicit URL overrides still take precedence. Unknown network names fail startup.

The backend supports one configured chain per deployment. Mainnet wallet transactions must not be recorded against a Testnet backend. Dashboard/activity queries and authentication detect a network mismatch. Transfer and Store Data submission report backend recording failures separately from the successful broadcast, preserving the transaction hash.

If using backend xUDT/Spore indexing, configure their Mainnet Script hashes from the deployed protocol metadata. Setting the network name does not migrate a database, a Fiber node, or previously deployed contracts.

## Transfer behavior

- The wallet uses the selected chain and rejects addresses with another chain's prefix.
- Amounts preserve eight decimal places without floating-point rounding; fee rates are validated.
- Transfer CKB previews retain the built transaction. Editing fields or changing the signer invalidates the preview; changing networks clears the page state.
- Submission checks the wallet identity and sends the retained transaction to the wallet. Review the final recipient, outputs and fee in the wallet before signing.
- The on-chain observer distinguishes pending/proposed from committed/rejected and uses the submitting client's chain. Explorer links select Mainnet or Testnet appropriately.

No Mainnet funds were sent while implementing or testing these changes. Wallet signing and actual Mainnet transfers remain user-controlled. These improvements are not a security audit of every asset contract or the complete service deployment.

## Development-only features

The Simple Lock bearer hash-lock stays on OffCKB Devnet. Mainnet builds show an explanation at `/simple-lock` and do not expose its funding/unlocking controls. The Testnet faucet is unavailable on Mainnet. Run `npm run dev` for the normal Testnet/Devnet development flow.

Only a Testnet Fiber YAML is bundled. Mainnet mode disables browser Fiber startup. To operate Mainnet Fiber, provide and validate a Mainnet configuration, set `VITE_FIBER_NETWORK=mainnet`, and explicitly set `VITE_FIBER_MAINNET_ENABLED=true`. Do not reuse Testnet chain settings or browser database identifiers. The Mainnet example uses a separate database prefix. Native Fiber operations also require a separately configured Mainnet FNN service; enabling the CKB portal does not configure that service.

## Verification

```sh
cd portal
npm test
npm run check:mainnet
npm run test:e2e:mainnet
# In rust-service:
cargo test --locked --offline network_tests --bin rust-service
```

`check:mainnet` reads genesis and tip only. Optionally set `CKB_MAINNET_RPC_URL` for that CLI check. It never loads signing material or submits a transaction. The browser smoke test verifies the Mainnet indication and disabled Devnet lab without connecting a wallet. The Simple Lock Devnet verification data remains in `contracts/deployment/week5-evidence.json`.

Read-only verification on 2026-09-09 returned Mainnet genesis `0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5` and tip 20404561. This is a point-in-time connectivity observation, not a transaction confirmation.

Validation results: 35 portal tests and the Rust network-default test passed. Mainnet production compilation, Mainnet browser smoke testing, and public Mainnet RPC checks passed. No signing material was added.

## Asset and backend follow-up (2026-09-10)

Spore, Cluster and xUDT audit recording now checks the backend network before writing. A submitted transaction remains reported as submitted if the audit API is unavailable, unauthenticated or on another chain. Audit success does not imply transaction commitment; use the on-chain status observer. The asset portfolio also checks the backend network before reads or sync, clears old wallet data, and ignores late responses after wallet changes.

The backend now parses CKB addresses and validates their network at authentication, token issuance/authorization, asset operations, indexer sync, tracking and dashboard reads. This rejects mismatches from direct API callers as well as the portal. Testnet and Devnet share the ckt address prefix; matching node configuration and separate service databases are still required to distinguish those environments.

Mainnet startup requires a JWT secret of at least 32 bytes and rejects development defaults and common placeholders. Supply a randomly generated secret through your deployment secret store or ignored environment file. The length check does not prove randomness. Existing Testnet/Devnet development defaults continue to work.

Follow-up validation: 39 portal tests, 8 backend unit tests and the Mainnet production build passed. These checks do not submit Mainnet transactions.
