import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../..", import.meta.url));
export const out = join(root, "build/week11");
export const pins = JSON.parse(
  readFileSync(join(root, "xudt-extension-lab/pins.json"), "utf8").replace(
    /^\uFEFF/,
    "",
  ),
);
export const sha = (data) => createHash("sha256").update(data).digest("hex");
export function check(path, expected) {
  if (sha(readFileSync(path)) !== expected)
    throw Error(`Checksum mismatch: ${path}`);
}
export function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (r.error || r.signal || r.status !== 0)
    throw Error(`${command}: ${r.error || r.stderr || r.stdout}`);
  return r;
}
export const source = join(
  out,
  `ckb-production-scripts-${pins.implementation.revision}`,
);
export const stdlib = join(out, `ckb-c-stdlib-${pins.stdlib.revision}`);
export function json(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
