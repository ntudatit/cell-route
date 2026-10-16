# Pausable UDT source and audit notes

Read all11 PDF pages (cover plus10 numbered pages) on2026-10-10. Source PDF: https://github.com/Alive24/pausable-udt/blob/38f11ef0529e65dc7c5ecf37541a57ca923e9852/20241224-Pausable-UDT-Final-Audit-Report.pdf
SHA256: c4416339f2d97e7cc9e91bd18b072fd54abec5ea657ea5530315f216cc54dfe1.

ScaleBit report dated18 December2024, audit16–18 December2024. Audited source repository is ckb-devrel/pausable-udt, commit dc6c164b8956072180b97e0e3ce225c21aff70a9. Scope is main.rs, error.rs, fallback.rs, modules.rs, utils.rs under contracts/pausable-udt/src. This is different from the inspected Alive24 revision38f11ef0529e65dc7c5ecf37541a57ca923e9852; no equivalence or coverage of CellRoute is claimed.

Report finding MAI-1: centralization risk, Informational, Acknowledged (not fixed). Administrators can restrict trading through pause controls and owners can mint. The report recommends multisignature administration. This matters to product disclosures, governance and signing policy; displaying pause metadata does not remove those privileges. Report explicitly provides limited scope/time assurance, not a security guarantee.

Actual method names inspected in pinned source: UDT.name, UDT.symbol, UDT.decimals, UDT.icon, UDT.transfer, UDT.mint, UDTPausable.is_paused, UDTPausable.enumerate_paused, UDTPausable.pause, UDTPausable.unpause. is_paused accepts encoded lock-hash vectors; enumerate_paused uses offset/limit. This SDK/profile differs from the legacy prototype used in the runtime demo.

Pinned fallback.rs gathers input lock hashes and rejects when is_paused reports any paused input. It then tries verify_mint, otherwise verify_transfer. modules.rs verifies mint through check_owner_mode(script args), and transfer requires total input token amount >= output amount. Pause-list traversal differs between on-chain CellDep loading and SSRI lookups and rejects incomplete/cyclic lists. Pause/unpause methods assemble transactions involving pause-data cells; querying them does not bypass the consumed cells' lock/type validation or confer wallet signing rights. No mutation or authorization execution test was attempted; full upgrade/governance integration is outside this readonly lab.

The audit's governance description concerns its audited revision, not proof of the newer inspected revision's behavior. Do not infer runtime authorization solely from the report or SSRI response.
