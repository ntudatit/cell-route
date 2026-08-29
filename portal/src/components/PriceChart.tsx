export function PriceChart() {
 return (
  <section className="panel chart-panel">
   <div className="panel-head"><div><span className="muted">Architecture flow</span><h2>CCC → CKB Network</h2></div><em>Wallet signed</em></div>
   <div className="flow-diagram">
    <div className="flow-node"><b>React + CCC</b><span>Connect • compose • sign</span></div>
    <div className="flow-arrow">→</div>
    <div className="flow-node"><b>CKB Network</b><span>Broadcast transaction</span></div>
    <div className="flow-arrow">→</div>
    <div className="flow-node"><b> BE</b><span>Track • query RPC • persist</span></div>
   </div>
  </section>
 );
}
