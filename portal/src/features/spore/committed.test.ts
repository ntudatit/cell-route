import { beforeEach, expect, it, vi } from 'vitest';
import { ccc } from '@ckb-ccc/connector-react';
import * as spore from '@ckb-ccc/spore';
import { Prepared, verifyCommitted } from './lifecycle';
vi.mock('@ckb-ccc/spore', async original => ({ ...await original<typeof spore>(), findSpore: vi.fn() }));
const lock = ccc.Script.from({ codeHash: `0x${'11'.repeat(32)}`, hashType: 'data1', args: '0x' });
const type = ccc.Script.from({ ...lock, args: `0x${'22'.repeat(32)}` });
const before = ccc.Cell.from({ outPoint: { txHash: `0x${'33'.repeat(32)}`, index: 0 }, cellOutput: { capacity: 20000000000n, lock, type }, outputData: '0x1234' });
const tx = ccc.Transaction.from({ inputs: [{ previousOutput: before.outPoint }], outputs: [{ capacity: 19999999000n, lock }], outputsData: ['0x'] });
const p = { tx, rawHash: tx.hash(), operation: 'melt', id: type.args, before, environment: { scripts: { spore: spore.getSporeScriptInfo(new ccc.ClientPublicTestnet()) } }, review: { inputCapacity: '20000000000', feeShannons: '1000' } } as Prepared;
const client = { getTransactionNoCache: vi.fn(), getCellLiveNoCache: vi.fn() } as unknown as ccc.Client;
beforeEach(() => {
  vi.mocked(client.getTransactionNoCache).mockResolvedValue({ transaction: tx, status: 'committed' } as Awaited<ReturnType<ccc.Client['getTransactionNoCache']>>);
  vi.mocked(client.getCellLiveNoCache).mockResolvedValue(undefined);
  vi.mocked(spore.findSpore).mockResolvedValue(undefined);
});
it('requires node commitment, consumed inputs and indexer absence before reporting verified melt', async () => {
  const result = await verifyCommitted(client, p, tx.hash());
  expect(result.status).toBe('committed'); expect(result.review.feeShannons).toBe('1000'); expect(result.outputs).toEqual(tx.outputs);
  expect(client.getCellLiveNoCache).toHaveBeenCalledWith(before.outPoint, false);
});
it('keeps committed node state distinct from a lagging indexer', async () => {
  vi.mocked(spore.findSpore).mockResolvedValue({ cell: before } as Awaited<ReturnType<typeof spore.findSpore>>);
  await expect(verifyCommitted(client, p, tx.hash())).rejects.toThrow('indexer still returns');
});
it('does not accept an unconsumed input or failed capacity reconciliation', async () => {
  vi.mocked(client.getCellLiveNoCache).mockResolvedValue(before);
  await expect(verifyCommitted(client, p, tx.hash())).rejects.toThrow('input still live');
  vi.mocked(client.getCellLiveNoCache).mockResolvedValue(undefined);
  await expect(verifyCommitted(client, { ...p, review: { ...p.review, feeShannons: '999' } }, tx.hash())).rejects.toThrow('Capacity');
});
