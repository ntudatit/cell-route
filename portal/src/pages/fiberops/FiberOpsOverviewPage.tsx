import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  GitCompareArrows,
  Network,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  Siren,
  WalletCards,
  Zap,
} from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";
import { FiberOpsWorkspace } from "./FiberOpsWorkspace";
import {
  fiberOpsApi,
  aiApi,
  type ChannelHealth,
  type ChannelHealthResponse,
  type FiberIncident,
  type FiberOpsOverview,
  type FiberCompatibility,
} from "../../api/backend";

const meshPositions = [
  [10, 31], [22, 14], [29, 43], [40, 8], [53, 25], [66, 12], [72, 43], [85, 26],
  [18, 69], [37, 77], [50, 68], [61, 63], [77, 73], [90, 61],
] as const;

function rawAmount(value: string | undefined) {
  if (!value) return "0";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString();
}

function short(value?: string | null, left = 7, right = 5) {
  if (!value) return "—";
  if (value.length <= left + right + 2) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

function incidentClass(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("high")) return "critical";
  if (normalized.includes("warn") || normalized.includes("medium")) return "warning";
  return "healthy";
}

function HealthRing({ value }: { value: number | null }) {
  return (
    <div
      className="chain-health-ring"
      style={{ "--health": `${value ?? 0}%` } as CSSProperties}
      aria-label={value === null ? "Channel health unavailable" : `${value}% channels healthy`}
    >
      <div>
        <strong>{value ?? "—"}{value === null ? "" : "%"}</strong>
        <span>{value !== null && value >= 90 ? "healthy" : "ready"}</span>
      </div>
    </div>
  );
}

function FiberMesh({ channels }: { channels: ChannelHealth[] }) {
  const nodes = channels.slice(0, meshPositions.length);
  return (
    <div className="fiber-mesh real-mesh" aria-label="Fiber network topology visualization">
      <svg className="mesh-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {nodes.map((_, index) => {
          const [x, y] = meshPositions[index];
          return <line key={`core-${index}`} x1="50" y1="50" x2={x} y2={y} className="mesh-edge core-edge" />;
        })}
        {nodes.slice(1).map((_, index) => {
          const [x1, y1] = meshPositions[index];
          const [x2, y2] = meshPositions[index + 1];
          return <line key={`peer-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} className="mesh-edge peer-edge" />;
        })}
      </svg>

      <div className="mesh-node core" style={{ left: "50%", top: "50%" }}>
        <i />
        <b>FNN</b>
        <small>(You)</small>
      </div>

      {nodes.map((channel, index) => {
        const [x, y] = meshPositions[index];
        const state = channel.health.toLowerCase();
        return (
          <div
            className={`mesh-node peer ${state}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            key={channel.channelId}
            title={`${channel.state} • ${channel.health}`}
          >
            <i />
            <b>{short(channel.peerPubkey, 5, 3)}</b>
            <small>{short(channel.channelId, 4, 3)}</small>
          </div>
        );
      })}

      {nodes.length === 0 && (
        <div className="mesh-empty">
          <Network size={28} />
          <strong>No channels discovered</strong>
          <span>Connect FNN and run a channel health scan.</span>
        </div>
      )}
    </div>
  );
}

