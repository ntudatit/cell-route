import { useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Network, RefreshCw, Route, Send } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberErrorMessage, fiberWasmRuntime } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";

const LAB_INVOICE_KEY = "fiberops.two-node-lab.invoice.v1";
const RELAY_A = "/dns4/thrall.fiber.channel/tcp/443/wss/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy";
const RELAY_B = "/dns4/onyxia.fiber.channel/tcp/443/wss/p2p/QmdyQWjPtbK4NWWsvy8s69NGJaQULwgeQDT5ZpNDrTNaeV";
type SharedInvoice = { invoice: string; paymentHash: string; nodePubkey: string; createdAt: string };

export function FiberTwoNodeLabPage() {
  const runtime = useFiberRuntime();
  const profile = fiberWasmRuntime.profile === "b" ? "B" : "A";
  const [relay, setRelay] = useState(profile === "A" ? RELAY_A : RELAY_B);
  const [amount, setAmount] = useState("100000000");
  const [invoice, setInvoice] = useState<SharedInvoice | null>(() => { try { return JSON.parse(localStorage.getItem(LAB_INVOICE_KEY) || "null"); } catch { return null; } });
  const [trampoline, setTrampoline] = useState("");
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [verification, setVerification] = useState<Record<string, unknown> | null>(null);
  const [resources, setResources] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const receive = (event: StorageEvent) => { if (event.key === LAB_INVOICE_KEY && event.newValue) setInvoice(JSON.parse(event.newValue)); };
    window.addEventListener("storage", receive); return () => window.removeEventListener("storage", receive);
  }, []);

  async function execute(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { return await action(); } catch (cause) { setError(fiberErrorMessage(cause)); return undefined; } finally { setBusy(false); }
  }

  async function connectRelay() { await execute(() => fiberWasmRuntime.connectPeer({ address: relay.trim() })); await runtime.refresh(); }
  async function scanGossip() { const value = await execute(() => fiberWasmRuntime.networkResources()); if (value) setResources(value as Record<string, unknown>); }
  async function createInvoice() {
    const value = await execute(() => fiberWasmRuntime.newInvoice({ amountRaw: amount, description: "Two-node routing lab", expirySeconds: 1800 })) as Record<string, any> | undefined;
    if (!value?.invoice_address) return;
    const shared = { invoice: String(value.invoice_address), paymentHash: String(fiberWasmRuntime.extractPaymentHash(value) ?? ""), nodePubkey: String(runtime.node?.pubkey ?? ""), createdAt: new Date().toISOString() };
    localStorage.setItem(LAB_INVOICE_KEY, JSON.stringify(shared)); setInvoice(shared);
  }
  async function sendPayment(dryRun: boolean) {
    if (!invoice) return;
    if (!dryRun && !confirm("Send Node A payment to the invoice created by Node B?")) return;
    const trampolineHops = trampoline.split(/[,\s]+/).filter(Boolean);
    const value = await execute(() => fiberWasmRuntime.sendPaymentAdvanced({ invoice: invoice.invoice, dryRun, maxParts: trampolineHops.length > 1 ? 1 : 4, maxFeeAmountRaw: "100000000", timeoutSeconds: 90, trampolineHops }));
    if (value) setPayment(value as Record<string, unknown>);
  }
  async function verify() {
    if (!invoice?.paymentHash) return;
    const value = await execute(() => profile === "B" ? fiberWasmRuntime.getInvoice(invoice.paymentHash) : fiberWasmRuntime.getPayment(invoice.paymentHash));
    if (value) setVerification(value as Record<string, unknown>);
  }

  return <AppLayout><div className="fiber-lab-page">
    <PageHero eyebrow="Fiber Integration Lab" title={`Local Node ${profile}`} description="Build Node A → Relay 1 → Relay 2 → Node B with independent browser identities, public channels and gossip routing." actions={<><a className="btn secondary" href="/fiber-lab?node=a" target="_blank"><ExternalLink size={15}/> Open A</a><a className="btn secondary" href="/fiber-lab?node=b" target="_blank"><ExternalLink size={15}/> Open B</a></>} />
    {error && <div className="ops-alert critical"><b>Fiber operation failed</b><span>{error}</span></div>}
    <div className="ops-kpi-grid"><article><Network/><span>Profile</span><strong>{profile}</strong></article><article><CheckCircle2/><span>Node</span><strong>{runtime.node ? "Online" : "Starting"}</strong></article><article><Route/><span>Peers</span><strong>{runtime.peers.length}</strong></article><article><Route/><span>Channels</span><strong>{runtime.channels.length}</strong></article></div>
    <section className="panel ops-panel"><span className="ops-kicker">1–3 · CONNECTIVITY & PUBLIC CAPACITY</span><h2>{profile === "A" ? "Node A → Relay 1" : "Relay 2 → Node B"}</h2><label className="ops-label">{profile === "A" ? "Relay 1" : "Relay 2"} WSS multi-address</label><div className="ops-inline"><input value={relay} onChange={e => setRelay(e.target.value)}/><button className="btn primary" disabled={busy || !relay} onClick={() => void connectRelay()}>Connect relay</button></div><div className="ops-actions"><a className="btn secondary" href={`/fiber-node?node=${profile.toLowerCase()}`}>Open/fund public channel</a><button className="btn secondary" disabled={busy} onClick={() => void scanGossip()}><RefreshCw size={15}/> Verify public gossip graph</button></div>{resources && <pre className="rpc-output">{JSON.stringify(resources, null, 2)}</pre>}</section>
    {profile === "B" ? <section className="panel ops-panel"><span className="ops-kicker">4 · NODE B</span><h2>Create recipient invoice</h2><label className="ops-label">Amount (raw units)</label><input value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}/><button className="btn primary" disabled={busy || !amount} onClick={() => void createInvoice()}>Create MPP / trampoline invoice</button>{invoice && <div className="fiber-result"><textarea readOnly value={invoice.invoice}/><button className="btn secondary" onClick={() => void navigator.clipboard.writeText(invoice.invoice)}><Copy size={14}/> Copy</button></div>}</section> : <section className="panel ops-panel"><span className="ops-kicker">5 · NODE A</span><h2>Route and send payment</h2><label className="ops-label">Node B invoice</label><textarea className="ops-textarea" value={invoice?.invoice ?? ""} onChange={e => setInvoice({ invoice: e.target.value, paymentHash: invoice?.paymentHash ?? "", nodePubkey: invoice?.nodePubkey ?? "", createdAt: new Date().toISOString() })}/><label className="ops-label">Trampoline pubkeys (optional, max 5, comma separated)</label><input value={trampoline} onChange={e => setTrampoline(e.target.value)} placeholder="relay_1_pubkey, relay_2_pubkey"/><div className="ops-actions"><button className="btn secondary" disabled={busy || !invoice?.invoice} onClick={() => void sendPayment(true)}>Dry-run gossip route</button><button className="btn primary" disabled={busy || !invoice?.invoice} onClick={() => void sendPayment(false)}><Send size={15}/> Send payment</button></div>{payment && <pre className="rpc-output">{JSON.stringify(payment, null, 2)}</pre>}</section>}
    <section className="panel ops-panel"><span className="ops-kicker">VERIFY</span><h2>{profile === "B" ? "Invoice settlement" : "Payment session"}</h2><button className="btn secondary" disabled={busy || !invoice?.paymentHash} onClick={() => void verify()}>Refresh verification</button>{verification && <pre className="rpc-output">{JSON.stringify(verification, null, 2)}</pre>}</section>
  </div></AppLayout>;
}
