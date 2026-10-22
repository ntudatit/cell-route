import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { root, out, pins, sha, json, check } from "./common.mjs";
const result = JSON.parse(readFileSync(join(out, "results.json"), "utf8"));
if (result.status !== "passed" || result.results.some((r) => !r.passed))
  throw Error("Only a fully passing VM run can be exported as evidence");
check(join(out, "marker"), result.artifacts.extension.sha256);
check(
  join(root, "xudt-extension-lab/marker.c"),
  result.artifacts.extension.sourceSha256,
);
const evidence = join(root, "../docs/evidence/week-11");
mkdirSync(join(evidence, "fixtures"), { recursive: true });
for (const r of result.results) {
  const f = join(out, r.fixture);
  check(f, r.fixtureSha256);
  copyFileSync(f, join(evidence, r.fixture));
}
const sanitize = (s) =>
  s
    .replaceAll(root, "$CONTRACTS_ROOT")
    .replaceAll(process.env.USERPROFILE || "__none__", "$USERPROFILE");
const publicResult = JSON.parse(
  JSON.stringify(result, (key, value) =>
    typeof value === "string" ? sanitize(value) : value,
  ),
);
json(join(evidence, "vm-results.json"), publicResult);
json(join(evidence, "environment.json"), {
  recordedAt: result.measuredAt,
  scope: "local-only; public mock transaction dumps; no deployed extension",
  node: process.version,
  ccc: "1.12.2",
  testtool: "1.0.5",
  ...pins,
  artifacts: publicResult.artifacts,
  verification:
    "Every input lock, auxiliary authority type, and xUDT type group executed. No node consensus, wallet or signature lifecycle claim.",
});
copyFileSync(join(out, "marker"), join(evidence, "marker"));
const lines = [
  "# VM mode and negative-case matrix",
  "",
  `Measured: ${result.measuredAt}. All ${result.results.length} cases ran in actual CKB-VM v1 through ${result.debugger}.`,
  "",
  "Flags are the four little-endian bytes after the owner hash. Cycles are for the xUDT type group, not total transaction fees.",
  "",
  "| Case | Flags (LE hex) | Expected exit | Actual exit | Type-group cycles | Evidence |",
  "| --- | --- | --- | --- | --- | --- |",
];
for (const r of result.results) {
  const f = JSON.parse(readFileSync(join(out, r.fixture), "utf8"));
  const args = f.tx.outputs[0].type.args;
  lines.push(
    `| ${r.name} | ${args.slice(66, 74) || "absent/malformed"} | ${r.expected} | ${r.actual} | ${r.executions.at(-1).cycles} | [fixture](${r.fixture}) |`,
  );
}
lines.push(
  "",
  "`extension-pass` and `extension-wrong-marker` have identical non-witness transaction and resolved-cell data. The runner asserts this invariant.",
  "",
  "The input-lock shortcut deliberately passes with an incorrect marker: its permissive lock entry succeeds and xUDT skips the extension call. This artifact must never protect real funds.",
  "",
  "Raw stdout, branch markers, per-group execution results, fixture SHA-256 hashes and process statuses are in [vm-results.json](vm-results.json).",
);
writeFileSync(join(evidence, "mode-matrix.md"), lines.join("\n") + "\n");
console.log(
  `Exported ${result.results.length} complete public fixtures and actual VM receipts.`,
);
