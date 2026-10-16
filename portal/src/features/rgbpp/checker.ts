import { ccc } from '@ckb-ccc/core';
import officialSample from './sample.json';
import pins from './pins.json';
export { pins, officialSample };
export type Sample = typeof officialSample;
export class RgbppError extends Error {}
export interface Check { field: string; expected: string; actual: string; status: 'match' | 'mismatch' }
export const hex = (value: Uint8Array) => ccc.hexFrom(value).slice(2);
export function bytes(value: string, length?: number) {
  if (typeof value !== 'string' || !/^(?:0x)?(?:[0-9a-f]{2})*$/i.test(value) || value.length > 524290) throw new RgbppError('Invalid or oversized hexadecimal data.');
  const result = ccc.bytesFrom(value.startsWith('0x') ? value : `0x${value}`);
  if (length !== undefined && result.length !== length) throw new RgbppError(`Expected ${length} bytes.`);
  return new Uint8Array(result);
}
function uint32(n: number) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) throw new RgbppError('Expected uint32.');
  const result = new Uint8Array(4); new DataView(result.buffer).setUint32(0, n, true); return result;
}
export function decodeBinding(args: string) {
  const value = bytes(args, 36);
  return { vout: new DataView(value.buffer, value.byteOffset, 4).getUint32(0, true), txid: hex(value.slice(4).reverse()) };
}
export function encodeBinding(txid: string, vout: number) { return `0x${hex(uint32(vout))}${hex(bytes(txid, 32).slice().reverse())}`; }
function concat(parts: Uint8Array[]) {
  const size = parts.reduce((n, p) => n + p.length, 0);
  if (size > 1048576) throw new RgbppError('Commitment preimage exceeds 1 MiB.');
  const result = new Uint8Array(size); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
}
export async function hash256(value: Uint8Array) {
  const first = await crypto.subtle.digest('SHA-256', new Uint8Array(value));
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', first)));
}
// Pinned SDK algorithm hashes outpoints (not since), outputs and length-prefixed data.
// Accepts a full virtual prefix, not an arbitrary live transaction or leap.
export async function commitment(transaction: Sample['virtual']['transaction']) {
  if (!transaction || !Array.isArray(transaction.inputs) || !Array.isArray(transaction.outputs) || !Array.isArray(transaction.outputsData)) throw new RgbppError('Missing virtual transaction arrays.');
  const { inputs, outputs, outputsData } = transaction;
  if (!inputs.length || inputs.length > 255 || !outputs.length || outputs.length > 255 || outputs.length !== outputsData.length) throw new RgbppError('Expected 1-255 inputs/outputs and matching data count.');
  const parts: Uint8Array[] = [new TextEncoder().encode('RGB++'), new Uint8Array([0, 0, inputs.length, outputs.length])];
  for (const input of inputs) parts.push(ccc.OutPoint.from(input.previousOutput).toBytes());
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i];
    if (output.lock.codeHash !== pins.network.rgbppLock.codeHash || output.lock.hashType !== 'type') throw new RgbppError('Only RGB++ Testnet3 virtual outputs supported; time locks/leaps are unsupported.');
    if (decodeBinding(output.lock.args).txid !== '00'.repeat(32)) throw new RgbppError('Expected zero-txid virtual placeholders.');
    const data = bytes(outputsData[i]);
    parts.push(ccc.CellOutput.from(output).toBytes(), uint32(data.length), data);
  }
  return hash256(concat(parts));
}
// Bounded legacy unsigned transaction decoder for the official PSBT snapshot.
// No signature, Bitcoin script, witness or SPV verification is performed.
export function decodeUnsignedBitcoin(raw: string) {
  const data = bytes(raw); let pos = 0;
  function take(n: number) { if (pos + n > data.length) throw new RgbppError('Truncated Bitcoin transaction.'); const part = data.slice(pos, pos + n); pos += n; return part; }
  function compact() {
    const prefix = take(1)[0]; if (prefix < 253) return prefix;
    if (prefix === 253) { const b = take(2); const n = b[0] + b[1] * 256; if (n < 253) throw new RgbppError('Noncanonical CompactSize.'); return n; }
    throw new RgbppError('Oversized CompactSize unsupported.');
  }
  take(4); const inputCount = compact();
  if (!inputCount || inputCount > 255) throw new RgbppError('Only bounded legacy unsigned transactions supported.');
  const inputs = Array.from({ length: inputCount }, () => {
    const txid = hex(take(32).reverse()); const b = take(4); const vout = new DataView(b.buffer).getUint32(0, true);
    if (compact() !== 0) throw new RgbppError('Expected empty unsigned input scripts.'); take(4); return { txid, vout };
  });
  const outputCount = compact(); if (!outputCount || outputCount > 255) throw new RgbppError('Invalid output count.');
  const outputs = Array.from({ length: outputCount }, () => { take(8); return { script: hex(take(compact())) }; });
  take(4); if (pos !== data.length) throw new RgbppError('Trailing bytes or witness encoding unsupported.');
  return { inputs, outputs };
}
export function parseSample(text: string): Sample {
  if (new TextEncoder().encode(text).length > 262144) throw new RgbppError('Fixture exceeds 256 KiB.');
  let value: Sample; try { value = JSON.parse(text); } catch { throw new RgbppError('Invalid fixture JSON.'); }
  if (!value || value.schema !== 'cellroute-rgbpp-v1' || !value.network || !value.bitcoin || !value.ckb?.output?.lock || !value.ckb.outPoint || !value.virtual?.transaction) throw new RgbppError('Unsupported fixture schema.');
  bytes(value.bitcoin.txid, 32); uint32(value.bitcoin.vout); bytes(value.ckb.outPoint.txHash, 32); uint32(Number(value.ckb.outPoint.index));
  return value;
}
export async function checkSample(value: Sample) {
  const sample = parseSample(JSON.stringify(value)); const checks: Check[] = [];
  function check(field: string, expected: unknown, actual: unknown) { checks.push({ field, expected: String(expected), actual: String(actual), status: expected === actual ? 'match' : 'mismatch' }); }
  check('Network pair', 'testnet3/testnet', `${sample.network.bitcoin}/${sample.network.ckb}`);
  const lock = sample.ckb.output.lock;
  check('RGB++ lock code hash', pins.network.rgbppLock.codeHash, lock.codeHash); check('RGB++ lock hash type', 'type', lock.hashType);
  const binding = decodeBinding(lock.args);
  check('Bitcoin txid (display order)', sample.bitcoin.txid.toLowerCase(), binding.txid); check('Bitcoin output index', sample.bitcoin.vout, binding.vout);
  const btc = decodeUnsignedBitcoin(sample.virtual.bitcoinUnsignedTx);
  check('Unsigned Bitcoin transaction spends selected seal', true, btc.inputs.some(i => i.txid === binding.txid && i.vout === binding.vout));
  check('Virtual output indexes select spendable-script Bitcoin outputs', true, sample.virtual.transaction.outputs.every(output => { const index = decodeBinding(output.lock.args).vout; return Boolean(btc.outputs[index]) && !btc.outputs[index].script.startsWith('6a'); }));
  check('Virtual CKB transaction consumes selected Cell', true, sample.virtual.transaction.inputs.some(i => i.previousOutput.txHash === sample.ckb.outPoint.txHash && BigInt(i.previousOutput.index) === BigInt(sample.ckb.outPoint.index)));
  const computed = await commitment(sample.virtual.transaction);
  check('Virtual commitment vs upstream expected value', hex(bytes(sample.virtual.expectedCommitment, 32)), computed);
  const returns = btc.outputs.filter(o => o.script.startsWith('6a'));
  check('Exactly one OP_RETURN', 1, returns.length);
  check('Bitcoin OP_RETURN commitment (OP_RETURN PUSH32)', `6a20${computed}`, returns[0]?.script ?? 'missing');
  return { profile: pins.profile, layer: 'Offline fixture linkage and commitment checks', status: checks.every(c => c.status === 'match') ? 'matched' : 'mismatch', checks, binding, computedCommitment: computed,
    proof: { status: 'not verified' as const, reason: pins.spv.reason }, unchecked: ['Full typed-input coverage', 'Token conservation', 'Signatures and lock execution', 'Bitcoin header/SPV verification'], transfer: 'not performed', provenance: sample.provenance };
}



