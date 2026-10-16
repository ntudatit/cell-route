import {expect,it} from 'vitest';
import deployment from '../../public/simple-lock.devnet.json';
import {parseDeployment} from './simpleLock';
it('accepts an exported deployment without assuming a fixed OutPoint',()=>{const value=structuredClone(deployment);value.code.codeHash='0x'+'11'.repeat(32);expect(parseDeployment(JSON.stringify(value)).code.codeHash).toBe(value.code.codeHash);});
it('rejects deployment URLs with credentials and missing dependencies',()=>{expect(()=>parseDeployment(JSON.stringify({...deployment,rpcUrl:'https://user:secret@node'}))).toThrow('public RPC');expect(()=>parseDeployment(JSON.stringify({...deployment,code:{}}))).toThrow();});
it('rejects signing material in public deployment manifests',()=>{expect(()=>parseDeployment(JSON.stringify({...deployment,privateKey:'not-a-key'}))).toThrow('Signing material');});
