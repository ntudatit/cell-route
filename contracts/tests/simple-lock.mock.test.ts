import { hexFrom, Transaction, hashTypeToBytes, hashCkb } from '@ckb-ccc/core';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS, DEFAULT_SCRIPT_CKB_JS_VM } from 'ckb-testtool';
const preimage = new TextEncoder().encode('CellRoute Week 5');
function fixture(witness?: Uint8Array, digest = hashCkb(preimage), preceding = false, grouped = false) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const vm = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)), tx, false);
  const always = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const code = resource.deployCell(hexFrom(readFileSync('dist/simple-lock.bc')), tx, false);
  vm.args = hexFrom('0x0000' + code.codeHash.slice(2) + hexFrom(hashTypeToBytes(code.hashType)).slice(2) + digest.slice(2));
  if (preceding) {
    tx.inputs.push(Resource.createCellInput(resource.mockCell(always)));
    tx.witnesses.push('0x1234');
  }
  tx.inputs.push(Resource.createCellInput(resource.mockCell(vm)));
  if (grouped) tx.inputs.push(Resource.createCellInput(resource.mockCell(vm)));
  tx.outputs.push(Resource.createCellOutput(always));
  tx.outputsData.push('0x');
  if (witness !== undefined) tx.witnesses.push(hexFrom(witness));
  const verifier = Verifier.from(resource, tx);
  verifier.debugger = process.env.CKB_DEBUGGER ?? "ckb-debugger";
  return verifier;
}
test('correct preimage exits 0', async () => {
  const verifier = fixture(preimage);
  mkdirSync('build', { recursive: true });
  writeFileSync('build/correct.json', JSON.stringify(verifier.txFile(), null, 2));
  await verifier.verifySuccess(true);
});
test('incorrect preimage exits 7', async () => {
  const verifier = fixture(new TextEncoder().encode('wrong'));
  mkdirSync('build', { recursive: true });
  writeFileSync('build/incorrect.json', JSON.stringify(verifier.txFile(), null, 2));
  await verifier.verifyFailure(7, true);
});
test('missing witness exits 6', async () => { await fixture().verifyFailure(6); });
test('empty witness exits 6', async () => { await fixture(new Uint8Array()).verifyFailure(6); });
test('malformed args exit 5', async () => { await fixture(preimage, '0x1234').verifyFailure(5); });
test('oversized preimage exits 8', async () => { await fixture(new Uint8Array(1025)).verifyFailure(8); });
test('uses group input instead of absolute input zero', async () => { await fixture(preimage, undefined, true).verifySuccess(); });
test('one witness unlocks two grouped inputs', async () => { await fixture(preimage, undefined, false, true).verifySuccess(); });

