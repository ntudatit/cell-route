import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const name = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Provide a contract name (lowercase, digits, hyphens).');
mkdirSync('dist', { recursive: true });
await build({ entryPoints: [`contracts/${name}/src/index.ts`], outfile: `dist/${name}.js`, platform: 'neutral', bundle: true, external: ['@ckb-js-std/bindings'], target: 'es2022', minify: !process.argv.includes('--debug') });
execFileSync(process.env.CKB_DEBUGGER ?? 'ckb-debugger', ['--read-file', `dist/${name}.js`, '--bin', 'node_modules/ckb-testtool/src/unittest/defaultScript/ckb-js-vm', '--', '-c', `dist/${name}.bc`], { stdio: 'inherit' });
