import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  root,
  debuggerPath,
  run,
  parseExecution,
  hash,
} from "./runtime-tools.mjs";
process.chdir(root);
const environment = JSON.parse(
  readFileSync("../docs/evidence/week-8/environment.json", "utf8"),
);
assert.equal(
  environment.decoder?.verified,
  true,
  "Run portal/scripts/week8-environment.mjs first",
);
assert.equal(
  hash("build/runtime-lab/dob0-decoder"),
  environment.decoder.sha256,
);
const pattern = [
  [
    "BackgroundColor",
    "String",
    0,
    1,
    "options",
    ["red", "blue", "green", "black", "white"],
  ],
  ["Type", "Number", 1, 1, "range", [10, 50]],
  ["Timestamp", "Number", 2, 4, "rawNumber"],
];
const dna = "0102030405060708";
const expected = [
  { name: "BackgroundColor", traits: [{ String: "blue" }] },
  { name: "Type", traits: [{ Number: 12 }] },
  { name: "Timestamp", traits: [{ Number: 100992003 }] },
];
const runs = [];
let unavailable;
for (let attempt = 0; attempt < 5; attempt++) {
  const execution = run(
    debuggerPath,
    [
      "--bin",
      "build/runtime-lab/dob0-decoder",
      "--",
      dna,
      JSON.stringify(pattern),
    ],
    { allowFailure: true },
  );
  let parsed;
  try {
    parsed = parseExecution(execution);
  } catch {
    unavailable = execution;
    break;
  }
  assert.equal(parsed.scriptResult, 0);
  const text = execution.stdout + execution.stderr;
  const start = text.indexOf('[{"name":');
  const end = text.indexOf("]}]", start);
  assert.notEqual(start, -1, "Actual decoder must emit attributes");
  const attributes = JSON.parse(text.slice(start, end + 3));
  assert.deepEqual(attributes, expected);
  runs.push({ ...execution, ...parsed, attributes });
}
writeFileSync(
  join(root, "../docs/evidence/week-8/dob-fixture.json"),
  JSON.stringify(
    {
      scope:
        "Pinned deployed decoder binary executed locally in CKB-VM; not a mint/commitment",
      dna,
      pattern,
      expected,
      decoder: environment.decoder,
      status: unavailable
        ? "UNAVAILABLE: debugger cannot execute this decoder binary"
        : "LOCAL DECODE VERIFIED",
      cookbookCommit: "969db44523c7bad75ebc126a513353163843c3df",
      decoderSourceCommit: "a592680c9a507a014ebf505075cbef0b21382799",
      runner: run(debuggerPath, ["--version"]).stdout.trim(),
      unavailable,
      runs,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  unavailable
    ? "Official decoder execution unavailable; raw failure recorded. Worker reference is tested separately."
    : "Official DOB/0 binary: five deterministic runs match the Worker reference fixture.",
);
if (unavailable) process.exitCode = 1;
