import { useEffect, useState } from "react";
import { CheckCircle2, GitCompareArrows, HeartPulse, RefreshCw, Route, Search, ShieldAlert, Siren, XCircle } from "lucide-react";
import { fiberOpsApi, type FiberIncident, type PaymentReadiness, type ReconciliationResult } from "../../api/backend";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";

type Tool = "readiness" | "channels" | "reconciliation" | "incidents";
const tools: Array<{ id: Tool; label: string; icon: typeof Route }> = [
  { id: "readiness", label: "Payment Readiness", icon: Route },
  { id: "channels", label: "Channel Health", icon: HeartPulse },
  { id: "reconciliation", label: "Reconciliation", icon: GitCompareArrows },
  { id: "incidents", label: "Incidents", icon: Siren },
];
const short = (value?: string | null) => !value ? "—" : value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-7)}` : value;

export function FiberOpsWorkspace() {
  const initial = location.hash.slice(1) as Tool;
  const [active, setActive] = useState<Tool>(tools.some(tool => tool.id === initial) ? initial : "readiness");
  useEffect(() => { const sync = () => { const next = location.hash.slice(1) as Tool; if (tools.some(tool => tool.id === next)) setActive(next); }; addEventListener("hashchange", sync); return () => removeEventListener("hashchange", sync); }, []);
  function select(tool: Tool) { setActive(tool); history.replaceState({}, "", `#${tool}`); document.querySelector("#ops-workspace")?.scrollIntoView({ behavior: "smooth" }); }
  return <section className="ops-workspace" id="ops-workspace">
    <div className="ops-workspace-tabs" role="tablist">{tools.map(({ id, label, icon: Icon }) => <button role="tab" aria-selected={active === id} className={active === id ? "active" : ""} key={id} onClick={() => select(id)}><Icon size={15}/>{label}</button>)}</div>
    {active === "readiness" && <ReadinessTool/>}
    {active === "channels" && <ChannelsTool/>}
    {active === "reconciliation" && <ReconciliationTool/>}
    {active === "incidents" && <IncidentsTool/>}
  </section>;
}

function ReadinessTool() {
  const [invoice, setInvoice] = useState(""); const [result, setResult] = useState<PaymentReadiness | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function run() { setLoading(true); setError(""); try { setResult(await fiberOpsApi.readiness(invoice.trim())); } catch (cause) { setError(fiberErrorMessage(cause)); } finally { setLoading(false); } }
  return <div className="ops-workspace-body"><div className="ops-workspace-heading"><div><span className="ops-kicker">PAYMENT INTELLIGENCE</span><h2>Can I Pay?</h2></div></div><section className="panel ops-panel"><label className="ops-label">Fiber invoice</label><textarea className="ops-textarea" rows={4} value={invoice} onChange={event => setInvoice(event.target.value)} placeholder="fibt..."/><button className="btn primary" disabled={!invoice.trim() || loading} onClick={() => void run()}><Search size={15}/>{loading ? "Analyzing..." : "Analyze route"}</button>{error && <div className="ops-alert critical">{error}</div>}</section>{result && <section className={`panel ops-panel readiness-result ${result.status.toLowerCase()}`}><div className="readiness-head">{result.payable ? <CheckCircle2/> : <XCircle/>}<div><span>Readiness</span><h2>{result.status}</h2></div></div><div className="ops-kpi-grid compact"><article><Route/><span>Routes</span><strong>{result.routeCount}</strong></article><article><ShieldAlert/><span>Fee</span><strong>{result.feeRaw ?? "—"}</strong></article></div>{result.failure && <div className="ops-alert critical">{result.failure}</div>}<ul className="ops-list">{result.recommendations.map(item => <li key={item}>{item}</li>)}</ul></section>}</div>;
}

