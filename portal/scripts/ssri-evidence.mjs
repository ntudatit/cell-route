import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({entryPoints:['scripts/ssri-evidence.ts'],bundle:true,platform:'node',format:'esm',banner:{js:'import { createRequire } from "node:module"; const require=createRequire(import.meta.url);'},outfile:'../contracts/build/ssri/evidence-runner.mjs'});
const result=spawnSync(process.execPath,['../contracts/build/ssri/evidence-runner.mjs'],{stdio:'inherit'});process.exit(result.status??1);
