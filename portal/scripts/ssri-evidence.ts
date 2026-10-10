import deployment from '../public/ssri.devnet.json';
import { inspect, rpc, methodPath, u64, pins, SsriError, type Identity } from '../src/features/ssri/client';
import { writeFileSync, mkdirSync } from 'node:fs';
const nodeUrl=deployment.nodeUrl,serverUrl='http://127.0.0.1:9090';
const genesis=await rpc(nodeUrl,'get_block_hash',['0x0']);
if(genesis.result!==deployment.genesisHash)throw Error('Configured Devnet genesis mismatch');
const identity:Identity={nodeUrl,serverUrl,network:'devnet',genesisHash:deployment.genesisHash,outPoint:deployment.outPoint,codeHash:deployment.codeHash};
const cases:unknown[]=[];
for(const method of ['SSRI.get_methods','UDT.name','UDT.decimals'] as const) cases.push({case:method,outcome:'PASS',receipt:await inspect(identity,method)});
cases.push({case:'Repeat UDT.name',outcome:'PASS',receipt:await inspect(identity,'UDT.name')});
const variants=[{name:'Unsupported method',action:()=>rpc(serverUrl,pins.server.rpc,[identity.outPoint.txHash,0,[methodPath('NoSuch.method')]])},{name:'Unavailable OutPoint',action:()=>rpc(serverUrl,pins.server.rpc,['0x'+'00'.repeat(32),0,[methodPath('UDT.name')]])},{name:'Wrong code hash',action:()=>inspect({...identity,codeHash:'0x'+'00'.repeat(32)},'UDT.name')}];
for(const variant of variants){try{const response=await variant.action();cases.push({case:variant.name,outcome:'UNEXPECTED SUCCESS',response});}catch(e){cases.push({case:variant.name,outcome:'REJECTED',error:e instanceof SsriError?{code:e.code,message:e.message,diagnostic:e.diagnostic}:{message:String(e)}});}}
cases.push({case:'Pagination limit 1',layer:'actual server RPC',response:await rpc(serverUrl,pins.server.rpc,[identity.outPoint.txHash,0,[methodPath('SSRI.get_methods'),u64(0n),u64(1n)]])});
mkdirSync('../docs/evidence/week-9',{recursive:true});writeFileSync('../docs/evidence/week-9/environment.json',JSON.stringify({timestamp:new Date().toISOString(),identity,pins,layer:'Actual local Devnet and pinned SSRI server'},null,2));writeFileSync('../docs/evidence/week-9/method-calls.json',JSON.stringify(cases,null,2));console.log(JSON.stringify(cases.map((c:any)=>({case:c.case,outcome:c.outcome,decoded:c.receipt?.decoded,error:c.error?.code})),null,2));

if(cases.some((item:any)=>item.outcome==='UNEXPECTED SUCCESS')) process.exitCode=1;



