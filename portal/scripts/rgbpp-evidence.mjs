import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('../contracts/build/rgbpp',{recursive:true});
await build({absWorkingDir:process.cwd(),entryPoints:['scripts/rgbpp-evidence.ts'],bundle:true,platform:'node',format:'esm',banner:{js:'import { createRequire } from "node:module"; const require=createRequire(import.meta.url);'},outfile:'../contracts/build/rgbpp/evidence-runner.mjs'});
const result=spawnSync(process.execPath,['../contracts/build/rgbpp/evidence-runner.mjs',...process.argv.slice(2)],{stdio:'inherit'});process.exit(result.status??1);


