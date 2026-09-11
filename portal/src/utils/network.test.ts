import { describe, expect, it, vi, afterEach } from 'vitest';
import { ccc } from '@ckb-ccc/connector-react';
import { assertMainnet, MAINNET_GENESIS, clientNetwork, createClient, explorerUrl, parseCapacity, parseFeeRate, parseNetwork } from './network';
import { recordSubmittedTransaction } from './submission';
import { backendApi } from '../api/backend';
const mainnet = createClient('mainnet');
const request = { txHash: '0x' + '11'.repeat(32), walletAddress: 'ckb1example', direction: 'SEND' as const };
afterEach(() => vi.restoreAllMocks());
describe('network isolation', () => {
 it('creates distinct mainnet, testnet and devnet clients', () => {
  expect(mainnet.addressPrefix).toBe('ckb');
  expect(clientNetwork(createClient('testnet'))).toBe('testnet');
  expect(clientNetwork(createClient('devnet'))).toBe('devnet');
  expect(parseNetwork(' MAINNET ')).toBe('mainnet');
  expect(() => parseNetwork('mainent')).toThrow();
 });
 it('uses network-specific explorer links', () => {
  expect(explorerUrl('mainnet', request.txHash)).toBe(`https://explorer.nervos.org/transaction/${request.txHash}`);
  expect(explorerUrl('testnet')).toContain('pudge');
  expect(explorerUrl('devnet')).toBeUndefined();
 });
 it('rejects a testnet recipient on mainnet', async () => {
  const script = ccc.Script.from({ codeHash: '0x' + '11'.repeat(32), hashType: 'type', args: '0x' + '22'.repeat(20) });
  const address = (await ccc.Address.fromScript(script, createClient('testnet'))).toString();
  await expect(ccc.Address.fromString(address, mainnet)).rejects.toThrow();
 });
 it('does not record a mainnet transaction in a testnet backend', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockResolvedValue({ network: 'testnet', rpcUrl: '' });
  const track = vi.spyOn(backendApi, 'trackTransaction');
  expect(await recordSubmittedTransaction(mainnet, request)).toContain('another network');
  expect(track).not.toHaveBeenCalled();
 });
 it('preserves submitted status when the backend fails', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockRejectedValue(new Error('offline'));
  expect(await recordSubmittedTransaction(mainnet, request)).toContain('Submitted on-chain');
 });
 it('records only on the matching backend', async () => {
  vi.spyOn(backendApi, 'getNetwork').mockResolvedValue({ network: 'mainnet', rpcUrl: '' });
  const track = vi.spyOn(backendApi, 'trackTransaction').mockResolvedValue({} as never);
  await recordSubmittedTransaction(mainnet, request);
  expect(track).toHaveBeenCalledWith(request);
 });
});
describe('transfer amounts and fees', () => {
 it('preserves all eight decimals without float rounding', () => expect(parseCapacity('123.12345678')).toBe(12312345678n));
 it.each(['-1', '0', 'NaN', '1e3', '1.123456789', ''])('rejects invalid amount %s', value => expect(() => parseCapacity(value)).toThrow());
 it.each(['-1', 'Infinity', '1000.5', '999', '100001'])('rejects invalid fee %s', value => expect(() => parseFeeRate(value)).toThrow());
 it('accepts the supported fee range', () => { expect(parseFeeRate('1000')).toBe(1000); expect(parseFeeRate('100000')).toBe(100000); });
});

it('blocks broadcast when a mainnet RPC points to another genesis', async () => {
 const client = { getBlockByNumber: vi.fn().mockResolvedValue({ header: { hash: '0xwrong' } }) };
 await expect(assertMainnet(client as unknown as ccc.Client)).rejects.toThrow('not CKB Mainnet');
 client.getBlockByNumber.mockResolvedValue({ header: { hash: MAINNET_GENESIS } });
 await expect(assertMainnet(client as unknown as ccc.Client)).resolves.toBeUndefined();
});
