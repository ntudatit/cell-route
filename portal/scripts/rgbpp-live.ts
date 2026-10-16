import { inspectAsset } from '../src/features/rgbpp/live';
import type { ProfileName } from '../src/features/rgbpp/profiles';
import { writeFileSync,mkdirSync } from 'node:fs';
const [network,kind,txid,index]=process.argv.slice(2);
if(!network||!kind||!txid||index===undefined)throw Error('Usage: node scripts/rgbpp-live.mjs <testnet3|mainnet> <cell|utxo> <transaction-id> <index>');
const receipt=await inspectAsset({network:network as ProfileName,kind:kind as 'cell'|'utxo',txid,index:Number(index)});
mkdirSync('../docs/evidence/live-labs',{recursive:true});writeFileSync(`../docs/evidence/live-labs/rgbpp-${network}-${kind}.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({...receipt,raw:undefined,cells:receipt.cells.map(c=>({...c,output:undefined,data:undefined}))},null,2));
