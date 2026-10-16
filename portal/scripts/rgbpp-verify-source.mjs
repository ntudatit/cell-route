// Fetch immutable public fixtures in memory. Never execute upstream code or retain account objects.
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const commit='ee21eb9735c1adeb277e3a02b7f6c2f6fd1d0556';
const root=`https://raw.githubusercontent.com/RGBPlusPlus/rgbpp-sdk/${commit}/`;
const bindingPath='packages/rgbpp/tests/mocked/50-included-41-excluded.ts';
const commitmentPath='packages/rgbpp/tests/__snapshots__/RgbppXudt.test.ts.snap';
async function load(path){const r=await fetch(root+path,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error(`HTTP ${r.status}`);const reader=r.body.getReader();let length=0;const chunks=[];try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>2097152)throw Error('Upstream fixture exceeds2MiB');chunks.push(next.value);}}finally{await reader.cancel();}return Buffer.concat(chunks).toString('utf8');}
function literal(node){
 if(ts.isStringLiteral(node))return node.text;
 if(ts.isNumericLiteral(node))return Number(node.text);
 if(ts.isBigIntLiteral(node))return node.text.replace(/n$/,'');
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(node.kind===ts.SyntaxKind.NullKeyword)return null;
 if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(p=>{if(!ts.isPropertyAssignment(p)||(!ts.isIdentifier(p.name)&&!ts.isStringLiteral(p.name)))throw Error('Nonliteral upstream property');return[p.name.text,literal(p.initializer)];}));
 throw Error(`Unsupported upstream syntax: ${ts.SyntaxKind[node.kind]}`);
}
const loaded=await Promise.allSettled([load(bindingPath),load(commitmentPath)]);
for(const result of loaded)if(result.status==='rejected')throw result.reason;
const [source,snapshot]=loaded.map(result=>result.value);
const parsed=ts.createSourceFile('fixture.ts',source,ts.ScriptTarget.Latest,true);
const arrays={};parsed.forEachChild(statement=>{if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations){if(ts.isIdentifier(d.name)&&['btcUtxos','rgbppCells'].includes(d.name.text))arrays[d.name.text]=literal(d.initializer);}});
const body=snapshot.slice(snapshot.indexOf('`\n')+2,snapshot.lastIndexOf('`'));
const snapshotAst=ts.createSourceFile('snapshot.ts',`const value=${body}`,ts.ScriptTarget.Latest,true);
const value=literal(snapshotAst.statements[0].declarationList.declarations[0].initializer);
const group=value.transactions[0], virtual=group.ckb.virtualTxResult;
const psbt=Buffer.from(group.btc.psbtHex,'hex');let offset=5;
function size(){const b=psbt[offset++];if(b<253)return b;if(b===253){const n=psbt.readUInt16LE(offset);offset+=2;return n;}if(b===254){const n=psbt.readUInt32LE(offset);offset+=4;return n;}throw Error('PSBT size unsupported');}
let unsigned;
while(offset<psbt.length){const keySize=size();if(!keySize)break;const key=psbt.subarray(offset,offset+keySize);offset+=keySize;const n=size();const data=psbt.subarray(offset,offset+n);offset+=n;if(keySize===1&&key[0]===0)unsigned=data.toString('hex');}
if(!unsigned)throw Error('Missing unsigned transaction');
const cell=arrays.rgbppCells.find(c=>virtual.ckbRawTx.inputs.some(i=>i.previousOutput.txHash===c.outPoint.txHash&&i.previousOutput.index===c.outPoint.index));
if(!cell)throw Error('Missing historical Cell');
const args=Buffer.from(cell.cellOutput.lock.args.slice(2),'hex');const txid=Buffer.from(args.subarray(4)).reverse().toString('hex'),vout=args.readUInt32LE(0);
const historical=arrays.btcUtxos.find(u=>u.txid===txid&&u.vout===vout);if(!historical)throw Error('Missing historical UTXO');
const projection={schema:'cellroute-rgbpp-v1',network:{bitcoin:'testnet3',ckb:'testnet'},provenance:{repository:'https://github.com/RGBPlusPlus/rgbpp-sdk',commit,bindingPath,commitmentPath,groupIndex:0,kind:'Official mocked historical binding and unsigned virtual-transaction snapshot; not a submitted transfer'},bitcoin:{vout,txid,historical},ckb:{outPoint:cell.outPoint,output:cell.cellOutput,data:cell.data,historicalBlock:cell.blockNumber},virtual:{transaction:virtual.ckbRawTx,expectedCommitment:virtual.commitment,bitcoinUnsignedTx:unsigned}};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const local=JSON.parse(readFileSync('src/features/rgbpp/sample.json','utf8'));
if(JSON.stringify(canonical(projection))!==JSON.stringify(canonical(local)))throw Error('Tracked fixture differs from immutable upstream projection');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const receipt={repository:'https://github.com/RGBPlusPlus/rgbpp-sdk',commit,license:'ISC',files:[{path:bindingPath,sha256:sha256(source)},{path:commitmentPath,sha256:sha256(snapshot)}],projectionSha256:sha256(readFileSync('src/features/rgbpp/sample.json')),result:'Exact public-data projection matched; upstream account objects excluded; source not executed',checkedAt:new Date().toISOString()};
mkdirSync('../docs/evidence/week-10',{recursive:true});writeFileSync('../docs/evidence/week-10/fixture-provenance.json',JSON.stringify(receipt,null,2)+'\n');console.log('PASS: immutable upstream public projection matched. Account fields were not retained.');
