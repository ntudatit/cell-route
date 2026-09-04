# FiberPay CKB Beginner Dev Log

This log tracks implementation and testnet completion evidence for the CKB beginner exercises. Code completion is not the same as an on-chain completion: each exercise is complete only after its transaction reaches `committed` and the evidence fields below are filled in.

## Evidence rules

- Use CKB Testnet unless an exercise explicitly requires OffCKB Devnet.
- Never include private keys, seed phrases, wallet exports, access tokens, or unredacted secrets.
- Store screenshots in `docs/evidence/<exercise>/` using the filenames shown below.
- Record the transaction hash and explorer URL. A wallet submission screen alone is not proof of commitment.

## Exercise checklist

| Exercise | Implementation | Network verification | Required evidence |
| --- | --- | --- | --- |
| Transfer CKB | Implemented | Pending | `docs/evidence/transfer-ckb/committed.png` |
| Store Data on Cell | Implemented, including live-cell read | Pending | `docs/evidence/store-data/decoded-live-cell.png` |
| Fungible Token | Implemented: mint, transfer, live-cell query | Pending | `docs/evidence/xudt/mint-committed.png`, `holders.png` |
| DOB / Spore | Implemented: mint, on-chain read/render, transfer, melt | Pending | `docs/evidence/spore/mint-and-render.png` |
| Simple Lock | Not implemented | Pending | Contract tests, wrong-preimage rejection and committed spend |
| Fiber payment | Implemented | Pending | `docs/evidence/fiber/payment-success.png` |

## Run record template

Copy this section for every testnet/devnet run.

### YYYY-MM-DD — Exercise name

- Network:
- Wallet address/public identifier:
- Action:
- Transaction hash:
- Explorer URL:
- Final status:
- Screenshot path:
- Notes or errors:

## Automated verification

Run from `portal`:

```powershell
npm test
npx tsc --noEmit --incremental false -p tsconfig.app.json
npm run test:e2e
```

Run from `rust-service`:

```powershell
cargo check
```

## Current automated result

- Portal unit tests: 8 passed on 2026-09-03.
- Portal TypeScript check: passed on 2026-09-03.
- Rust `cargo check`: passed on 2026-09-03.
- Vite production build: blocked by a local `EPERM` lock while cleaning `portal/dist/assets`; TypeScript compilation itself passed.

