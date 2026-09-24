// Portable, project-local Windows tooling. No PATH or system installation changes.
import {
  mkdirSync,
  existsSync,
  readFileSync,
  createWriteStream,
} from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { toolsRoot, run } from "./runtime-tools.mjs";
if (process.platform !== "win32" || process.arch !== "x64")
  throw Error(
    "Automatic setup supports Windows x64. On other hosts set RISCV_CC, RISCV_GDB, WASM2C and WABT_ROOT; see docs/script-runtime.md.",
  );
mkdirSync(toolsRoot, { recursive: true });
const archives = [
  {
    base: "https://github.com/xpack-dev-tools/riscv-none-elf-gcc-xpack/releases/download/v15.2.0-1/",
    name: "xpack-riscv-none-elf-gcc-15.2.0-1-win32-x64.zip",
    sha256: "85ef714dacd273b1dadf4af4892774520ac01915bfa6da816a56e7e41591e09e",
  },
  {
    base: "https://github.com/WebAssembly/wabt/releases/download/1.0.42/",
    name: "wabt-1.0.42-windows-x64.tar.gz",
    sha256: "62f1eb2b51aa57cf0f0b8ba333bf2c72a049930aa9c5de01dcad271c4fe48c88",
  },
];
for (const archive of archives) {
  const path = join(toolsRoot, archive.name);
  const valid = () =>
    existsSync(path) &&
    createHash("sha256").update(readFileSync(path)).digest("hex") ===
      archive.sha256;
  if (!valid()) {
    console.log("Downloading " + archive.name);
    const response = await fetch(archive.base + archive.name, {
      signal: AbortSignal.timeout(900000),
    });
    if (!response.ok) throw Error(`Download failed: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
  }
  if (!valid()) throw Error("Archive checksum mismatch: " + archive.name);
  run("tar", ["-xf", path, "-C", toolsRoot], { timeout: 300000 });
  console.log("Verified and extracted " + archive.name);
}
