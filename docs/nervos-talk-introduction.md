# CellRoute / FiberPay — CKB development tools with live asset inspection

Hi Nervos community,

I am building CellRoute / FiberPay, a CKB application that brings development labs and payment experiments into one portal. I would like to share the current progress and get feedback from developers in the ecosystem.

Live app: https://cellroute.vercel.app/
Source: https://github.com/ntudatit/cell-route

## What the project includes

- Simple Lock: deployment manifest checks, lock-address derivation, live capacity lookup, and funding/unlocking transaction preparation.
- Token Lab: sUDT/xUDT transaction workflows with wallet review and live-input checks.
- Spore/DOB: asset reading and transaction review, with a bounded local DOB/0 reference preview.
- SSRI Inspector: configurable service/script inputs, code identity checks, method queries and public receipt export.
- RGB++ Inspector: read-only Bitcoin UTXO / CKB Cell binding inspection on paired Mainnet or Testnet networks.
- Fiber experiments: two-node invoice/payment workflows requiring configured relays and funded channels.
- Runtime tools and per-feature developer consoles for inspecting results and errors.

These capabilities have different prerequisites and verification levels. A UI workflow being implemented does not mean its funded on-chain lifecycle has been verified.

## Latest progress: RGB++

The Week 10 work adds live lookup from a user-supplied CKB OutPoint or Bitcoin txid/vout. The inspector checks network genesis and deployment identity, decodes the binding, reports each chain's state separately and exports public receipts. An advanced regression tool reproduces an upstream fixture's virtual transaction commitment and deliberate mismatch cases.

Public queries captured on 15 October 2026 identified a live Mainnet CKB Cell bound to an unspent Bitcoin UTXO. The client also checked Bitcoin transaction Merkle inclusion against the API-supplied block header.

This is not full RGB++ SPV verification: the header chain was not independently validated and the RGB++ lock was not executed by this inspector. No RGB++ transfer was signed or broadcast. Results are never labeled cross-chain complete.

## Validation and limits

The latest local validation passed 121 portal unit tests across 21 files, 9 Labs browser tests, 4 runtime parser tests, and the production build. These totals cover the broader project, not RGB++ alone. Browser tests include recorded-response replay; actual public-network observations are recorded separately.

The production build still reports a large-bundle warning. Some workflows require operator deployments, compatible services, interactive wallets and funds. The deployed website may differ from the latest local source until the changes are deployed. I am sharing this as a work in progress, not an audited production payment service.

Week 10 report and evidence links:
https://github.com/ntudatit/cell-route/blob/main/docs/week-10-report.md

## Feedback welcome

I would appreciate feedback on the inspector's evidence boundaries, compatible RGB++ proof-verification infrastructure, and which developer workflow would be most useful to improve next.

My next steps are investigating compatible SPV/client-state verification, preparing a separately reviewed test-network transfer, and continuing with xUDT extensions.
