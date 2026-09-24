import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExecution } from "../scripts/runtime-tools.mjs";
test("nonzero program result is distinct from the host process status", () => {
  assert.deepEqual(
    parseExecution({
      stdout: "Run result: 89\nAll cycles: 35021(34.2K)",
      stderr: "",
      status: 254,
    }),
    { scriptResult: 89, cycles: 35021, processExitStatus: 254 },
  );
});
test("negative validation results and formatted cycles are preserved", () => {
  assert.equal(
    parseExecution({
      stdout: "",
      stderr: "Run result: -1\nCycles: 2,178",
      status: 254,
    }).scriptResult,
    -1,
  );
  assert.equal(
    parseExecution({
      stdout: "Run result: 0\nAll cycles: 13,136,726",
      stderr: "",
      status: 0,
    }).cycles,
    13136726,
  );
});
test("a zero host exit without VM measurements is not validation evidence", () => {
  assert.throws(
    () => parseExecution({ stdout: "", stderr: "", status: 0 }),
    /lacks/,
  );
  assert.throws(
    () => parseExecution({ stdout: "Run result: 0", stderr: "", status: 0 }),
    /lacks/,
  );
});
test("killed or failed debugger cannot provide a passing measurement", () => {
  assert.throws(
    () =>
      parseExecution({
        stdout: "Run result: 0\nAll cycles: 1",
        stderr: "",
        status: null,
        signal: "SIGTERM",
      }),
    /complete/,
  );
});
