import { existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  root,
  output,
  debuggerPath,
  run,
  hash,
  parseExecution,
} from "./runtime-tools.mjs";
const args = process.argv.slice(2),
  mode = args.shift(),
  file = args.shift();
if (!["binary", "transaction"].includes(mode) || !file)
  throw Error(
    "Usage: runtime:inspect -- <binary|transaction> <file> [--script input.0.lock] [--cycles 10000000] [--expect 0] [-- program arguments]",
  );
const absolute = resolve(file);
if (
  !existsSync(absolute) ||
  !statSync(absolute).isFile() ||
  statSync(absolute).size > 4194304
)
  throw Error("Use an existing artifact/dump of at most4MiB.");
let cycles = 10000000,
  script = "input.0.lock",
  expected = 0,
  program = [];
while (args.length) {
  const flag = args.shift();
  if (flag === "--") {
    program = args.splice(0);
    break;
  }
  const value = args.shift();
  if (flag === "--cycles") cycles = Number(value);
  else if (flag === "--script") script = value;
  else if (flag === "--expect") expected = Number(value);
  else throw Error("Unknown option");
}
if (
  !Number.isSafeInteger(cycles) ||
  cycles < 1 ||
  cycles > 3500000000 ||
  !Number.isInteger(expected) ||
  expected < -128 ||
  expected > 127 ||
  !/^(input|output)\.\d+\.(lock|type)$/.test(script) ||
  program.length > 32
)
  throw Error("Invalid cycle limit, selector or expected exit code.");
const command =
  mode === "binary"
    ? [
        "--mode",
        "fast",
        "--max-cycles",
        String(cycles),
        "--bin",
        absolute,
        "--",
        ...program,
      ]
    : [
        "--mode",
        "full",
        "--max-cycles",
        String(cycles),
        "--tx-file",
        absolute,
        "--script",
        script,
      ];
const execution = run(debuggerPath, command, {
  allowFailure: true,
  timeout: 30000,
});
const observed = parseExecution(execution);
const report = {
  executedAt: new Date().toISOString(),
  artifactSha256: hash(absolute),
  scope:
    mode === "binary"
      ? "Standalone CKB-VM execution; not a transaction validation claim"
      : "Selected script group from supplied transaction dump; not node commitment",
  mode,
  script: mode === "transaction" ? script : undefined,
  cycleLimit: cycles,
  expectedExitCode: expected,
  ...observed,
  matched: observed.scriptResult === expected,
};
mkdirSync(output, { recursive: true });
writeFileSync(
  join(output, "runtime-inspection.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (!report.matched) process.exitCode = 1;
