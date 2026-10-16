import { describe, expect, it } from 'vitest';
import { checkSample, commitment, decodeBinding, encodeBinding, officialSample, parseSample } from './checker';
import { confirmationState, observe, request } from './observer';
const clone = () => structuredClone(officialSample);
describe('RGB++ pinned fixture checker', () => {
  it('reproduces official binding, unsigned input link and commitment', async () => {
    const result = await checkSample(clone()); expect(result.status).toBe('matched');
    expect(result.computedCommitment).toBe('e2614965809a619bfa47b36631c3896fca24780336a8d524930dd61ef4e67d11');
    expect(result.proof.status).toBe('not verified');
  });
  it('encodes index little endian and reverses display txid', () => {
    const txid = '0123456789abcdef'.repeat(4); const args = encodeBinding(txid, 258);
    expect(args.slice(2, 10)).toBe('02010000'); expect(decodeBinding(args)).toEqual({ txid, vout: 258 });
    expect(() => decodeBinding('0x00')).toThrow(); expect(() => encodeBinding(txid, -1)).toThrow();
  });
  it.each(['vout', 'txid', 'network', 'commitment', 'data', 'outpoint'] as const)('detects changed %s', async field => {
    const sample = clone();
    if (field === 'vout') sample.bitcoin.vout = 1;
    if (field === 'txid') sample.bitcoin.txid = '11'.repeat(32);
    if (field === 'network') sample.network.bitcoin = 'mainnet';
    if (field === 'commitment') sample.virtual.expectedCommitment = '11'.repeat(32);
    if (field === 'data') sample.virtual.transaction.outputsData[0] = '0x01';
    if (field === 'outpoint') sample.ckb.outPoint.txHash = '0x' + '11'.repeat(32);
    expect((await checkSample(sample)).status).toBe('mismatch');
  });
  it('rejects unsupported live placeholders and malformed/oversized input', async () => {
    const sample = clone(); sample.virtual.transaction.outputs[0].lock.args = encodeBinding('11'.repeat(32), 1);
    await expect(commitment(sample.virtual.transaction)).rejects.toThrow('placeholders');
    expect(() => parseSample('x'.repeat(262145))).toThrow(); expect(() => parseSample('{}')).toThrow();
  });
  it('does not trust an injected proof label', async () => {
    const sample = { ...clone(), proof: { status: 'verified' } }; expect((await checkSample(sample)).proof.status).toBe('not verified');
  });
  it('keeps API outages unknown on both chains', async () => {
    const fetcher = (async () => new Response('', { status: 503 })) as typeof fetch;
    const result = await observe(clone(), { fetcher }); expect(result.bitcoin.state).toBe('unknown'); expect(result.ckb.state).toBe('unknown'); expect(result.crossChainComplete).toBe(false);
  });
  it('rejects mixed-network fixtures before reading APIs', async () => {
    const sample = clone(); sample.network.ckb = 'mainnet'; let calls = 0;
    await expect(observe(sample, { fetcher: (async () => { calls++; throw Error(); }) as typeof fetch })).rejects.toThrow('mismatches'); expect(calls).toBe(0);
  });
  it('downgrades reorgs, changing tips and pending confirmations', () => {
    expect(confirmationState(true, true, 100, 106, true).state).toBe('observed threshold reached');
    expect(confirmationState(true, false, 100, 106, true).state).toBe('reorg-detected');
    expect(confirmationState(true, true, 100, 106, false).state).toBe('unknown');
    expect(confirmationState(false, true, 0, 106, true).state).toBe('pending');
    expect(confirmationState(true, true, 106, 106, true).state).toBe('pending confirmations');
  });
  it('bounds slow and oversized API responses', async () => {
    await expect(request('https://unused', {}, { fetcher: (async () => new Response('x'.repeat(1048577))) as typeof fetch })).rejects.toThrow('1 MiB');
    const fetcher = ((_url: unknown, options: RequestInit) => new Promise<Response>((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(options.signal?.reason)))) as typeof fetch;
    await expect(request('https://unused', {}, { fetcher, timeoutMs: 5 })).rejects.toThrow('timeout');
  });
});
