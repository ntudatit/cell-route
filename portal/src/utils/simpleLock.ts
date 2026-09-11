import { ccc } from '@ckb-ccc/connector-react';
export interface Deployment {
  network: string; rpcUrl: string; genesisHash: string;
  code: ccc.ScriptInfoLike; vm: ccc.ScriptInfoLike;
  knownScripts: Record<ccc.KnownScript, ccc.ScriptInfoLike | undefined>;
}
export function preimageBytes(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (!bytes.length || bytes.length > 1024) throw new Error('Preimage must be 1–1024 UTF-8 bytes.');
  return bytes;
}
export function deriveLock(meta: Deployment, digest: string) {
  if (!/^0x[0-9a-f]{64}$/i.test(digest)) throw new Error('Digest must be 32 bytes of hex.');
  return ccc.Script.from({ ...meta.vm, args: ccc.hexFrom('0x0000' + ccc.hexFrom(meta.code.codeHash).slice(2) + ccc.hexFrom(ccc.hashTypeToBytes(meta.code.hashType)).slice(2) + digest.slice(2)) });
}
export async function verifyDeployment(client: ccc.Client, meta: Deployment) {
  if (meta.network !== 'offckb-devnet') throw new Error('This lab requires OffCKB Devnet.');
  const genesis = await client.getBlockByNumber(0);
  if (genesis?.header.hash !== meta.genesisHash) throw new Error('Wrong network or reset Devnet. Re-deploy and export metadata.');
  for (const info of [meta.code, meta.vm]) {
    const dep = info.cellDeps?.[0]?.cellDep;
    if (!dep || dep.depType !== 'code') throw new Error('Missing code Cell dependency.');
    const cell = await client.getCellLive(dep.outPoint, true);
    if (!cell) throw new Error('Deployed code Cell is no longer live.');
    const hash = info.hashType === 'type' ? cell.cellOutput.type?.hash() : ccc.hashCkb(cell.outputData);
    if (hash !== info.codeHash) throw new Error('Deployed code hash mismatch.');
  }
}
export async function liveCells(client: ccc.Client, lock: ccc.Script) {
  const cells: ccc.Cell[] = [];
  for await (const cell of client.findCells({ script: lock, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
    if (!cell.cellOutput.type && cell.outputData === '0x') cells.push(cell);
  }
  return cells;
}
export function buildUnlock(meta: Deployment, cell: ccc.Cell, recipient: ccc.Script, preimage: string) {
  const bytes = preimageBytes(preimage);
  const expected = deriveLock(meta, ccc.hashCkb(bytes));
  if (cell.cellOutput.lock.hash() !== expected.hash()) throw new Error('Wrong preimage (contract exit code 7).');
  if (cell.cellOutput.type || cell.outputData !== '0x') throw new Error('Only plain capacity Cells are supported.');
  const fee = 100_000n; // 0.001 CKB; ample for one input and a <=1024-byte witness.
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ capacity: cell.cellOutput.capacity - fee, lock: recipient }], outputsData: ['0x'],
    cellDeps: [...(meta.vm.cellDeps ?? []), ...(meta.code.cellDeps ?? [])].map(d => d.cellDep),
    witnesses: [ccc.hexFrom(bytes)],
  });
  if (tx.outputs[0].capacity < BigInt(tx.outputs[0].occupiedSize) * 100_000_000n) throw new Error('Recipient requires more capacity than this Cell contains.');
  return tx;
}

