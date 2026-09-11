import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentScope, scopeFor, setLogNetwork } from './features';
import { beginOperation, clearLogs, exportLogs, instrument, LOG_LIMIT, SCOPE_LIMIT, snapshot, traceCall } from './store';
const scope = scopeFor('/simple-lock', '', 'testnet');
afterEach(() => { clearLogs(scope.key); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('feature developer logs', () => {
 it('isolates features, Fiber tools and networks', () => {
  const other = scopeFor('/wallet', '', 'mainnet'); clearLogs(other.key);
  beginOperation(scope, 'action', 'derive').complete();
  expect(snapshot(other.key)).toHaveLength(0);
  expect(scopeFor('/simple-lock', '', 'mainnet').key).not.toBe(scope.key);
  expect(scopeFor('/fiber-ops', '#channels', 'testnet').key).not.toBe(scopeFor('/fiber-ops', '#incidents', 'testnet').key);
  expect(scopeFor('/transactions', '', 'testnet').feature).toBe('/activity-log');
 });
 it('keeps pending work in its originating scope after navigation', async () => {
  vi.stubGlobal('location', { pathname: '/simple-lock', hash: '' }); setLogNetwork('testnet');
  let resolve!: (value: string) => void;
  const api = instrument({ load: () => new Promise<string>(done => { resolve = done; }) }, 'api', 'API');
  const result = api.load();
  vi.stubGlobal('location', { pathname: '/wallet', hash: '' }); clearLogs(currentScope().key);
  resolve('private response'); expect(await result).toBe('private response');
  expect(snapshot(scope.key).map(e => e.phase)).toEqual(['start', 'complete']);
  expect(snapshot(currentScope().key)).toHaveLength(0);
 });
 it('preserves method receivers, return values and replaced methods', async () => {
  class Client { #value = 7; async load(_secret: string) { return this.#value; } }
  const client = instrument(new Client(), 'ckb', 'CKB', scope);
  expect(await client.load('private input')).toBe(7);
  const spy = vi.spyOn(client, 'load').mockResolvedValue(9);
  expect(await client.load('private input')).toBe(9); expect(spy).toHaveBeenCalledOnce();
 });
 it('exports safe error codes and public hashes without inputs or raw payloads', async () => {
  const secret = 'seed-preimage-bearer-signature-secret';
  const error = Object.assign(new Error(secret), { code: -42, response: secret });
  const api = instrument({ async fail(_arg: string) { throw error; }, async sendTransaction(_arg: string) { return '0x' + 'a'.repeat(64); }, async body() { return { token: secret }; } }, 'api', 'API', scope);
  await expect(api.fail(secret)).rejects.toBe(error); await api.sendTransaction(secret); await api.body();
  const output = exportLogs(scope); expect(output).not.toContain(secret); expect(output).toContain('"code":-42'); expect(output).toContain('"txHash":"0x');
  expect(snapshot(scope.key).filter(e => e.phase === 'error')).toHaveLength(1);
 });
 it('preserves async iteration and closes a cancelled iterator', async () => {
  let closed = false;
  async function* items() { try { yield 1; yield 2; } finally { closed = true; } }
  const result = traceCall(scope, 'ckb', 'findCells', items);
  for await (const item of result) { expect(item).toBe(1); break; }
  expect(closed).toBe(true); expect(snapshot(scope.key).at(-1)?.phase).toBe('cancelled');
 });
 it('logs iterator errors and synchronous errors without changing them', async () => {
  const error = new Error('secret');
  async function* items() { yield 1; throw error; }
  await expect((async () => { for await (const _ of traceCall(scope, 'ckb', 'findCells', items)) { /* consume */ } })()).rejects.toBe(error);
  expect(() => traceCall(scope, 'action', 'validate', () => { throw error; })).toThrow(error);
  expect(snapshot(scope.key).filter(e => e.phase === 'error')).toHaveLength(2);
 });
 it('bounds retained events and suppresses cleared or evicted pending completions', () => {
  for (let i = 0; i < LOG_LIMIT; i++) beginOperation(scope, 'action', 'derive').complete();
  expect(snapshot(scope.key)).toHaveLength(LOG_LIMIT);
  const pending = beginOperation(scope, 'api', 'pending'); clearLogs(scope.key); pending.complete();
  expect(snapshot(scope.key)).toHaveLength(0);
  const evicted = beginOperation(scope, 'api', 'evicted');
  for (let i = 0; i < SCOPE_LIMIT; i++) clearLogs('temporary:' + i);
  evicted.complete(); expect(snapshot(scope.key)).toHaveLength(0);
 });
});
