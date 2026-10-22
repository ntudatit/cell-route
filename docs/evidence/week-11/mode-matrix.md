# VM mode and negative-case matrix

Measured: 2026-10-22T14:20:41.254Z. All 31 cases ran in actual CKB-VM v1 through ckb-debugger 1.1.1.

Flags are the four little-endian bytes after the owner hash. Cycles are for the xUDT type group, not total transaction fees.

| Case | Flags (LE hex) | Expected exit | Actual exit | Type-group cycles | Evidence |
| --- | --- | --- | --- | --- | --- |
| basic-zero-extension | 00000000 | 0 | 0 | 19383 | [fixture](fixtures/basic-zero-extension.json) |
| basic-inflation | 00000000 | -52 | -52 | 19377 | [fixture](fixtures/basic-inflation.json) |
| extension-pass | 01000000 | 0 | 0 | 36753 | [fixture](fixtures/extension-pass.json) |
| extension-wrong-marker | 01000000 | 94 | 94 | 36753 | [fixture](fixtures/extension-wrong-marker.json) |
| extension-missing-witness | 01000000 | 92 | 92 | 32029 | [fixture](fixtures/extension-missing-witness.json) |
| extension-malformed-witness | 01000000 | 7 | 7 | 16381 | [fixture](fixtures/extension-malformed-witness.json) |
| extension-wrong-args | 01000000 | 91 | 91 | 33792 | [fixture](fixtures/extension-wrong-args.json) |
| extension-inflation | 01000000 | -52 | -52 | 19457 | [fixture](fixtures/extension-inflation.json) |
| extension-burn | 01000000 | 0 | 0 | 36753 | [fixture](fixtures/extension-burn.json) |
| owner-input-lock-mint | 01000000 | 0 | 0 | 30366 | [fixture](fixtures/owner-input-lock-mint.json) |
| owner-input-lock-invalid-marker | 01000000 | 94 | 94 | 30366 | [fixture](fixtures/owner-input-lock-invalid-marker.json) |
| owner-input-lock-disabled | 01000020 | -52 | -52 | 17810 | [fixture](fixtures/owner-input-lock-disabled.json) |
| owner-input-type-mint | 01000080 | 0 | 0 | 32019 | [fixture](fixtures/owner-input-type-mint.json) |
| owner-output-type-mint | 01000040 | 0 | 0 | 32562 | [fixture](fixtures/owner-output-type-mint.json) |
| owner-witness-mint | 01000000 | 0 | 0 | 53402 | [fixture](fixtures/owner-witness-mint.json) |
| owner-output-only-mint | 01000000 | 0 | 0 | 30197 | [fixture](fixtures/owner-output-only-mint.json) |
| owner-input-type-invalid-marker | 01000080 | 94 | 94 | 32019 | [fixture](fixtures/owner-input-type-invalid-marker.json) |
| owner-output-type-invalid-marker | 01000040 | 94 | 94 | 32562 | [fixture](fixtures/owner-output-type-invalid-marker.json) |
| owner-input-type-disabled | 01000000 | -52 | -52 | 19457 | [fixture](fixtures/owner-input-type-disabled.json) |
| owner-output-type-disabled | 01000000 | -52 | -52 | 19457 | [fixture](fixtures/owner-output-type-disabled.json) |
| owner-witness-invalid-marker | 01000000 | -52 | -52 | 37977 | [fixture](fixtures/owner-witness-invalid-marker.json) |
| input-lock-shortcut | 01000000 | 0 | 0 | 34119 | [fixture](fixtures/input-lock-shortcut.json) |
| trailing-cell-data | 01000000 | 0 | 0 | 36753 | [fixture](fixtures/trailing-cell-data.json) |
| p2sh-pass | 02000000 | 0 | 0 | 45428 | [fixture](fixtures/p2sh-pass.json) |
| p2sh-hash-mismatch | 02000000 | 49 | 49 | 21501 | [fixture](fixtures/p2sh-hash-mismatch.json) |
| missing-dependency | 01000000 | 1 | 1 | 22796 | [fixture](fixtures/missing-dependency.json) |
| wrong-dependency | 01000000 | 1 | 1 | 23333 | [fixture](fixtures/wrong-dependency.json) |
| malformed-scriptvec | 01000000 | 47 | 47 | 13582 | [fixture](fixtures/malformed-scriptvec.json) |
| unknown-flags | 03000000 | 44 | 44 | 13578 | [fixture](fixtures/unknown-flags.json) |
| short-args | absent/malformed | -1 | -1 | 9972 | [fixture](fixtures/short-args.json) |
| short-token-data | 01000000 | -2 | -2 | 17828 | [fixture](fixtures/short-token-data.json) |

`extension-pass` and `extension-wrong-marker` have identical non-witness transaction and resolved-cell data. The runner asserts this invariant.

The input-lock shortcut deliberately passes with an incorrect marker: its permissive lock entry succeeds and xUDT skips the extension call. This artifact must never protect real funds.

Raw stdout, branch markers, per-group execution results, fixture SHA-256 hashes and process statuses are in [vm-results.json](vm-results.json).
