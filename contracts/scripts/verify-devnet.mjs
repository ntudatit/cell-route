import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ccc } from '@ckb-ccc/core';
const meta = JSON.parse(readFileSync('deployment/simple-lock.devnet.json', 'utf8'));
const client = new ccc.ClientPublicTestnet({ url: meta.rpcUrl, fallbacks: [], scripts: meta.knownScripts });
assert.equal((await client.getBlockByNumber(0)).header.hash, meta.genesisHash, 'Devnet genesis mismatch');
const preimage = new TextEncoder().encode('CellRoute Week 5');
const digest = ccc.hashCkb(preimage);
const lock = ccc.Script.from({ ...meta.vm, args: '0x0000' + meta.code.codeHash.slice(2) + ccc.hexFrom(ccc.hashTypeToBytes(meta.code.hashType)).slice(2) + digest.slice(2) });
const address = (await ccc.Address.fromScript(lock, client)).toString();
if (process.argv.includes('--address')) { console.log(address); process.exit(0); }
const codeCell = await client.getCellLive(meta.code.cellDeps[0].cellDep.outPoint, true);
assert.ok(codeCell); assert.equal(ccc.hashCkb(codeCell.outputData), meta.code.codeHash);
let protectedCell;
for await (const cell of client.findCells({ script: lock, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
  if (!cell.cellOutput.type && cell.outputData === '0x') { protectedCell = cell; break; }
}
assert.ok(protectedCell, `Fund first: offckb deposit ${address} 200`);
const tx = ccc.Transaction.from({
  inputs: [{ previousOutput: protectedCell.outPoint }],
  outputs: [{ capacity: protectedCell.cellOutput.capacity - 100_000n, lock: codeCell.cellOutput.lock }], outputsData: ['0x'],
  cellDeps: [...meta.vm.cellDeps, ...meta.code.cellDeps].map(dep => dep.cellDep),
  witnesses: [ccc.hexFrom(new TextEncoder().encode('wrong'))],
});
let rejection;
try { await client.sendTransaction(tx); } catch (error) { rejection = String(error); }
assert.match(rejection ?? '', /(?:error code|ValidationFailure[^\n]*|code)[^\n]*7/i, 'Wrong preimage must fail with exit 7');
tx.witnesses = [];
let missing;
try { await client.sendTransaction(tx); } catch (error) { missing = String(error); }
assert.match(missing ?? '', /(?:error code|ValidationFailure[^\n]*|code)[^\n]*6/i, 'Missing witness must fail with exit 6');
tx.witnesses = [ccc.hexFrom(preimage)];
const unlockTxHash = await client.sendTransaction(tx);
console.log(`Unlock submitted: ${unlockTxHash}`);
const committed = await client.waitTransaction(unlockTxHash, 0, 60000);
assert.equal(committed?.status, 'committed');
const evidence = { network: meta.network, genesisHash: meta.genesisHash, codeHash: meta.code.codeHash,
  codeOutPoint: meta.code.cellDeps[0].cellDep.outPoint, address, digest,
  fundingTxHash: protectedCell.outPoint.txHash, unlockTxHash, status: committed.status,
  wrongPreimageExitCode: 7, missingWitnessExitCode: 6, checkedAt: new Date().toISOString() };
writeFileSync('deployment/week5-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
