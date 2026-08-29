import { useEffect, useMemo, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { RefreshCw } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { assetApi, indexerApi, type AssetEvent, type IndexedAsset } from "../../api/backend";
import { useBackendAuth } from "../../auth/AuthProvider";

export function AssetPortfolioPage() {
 const signer = ccc.useSigner();
 const auth = useBackendAuth();
 const [events, setEvents] = useState<AssetEvent[]>([]);
 const [onChain, setOnChain] = useState<IndexedAsset[]>([]);
 const [address, setAddress] = useState("");
 const [status, setStatus] = useState("Loading asset state...");
 const [syncing, setSyncing] = useState(false);

 async function load() {
  if (!signer) return;
  const wallet = await signer.getRecommendedAddress();
  setAddress(wallet);
  const [audit, indexed] = await Promise.all([
   assetApi.listByOwner(wallet),
   indexerApi.list(wallet).catch(() => [] as IndexedAsset[]),
  ]);
  setEvents(audit); setOnChain(indexed);
  setStatus(!audit.length && !indexed.length ? "No indexed or audit assets yet." : "");
 }

 useEffect(() => { void load().catch(e => setStatus(e instanceof Error ? e.message : String(e))); }, [signer]);

 async function sync() {
  if (!address) return;
  if (!auth.authenticated) {
   setStatus("Authenticate the API first; on-chain sync is a protected backend operation.");
   return;
  }
  setSyncing(true);
  try {
   const result = await indexerApi.sync(address);
   setOnChain(result.assets);
   setStatus(`Indexer scanned ${result.scannedCells} live Cells and persisted ${result.indexedAssets} typed asset Cells.`);
  } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  finally { setSyncing(false); }
 }

 const metrics = useMemo(() => ({
  typedCells: onChain.length,
  xudtCells: onChain.filter(e => e.assetKind === "XUDT").length,
  sporeCells: onChain.filter(e => e.assetKind === "SPORE").length,
  auditEvents: events.length,
 }), [events, onChain]);

 return <AppLayout>
  <PageHero eyebrow="M1 · On-chain Indexer + Audit Read Model" title="My Assets" description="Compare live on-chain typed Cells discovered via CKB Indexer RPC with the application's PostgreSQL audit trail." actions={<button className="btn primary" disabled={syncing} onClick={() => void sync()}><RefreshCw size={15}/>{syncing ? " Syncing..." : " Sync On-chain"}</button>} />
  <div className="asset-metrics-grid four">
   <div className="panel metric-card"><span>Live typed Cells</span><strong>{metrics.typedCells}</strong></div>
   <div className="panel metric-card"><span>xUDT Cells</span><strong>{metrics.xudtCells}</strong></div>
   <div className="panel metric-card"><span>Spore Cells</span><strong>{metrics.sporeCells}</strong></div>
   <div className="panel metric-card"><span>Audit events</span><strong>{metrics.auditEvents}</strong></div>
  </div>
  {status && <p className="status-line">{status}</p>}

  <section className="panel asset-history-panel">
   <div className="panel-heading"><div><span className="page-eyebrow">On-chain source of truth</span><h2>Indexed Live Assets</h2></div><span>{onChain.length} live typed Cells</span></div>
   <div className="asset-event-list">
    {onChain.map(asset => <article key={`${asset.txHash}:${asset.outputIndex}`} className="asset-event-row">
     <div className="asset-event-icon">{asset.assetKind === "XUDT" ? "T" : asset.assetKind === "SPORE" ? "S" : asset.assetKind === "CLUSTER" ? "C" : "#"}</div>
     <div className="asset-event-main"><strong>{asset.assetKind}</strong><span>Cell #{asset.outputIndex}{asset.blockNumber != null ? ` · block ${asset.blockNumber}` : ""}</span><code>{asset.assetId}</code></div>
     <div className="asset-event-meta"><span>{asset.amountRaw ? `raw ${asset.amountRaw}` : asset.typeHashType}</span><time>{new Date(asset.lastSeenAt).toLocaleString()}</time><code>{asset.txHash.slice(0, 14)}…</code></div>
    </article>)}
   </div>
  </section>

  <section className="panel asset-history-panel">
   <div className="panel-heading"><div><span className="page-eyebrow">Application read model</span><h2>Authenticated Audit Trail</h2></div><span>{events.length} events</span></div>
   <div className="asset-event-list">
    {events.map(event => <article key={event.id} className="asset-event-row">
     <div className="asset-event-icon">{event.assetKind === "XUDT" ? "T" : event.assetKind === "CLUSTER" ? "C" : "S"}</div>
     <div className="asset-event-main"><strong>{event.displayName || event.assetKind}</strong><span>{event.action} · {event.symbol || event.assetKind} {event.amount ? `· ${event.amount}` : ""}</span><code>{event.assetId}</code></div>
     <div className="asset-event-meta"><span>{event.network}</span><time>{new Date(event.createdAt).toLocaleString()}</time><code>{event.txHash.slice(0, 12)}…</code></div>
    </article>)}
   </div>
  </section>
 </AppLayout>;
}
