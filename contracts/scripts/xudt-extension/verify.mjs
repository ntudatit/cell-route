import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { root, out, pins, sha, json, run, check } from "./common.mjs";
import { debuggerPath, parseExecution } from "../runtime-tools.mjs";
const require = createRequire(import.meta.url);
const {
  hexFrom,
  hashCkb,
  Transaction,
  numLeToBytes,
} = require("@ckb-ccc/core");
const {
  Resource,
  Verifier,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
} = require("ckb-testtool");
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const bytes = (b) => Buffer.concat([u32(b.length), b]);
const table = (fields) => {
  let offset = 4 + 4 * fields.length;
  const offsets = fields.map((f) => {
    const o = u32(offset);
    offset += f.length;
    return o;
  });
  return Buffer.concat([u32(offset), ...offsets, ...fields]);
};
const vec = (items) => (items.length ? table(items) : u32(4));
const empty = Buffer.alloc(0);
const artifacts = JSON.parse(readFileSync(join(out, "artifacts.json"), "utf8"));
check(join(out, "marker"), artifacts.extension.sha256);
check(join(root, "vendor/xudt/xudt_rce"), pins.xudt.sha256);
const extension = readFileSync(join(out, "marker"));
json(join(out, "results.json"), {
  status: "running",
  startedAt: new Date().toISOString(),
});
function fixture(c) {
  const r = Resource.default(),
    tx = Transaction.default();
  const holder = r.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false,
  );
  holder.hashType = "data1";
  const owner = holder.clone();
  owner.args = "0x01";
  const authority = holder.clone();
  authority.args = "0x02";
  const ext = r.deployCell(hexFrom(extension), tx, false);
  ext.hashType = "data1";
  ext.args = c.badArgs ? "0x" : "0xa5";
  if (c.missingDep) tx.cellDeps.pop();
  if (c.wrongDep) {
    const d = r.cells.get(tx.cellDeps.at(-1).outPoint.toBytes().toString());
    d.outputData = "0x00";
  }
  const type = r.deployCell(
    hexFrom(readFileSync(join(root, "vendor/xudt/xudt_rce"))),
    tx,
    false,
  );
  type.hashType = "data1";
  let flags = c.basic ? 0 : (c.flags ?? 1);
  const ownerHash =
    c.owner === "input-type" || c.owner === "output-type"
      ? authority.hash()
      : c.owner === "witness"
        ? ext.hash()
        : owner.hash();
  const scriptVec = vec([Buffer.from(ext.toBytes())]);
  const raw = c.malformed ? Buffer.from("010203", "hex") : scriptVec;
  type.args =
    ownerHash +
    u32(flags).toString("hex") +
    (c.basic
      ? ""
      : flags % 0x20000000 === 2
        ? hashCkb(scriptVec).slice(2, 42)
        : raw.toString("hex"));
  if (c.shortArgs) type.args = "0x1234";
  const authInput = r.mockCell(
    c.shortcut ? ext : c.owner === "input-lock" ? owner : holder,
    c.owner === "input-type" ? authority : undefined,
    "0x",
    100000000000n,
  );
  tx.inputs.push(Resource.createCellInput(authInput));
  const amount = (n) => hexFrom(numLeToBytes(BigInt(n), 16));
  if (!c.outputOnly)
    tx.inputs.push(
      Resource.createCellInput(
        r.mockCell(
          c.shortcut ? ext : holder,
          type,
          c.shortData ? "0x01" : amount(100) + (c.trailing ? "aa" : ""),
          100000000000n,
        ),
      ),
    );
  tx.outputs.push(Resource.createCellOutput(holder, type, 99000000000n));
  tx.outputsData.push(
    amount(c.inflation ? 101 : c.burn ? 90 : 100) + (c.trailing ? "aa" : ""),
  );
  if (c.owner === "output-type") {
    tx.outputs.push(Resource.createCellOutput(holder, authority, 100000000n));
    tx.outputsData.push("0x");
  }
  const index = c.outputOnly ? 0 : 1;
  tx.witnesses = Array(tx.inputs.length).fill("0x");
  if (!c.missingWitness) {
    const payload = table([
      c.owner === "witness" ? Buffer.from(ext.toBytes()) : empty,
      empty,
      flags % 0x20000000 === 2 ? (c.hashMismatch ? vec([]) : scriptVec) : empty,
      vec([bytes(Buffer.from([c.badProof ? 0x00 : 0xa5]))]),
    ]);
    tx.witnesses[index] = hexFrom(
      table([
        empty,
        c.outputOnly ? empty : bytes(c.badSchema ? Buffer.from([0]) : payload),
        c.outputOnly ? bytes(payload) : empty,
      ]),
    );
  }
  return {
    dump: Verifier.from(r, tx).txFile(),
    script: c.outputOnly ? "output.0.type" : "input.1.type",
  };
}
const cases = [
  { name: "basic-zero-extension", basic: true, expected: 0 },
  { name: "basic-inflation", basic: true, inflation: true, expected: -52 },
  { name: "extension-pass", expected: 0, trace: "marker:normal" },
  {
    name: "extension-wrong-marker",
    badProof: true,
    expected: 94,
    trace: "marker:normal",
  },
  {
    name: "extension-missing-witness",
    missingWitness: true,
    expected: 92,
    trace: "marker:normal",
  },
  { name: "extension-malformed-witness", badSchema: true, expected: 7 },
  { name: "extension-wrong-args", badArgs: true, expected: 91 },
  { name: "extension-inflation", inflation: true, expected: -52 },
  { name: "extension-burn", burn: true, expected: 0 },
  {
    name: "owner-input-lock-mint",
    owner: "input-lock",
    inflation: true,
    expected: 0,
    trace: "marker:owner",
  },
  {
    name: "owner-input-lock-invalid-marker",
    owner: "input-lock",
    badProof: true,
    inflation: true,
    expected: 94,
    trace: "marker:owner",
  },
  {
    name: "owner-input-lock-disabled",
    owner: "input-lock",
    flags: 0x20000001,
    inflation: true,
    expected: -52,
  },
  {
    name: "owner-input-type-mint",
    owner: "input-type",
    flags: 0x80000001,
    inflation: true,
    expected: 0,
    trace: "marker:owner",
  },
  {
    name: "owner-output-type-mint",
    owner: "output-type",
    flags: 0x40000001,
    inflation: true,
    expected: 0,
    trace: "marker:owner",
  },
  {
    name: "owner-witness-mint",
    owner: "witness",
    inflation: true,
    expected: 0,
    trace: "marker:owner",
  },
  {
    name: "owner-output-only-mint",
    owner: "input-lock",
    outputOnly: true,
    inflation: true,
    expected: 0,
    trace: "marker:owner",
  },
  {
    name: "owner-input-type-invalid-marker",
    owner: "input-type",
    flags: 0x80000001,
    inflation: true,
    badProof: true,
    expected: 94,
    trace: "marker:owner",
  },
  {
    name: "owner-output-type-invalid-marker",
    owner: "output-type",
    flags: 0x40000001,
    inflation: true,
    badProof: true,
    expected: 94,
    trace: "marker:owner",
  },
  {
    name: "owner-input-type-disabled",
    owner: "input-type",
    inflation: true,
    expected: -52,
  },
  {
    name: "owner-output-type-disabled",
    owner: "output-type",
    inflation: true,
    expected: -52,
  },
  {
    name: "owner-witness-invalid-marker",
    owner: "witness",
    inflation: true,
    badProof: true,
    expected: -52,
    trace: "marker:normal",
  },
  {
    name: "input-lock-shortcut",
    shortcut: true,
    badProof: true,
    expected: 0,
    noTrace: true,
  },
  { name: "trailing-cell-data", trailing: true, expected: 0 },
  { name: "p2sh-pass", flags: 2, expected: 0, trace: "marker:normal" },
  { name: "p2sh-hash-mismatch", flags: 2, hashMismatch: true, expected: 49 },
  { name: "missing-dependency", missingDep: true, expected: 1 },
  { name: "wrong-dependency", wrongDep: true, expected: 1 },
  { name: "malformed-scriptvec", malformed: true, expected: 47 },
  { name: "unknown-flags", flags: 3, expected: 44 },
  { name: "short-args", shortArgs: true, expected: -1 },
  { name: "short-token-data", shortData: true, expected: -2 },
];
mkdirSync(join(out, "fixtures"), { recursive: true });
const results = [];
let failed = false;
for (const c of cases) {
  const { dump, script } = fixture(c);
  const path = join(out, "fixtures", `${c.name}.json`);
  json(path, dump);
  // Run each lock and type group independently. This is VM script execution, not node validation.
  const scripts = [
    ...new Set(dump.mock_info.inputs.map((i, n) => `input.${n}.lock`)),
  ];
  if (c.owner === "input-type") scripts.push("input.0.type");
  if (c.owner === "output-type") scripts.push("output.1.type");
  const executions = [];
  for (const s of [...scripts, script]) {
    const args = [
      "--mode",
      "full",
      "--tx-file",
      path,
      "--script",
      s,
      "--max-cycles",
      "100000000",
    ];
    const p = spawnSync(debuggerPath, args, {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const record = {
      status: p.status,
      signal: p.signal,
      error: p.error?.message,
      stdout: p.stdout || "",
      stderr: p.stderr || "",
    };
    let measured;
    try {
      measured = parseExecution(record);
    } catch (e) {
      throw Error(
        `${c.name} ${s}: ${e.message}\n${record.stdout}\n${record.stderr}`,
      );
    }
    executions.push({
      script: s,
      ...measured,
      processStatus: p.status,
      stdout: record.stdout,
      stderr: record.stderr,
    });
  }
  const target = executions.at(-1);
  const actual = target.scriptResult;
  const passed =
    executions.slice(0, -1).every((e) => e.scriptResult === 0) &&
    (c.expected === null ? actual !== 0 : actual === c.expected) &&
    (!c.trace || (target.stdout + target.stderr).includes(c.trace)) &&
    (!c.noTrace || !(target.stdout + target.stderr).includes("marker:"));
  results.push({
    name: c.name,
    expected: c.expected ?? "nonzero",
    actual,
    passed,
    fixture: `fixtures/${c.name}.json`,
    fixtureSha256: sha(readFileSync(path)),
    executions,
  });
  console.log(
    `${passed ? "PASS" : "FAIL"} ${c.name}: ${actual} (${target.cycles} cycles)`,
  );
  if (!passed) failed = true;
}
// Positive/negative pair must change only the witness, not accounting, scripts or dependencies.
const positive = fixture(cases.find((c) => c.name === "extension-pass")).dump;
const negative = fixture(
  cases.find((c) => c.name === "extension-wrong-marker"),
).dump;
const a = structuredClone(positive),
  b = structuredClone(negative);
delete a.tx.witnesses;
delete b.tx.witnesses;
assert.deepEqual(a, b);
json(join(out, "results.json"), {
  status: failed ? "failed" : "passed",
  measuredAt: new Date().toISOString(),
  layer:
    "actual CKB-VM execution of complete public mock transactions; no node consensus or broadcast",
  debugger: run(debuggerPath, ["--version"]).stdout.trim(),
  vmVersion: 1,
  cycleLimit: 100000000,
  artifacts: JSON.parse(readFileSync(join(out, "artifacts.json"), "utf8")),
  pairedFixtureInvariant: "pass/wrong-marker differ only in witnesses",
  results,
});
if (failed) process.exitCode = 1;
