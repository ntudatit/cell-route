# Network promotion

| Environment | CKB_NETWORK | RPC example | Purpose |
|---|---|---|---|
| devnet | devnet | `http://127.0.0.1:8114` | local contract/application integration |
| testnet | testnet | `https://testnet.ckb.dev` | public QA / portfolio demo |
| mainnet | mainnet | `https://mainnet.ckb.dev/rpc` | production after explicit release approval |

Keep `JWT_SECRET`, database credentials and deployment provider tokens in environment secrets. Never put wallet private keys in this service: user signing remains in CCC/browser wallets.

For each network set `XUDT_CODE_HASH`, `SPORE_CODE_HASH`, and `SPORE_CLUSTER_CODE_HASH` to the deployment you actually intend to classify in the indexer.
