import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { requireBackendNetwork } from "../../utils/submission";
import { useEffect, useMemo, useRef, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { RefreshCw } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { assetApi, indexerApi, type AssetEvent, type IndexedAsset } from "../../api/backend";
import { useBackendAuth } from "../../auth/AuthProvider";

export function AssetPortfolioPage() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const auth = useBackendAuth();
 const [events, setEvents] = useState<AssetEvent[]>([]);
 const [onChain, setOnChain] = useState<IndexedAsset[]>([]);
 const [address, setAddress] = useState("");
 const [status, setStatus] = useState("Loading asset state...");
 const [syncing, setSyncing] = useState(false);

 const generation = useRef(0);
 useEffect(() => {
  const version = ++generation.current;
  setEvents([]); setOnChain([]); setAddress(''); setSyncing(false);
  if (!signer) { setStatus('Connect a wallet to load assets.'); return; }
  setStatus('Loading asset state...');
  void (async () => {
   try {
    const wallet = await signer.getRecommendedAddress();
    await requireBackendNetwork(signer.client);
    const [audit, indexed] = await Promise.all([assetApi.listByOwner(wallet), indexerApi.list(wallet)]);
    if (version !== generation.current) return;
    setAddress(wallet); setEvents(audit); setOnChain(indexed);
    setStatus(!audit.length && !indexed.length ? 'No indexed or audit assets yet.' : '');
   } catch (e) {
    if (version === generation.current) setStatus(e instanceof Error ? e.message : String(e));
   }
  })();
  return () => { generation.current++; };
 }, [signer]);

 async function sync() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'sync');
 try {

  if (!address || !signer || syncing) return;
  if (!auth.authenticated) {
   setStatus('Authenticate the API first; on-chain sync is a protected backend operation.');
   return;
  }
  const version = generation.current;
  setSyncing(true);
  try {
   await requireBackendNetwork(signer.client);
   if (version !== generation.current) return;
   if (await signer.getRecommendedAddress() !== address) throw new Error('Wallet changed. Reload assets before syncing.');
   if (version !== generation.current) return;
   const result = await indexerApi.sync(address);
   if (version !== generation.current) return;
   setOnChain(result.assets);
   setStatus(`Indexer scanned ${result.scannedCells} live Cells and persisted ${result.indexedAssets} typed asset Cells.`);
  } catch (e) { featureOperation.fail(e);
   if (version === generation.current) setStatus(e instanceof Error ? e.message : String(e));
  } finally { if (version === generation.current) setSyncing(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}
 const metrics = useMemo(() => ({
  typedCells: onChain.length,
  xudtCells: onChain.filter(e => e.assetKind === "XUDT").length,
  sporeCells: onChain.filter(e => e.assetKind === "SPORE").length,
  auditEvents: events.length,
 }), [events, onChain]);

 return <AppLayout>
  <PageHero eyebrow="M1 · On-chain Indexer + Audit Read Model" title="My Assets" description="Compare live on-chain typed Cells discovered via CKB Indexer RPC with the application's PostgreSQL audit trail." actions={<button className="btn primary" disabled={syncing || !address} onClick={() => void sync()}><RefreshCw size={15}/>{syncing ? " Syncing..." : " Sync On-chain"}</button>} />
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
     <div className="asset-event-icon">{(asset.assetKind === "XUDT" || asset.assetKind === "SUDT") ? "T" : asset.assetKind === "SPORE" ? "S" : asset.assetKind === "CLUSTER" ? "C" : "#"}</div>
     <div className="asset-event-main"><strong>{asset.assetKind}</strong><span>Cell #{asset.outputIndex}{asset.blockNumber != null ? ` · block ${asset.blockNumber}` : ""}</span><code>{asset.assetId}</code></div>
     <div className="asset-event-meta"><span>{asset.amountRaw ? `raw ${asset.amountRaw}` : asset.typeHashType}</span><time>{new Date(asset.lastSeenAt).toLocaleString()}</time><code>{asset.txHash.slice(0, 14)}…</code></div>
    </article>)}
   </div>
  </section>

  <section className="panel asset-history-panel">
   <div className="panel-heading"><div><span className="page-eyebrow">Application read model</span><h2>Authenticated Audit Trail</h2></div><span>{events.length} events</span></div>
   <div className="asset-event-list">
    {events.map(event => <article key={event.id} className="asset-event-row">
     <div className="asset-event-icon">{(event.assetKind === "XUDT" || event.assetKind === "SUDT") ? "T" : event.assetKind === "CLUSTER" ? "C" : "S"}</div>
     <div className="asset-event-main"><strong>{event.displayName || event.assetKind}</strong><span>{event.action} · {event.symbol || event.assetKind} {event.amount ? `· ${event.amount}` : ""}</span><code>{event.assetId}</code></div>
     <div className="asset-event-meta"><span>{event.network}</span><time>{new Date(event.createdAt).toLocaleString()}</time><code>{event.txHash.slice(0, 12)}…</code></div>
    </article>)}
   </div>
  </section>
 </AppLayout>;
}
