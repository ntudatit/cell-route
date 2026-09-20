import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
const binary = readFileSync("vendor/sudt/simple_udt");
const expected =
  "b1a962cb43d88e777d9df0aa4e67270ee758d9abdd18b1c56b106a5eed149af9";
if (createHash("sha256").update(binary).digest("hex") !== expected)
  throw Error("sUDT artifact checksum mismatch");
mkdirSync("build/week6", { recursive: true });
copyFileSync("vendor/sudt/simple_udt", "build/week6/simple_udt");
console.log(
  "Verified and staged pinned sUDT binary. This command does not compile the reference C source.",
);
