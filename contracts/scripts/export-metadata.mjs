import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ccc } from '@ckb-ccc/core';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const code = read('deployment/scripts.json').devnet['simple-lock.bc'];
const system = read('deployment/system-scripts.json').devnet;
const client = new ccc.ClientPublicTestnet({ url: 'http://127.0.0.1:28114', fallbacks: [] });
const genesis = await client.getBlockByNumber(0);
const live = await client.getCellLive(code.cellDeps[0].cellDep.outPoint, true);
if (!live || ccc.hashCkb(live.outputData) !== code.codeHash) throw new Error('Deployed bytecode mismatch');
const metadata = {
  network: 'offckb-devnet', rpcUrl: 'http://127.0.0.1:28114',
  genesisHash: genesis.header.hash, code,
  vm: system.ckb_js_vm.script,
  knownScripts: { [ccc.KnownScript.NervosDao]: system.dao.script, [ccc.KnownScript.Secp256k1Blake160]: system.secp256k1_blake160_sighash_all.script },
};
writeFileSync('deployment/simple-lock.devnet.json', JSON.stringify(metadata, null, 2) + '\n');
mkdirSync('../portal/public', { recursive: true });
writeFileSync('../portal/public/simple-lock.devnet.json', JSON.stringify(metadata, null, 2) + '\n');
console.log('Verified deployment metadata exported to portal/public/simple-lock.devnet.json');

