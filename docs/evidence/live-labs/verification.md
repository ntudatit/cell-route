# Live Labs verification — 16 October 2026

Public network receipts were captured on 15 October 2026; final local checks were repeated on 16 October 2026.

## Executed checks

- Portal unit/fixture suite:121 passed across21 files (including live lookup, Merkle tampering, arbitrary SSRI method/envelope, manifest validation, custom DOB traits and invoice-storage cases).
- Portal TypeScript/Vite build passed; existing large-chunk warning remains.
- Dedicated Labs browser suite:9 passed (Mainnet response replay with local Merkle calculation; live-first inputs; explicit Simple Lock manifest; DOB input errors and unique DNA; retained offline regression checks and mobile behavior). Replay responses are not labeled new network observations.
- Runtime parser suite:4 passed.
- Actual CKB-VM CLI invocation: the chosen artifact with user arguments `fib 5` returned VM result8 in34,961 cycles, matching the explicitly supplied expected result. This is standalone VM execution, not a node transaction.
- Actual RGB++ Testnet3 OutPoint lookup: historical Cell binding decoded directly from RPC; selected UTXO spent; Bitcoin inclusion matched the API-supplied header.
- Actual RGB++ Mainnet OutPoint lookup: live Cell, unspent UTXO; Bitcoin inclusion matched the supplied header. Exact tips/identities/raw responses are in the dated JSON receipts.

## Evidence scope

`rgbpp-testnet3-cell.json` and `rgbpp-mainnet-cell.json` are actual public API/node observations, not virtual-transaction fixtures. A matching Bitcoin branch/header does not establish an independently validated header chain or full RGB++ SPV verification. Full RGB++ proof remains not verified.

Contract signing/payment workflows require the operator's wallet, deployment and funds. No new public-chain asset transfer, SSRI service execution or funded Fiber settlement is claimed by this run. Historical Week reports remain dated evidence for their original implementations.
