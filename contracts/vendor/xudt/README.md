# Pinned deployed xUDT artifact

`xudt_rce` is the public deployed binary fetched from output 0 of Mainnet transaction `0xc07844ce21b38e4b071dd0e1ee3b0e27afd8d7532491327f39b786343f558ab7` for local VM experiments. It is not a local build or an extension deployment.

CKB data hash: `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`.
SHA-256: `e9b92e5783f692f6ee99ca20eeda5f3da282e0f4010eb4fbd3db4e3058239349`.

Official implementation: https://github.com/nervosnetwork/ckb-production-scripts/tree/abdcb117b512e35910fa8e30241a7a354e5cacf0
The upstream package declares MIT in its Cargo.toml. RFC 0052 identifies this source revision as its reproducible deployment build reference. This lab verifies the deployed binary hash but does not reproduce that upstream build.

Source/dependency pins and the extension build are in `../../xudt-extension-lab/` and `../../scripts/xudt-extension/`.
