import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  output,
  gdb,
  debuggerPath,
  run,
  hash,
} from "./runtime-tools.mjs";
process.chdir(root);
const verification = JSON.parse(
  readFileSync(join(output, "verification.json"), "utf8"),
);
if (
  verification.status !== "passed" ||
  verification.manifestSha256 !== hash("build/runtime-lab/manifest.json")
)
  throw Error("Run runtime:verify against the current build before GDB.");
const port = Number(process.env.RUNTIME_GDB_PORT ?? 29997);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Invalid RUNTIME_GDB_PORT");
const marker = readFileSync("runtime-lab/carrot.c", "utf8")
  .split("\n")
  .findIndex((l) => l.includes("GDB_BREAKPOINT"));
if (marker < 0) throw Error("Breakpoint marker not found");
const breakpoint = marker + 3;
const commands = [
  "set pagination off",
  "set confirm off",
  "set remotetimeout 10",
  `target remote 127.0.0.1:${port}`,
  `break runtime-lab/carrot.c:${breakpoint}`,
  "continue",
  'printf "OBSERVED cmp=%d len=%llu first=%u\\n", cmp, (unsigned long long)len, buffer[0]',
  "print index",
  "x/6ub buffer",
  "bt",
  "if cmp == 0",
  "quit 3",
  "end",
  "if buffer[0] != 0",
  "quit 4",
  "end",
  'printf "BREAKPOINT_CHECK_PASSED\\n"',
  "continue",
  "quit",
];
writeFileSync(join(output, "carrot.gdb"), commands.join("\n") + "\n");
const server = spawn(
  debuggerPath,
  [
    "--mode",
    "gdb",
    "--gdb-listen",
    `127.0.0.1:${port}`,
    "--tx-file",
    "build/runtime-lab/carrot-bug-empty-tx.json",
    "--script",
    "output.0.type",
  ],
  { cwd: root, windowsHide: true },
);
let serverLog = "",
  serverError;
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
server.on("error", (e) => (serverError = e));
try {
  // Give the local server time to bind without probing its single-client socket.
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (serverError || server.exitCode !== null)
    throw Error("GDB server failed: " + (serverError?.message ?? serverLog));
  const record = run(
    gdb,
    [
      "--nx",
      "--batch",
      "build/runtime-lab/carrot-bug",
      "-x",
      "build/runtime-lab/carrot.gdb",
    ],
    { allowFailure: true, log: "gdb-session.json", timeout: 30000 },
  );
  if (record.status !== 0 || !record.stdout.includes("BREAKPOINT_CHECK_PASSED"))
    throw Error("GDB observation failed: " + record.stdout + record.stderr);
  writeFileSync(
    join(output, "gdb-verification.json"),
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        gdb: run(gdb, ["--version"]).stdout.split("\n")[0],
        binarySha256: hash("build/runtime-lab/carrot-bug"),
        fixtureSha256: hash("build/runtime-lab/carrot-bug-empty-tx.json"),
        breakpoint: `runtime-lab/carrot.c:${breakpoint}`,
        status: "passed",
        conclusion:
          "Empty output gives a nonzero memcmp result; the deliberately inverted branch wrongly rejects it. Fixed variant accepts empty output and rejects carrot prefix.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(record.stdout);
} finally {
  server.kill();
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("close", resolve);
      setTimeout(resolve, 1000);
    }
  });
  writeFileSync(join(output, "gdb-server.log"), serverLog);
}
