import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
mkdirSync("../contracts/build/ickb", { recursive: true });
await build({
  absWorkingDir: process.cwd(),
  stdin: {
    contents:
      "export * from './src/features/ickb/model'; export * from './src/features/ickb/snapshot';",
    resolveDir: process.cwd(),
    sourcefile: "ickb-bridge.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  banner: {
    js: 'import { createRequire } from "node:module"; const require=createRequire(import.meta.url);',
  },
  outfile: "../contracts/build/ickb/bridge.mjs",
});
console.log(
  "Built independent portal arithmetic/RPC bridge. Run the isolated SDK checks with Node 26.",
);
