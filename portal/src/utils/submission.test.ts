import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetApi, backendApi, type CreateAssetEventRequest } from '../api/backend';
import { createClient } from './network';
import { recordSubmittedAsset, requireBackendNetwork } from './submission';
const client = createClient('mainnet');
const event: CreateAssetEventRequest = { assetKind: 'SPORE', action: 'MINT', assetId: 'id', ownerAddress: 'ckb1example', txHash: '0x' + '11'.repeat(32) };
afterEach(() => vi.restoreAllMocks());
describe('asset audit isolation', () => {
 it('never records mainnet assets against another backend network', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockResolvedValue({ network: 'testnet', rpcUrl: '' });
  const record = vi.spyOn(assetApi, 'record');
  await expect(requireBackendNetwork(client)).rejects.toThrow('another network');
  expect(await recordSubmittedAsset(client, event)).toContain('Transaction submitted. Asset audit not recorded');
  expect(record).not.toHaveBeenCalled();
 });
 it('reports submission separately from a failed audit write', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockResolvedValue({ network: 'mainnet', rpcUrl: '' });
  vi.spyOn(assetApi, 'record').mockRejectedValue(new Error('unauthenticated'));
  const status = await recordSubmittedAsset(client, event);
  expect(status).toContain('Transaction submitted. Asset audit recording failed');
  expect(status).not.toContain('audit recorded');
 });
 it('preserves submission when the network check is unavailable', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockRejectedValue(new Error('offline'));
  const record = vi.spyOn(assetApi, 'record');
  expect(await recordSubmittedAsset(client, event)).toContain('Transaction submitted. Asset audit not recorded');
  expect(record).not.toHaveBeenCalled();
 });
 it('records on the matching chain without claiming commitment', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockResolvedValue({ network: 'mainnet', rpcUrl: '' });
  const record = vi.spyOn(assetApi, 'record').mockResolvedValue({} as never);
  expect(await recordSubmittedAsset(client, event)).toBe('Transaction submitted and asset audit recorded. Check the on-chain status below for commitment.');
  expect(record).toHaveBeenCalledWith(event);
 });
});
