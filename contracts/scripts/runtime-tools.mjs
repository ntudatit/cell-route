import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
export const root = fileURLToPath(new URL("..", import.meta.url));
export const output = join(root, "build/runtime-lab");
export const toolsRoot = join(root, "build/toolchains");
export function tool(env, name, fallback) {
  const candidate =
    process.env[env] || (fallback && existsSync(fallback) ? fallback : name);
  return candidate;
}
export const debuggerPath = tool(
  "CKB_DEBUGGER",
  "ckb-debugger",
  process.env.LOCALAPPDATA &&
    join(process.env.LOCALAPPDATA, "offckb-nodejs/Data/tools/ckb-debugger.exe"),
);
export const gcc = tool(
  "RISCV_CC",
  "riscv-none-elf-gcc",
  join(
    toolsRoot,
    "xpack-riscv-none-elf-gcc-15.2.0-1/bin/riscv-none-elf-gcc.exe",
  ),
);
export const gdb = tool(
  "RISCV_GDB",
  "riscv-none-elf-gdb",
  join(
    toolsRoot,
    "xpack-riscv-none-elf-gcc-15.2.0-1/bin/riscv-none-elf-gdb.exe",
  ),
);
export const wabtRoot = process.env.WABT_ROOT || join(toolsRoot, "wabt-1.0.42");
export const wasm2c = tool(
  "WASM2C",
  "wasm2c",
  join(wabtRoot, "bin/wasm2c.exe"),
);
export function run(
  command,
  args,
  { allowFailure = false, log, ...options } = {},
) {
  mkdirSync(output, { recursive: true });
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  const record = {
    command,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  if (log)
    writeFileSync(join(output, log), JSON.stringify(record, null, 2) + "\n");
  if (result.error || (!allowFailure && result.status !== 0))
    throw Error(
      `${command} failed (${result.status}): ${result.error?.message ?? record.stderr}\n${record.stdout}`,
    );
  return record;
}
export function hash(path) {
  return createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex");
}
export function parseExecution(record) {
  if (record.error || record.signal || record.status === null)
    throw Error("Debugger process did not complete.");
  const text = record.stdout + "\n" + record.stderr;
  const result = text.match(/Run result:\s*(-?\d+)/i);
  const cycles = text.match(
    /(?:All\s+|Total\s+)?cycles(?:\s+consumed)?:\s*([\d,]+)/i,
  );
  if (!result || !cycles)
    throw Error(
      "Debugger output lacks script result/cycles; not treating process status as a VM result.",
    );
  return {
    scriptResult: Number(result[1]),
    cycles: Number(cycles[1].replaceAll(",", "")),
    processExitStatus: record.status,
  };
}
