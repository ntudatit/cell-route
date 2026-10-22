import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pins, out, run, check } from "./common.mjs";
mkdirSync(out, { recursive: true });
for (const [key, name] of [
  ["implementation", "source"],
  ["stdlib", "stdlib"],
]) {
  const p = pins[key];
  const repo = p.repository.split("/").slice(-2).join("/");
  const archive = join(out, `${name}.zip`);
  if (!existsSync(archive)) {
    const r = await fetch(
      `https://codeload.github.com/${repo}/zip/${p.revision}`,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!r.ok) throw Error(`Download failed: ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 16 * 1024 * 1024) throw Error("Source archive too large");
    writeFileSync(archive, b);
  }
  check(archive, p.archiveSha256);
  // Extract only checksum-pinned upstream archives; argv paths never enter a shell.
  if (process.platform === "win32") run("tar.exe", ["-xf", archive, "-C", out]);
  else run("unzip", ["-o", "-q", archive, "-d", out]);
}
console.log(
  "Pinned official source and stdlib ready. Compiler setup: npm run runtime:setup (or RISCV_CC).",
);
