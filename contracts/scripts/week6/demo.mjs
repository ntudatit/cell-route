import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));
await build({
  entryPoints: ["portal/scripts/week6-devnet.ts"],
  outfile: "contracts/build/week6-demo.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
});
const result = spawnSync(process.execPath, ["contracts/build/week6-demo.cjs"], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
