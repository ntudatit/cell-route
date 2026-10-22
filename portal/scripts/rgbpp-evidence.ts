import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkSample, officialSample, pins, type Sample } from '../tests/rgbpp/checker';
import { confirmationState, observe } from '../tests/rgbpp/observer';
const directory='../docs/evidence/week-10'; mkdirSync(directory,{recursive:true});
const write=(name:string,value:unknown)=>writeFileSync(`${directory}/${name}`,JSON.stringify(value,null,2)+'\n');
const hashFile=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const linkage=await checkSample(officialSample);
write('binding-map.json',linkage);
if(linkage.status!=='matched')throw Error('Official fixture failed');
const negatives:unknown[]=[];
for(const variant of ['vout','txid','commitment','output-data','network','ckb-outpoint']){
 const sample:Sample=structuredClone(officialSample);
 if(variant==='vout')sample.bitcoin.vout++;
 if(variant==='txid')sample.bitcoin.txid='11'.repeat(32);
 if(variant==='commitment')sample.virtual.expectedCommitment='11'.repeat(32);
 if(variant==='output-data')sample.virtual.transaction.outputsData[0]='0x01';
 if(variant==='network')sample.network.bitcoin='mainnet';
 if(variant==='ckb-outpoint')sample.ckb.outPoint.txHash='0x'+'11'.repeat(32);
 const actual=await checkSample(sample);
 negatives.push({case:variant,layer:'mutated public fixture; no broadcast',expected:'mismatch',actual:actual.status,failedChecks:actual.checks.filter(c=>c.status==='mismatch')});
 if(actual.status!=='mismatch')throw Error(`Negative case unexpectedly passed: ${variant}`);
}
const outage=await observe(officialSample,{fetcher:(async()=>new Response('',{status:503})) as typeof fetch});
negatives.push({case:'API outage',layer:'HTTP503 fixture',expected:'both states unknown, no completion',actual:{bitcoin:outage.bitcoin,ckb:outage.ckb,crossChainComplete:outage.crossChainComplete}});
negatives.push({case:'reorg',layer:'confirmation policy fixture',before:confirmationState(true,true,100,110,true),after:confirmationState(true,false,100,110,true),expected:'reorg-detected; no retained finality'});
negatives.push({case:'one chain pending',layer:'confirmation policy fixture',actual:confirmationState(false,true,0,110,true),expected:'pending; no cross-chain completion'});
negatives.push({case:'missing proof',layer:'offline fixture has no SPV proof',expected:'not verified',actual:linkage.proof});
write('negative-cases.json',negatives);
const live=process.argv.includes('--live');
if(live){const observed=await observe(officialSample);write('observations.json',observed);console.log(JSON.stringify({bitcoin:observed.bitcoin,ckb:observed.ckb,proof:observed.proof},null,2));}
const pkg=JSON.parse(readFileSync('package.json','utf8'));
write('environment.json',{recordedAt:new Date().toISOString(),dateTimezone:'Asia/Bangkok',pins,sampleProvenance:officialSample.provenance,node:process.version,cccCore:pkg.dependencies['@ckb-ccc/core'],hashes:{sampleSha256:hashFile('tests/rgbpp/binding-vector.json'),pinsSha256:hashFile('src/features/rgbpp/pins.json'),portalLockSha256:hashFile('package-lock.json')},runMode:live?'offline checks plus requested live API observations':'offline fixture checks only; existing observations.json is a separate dated capture',proof:'not verified',transfer:'not performed'});
console.log(`PASS: ${linkage.checks.length} linkage checks, ${negatives.length} negative/policy cases. Proof not verified; transfer not performed.`);

