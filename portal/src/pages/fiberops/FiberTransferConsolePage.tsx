import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useEffect, useMemo, useState } from "react";
import { Boxes, Network, RefreshCw, Route, Send, ShieldCheck } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberErrorMessage, fiberWasmRuntime, type FiberRpcScript } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";
import { fiberRuntimeService } from "../../api/backend";

type ResourceSnapshot = Awaited<ReturnType<typeof fiberWasmRuntime.networkResources>>;
type RouteResult = { router_hops?: unknown[] } & Record<string, unknown>;

function parseScript(codeHash: string, hashType: string, args: string): FiberRpcScript | undefined {
  if (!codeHash.trim() && !args.trim()) return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(codeHash.trim())) throw new Error("Stablecoin code hash must be 32 bytes.");
  if (!/^0x[0-9a-fA-F]*$/.test(args.trim())) throw new Error("Stablecoin type args must be hexadecimal.");
  if (!["data", "type", "data1", "data2"].includes(hashType)) throw new Error("Unsupported script hash type.");
  return { code_hash: codeHash.trim(), hash_type: hashType as FiberRpcScript["hash_type"], args: args.trim() };
}

function parseHops(value: string) {
  const hops = value.split("\n").map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [pubkey, channelOutpoint] = line.split(",").map(item => item.trim());
    if (!pubkey || !channelOutpoint) throw new Error(`Hop ${index + 1} must contain pubkey,channel_outpoint.`);
    return { pubkey, channelOutpoint };
  });
  if (hops.length < 2) throw new Error("A multi-hop route requires at least two hops.");
  return hops;
}

