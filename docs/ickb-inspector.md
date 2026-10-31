# iCKB Inspector and conversion checks

The `/ickb` page is read-only. It reads a selected public chain, checks genesis, recomputes the header hash, checks canonicality through RPC and verifies the live code identities in the pinned iCKB dependency group. This is node-observed state, not independent chain consensus or SPV verification.

The page accepts user amounts, distinguishes receipt accounting from indicative order pricing, and can construct a deposit/receipt output skeleton for a user-supplied CKB address. It does not connect a signer, fund, sign or submit the construction. Selecting the reverse direction does not establish that a mature pool deposit is available.

## Source and SDK compatibility

The handbook URL `https://github.com/ickb/sdk` returned HTTP 404 on 31 October 2026. The [official iCKB website](https://ickb.org/) links to [ickb/stack](https://github.com/ickb/stack), which now contains the SDK and interface. This repository pins `@ickb/sdk` **9001.0.0** to stack commit `5d00050d53f450951d40c8a564535b63a599bc76`.

The npm provenance statement identifies that commit and package digest. The installed package is protected by the isolated npm lockfile and explicit comparison-module hashes; Sigstore signatures were not independently verified here. See [provenance metadata](evidence/week-12/sdk-provenance.json).

This SDK requires Node 26 and CCC 1.23.0. It is installed only in `contracts/ickb-checks/`, separate from the React portal's existing CCC 1.19.1 and Node 22+ build. The portal implements bounded integer arithmetic and output construction, checked against the pinned SDK by a separate Node 26 runner.

The runner uses public `ickbExchangeRatio`, `quoteConversion`, SDK fee constants and `IckbSdk.buildConversionTransaction` early rejection paths. It also explicitly imports pinned internal modules for `ickbValue`, `LogicManager.deposit`, deployment constants and `depositMaturity` as comparison oracles. Those internal APIs are not stable integration contracts and are never imported by the portal.

## Arithmetic and units

CKB shannons and raw iCKB display units both use eight decimal places. Similar precision does not imply a 1:1 exchange rate. All amount arithmetic is BigInt, with uint64 capacity and uint128 token bounds.

- Base accumulated rate: `AR0 = 10^16`.
- Deposit occupied capacity: `82 * 10^8` shannons. Receipt accounting uses the remaining **free capacity**, not total deposit capacity.
- Before the soft cap: `raw = floor(freeCapacity * AR0 / depositHeaderAR)`.
- If `raw > 100000 * 10^8`, subtract `floor((raw - cap) / 10)` **per deposit**. Applying this once to an aggregate is not equivalent to valuing each deposit.
- A receipt's final value uses its actual deposit commitment header, which is not known when constructing a new deposit. Current-tip estimates are labeled accordingly.
- The SDK's gross exchange denominator is `currentAR + 82 * AR0 / 100000`. Indicative order output uses ceiling division after applying the selected SDK default fee `10 / 100000`.

The order fee is a pricing policy parameter, not the network transaction fee. A price calculation is not an order fill or an executable redemption quote. Tiny ceiling-rounded prices must not be interpreted as profitable accounting round trips. Receipt accounting's floor/discount round trips are tested separately.

Source references are `sdk/src/udt.ts`, `sdk/src/order/conversion.ts`, `sdk/src/logic.ts` and `sdk/src/dao.ts` at the pinned stack revision. [Vectors](evidence/week-12/conversion-vectors.json) retain expected and actual outputs.

## Snapshot and preview boundaries

Supported network profiles and script identities are in [pins.json](../portal/src/features/ickb/pins.json). Public endpoints can be configured with `VITE_ICKB_TESTNET_RPC` and `VITE_ICKB_MAINNET_RPC`. Browser endpoints must not contain embedded credentials, query strings or fragments; never put private API credentials into browser configuration.

Each snapshot checks the iCKB Logic, xUDT, Owned Owner and Limit Order data hashes, plus the DAO type identity. It is anchored to a hash-checked header and canonicality is queried before and after deployment reads. Sequential RPC reads do not form an atomic snapshot. The current actual capture is **Testnet**; Mainnet is supported by the pinned profile and checked when requested, not claimed as a completed live run here.

Requests are bounded to 12 seconds each and 60 seconds overall. iCKB code reads allow at most 4 MiB per response because one deployed data dependency exceeds the shared 1 MiB default. Other consumers retain that default. Dep groups are bounded to 16 OutPoints. Cancellation, malformed envelopes, incorrect genesis, corrupted headers and missing code identities fail explicitly.

Conversion review rejects snapshots older than five minutes or chain headers older than thirty minutes, and rejects materially future-dated observations. Input or network edits invalidate the prior review. These checks are not a guarantee of execution.

The direct-deposit construction supports one deposit with 1,000–1,000,000 free CKB. It includes another 82 CKB occupied capacity and a receipt reserve based on the recipient lock. With a standard 20-byte lock args, the minimum construction has:

| Output | Capacity |
| --- | --- |
| DAO deposit | 1,082 CKB |
| Receipt / phase-2 reserve | 208 CKB |
| Total outputs, before actual funding and network fees | 1,290 CKB |

The recorded construction has zero inputs, unknown network fees and `requiresFunding: true`. It matches the pinned SDK's serialized transaction byte-for-byte but has **not** passed VM validation or node consensus. It is not a funded prepared transaction. No private key or seed is needed or stored.

The SDK timing experiments test its wallet selection window using controlled claim epochs. No real pool deposit was selected and no withdrawal `since`/header-dependency lifecycle was validated. The UI therefore reports withdrawal readiness as **not evaluated**. DAO reward withdrawals require protocol-specific capacity and header accounting rather than ordinary input-minus-output fee assumptions.

## Reproduce

From the repository root:

```powershell
npm --prefix portal ci
npm --prefix contracts/ickb-checks ci --ignore-scripts
npm --prefix portal run ickb:bridge
npm exec --yes --package=node@26.13.0 -- node contracts/ickb-checks/verify.mjs testnet --replay
```

Installing the isolated package with an older npm host can emit an engine warning; the runner refuses execution below Node 26. With Node 26 already installed, `npm --prefix contracts/ickb-checks run verify -- testnet --replay` is equivalent. Do not relax engine requirements or upgrade the portal to run these checks.

Replay consumes the captured public snapshot, applies freshness rules relative to its original observation time and writes **historical replay** results under ignored `contracts/build/ickb/replay/`. It does not refresh public evidence.

To collect a new public Testnet snapshot and replace the current Week 12 evidence deliberately:

```powershell
npm exec --yes --package=node@26.13.0 -- node contracts/ickb-checks/verify.mjs testnet
```

Then run frontend checks:

```powershell
npm --prefix portal test
npm --prefix portal run build
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix portal run test:e2e:labs -- --grep iCKB
```

Use an installed Playwright browser available on your machine. Browser checks replay public responses and do not constitute new network observations. See [verification](evidence/week-12/verification.md), [audit notes](evidence/week-12/audit-notes.md), and the [Week 12 report](week-12-report.md).

## Integration decision

This release provides inspection, arithmetic validation and unfunded construction only. It does not expose limit-order creation/matching/melting, immediate redemption, a funded wallet builder or signing. A future transaction flow must acquire real account/pool state, select mature deposits, verify live inputs and deployment identities, compute DAO-aware fees/constraints, invalidate stale review, request an explicit wallet signature, then observe commitment and resulting Cells. The current audit notes do not certify that future flow or this portal.

Protocol references are pinned separately in [protocol-sources.json](evidence/week-12/protocol-sources.json): the iCKB whitepaper and RFC 0023. The DAO lifecycle requires a deposit, a withdrawal request, and a later claim satisfying its 180-epoch cycle, absolute epoch since, and header/witness rules. The current timing-policy checks do not validate that full lifecycle.
