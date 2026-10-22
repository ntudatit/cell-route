import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hashCkb } from "@ckb-ccc/core";
import { gcc } from "../runtime-tools.mjs";
import {
  pins,
  out,
  root,
  source,
  stdlib,
  run,
  check,
  sha,
  json,
} from "./common.mjs";
mkdirSync(out, { recursive: true });
const xudt = join(root, "vendor/xudt/xudt_rce");
check(xudt, pins.xudt.sha256);
if (hashCkb(readFileSync(xudt)) !== pins.xudt.codeHash)
  throw Error("Deployed xUDT code identity mismatch");
let linker = process.env.RISCV_LD;
if (!linker && process.platform === "win32") {
  const rust = join(process.env.USERPROFILE, ".rustup/toolchains");
  if (existsSync(rust))
    for (const v of readdirSync(rust).sort().reverse()) {
      const p = join(
        rust,
        v,
        "lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe",
      );
      if (existsSync(p)) {
        linker = p;
        break;
      }
    }
}
linker ||= "ld.lld";
const args = [
  "-march=rv64imc",
  "-mabi=lp64",
  "-fPIC",
  "-Os",
  "-fno-builtin",
  "-nostdinc",
  "-nostdlib",
  "-nostartfiles",
  "-fvisibility=hidden",
  "-fdata-sections",
  "-ffunction-sections",
  `-I${stdlib}`,
  `-I${join(stdlib, "libc")}`,
  `-I${join(stdlib, "molecule")}`,
  `-I${join(source, "c")}`,
  "-D__SHARED_LIBRARY__",
  "-c",
  "-o",
  "build/week11/marker.o",
  "xudt-extension-lab/marker.c",
];
run(gcc, args);
const link = [
  "-flavor",
  "gnu",
  "-m",
  "elf64lriscv",
  "-shared",
  "-Bsymbolic",
  "--no-rosegment",
  "-e",
  "_start",
  "--gc-sections",
  "--dynamic-list=xudt-extension-lab/validate.syms",
  "--build-id=none",
  "-z",
  "max-page-size=4096",
  "-o",
  "build/week11/marker",
  "build/week11/marker.o",
];
run(linker, link);
const binary = readFileSync(join(out, "marker"));
json(join(out, "artifacts.json"), {
  compiler: run(gcc, ["--version"]).stdout.split("\n")[0],
  linker: run(linker, ["-flavor", "gnu", "--version"]).stdout.trim(),
  commands: [
    [gcc, ...args],
    [linker, ...link],
  ],
  xudt: pins.xudt,
  extension: {
    sha256: sha(binary),
    codeHash: hashCkb(binary),
    hashType: "data1",
    bytes: binary.length,
    sourceSha256: sha(readFileSync(join(root, "xudt-extension-lab/marker.c"))),
  },
});
console.log("Built marker extension", hashCkb(binary));
