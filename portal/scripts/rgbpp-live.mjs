import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));mkdirSync('../contracts/build/rgbpp',{recursive:true});
await build({absWorkingDir:process.cwd(),entryPoints:['scripts/rgbpp-live.ts'],bundle:true,platform:'node',format:'esm',banner:{js:'import {createRequire} from "node:module";const require=createRequire(import.meta.url);'},outfile:'../contracts/build/rgbpp/live-runner.mjs'});
const result=spawnSync(process.execPath,['../contracts/build/rgbpp/live-runner.mjs',...process.argv.slice(2)],{stdio:'inherit'});process.exit(result.status??1);
