import { Activity, Boxes, Radio } from "lucide-react";

export function StatsCards({ balance, tracked, tip }: { balance: string; tracked: number; tip: string }) {
 return (
  <section className="stats-grid">
   <article className="stat-card"><div><span className="muted">Wallet balance</span><h3>{balance} <small>CKB</small></h3><p>Read directly through the connected CCC signer</p></div><Activity className="spark"/></article>
   <article className="stat-card"><div><span className="muted">Tracked transactions</span><h3>{tracked}</h3><p>Saved by Backend</p></div><span className="stat-icon"><Boxes/></span></article>
   <article className="stat-card"><div><span className="muted">Tip block</span><h3>{tip || "—"}</h3><p>From CKB JSON-RPC</p></div><span className="stat-icon i2"><Radio/></span></article>
   <article className="stat-card"><div><span className="muted">Signing model</span><h3>Client</h3><p>Private key stays in the wallet</p></div><span className="stat-icon i3">✓</span></article>
  </section>
 );
}