export function FiberTransferConsolePage() {
 const featureConsoleScope = currentScope();

  const runtime = useFiberRuntime();
  const [invoice, setInvoice] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [codeHash, setCodeHash] = useState("");
  const [hashType, setHashType] = useState("type");
  const [args, setArgs] = useState("0x");
  const [hopsText, setHopsText] = useState("");
  const [maxParts, setMaxParts] = useState("4");
  const [maxFee, setMaxFee] = useState("10000");
  const [resources, setResources] = useState<ResourceSnapshot | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("Local runtime");
  const assetScript = useMemo(() => { try { return parseScript(codeHash, hashType, args); } catch { return undefined; } }, [codeHash, hashType, args]);

  useEffect(() => { void scanResources(); }, []);

  async function run(action: () => Promise<unknown>) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'run');
 try {

    setBusy(true); setError("");
    try { const next = await action(); setResult(next); return next; }
    catch (cause) { featureOperation.fail(cause);  setError(fiberErrorMessage(cause)); }
    finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  async function scanResources() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'scanResources');
 try {

    const next = await run(() => fiberWasmRuntime.networkResources());
    if (next) {
      const snapshot = next as ResourceSnapshot;
      setResources(snapshot);
      void fiberRuntimeService.storeResources(snapshot).then(() => setServiceStatus("Synced to FiberOps API")).catch(() => setServiceStatus("Local runtime · API sync unavailable"));
    }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  async function createStablecoinInvoice() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'createStablecoinInvoice');
 try {

    const next = await run(async () => {
      const script = parseScript(codeHash, hashType, args);
      if (!script) throw new Error("Enter the stablecoin xUDT type script.");
      return fiberWasmRuntime.newInvoice({ amountRaw: amount, description: "Stablecoin transfer", expirySeconds: 900, udtTypeScript: script });
    });
    const address = (next as { invoice_address?: string } | undefined)?.invoice_address;
    if (address) setInvoice(address);

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  async function pay(dryRun: boolean) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'pay');
 try {

    if (!invoice.trim()) return setError("Paste a Fiber invoice first.");
    if (!dryRun && !confirm("Send this Fiber payment using the selected fee and MPP limits?")) return;
    await run(() => fiberWasmRuntime.sendPaymentAdvanced({ invoice: invoice.trim(), dryRun, maxParts: Number(maxParts), maxFeeAmountRaw: maxFee, timeoutSeconds: 60 }));
    if (!dryRun) await runtime.refresh();

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  async function buildRoute() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'buildRoute');
 try {

    const script = parseScript(codeHash, hashType, args);
    const next = await run(() => fiberWasmRuntime.buildMultiHopRoute({ amountRaw: amount, hops: parseHops(hopsText), udtTypeScript: script }));
    if (next) setRouteResult(next as RouteResult);

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  async function sendRoute(dryRun: boolean) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'sendRoute');
 try {

    const router = routeResult?.router_hops;
    if (!Array.isArray(router) || !router.length) return setError("Build a valid route first.");
    if (!dryRun && !confirm("Send a keysend payment through this explicit multi-hop route?")) return;
    await run(() => fiberWasmRuntime.sendWithRouter({ router, udtTypeScript: parseScript(codeHash, hashType, args), dryRun }));
    if (!dryRun) await runtime.refresh();

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  return <AppLayout>
    <PageHero eyebrow="Fiber Payments" title="Transfer Console" description="Operate stablecoin payments, MPP and explicit multi-hop routes against the browser Fiber node." actions={<><span className="ops-badge info">{serviceStatus}</span><button className="btn secondary" disabled={busy} onClick={() => void scanResources()}><RefreshCw className={busy ? "spin" : ""} size={16}/> Scan network</button></>} />
    {(error || runtime.error) && <div className="ops-alert critical"><b>Operation unavailable</b><span>{error || runtime.error}</span></div>}
    <div className="ops-kpi-grid">
      <article><Network/><span>Graph nodes</span><strong>{resources?.graphNodes ?? "—"}</strong></article>
      <article><Route/><span>Graph channels</span><strong>{resources?.graphChannels ?? "—"}</strong></article>
      <article><ShieldCheck/><span>Ready local channels</span><strong>{resources?.readyChannels ?? runtime.channelHealth?.healthy ?? "—"}</strong></article>
      <article><Boxes/><span>UDT channels</span><strong>{resources?.udtChannels ?? "—"}</strong></article>
    </div>
    <div className="ops-grid-2">
      <section className="panel ops-panel transfer-console-card">
        <span className="ops-kicker">STABLECOIN / MPP</span><h2>Invoice payment</h2>
        <label className="ops-label">Amount (raw token units)</label><input value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}/>
        <div className="transfer-script-grid"><label>Code hash<input value={codeHash} onChange={e => setCodeHash(e.target.value)} placeholder="0x..."/></label><label>Hash type<select value={hashType} onChange={e => setHashType(e.target.value)}><option>type</option><option>data</option><option>data1</option><option>data2</option></select></label></div>
        <label className="ops-label">Type args</label><input value={args} onChange={e => setArgs(e.target.value)} placeholder="0x..."/>
        <button className="btn secondary" disabled={busy || !assetScript} onClick={() => void createStablecoinInvoice()}>Create stablecoin invoice</button>
        <label className="ops-label">Invoice</label><textarea className="ops-textarea" rows={4} value={invoice} onChange={e => setInvoice(e.target.value)}/>
        <div className="transfer-limits"><label>MPP max parts<input value={maxParts} onChange={e => setMaxParts(e.target.value.replace(/\D/g, ""))}/></label><label>Max fee (raw)<input value={maxFee} onChange={e => setMaxFee(e.target.value.replace(/\D/g, ""))}/></label></div>
        <div className="ops-actions"><button className="btn secondary" disabled={busy || !invoice} onClick={() => void pay(true)}>Dry run</button><button className="btn primary" disabled={busy || !invoice} onClick={() => void pay(false)}><Send size={15}/> Send payment</button></div>
      </section>
      <section className="panel ops-panel transfer-console-card">
        <span className="ops-kicker">EXPLICIT ROUTING</span><h2>Multi-hop transfer</h2>
        <label className="ops-label">Hops, one per line</label><textarea className="ops-textarea mono" rows={9} value={hopsText} onChange={e => setHopsText(e.target.value)} placeholder={"peer_pubkey,channel_outpoint\npeer_pubkey,channel_outpoint"}/>
        <div className="ops-actions"><button className="btn secondary" disabled={busy} onClick={() => void buildRoute()}>Build route</button><button className="btn secondary" disabled={busy || !routeResult} onClick={() => void sendRoute(true)}>Dry run route</button><button className="btn primary" disabled={busy || !routeResult} onClick={() => void sendRoute(false)}><Send size={15}/> Send route</button></div>
        {routeResult && <pre className="rpc-output">{JSON.stringify(routeResult, null, 2)}</pre>}
      </section>
    </div>
    {result !== null && <section className="panel ops-panel"><span className="ops-kicker">LATEST RESULT</span><pre className="rpc-output">{JSON.stringify(result, null, 2)}</pre></section>}
  </AppLayout>;
}