export function FiberOpsOverviewPage() {
 const featureConsoleScope = currentScope();

  const [overview, setOverview] = useState<FiberOpsOverview | null>(null);
  const [channels, setChannels] = useState<ChannelHealthResponse | null>(null);
  const [incidents, setIncidents] = useState<FiberIncident[]>([]);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [compatibility, setCompatibility] = useState<FiberCompatibility | null>(null);

  async function load() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'load');
 try {

    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fiberOpsApi.overview(),
      fiberOpsApi.channels(),
      fiberOpsApi.incidents(),
      fiberOpsApi.compatibility(),
    ]);

    if (results[0].status === "fulfilled") { setOverview(results[0].value); setLive(results[0].value.nodeReachable); }
    if (results[1].status === "fulfilled") setChannels(results[1].value);
    if (results[2].status === "fulfilled") setIncidents(results[2].value);
    if (results[3].status === "fulfilled") setCompatibility(results[3].value);

    if (results[0].status === "fulfilled" && results[1].status === "fulfilled" && results[2].status === "fulfilled") {
      void aiApi.syncRuntimeSnapshot({ overview: results[0].value, channels: results[1].value, incidents: results[2].value }).catch(() => undefined);
    }

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length === results.length) {
      const reason = results[0].status === "rejected" ? results[0].reason : "FiberOps API unavailable";
      setError(reason instanceof Error ? reason.message : String(reason));
    } else if (failed.length > 0) {
      setError("Some FiberOps telemetry is unavailable. Showing the latest data that could be loaded.");
    }
    setLoading(false);

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    // The Fiber node now lives in this browser tab. Poll the in-process WASM runtime
    // instead of subscribing to a server-side FNN SSE endpoint.
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const healthyRatio = overview?.channels
    ? Math.round((overview.healthyChannels / overview.channels) * 100)
    : null;

  const displayedChannels = useMemo(() => channels?.channels.slice(0, 5) ?? [], [channels]);
  const displayedIncidents = useMemo(() => incidents.slice(0, 3), [incidents]);

  return (
    <AppLayout>
      <section className="ops-title-row">
        <div>
          <span className="page-eyebrow">FIBEROPS // REAL-TIME CONTROL PLANE</span>
          <h1>Network Operations Overview</h1>
          <p>Payment intelligence, channel liquidity, reconciliation and incidents across your Nervos Fiber infrastructure.</p>
        </div>
        <button className="btn secondary sync-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          {loading ? "Syncing" : "Sync telemetry"}
        </button>
      </section>

      {error && <div className="ops-alert warning">{error}</div>}
      {compatibility && !compatibility.compatible && (
        <div className="ops-alert warning">
          FNN compatibility: expected v{compatibility.expectedVersion}, detected {compatibility.actualVersion ?? "unreachable"}.
        </div>
      )}

      <section className="chain-command-bar dashboard-command-bar">
        <div>
          <span className={overview?.nodeReachable ? "ops-live" : "ops-down"}>
            <Radio size={14} /> {overview?.nodeReachable ? "NODE ONLINE" : "NODE OFFLINE"}
          </span>
          <small>FNN runtime</small>
        </div>
        <div>
          <span className={live ? "ops-live" : "ops-down"}>
            <Zap size={14} /> {live ? "STREAM LIVE" : "RECONNECTING"}
          </span>
          <small>SSE telemetry</small>
        </div>
        <div>
          <span><ShieldCheck size={14} /> {overview?.nodeVersion ? `FNN ${overview.nodeVersion}` : "VERSION —"}</span>
          <small>protocol runtime</small>
        </div>
        <div>
          <span><Activity size={14} /> {healthyRatio === null ? "—" : `${healthyRatio}%`} HEALTH</span>
          <small>channel readiness</small>
        </div>
      </section>

      <section className="ops-kpi-grid chain-kpi-grid dashboard-kpis">
        <article>
          <div className="kpi-icon blue"><Network size={20} /></div>
          <div><span>PEERS</span><strong>{overview?.peers ?? "—"}</strong><small>Connected Fiber peers</small></div>
        </article>
        <article>
          <div className="kpi-icon cyan"><Activity size={20} /></div>
          <div><span>CHANNELS</span><strong>{overview?.channels ?? "—"}</strong><small>{overview?.healthyChannels ?? 0} routing-ready</small></div>
        </article>
        <article className={(overview?.criticalIncidents ?? 0) > 0 ? "danger" : ""}>
          <div className="kpi-icon red"><AlertTriangle size={20} /></div>
          <div><span>OPEN INCIDENTS</span><strong>{overview?.openIncidents ?? "—"}</strong><small>{overview?.criticalIncidents ?? 0} high / critical</small></div>
        </article>
        <article>
          <div className="kpi-icon green"><CircleDollarSign size={20} /></div>
          <div><span>OUTBOUND LIQUIDITY</span><strong>{rawAmount(overview?.totalLocalBalanceRaw)}</strong><small>Raw local channel balance</small></div>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="panel ops-panel network-map-panel dashboard-mesh-card">
          <div className="panel-title">
            <div><span className="panel-kicker">LIVE TOPOLOGY</span><h3>Fiber Payment Mesh</h3></div>
            <span className={`ops-badge ${live ? "healthy" : "warning"}`}>{live ? "LIVE" : "DEGRADED"}</span>
          </div>
          <FiberMesh channels={channels?.channels ?? []} />
          <div className="mesh-legend">
            <span><i className="good" /> healthy</span>
            <span><i className="warn" /> warning</span>
            <span><i className="bad" /> critical</span>
            <span className="mesh-count">Showing {Math.min(channels?.channels.length ?? 0, meshPositions.length)} of {channels?.scanned ?? overview?.channels ?? 0} channels</span>
          </div>
        </article>

        <article className="panel ops-panel chain-health-panel">
          <div className="panel-title"><div><span className="panel-kicker">NETWORK HEALTH</span><h3>Channel readiness</h3></div></div>
          <HealthRing value={healthyRatio} />
          <div className="ops-health-bars chain-health-bars">
            <div><span><i className="health-dot healthy" />Healthy</span><b>{overview?.healthyChannels ?? 0}</b></div>
            <div><span><i className="health-dot warning" />Warning</span><b>{overview?.warningChannels ?? 0}</b></div>
            <div><span><i className="health-dot critical" />Critical</span><b>{overview?.criticalChannels ?? 0}</b></div>
          </div>
          <small className="updated-copy">Updated {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleTimeString() : "—"}</small>
        </article>

        <article className="panel ops-panel readiness-preview-card">
          <div className="panel-title">
            <div><span className="panel-kicker">PAYMENT INTELLIGENCE</span><h3>Payment Readiness</h3></div>
            <a href="#readiness" className="panel-link">Analyze <ArrowRight size={14} /></a>
          </div>
          <div className="readiness-preview-status">
            <div className="readiness-orb"><Route size={28} /></div>
            <div><span>Dry-run engine</span><strong>READY</strong><small>Validate route + fee before sending funds</small></div>
          </div>
          <div className="readiness-preview-rows">
            <div><span>Route construction</span><b><CheckCircle2 size={15} /> available</b></div>
            <div><span>Fee estimation</span><b><CheckCircle2 size={15} /> enabled</b></div>
            <div><span>MPP diagnostics</span><b><CheckCircle2 size={15} /> inspected</b></div>
          </div>
          <div className="recommendation-box"><ShieldCheck size={16} /><span>Run a dry-run against a Fiber invoice before committing funds.</span></div>
        </article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="panel ops-panel channel-table-card">
          <div className="panel-title">
            <div><span className="panel-kicker">CHANNEL OPERATIONS</span><h3>Channel Health</h3></div>
            <a href="#channels" className="panel-link">View all <ArrowRight size={14} /></a>
          </div>
          <div className="ops-table-wrap compact-table-wrap">
            <table className="ops-table dashboard-channel-table">
              <thead><tr><th>Channel ID</th><th>State</th><th>Outbound</th><th>Pending TLC</th><th>Health</th><th>Recommendation</th></tr></thead>
              <tbody>
                {displayedChannels.map((channel) => (
                  <tr key={channel.channelId}>
                    <td><code>{short(channel.channelId)}</code><small>{short(channel.peerPubkey)}</small></td>
                    <td><span className={`state-dot ${channel.enabled ? "online" : "offline"}`} />{channel.state}</td>
                    <td><b>{(channel.outboundRatio * 100).toFixed(1)}%</b><small>{rawAmount(channel.localBalanceRaw)} raw</small></td>
                    <td className={channel.pendingTlcs >= 10 ? "metric-warning" : ""}>{channel.pendingTlcs}</td>
                    <td><span className={`ops-badge ${channel.health.toLowerCase()}`}>{channel.health}</span></td>
                    <td>{channel.recommendations[0] ?? "No action required"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayedChannels.length === 0 && <div className="empty-state">No channel telemetry available yet.</div>}
          </div>
        </article>

        <article className="panel ops-panel reconciliation-summary-card">
          <div className="panel-title">
            <div><span className="panel-kicker">CONSISTENCY</span><h3>Reconciliation Center</h3></div>
            <a href="#reconciliation" className="panel-link">Open <ArrowRight size={14} /></a>
          </div>
          <div className="reconciliation-sources">
            <div><span>Invoices</span><b><CheckCircle2 size={15} /> Browser WASM</b></div>
            <div><span>Payments</span><b><CheckCircle2 size={15} /> Browser WASM</b></div>
            <div><span>CCH orders</span><b><CheckCircle2 size={15} /> Cross-chain</b></div>
          </div>
          <p className="muted-copy">Cross-check invoice, payment and CCH state before retrying or taking manual recovery action.</p>
          <a href="#reconciliation" className="ops-action-link"><GitCompareArrows size={15} /> Run reconciliation</a>
        </article>

        <article className="panel ops-panel incident-summary-card">
          <div className="panel-title">
            <div><span className="panel-kicker">OPERATIONS</span><h3>Incident Center</h3></div>
            <a href="#incidents" className="panel-link">View all <ArrowRight size={14} /></a>
          </div>
          <div className="incident-mini-list">
            {displayedIncidents.map((incident) => (
              <div className="incident-mini" key={incident.id}>
                <span className={`incident-dot ${incidentClass(incident.severity)}`} />
                <div><b>{incident.title}</b><small>{incident.incidentType} · {short(incident.subjectId, 6, 4)}</small></div>
                <time>{new Date(incident.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
            ))}
            {displayedIncidents.length === 0 && <div className="incident-empty"><Siren size={22} /><span>No open incidents</span></div>}
          </div>
        </article>
      </section>
      <FiberOpsWorkspace />
    </AppLayout>
  );
}
