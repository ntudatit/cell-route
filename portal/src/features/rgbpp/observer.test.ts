import { describe, expect, it } from 'vitest';
import { ccc } from '@ckb-ccc/core';
import deploymentType from './deployment-type.json';
import { officialSample, pins } from './checker';
import { observe } from './observer';
const bh='11'.repeat(32), ch='0x'+'22'.repeat(32), tip='0x'+'33'.repeat(32);
const rpcScript=(s:{codeHash:string;hashType:string;args:string})=>({code_hash:s.codeHash,hash_type:s.hashType,args:s.args});
const output={capacity:officialSample.ckb.output.capacity,lock:rpcScript(officialSample.ckb.output.lock),type:rpcScript(officialSample.ckb.output.type)};
function fixture({spent=true,live='dead',reorg=false,bitcoinDown=false,badGenesis=false}:{spent?:boolean;live?:string;reorg?:boolean;bitcoinDown?:boolean;badGenesis?:boolean}={}) {
 return (async (input:RequestInfo|URL,options?:RequestInit)=>{
  const url=String(input); let result:unknown;
  if(url===pins.network.ckbRpc){const request=JSON.parse(String(options?.body));const {method,params}=request;
   if(method==='get_block_hash')result=params[0]==='0x0'?pins.network.ckbGenesis:ch;
   else if(method==='get_tip_header')result={hash:tip,number:'0x100'};
   else if(method==='get_transaction')result=params[0]===pins.network.rgbppLock.deployment.txHash?{tx_status:{status:'committed'},transaction:{hash:params[0],outputs:[{type:deploymentType}]}}:{tx_status:{status:'committed',block_hash:ch},transaction:{hash:params[0],outputs:[output],outputs_data:[officialSample.ckb.data]}};
   else if(method==='get_header')result={hash:ch,number:'0x10'};
   else if(method==='get_live_cell')result={status:live,...(live==='live'?{cell:{output,data:{content:officialSample.ckb.data}}}:{})};
   else throw Error('Unexpected RPC');
   return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
  }
  if(bitcoinDown)return new Response('',{status:503});
  const path=url.slice(pins.network.bitcoinApi.length);
  if(path==='/block-height/0')return new Response(badGenesis?'00'.repeat(32):pins.network.bitcoinGenesis);
  if(path==='/blocks/tip/hash')return new Response(bh);
  if(path===`/block/${bh}`)result={id:bh,height:110};
  else if(path.endsWith('/outspend/0'))result={spent,...(spent?{txid:'44'.repeat(32),vin:0}:{})};
  else if(path.startsWith('/tx/'))result={txid:officialSample.bitcoin.txid,vout:[{value:546}],status:{confirmed:true,block_height:100,block_hash:bh}};
  else if(path==='/block-height/100')return new Response(reorg?'55'.repeat(32):bh);
  else throw Error('Unexpected Bitcoin API path');
  return new Response(JSON.stringify(result));
 }) as typeof fetch;
}
describe('RGB++ chain state reconciliation fixtures (not live evidence)',()=>{
 it('preserves spent separately from confirmations, and dead separately from committed',async()=>{
  expect(ccc.Script.from({codeHash:deploymentType.code_hash,hashType:'type',args:deploymentType.args}).hash()).toBe(pins.network.rgbppLock.codeHash);
  const r=await observe(officialSample,{fetcher:fixture()});expect(r.bitcoin).toMatchObject({state:'spent',confirmation:'observed threshold reached'});expect(r.ckb).toMatchObject({state:'dead',transactionStatus:'committed'});expect(r.crossChainComplete).toBe(false);
 });
 it('supports independent unspent and live observations without declaring proof verified',async()=>{
  const r=await observe(officialSample,{fetcher:fixture({spent:false,live:'live'})});expect(r.bitcoin.state).toBe('unspent');expect(r.ckb.state).toBe('live');expect(r.proof.status).toBe('not verified');expect(r.crossChainComplete).toBe(false);
 });
 it('reports unknown from get_live_cell without inventing dead status',async()=>{
  const r=await observe(officialSample,{fetcher:fixture({live:'unknown'})});expect(r.ckb.state).toBe('unknown');
 });
 it('keeps one API failure independent of the other chain',async()=>{
  const r=await observe(officialSample,{fetcher:fixture({bitcoinDown:true})});expect(r.bitcoin.state).toBe('unknown');expect(r.ckb.state).toBe('dead');
 });
 it('detects mismatched Bitcoin genesis',async()=>{
  const r=await observe(officialSample,{fetcher:fixture({badGenesis:true})});expect(r.bitcoin).toMatchObject({state:'unknown',error:'Bitcoin network/genesis mismatch.'});
 });
 it('does not retain confirmation threshold after a reorg',async()=>{
  const r=await observe(officialSample,{fetcher:fixture({reorg:true})});expect(r.bitcoin).toMatchObject({confirmation:'reorg-detected',confirmations:0});expect(r.crossChainComplete).toBe(false);
 });
});
