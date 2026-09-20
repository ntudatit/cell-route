# Week 6 Report — sUDT and xUDT Token Lab

**Project:** FiberPay / CellRoute  
**Recorded Devnet demonstration:** September 17, 2026

## Objective

Extend the CKB script exercises with fungible tokens: understand owner-authorized issuance, token conservation, explicit burning, and transaction validation using sUDT and basic xUDT.

## Implementation

- Extended `/fungible-token` with sUDT/basic xUDT mint, transfer, explicit burn, live token Cells, and transaction review.
- Added BigInt amount handling and uint128 little-endian encoding. Token names, symbols, and decimals are display metadata.
- Separated sUDT owner-lock-hash arguments from basic xUDT arguments, which append zero extension flags.
- Added checks for genesis identity, live dependencies, token accounting, changed wallets, modified previews, and input liveness before submission.
- Added pinned sUDT artifact verification, Devnet metadata export, native VM fixtures, and an automated demonstration using ephemeral in-memory wallets.
- Added backend sUDT recognition through `SUDT_CODE_HASH`, accepted `SUDT` asset events, and a database migration.

The lab uses an existing sUDT executable bundled with OffCKB CLI 0.4.12. `week6:build` verifies its checksum and stages the binary; it does not compile a new contract from C source. Byte-for-byte correspondence to the reference C source has not been established. See [artifact provenance](contracts/vendor/sudt/README.md).

## Recorded Devnet results

The [evidence JSON](contracts/deployment/week6-evidence.json) records the following sequence independently for both token standards. Amounts are raw token units; fees are shannons.

| Action | Token inputs → outputs | Owner balance | Holder balance | sUDT fee | xUDT fee |
| --- | --- | --- | --- | --- | --- |
| Mint 1,000 to holder | 0 → 1,000 | 0 | 1,000 | 1,204 | 1,212 |
| Transfer 250 to owner | 1,000 → 1,000 | 250 | 750 | 1,712 | 1,728 |
| Burn 50 from holder | 750 → 700 | 250 | 700 | 1,292 | 1,300 |

All six transactions were recorded as `committed`. Unauthorized minting was rejected with script exit code `-52` for each standard. After burning, the two demo wallets hold a combined 950 units of each token.

| Standard | Action | Transaction hash |
| --- | --- | --- |
| sUDT | Mint | `0xc198c435e4184d5076caaf6d847ca4c7824dcd84971caf55af3e64096e0e78db` |
| sUDT | Transfer | `0xd4610f48fac5af54c5e0974620d27e59ecd5275c9227ddfb613ca3b4231d19c9` |
| sUDT | Burn | `0xa3e6edef2b3738b8457e89500f9edb230b23a38d780bf523cc869e95737c2557` |
| xUDT | Mint | `0xff7323b54590b23d0cd3e78561a94390ac8a80eeb82aa68963cfe2996c6450e0` |
| xUDT | Transfer | `0x4fcfadc8387441ebb6c0f52ea0416def931469051d92c50bdee60432a87a1efd` |
| xUDT | Burn | `0xe9ed02ad588e2d0fcb79cea7be66cc670a7a0d30e0eca417336e4f514905a1f9` |

These are local Devnet records, not public-network explorer transactions. A Devnet reset can make old hashes unavailable; regenerate metadata and evidence for the new chain.

## Validation coverage

Rechecked on September 19, 2026: pinned artifact checksum verification passed, native sUDT tests passed **11/11**, and portal token helper tests passed **8/8**. The production build, backend tests, browser tests, and on-chain demo were not rerun for this documentation update.

The native sUDT tests cover authorized and unauthorized minting, token change, partial/full burns, malformed amounts and args, uint128 overflow, owner-mode behavior, and independent type groups. Portal tests cover encoding, accounting, argument formats, serialization, wrong-genesis rejection, unsupported trailing data, wallet changes, and transaction mutation.

The on-chain demonstration above was recorded on September 17; it is separate from local unit/VM tests. See the [response-check guide](docs/week-6-response-check.md) for commands, expected responses, and verification limits.

## Lessons and limitations

Owner-authorized issuance and ordinary token transfers follow different validation paths. Normal transfers must preserve token amounts; burns deliberately reduce them. CKB capacity and token quantities are separate: transaction fees consume capacity, not token units.

The portal supports basic xUDT without extensions and rejects extended token data. Ephemeral demo wallet keys are not persisted, so the demonstration should be rerun with fresh local funds instead of attempting to reuse its wallet addresses.

Backend support requires the correct network-specific `SUDT_CODE_HASH` and database migration. The Devnet evidence does not establish backend indexing correctness, public-network deployment, or a reproducible C source build.

## Reproduction and supporting files

- [Token Lab setup](docs/token-lab.md)
- [Token transaction helpers](portal/src/utils/token.ts)
- [Native sUDT tests](contracts/tests/sudt.mock.test.ts)
- [Portal token tests](portal/src/utils/token.test.ts)
- [Devnet demonstration](portal/scripts/week6-devnet.ts)
- [Public deployment metadata](contracts/deployment/token.devnet.json)
- [Recorded evidence](contracts/deployment/week6-evidence.json)
