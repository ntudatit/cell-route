import { readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  root,
  output,
  gcc,
  debuggerPath,
  run,
  hash,
  parseExecution,
} from "./runtime-tools.mjs";
process.chdir(root);
run(process.execPath, ["scripts/runtime-build.mjs"]);
const build = JSON.parse(
  readFileSync(join(output, "riscv-build.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(join(output, "manifest.json"), "utf8"),
);
const evidence = join(root, "../docs/evidence/week-8");
mkdirSync(evidence, { recursive: true });
const sourceCommit = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const args = build.args.slice(0, -2);
const fixtures = Array.from({ length: 11 }, (_, i) => ({
  input: String(i),
  expected: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89][i],
}));
fixtures.push(
  { input: "-1", expected: 2 },
  { input: "11", expected: 2 },
  { input: "abc", expected: 2 },
);
const results = {};
for (const variant of ["baseline", "optimized"]) {
  const flags = variant === "optimized" ? ["-DLAB_SKIP_INITIAL_ZERO"] : [];
  const binary = `build/runtime-lab/fib-${variant}`;
  const compile = run(gcc, [...args, ...flags, "-o", binary]);
  const measurements = fixtures.map((fixture) => {
    const runs = Array.from({ length: 5 }, () => {
      const record = run(
        debuggerPath,
        ["--bin", binary, "--", "fib", fixture.input],
        { allowFailure: true },
      );
      const parsed = parseExecution(record);
      assert.equal(parsed.scriptResult, fixture.expected);
      return { ...parsed, stdout: record.stdout, stderr: record.stderr };
    });
    assert.equal(
      new Set(runs.map((r) => r.cycles)).size,
      1,
      "Repeated VM cycles must be deterministic",
    );
    return { ...fixture, runs };
  });
  const memoryBinary = `build/runtime-lab/memory-${variant}`;
  const memoryArgs = args.filter(
    (a) => a !== "runtime-lab/main.c" && a !== "build/runtime-lab/fib.c",
  );
  run(gcc, [
    ...memoryArgs,
    "runtime-lab/memory-check.c",
    ...flags,
    "-o",
    memoryBinary,
  ]);
  const memoryCheck = parseExecution(
    run(debuggerPath, ["--bin", memoryBinary], { allowFailure: true }),
  );
  assert.equal(
    memoryCheck.scriptResult,
    0,
    "Initial and reused memory must be zero",
  );
  results[variant] = {
    scope: "Local CKB-VM standalone executable, NOT a committed transaction",
    sourceCommit,
    timestamp: new Date().toISOString(),
    sourceHashes: {
      ...manifest.artifacts,
      "runtime-lab/memory-check.c": hash("runtime-lab/memory-check.c"),
      "scripts/runtime-benchmark.mjs": hash("scripts/runtime-benchmark.mjs"),
    },
    versions: {
      ...manifest.versions,
      debugger: run(debuggerPath, ["--version"]).stdout.trim(),
    },
    compile,
    binarySHA256: hash(binary),
    binaryBytes: statSync(binary).size,
    fixturesSHA256: (await import("node:crypto"))
      .createHash("sha256")
      .update(JSON.stringify(fixtures))
      .digest("hex"),
    measurements,
    memoryCheck,
    transactionBytes: null,
    fee: null,
  };
  writeFileSync(
    join(evidence, `script-${variant}.json`),
    JSON.stringify(results[variant], null, 2) + "\n",
  );
}
for (let i = 0; i < fixtures.length; i++)
  assert.equal(
    results.baseline.measurements[i].runs[0].scriptResult,
    results.optimized.measurements[i].runs[0].scriptResult,
  );
const compare = (baseline, optimized) => ({
  baseline,
  optimized,
  delta: optimized - baseline,
  deltaPercent: ((optimized - baseline) / baseline) * 100,
});
const comparison = {
  scope: "Local CKB-VM; no transaction fee inference",
  optimization:
    "Skip redundant first fixed-page zero fill; preserve zero fill on reuse",
  correctness:
    "14 inputs × 5 repetitions × 2 variants; full-page initial/reuse check for both variants",
  cyclesFib10: compare(
    results.baseline.measurements[10].runs[0].cycles,
    results.optimized.measurements[10].runs[0].cycles,
  ),
  binaryBytes: compare(
    results.baseline.binaryBytes,
    results.optimized.binaryBytes,
  ),
  transactionBytes: null,
  fee: null,
};
writeFileSync(
  join(evidence, "script-comparison.json"),
  JSON.stringify(comparison, null, 2) + "\n",
);
console.log(JSON.stringify(comparison, null, 2));
