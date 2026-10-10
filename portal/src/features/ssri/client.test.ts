import { describe, expect, it } from 'vitest';
import { decodeResult, encodeArgs, methodPath, publicEndpoint, rpc, u64 } from './client';
describe('SSRI pinned profile',()=>{
 it('encodes CKB method hashes and u64LE',()=>{expect(methodPath('SSRI.get_methods')).toBe('0x58f02409de9de7b1');expect(u64(1n)).toBe('0x0100000000000000');expect(()=>u64(-1n)).toThrow();});
 it('decodes prototype results',()=>{expect(decodeResult('UDT.name','0x54657374')).toBe('Test');expect(decodeResult('UDT.decimals','0x08')).toBe(8);expect(decodeResult('UDT.balance','0x00000000000000000100000000000000')).toBe('18446744073709551616');});
 it('rejects incompatible schema and unsafe endpoints',()=>{for(const value of [null,{content:'0x08'},'0x0008'])expect(()=>decodeResult('UDT.decimals',value)).toThrow();expect(()=>decodeResult('UDT.name','0xff')).toThrow();expect(()=>encodeArgs('SSRI.has_methods')).toThrow();expect(()=>publicEndpoint('http://user:secret@localhost')).toThrow();});
 it('bounds responses and checks correlation',async()=>{const fake=(text:string)=>(async()=>new Response(text)) as typeof fetch;await expect(rpc('http://localhost','x',[],{fetcher:fake('x'.repeat(100)),maxBytes:20})).rejects.toMatchObject({code:'SIZE'});await expect(rpc('http://localhost','x',[],{fetcher:fake('{"jsonrpc":"2.0","id":-1,"result":"0x"}')})).rejects.toMatchObject({code:'SCHEMA'});});
 it('enforces timeout on a pending transport',async()=>{
  const fetcher=((_url:unknown,options:RequestInit)=>new Promise<Response>((_resolve,reject)=>options.signal?.addEventListener('abort',()=>reject(options.signal?.reason),{once:true}))) as typeof fetch;
  await expect(rpc('http://localhost','x',[],{fetcher,timeoutMs:5})).rejects.toMatchObject({code:'TIMEOUT'});
 });
 it('honors cancellation',async()=>{const controller=new AbortController();controller.abort();await expect(rpc('http://localhost','x',[],{signal:controller.signal})).rejects.toMatchObject({code:'ABORTED'});});
});

