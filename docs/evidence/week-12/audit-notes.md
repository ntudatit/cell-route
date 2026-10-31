# Audit and review scope

The [ScaleBit report](https://scalebit.xyz/reports/20240911-ICKB-Final-Audit-Report.pdf) covers Rust L1 scripts at `454cfa966052a621c4e8b67001718c29ee8191a2`, formerly `ickb/v1-core`: iCKB Logic, Owned Owner, Limit Order and shared utilities. Review dates: 3–10 September 2024. The 14-page PDF was text-extracted; its findings table was also visually checked.

| Finding | Severity | Reported status |
| --- | --- | --- |
| ENT-1 Busywork Attack | Informational | Acknowledged |
| UTI-1 LengthNotEnough handling | Informational | Fixed |
| ENT1-1 Limit Order confusion | Minor | Acknowledged |

The first finding concerns pool maturity availability. The third concerns confusing order/master lineages because output locks do not execute when created. These findings do not certify client code or guarantee liquidity.

A [later executable review](https://github.com/ickb/contracts/blob/c951927e35fb5d4a13e28c5e55687d49cea7ca05/ICKB-Audit-Report.md) identifies known Limit Order lineage hazards under its deployment assumptions. Its stated reviewed contract revision remains `454cfa9`; the report evolved from May to September 2026. This exercise inspected its scope and conclusions, not all of its executable tests.

## CellRoute decision

This integration exposes read-only calculations and an unfunded direct-deposit construction. It does not create, match or melt limit orders. An indicative order price is not a fill, maturity check or withdrawal authorization. No audit applies automatically to SDK 9001.0.0, this portal, its RPC provider or this arithmetic adapter. Contract artifacts were identity-checked through RPC, not independently rebuilt or audited here.

## Document hashes

- ScaleBit PDF SHA-256: `3b0806477084b9872e20725f96ca0ab26cb873fa1411d0408a7bbeef87c04b61`.
- Pinned later review SHA-256: `fc664915aaab858806ccf79e82f0e67ff1ca8eea50c976856acece854b27a196`.

Full PDFs/source downloads remain in ignored local build storage; this directory records scope and public evidence rather than reproducing the reports.
