import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// testtool 1.0.5's published ESM entry contains extensionless imports; use its CJS entry.
const {
  hexFrom,
  hashCkb,
  hashTypeToBytes,
  Transaction,
} = require("@ckb-ccc/core");
const {
  Resource,
  Verifier,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
  DEFAULT_SCRIPT_CKB_JS_VM,
} = require("ckb-testtool");
import {
  root,
  output,
  debuggerPath,
  run,
  parseExecution,
  hash,
} from "./runtime-tools.mjs";
process.chdir(root);
const results = [];
const runner = run(debuggerPath, ["--version"]).stdout.trim();
process.on("exit", (code) =>
  writeFileSync(
    join(output, "verification.json"),
    JSON.stringify(
      {
        status: code === 0 ? "passed" : "failed",
        measuredAt: new Date().toISOString(),
        runner,
        manifestSha256: hash("build/runtime-lab/manifest.json"),
        results,
      },
      null,
      2,
    ) + "\n",
  ),
);
function check(name, args, expected, scope) {
  const record = run(debuggerPath, args, {
    allowFailure: true,
    log: `${name}.json`,
  });
  const observed = parseExecution(record);
  results.push({ name, scope, expected, ...observed });
  assert.equal(observed.scriptResult, expected, name);
  console.log(
    `${name}: script=${observed.scriptResult}, process=${observed.processExitStatus}, cycles=${observed.cycles}`,
  );
}
const wasm = new WebAssembly.Module(readFileSync("build/runtime-lab/fib.wasm"));
assert.throws(() => new WebAssembly.Instance(wasm, {}), /import|module/i);
const instance = new WebAssembly.Instance(wasm, {
  env: {
    abort() {
      throw Error("env.abort");
    },
  },
});
for (const [input, expected] of [
  [5, 8],
  [10, 89],
]) {
  assert.equal(instance.exports.fib(input), expected);
  check(
    `fib-${input}`,
    ["--bin", "build/runtime-lab/fib", "--", "fib", String(input)],
    expected,
    "Standalone RISC-V program, not transaction validation",
  );
}
assert.throws(() => instance.exports.checkedFib(-1), /env.abort/);
for (const input of ["-1", "11", "abc"])
  check(
    `fib-invalid-${input}`,
    ["--bin", "build/runtime-lab/fib", "--", "fib", input],
    2,
    "Input validation in standalone wrapper",
  );
function saveFixture(name, resource, tx) {
  const file = `build/runtime-lab/${name}-tx.json`;
  writeFileSync(
    file,
    JSON.stringify(Verifier.from(resource, tx).txFile(), null, 2),
  );
  return file;
}
for (const [name, data, variant, expected] of [
  ["carrot-bug-empty", "0x", "bug", -1],
  ["carrot-fixed-empty", "0x", "fixed", 0],
  [
    "carrot-fixed-forbidden",
    hexFrom(new TextEncoder().encode("carrot")),
    "fixed",
    -1,
  ],
]) {
  const resource = Resource.default(),
    tx = Transaction.default();
  const lock = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false,
  );
  const type = resource.deployCell(
    hexFrom(readFileSync(`build/runtime-lab/carrot-${variant}`)),
    tx,
    false,
  );
  tx.inputs.push(Resource.createCellInput(resource.mockCell(lock)));
  tx.outputs.push(Resource.createCellOutput(lock, type));
  tx.outputsData.push(data);
  const file = saveFixture(name, resource, tx);
  check(
    name,
    ["--tx-file", file, "--script", "output.0.type"],
    expected,
    "One local type group, not node commitment",
  );
}
run(process.execPath, ["scripts/build-contract.js", "simple-lock"], {
  env: { ...process.env, CKB_DEBUGGER: debuggerPath },
  log: "simple-lock-build.json",
});
for (const [name, witness, preceding, expected] of [
  ["correct", "CellRoute Week 5", false, 0],
  ["wrong", "wrong", false, 7],
  ["missing", undefined, false, 6],
  ["preceding-input", "CellRoute Week 5", true, 0],
]) {
  const resource = Resource.default(),
    tx = Transaction.default();
  const vm = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)),
    tx,
    false,
  );
  const always = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false,
  );
  const code = resource.deployCell(
    hexFrom(readFileSync("dist/simple-lock.bc")),
    tx,
    false,
  );
  vm.args = hexFrom(
    "0x0000" +
      code.codeHash.slice(2) +
      hexFrom(hashTypeToBytes(code.hashType)).slice(2) +
      hashCkb(new TextEncoder().encode("CellRoute Week 5")).slice(2),
  );
  if (preceding) {
    tx.inputs.push(Resource.createCellInput(resource.mockCell(always)));
    tx.witnesses.push("0x1234");
  }
  tx.inputs.push(Resource.createCellInput(resource.mockCell(vm)));
  tx.outputs.push(Resource.createCellOutput(always));
  tx.outputsData.push("0x");
  if (witness !== undefined)
    tx.witnesses.push(hexFrom(new TextEncoder().encode(witness)));
  const file = saveFixture(`simple-lock-${name}`, resource, tx);
  check(
    `simple-lock-${name}`,
    ["--tx-file", file, "--script", `input.${preceding ? 1 : 0}.lock`],
    expected,
    "One local lock group, not node commitment",
  );
}
console.log("Runner: " + run(debuggerPath, ["--version"]).stdout.trim());
