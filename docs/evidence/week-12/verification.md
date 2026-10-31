# Week 12 verification — 31 October 2026

| Command / check | Layer | Actual result |
| --- | --- | --- |
| Official legacy SDK URL lookup | Source discovery | HTTP 404; official site links to the stack repository containing the SDK |
| `npm exec --yes --package=node@26.13.0 -- node contracts/ickb-checks/verify.mjs testnet` | Real RPC + SDK reference + independent arithmetic | 47 checks passed |
| Same command with `--replay` | Historical public-snapshot replay | 47 checks passed; output isolated from live evidence |
| `npm --prefix portal test` | Portal unit suite | 139 tests passed across 23 files, including 15 new iCKB tests |
| `npm --prefix portal run build` | TypeScript / Vite | Passed; existing large-chunk warning remains |
| iCKB browser checks with installed Edge | Captured RPC replay and API outage | 2 passed across the initial run and corrected targeted rerun |

## Captured state and construction

- Network: CKB Testnet; genesis and all pinned iCKB code dependencies plus the DAO identity checked.
- Header: `0xc81960cdc1169df82496ad826d26529ae006a4fc25a65296af64fedbc52ad321`, block `0x15dc1f2`.
- DAO accumulated rate: `11944065912622031`.
- RPC observation: `2026-10-31T09:58:04.415Z`.
- A 1,000 free CKB construction contains a 1,082 CKB deposit and a 208 CKB receipt reserve. Its serialized bytes match the pinned SDK constructor.
- Snapshot raw public RPC data is in `snapshot-testnet.json`; no account secrets are present.

## Investigated failures

The original 1 MiB transport limit rejected a large deployed code-data dependency. iCKB requests now use a bounded 4 MiB override; shared consumers keep their 1 MiB default. Live verification was rerun and passed.

The initial browser assertion matched the global wallet authentication button while checking for transaction controls. The assertion now scopes to the read-only inspector, and the positive flow was rerun successfully. The outage/mobile case passed in the initial run. Browser state uses recorded responses and a controlled clock; the screenshot is UI evidence, not a new public RPC observation.

## Verification limits

No funded wallet transaction was prepared. The construction is an unsigned, input-free output skeleton, not a valid funded transaction, and was not VM-tested, signed, broadcast or committed. SDK negative balance checks are early builder-guard experiments without a wallet. Timing tests are SDK selection-policy checks with controlled epochs, not actual pool/DAO spendability. No Mainnet live run or complete deposit/redeem lifecycle is claimed.

Audit notes cover source/version scope and relevant findings. They are not an independent audit of this code. Registry provenance metadata was inspected; independent Sigstore signature verification was not performed.