function ChannelsTool() {
  const runtime = useFiberRuntime(); const data = runtime.channelHealth;
  return <div className="ops-workspace-body"><div className="ops-workspace-heading"><div><span className="ops-kicker">CHANNEL OPERATIONS</span><h2>Channel Health</h2></div><button className="btn secondary" disabled={runtime.loading} onClick={() => void runtime.refresh()}><RefreshCw className={runtime.loading ? "spin" : ""} size={15}/>Scan</button></div>{runtime.error && <div className="ops-alert critical">{runtime.error}</div>}<div className="ops-kpi-grid"><article><span>Scanned</span><strong>{data?.scanned ?? "—"}</strong></article><article><span>Healthy</span><strong>{data?.healthy ?? "—"}</strong></article><article><span>Warning</span><strong>{data?.warning ?? "—"}</strong></article><article className={(data?.critical ?? 0) > 0 ? "danger" : ""}><span>Critical</span><strong>{data?.critical ?? "—"}</strong></article></div><section className="panel ops-panel ops-table-wrap"><table className="ops-table"><thead><tr><th>Channel</th><th>State</th><th>Outbound</th><th>TLC</th><th>Health</th><th>Diagnosis</th></tr></thead><tbody>{data?.channels.map(channel => <tr key={channel.channelId}><td><b>{short(channel.channelId)}</b><small>{short(channel.peerPubkey)}</small></td><td>{channel.state}</td><td>{(channel.outboundRatio * 100).toFixed(1)}%</td><td>{channel.pendingTlcs}</td><td><span className={`ops-badge ${channel.health.toLowerCase()}`}>{channel.health}</span></td><td>{channel.diagnosis.join("; ")}</td></tr>)}</tbody></table>{data?.channels.length === 0 && <div className="empty-state">No open channels.</div>}</section></div>;
}

function ReconciliationTool() {
  const [hash, setHash] = useState(""); const [result, setResult] = useState<ReconciliationResult | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function run() { setLoading(true); setError(""); try { setResult(await fiberOpsApi.reconcile(hash.trim())); } catch (cause) { setError(fiberErrorMessage(cause)); } finally { setLoading(false); } }
  return <div className="ops-workspace-body"><div className="ops-workspace-heading"><div><span className="ops-kicker">CONSISTENCY</span><h2>Reconciliation</h2></div></div><section className="panel ops-panel"><label className="ops-label">Payment hash</label><div className="ops-inline"><input value={hash} onChange={event => setHash(event.target.value)} placeholder="0x..."/><button className="btn primary" disabled={!hash.trim() || loading} onClick={() => void run()}><GitCompareArrows size={15}/>{loading ? "Checking..." : "Reconcile"}</button></div>{error && <div className="ops-alert critical">{error}</div>}</section>{result && <section className="panel ops-panel"><span className={`ops-badge ${result.consistent ? "healthy" : "critical"}`}>{result.consistent ? "CONSISTENT" : result.severity}</span><h2>{result.diagnosis}</h2><p>{result.recommendedAction}</p><div className="ops-state-grid"><div><span>Invoice</span><strong>{result.invoiceStatus ?? "Not found"}</strong></div><div><span>Payment</span><strong>{result.paymentStatus ?? "Not found"}</strong></div><div><span>CCH</span><strong>{result.cchStatus ?? "N/A"}</strong></div></div></section>}</div>;
}

function IncidentsTool() {
  const [items, setItems] = useState<FiberIncident[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { setItems(await fiberOpsApi.incidents()); } catch (cause) { setError(fiberErrorMessage(cause)); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <div className="ops-workspace-body"><div className="ops-workspace-heading"><div><span className="ops-kicker">OPERATIONS</span><h2>Incident Center</h2></div><button className="btn secondary" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} size={15}/>Refresh</button></div>{error && <div className="ops-alert critical">{error}</div>}<div className="incident-list">{items.map(item => <article className="panel incident-card" key={item.id}><div className="incident-icon"><Siren/></div><div><div className="incident-meta"><span className={`ops-badge ${item.severity.toLowerCase()}`}>{item.severity}</span><span>{item.incidentType}</span></div><h3>{item.title}</h3><code>{item.subjectType}: {short(item.subjectId)}</code><p>{item.diagnosis}</p>{item.recommendation && <div className="incident-recommendation">{item.recommendation}</div>}</div></article>)}{items.length === 0 && <div className="panel empty-state">No open incidents.</div>}</div></div>;
}
