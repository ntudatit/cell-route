# Advanced evidence index — Weeks 9–12

This index separates implementation, local execution, public observations and signed lifecycle evidence. Each linked receipt retains its own timestamp and source versions.

| Module | Executed evidence | Limits / remaining work |
| --- | --- | --- |
| [SSRI](ssri-inspector.md) | [Devnet method calls, identity checks and failures](evidence/week-9/verification.md) | Queries do not establish mutation authorization; public deployment remains separate |
| [RGB++](rgbpp-inspector.md) | [Fixture/commitment checks](evidence/week-10/verification.md) and [live Mainnet/Testnet observations](evidence/live-labs/verification.md) | Full RGB++ SPV and signed cross-chain transfer not verified |
| [xUDT extensions](xudt-extension-lab.md) | [31 actual VM cases and source/artifact identities](evidence/week-11/verification.md) | Local-only marker rule; owner/input-lock bypass boundaries documented; no deployed adapter |
| [iCKB](ickb-inspector.md) | [Testnet snapshot, 47 SDK comparisons/negative cases and unfunded construction](evidence/week-12/verification.md) | No funded preparation, VM-validated deposit, signature, broadcast, commitment or live redemption |

Unit and browser tests establish behavior of the tested code. RPC captures establish what the selected node reported. Neither layer substitutes for protocol execution and signed lifecycle receipts. No private key or seed belongs in evidence.
