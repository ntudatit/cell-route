import { describe, expect, it } from 'vitest';
import { ccc } from '@ckb-ccc/connector-react';
import metadata from '../../public/simple-lock.devnet.json';
import { buildUnlock, deriveLock, preimageBytes, verifyDeployment, type Deployment } from './simpleLock';
const meta = metadata as Deployment;
const preimage = 'CellRoute Week 5';
const lock = deriveLock(meta, ccc.hashCkb(preimageBytes(preimage)));
const recipient = ccc.Script.from({ codeHash: '0x' + '11'.repeat(32), hashType: 'type', args: '0x' + '22'.repeat(20) });
const cell = ccc.Cell.from({ outPoint: { txHash: '0x' + '33'.repeat(32), index: 0 }, cellOutput: { capacity: ccc.fixedPointFrom(200), lock }, outputData: '0x' });
describe('Simple Lock transaction builder', () => {
  it('constructs the raw group witness and both executable dependencies', () => {
    const tx = buildUnlock(meta, cell, recipient, preimage);
    expect(tx.witnesses).toEqual([ccc.hexFrom(preimageBytes(preimage))]);
    expect(tx.cellDeps).toHaveLength(2);
    expect(tx.inputs[0].previousOutput).toEqual(cell.outPoint);
    expect(tx.outputs[0].capacity).toBe(cell.cellOutput.capacity - 100_000n);
    expect(tx.outputs[0].lock).toEqual(recipient);
    expect(lock.args.length).toBe(2 + 67 * 2);
  });
  it('rejects wrong preimages before construction', () => {
    expect(() => buildUnlock(meta, cell, recipient, 'wrong')).toThrow('exit code 7');
  });
  it('measures UTF-8 bytes and rejects empty or oversized preimages', () => {
    expect(preimageBytes('é').length).toBe(2);
    expect(() => preimageBytes('')).toThrow();
    expect(() => preimageBytes('é'.repeat(513))).toThrow();
  });
  it('rejects a different genesis before code lookup or submission', async () => {
    const client = { getBlockByNumber: async () => ({ header: { hash: '0x00' } }) } as unknown as ccc.Client;
    await expect(verifyDeployment(client, meta)).rejects.toThrow('Wrong network');
  });
  it('rejects malformed digests', () => { expect(() => deriveLock(meta, '0x12')).toThrow(); });
});
