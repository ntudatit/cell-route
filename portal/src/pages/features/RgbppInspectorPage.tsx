import { LiveAssetInspector } from '../../features/rgbpp/LiveAssetInspector';
import { useEffect, useRef, useState } from 'react';
import { AppLayout, PageHero } from '../../components/layout/AppLayout';
import { checkSample, officialSample, parseSample, pins } from '../../features/rgbpp/checker';
import { observe } from '../../features/rgbpp/observer';
import { traceCall } from '../../dev-console/store';
import { currentScope } from '../../dev-console/features';
import './rgbpp.css';

type Linkage = Awaited<ReturnType<typeof checkSample>>;
type Observation = Awaited<ReturnType<typeof observe>>;
export function RgbppInspectorPage() { const [fixture,setFixture]=useState(false); return fixture?<RgbppFixtureLab onLive={()=>setFixture(false)}/>:<LiveAssetInspector onFixture={()=>setFixture(true)}/>; }
function RgbppFixtureLab({onLive}:{onLive:()=>void}) {
  const [text, setText] = useState(JSON.stringify(officialSample, null, 2));
  const [linkage, setLinkage] = useState<Linkage>();
  const [observation, setObservation] = useState<Observation>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  function reset(value: string) {
    controller.current?.abort(); setText(value); setLinkage(undefined); setObservation(undefined); setError(''); setBusy(false);
  }
  async function run(live: boolean) {
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    setBusy(true); setError(''); setObservation(undefined); if (!live) setLinkage(undefined);
    try {
      const sample = parseSample(text);
      if (live) {
        const receipt = await traceCall(currentScope(), 'api', 'RGBPP.observe', () => observe(sample, { signal: active.signal }));
        if (!active.signal.aborted) setObservation(receipt);
      } else {
        const receipt = await traceCall(currentScope(), 'action', 'RGBPP.checkFixture', () => checkSample(sample));
        if (!active.signal.aborted) setLinkage(receipt);
      }
    } catch (cause) {
      if (!active.signal.aborted) setError(cause instanceof Error ? cause.message : 'Check failed.');
    } finally { if (controller.current === active) setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ pins, sample: parseSample(text), linkage, observation }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'rgbpp-inspection.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <AppLayout>
    <PageHero eyebrow="Bitcoin / CKB tools" title="RGB++ Inspector" description="Inspect Bitcoin Testnet3 UTXO bindings and CKB Testnet Cells, with explicit evidence boundaries." />
    <section className="panel product-form rgbpp-panel">
      <div className="rgbpp-banner"><strong>Read-only · Proof: not verified · Transfer: not performed</strong><p>Matching binding and commitment bytes is not full protocol validation. Public API observations do not independently verify Bitcoin headers or SPV proofs.</p></div>
      <div className="rgbpp-flow" aria-label="RGB++ inspection flow"><span>Bitcoin UTXO / single-use seal</span><span aria-hidden="true">↔</span><span>CKB Cell lock args</span><span aria-hidden="true">→</span><span>Virtual transaction commitment</span><span aria-hidden="true">→</span><span>Separate chain observations</span></div>
      <button className="btn secondary" onClick={onLive}>Back to live asset lookup</button><h2>Official public sample</h2>
      <p>Projection of the upstream SDK's mocked historical Cells and unsigned transaction snapshot. It is not a transfer submitted by this app. Wallet network in the header is independent; this tool is fixed to <strong>Bitcoin Testnet3 + CKB Testnet</strong>.</p>
      <dl className="rgbpp-identities"><dt>Bitcoin seal</dt><dd><code>{officialSample.bitcoin.txid}:{officialSample.bitcoin.vout}</code></dd><dt>CKB OutPoint</dt><dd><code>{officialSample.ckb.outPoint.txHash}:{officialSample.ckb.outPoint.index}</code></dd><dt>RGB++ lock code hash</dt><dd><code>{pins.network.rgbppLock.codeHash}</code></dd><dt>Source revision</dt><dd><code>{officialSample.provenance.commit}</code></dd></dl>
      <details><summary>Edit public fixture JSON</summary><p>Editing invalidates earlier results. Only this profile's virtual RGB++ transfer prefix is supported; time locks and leaps are unsupported.</p><label htmlFor="rgbpp-fixture">Public fixture JSON</label><textarea id="rgbpp-fixture" spellCheck={false} value={text} onChange={event => reset(event.target.value)} rows={16} /></details>
      <div className="rgbpp-actions"><button className="btn secondary" disabled={busy} onClick={() => reset(JSON.stringify(officialSample, null, 2))}>Load official sample</button><button className="btn primary" disabled={busy} onClick={() => void run(false)}>Check binding and commitment</button><button className="btn secondary" disabled={busy || linkage?.status !== 'matched'} onClick={() => void run(true)}>Refresh chain observations</button><button className="btn secondary" disabled={!busy} onClick={() => { controller.current?.abort(); setBusy(false); }}>Cancel</button></div>
      {busy && <p role="status">Reading bounded requests…</p>}
      {error && <p role="alert">{error}</p>}
      {linkage && <section aria-label="Linkage results"><h2>Linkage: {linkage.status}</h2><p>Offline checks on the selected fixture. No proof was verified.</p><div className="rgbpp-table"><table><thead><tr><th>Check / source field</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>{linkage.checks.map(check => <tr key={check.field}><td>{check.field}</td><td><code>{check.expected}</code></td><td><code>{check.actual}</code></td><td>{check.status}</td></tr>)}</tbody></table></div></section>}
      {observation && <section aria-label="Chain observations"><h2>Chain observations</h2><p>Observed at {observation.observedAt}. Separate sequential reads; refresh replaces old results. No cross-chain completion is asserted.</p><div className="rgbpp-chains"><div><h3>Bitcoin Testnet3</h3><pre>{JSON.stringify(observation.bitcoin, null, 2)}</pre></div><div><h3>CKB Testnet</h3><pre>{JSON.stringify(observation.ckb, null, 2)}</pre></div></div><p>Bitcoin policy: {pins.confirmationPolicy.bitcoin} confirmations, an observational threshold from the pinned SDK configuration, not irreversible finality. A spent output or historical committed transaction does not prove current ownership or spendability.</p><details><summary>Public raw API receipts</summary><pre>{JSON.stringify(observation.raw, null, 2)}</pre></details></section>}
      {linkage && <button className="btn secondary" disabled={busy} onClick={download}>Export public receipt</button>}
    </section>
  </AppLayout>;
}

