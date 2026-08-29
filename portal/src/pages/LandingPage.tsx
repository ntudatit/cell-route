import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ccc } from "@ckb-ccc/connector-react";
import { Activity, ArrowRight, Bot, Check, ChevronRight, CircleGauge, Code2, CreditCard, GitBranch, Radio, ShieldCheck, Store, Waypoints, Zap } from "lucide-react";

const products = [
  { icon: CreditCard, eyebrow: "CHECKOUT", title: "Payments without custody", text: "Create, inspect and pay Fiber invoices from a browser-local node. User keys stay on the device.", link: "/checkout", action: "Launch checkout" },
  { icon: Store, eyebrow: "MERCHANT", title: "Commerce that can retry safely", text: "Orchestrate orders, invoice lifecycle and payment attempts with idempotency and audit history.", link: "/merchant", action: "Open merchant console" },
  { icon: CircleGauge, eyebrow: "FIBEROPS", title: "Know before you route", text: "Monitor channel health, liquidity, readiness, reconciliation and incidents from one control plane.", link: "/fiber-ops", action: "Open operations" },
  { icon: Code2, eyebrow: "DEVELOPERS", title: "A clean integration boundary", text: "Build against REST APIs while Rust services isolate business state from Fiber and CKB execution.", link: "/docs", action: "Explore APIs" },
] as const;

function openDocument(path: string) { window.location.assign(path); }

export function LandingPage() {
  const { client } = ccc.useCcc();
  const network = useMemo(() => client.addressPrefix === "ckb" ? "MAINNET" : "TESTNET", [client.addressPrefix]);

  return <main className="ops-landing">
    <header className="ops-landing-nav">
      <Link className="ops-landing-brand" to="/" aria-label="FiberPay home"><span className="ops-brand-mark"><Zap size={21}/></span><span><strong>FIBER<span>PAY</span></strong><small>PAYMENT INFRASTRUCTURE</small></span></Link>
      <nav className="ops-nav-links" aria-label="Primary navigation"><a href="#products">Products</a><a href="#architecture">Architecture</a><a href="/fiber-ops">FiberOps</a><Link to="/docs">Developers</Link></nav>
      <div className="ops-nav-actions"><span className="ops-network-pill"><i/> CKB {network}</span><button className="ops-nav-button" onClick={() => openDocument("/platform")}>Open platform <ArrowRight size={15}/></button></div>
    </header>

    <section className="ops-landing-hero">
      <div className="ops-hero-grid"/>
      <div className="ops-hero-copy">
        <div className="ops-eyebrow"><span>01</span> CKB SETTLEMENT · FIBER PAYMENTS</div>
        <h1>Move value<br/>at <em>internet speed.</em></h1>
        <p>FiberPay is payment infrastructure for checkout, merchant orchestration and network operations—powered by Nervos Fiber for instant payments and CKB for verifiable settlement.</p>
        <div className="ops-hero-actions"><button className="ops-primary-button" onClick={() => openDocument("/checkout")}><CreditCard size={17}/> Launch checkout</button><button className="ops-text-button" onClick={() => openDocument("/fiber-ops")}><Activity size={16}/> Explore FiberOps</button></div>
        <div className="ops-proof-row"><span><ShieldCheck size={15}/> Non-custodial edge</span><span><Radio size={15}/> WSS Fiber network</span><span><Check size={15}/> Idempotent APIs</span></div>
      </div>

      <div className="ops-console-preview" aria-label="FiberPay payment lifecycle preview">
        <div className="ops-preview-head"><span><i/> FIBERPAY / PAYMENT LIVE</span><span>TESTNET · WASM EDGE</span></div>
        <div className="ops-preview-body">
          <div className="ops-preview-title"><div><small>ORDER FP-2048</small><strong>Payment orchestration</strong></div><span>READY <small>ROUTE</small></span></div>
          <div className="ops-preview-metrics"><div><small>AMOUNT</small><strong>1,000</strong><span>CKB</span></div><div><small>ESTIMATED FEE</small><strong>0.08%</strong><span>MAX</span></div><div><small>SETTLEMENT</small><strong>&lt; 2s</strong><span>P95</span></div></div>
          <div className="ops-payment-flow"><div className="flow-step done"><span>01</span><b>Invoice</b><small>CREATED</small></div><i/><div className="flow-step active"><span>02</span><b>Fiber</b><small>IN FLIGHT</small></div><i/><div className="flow-step"><span>03</span><b>Order</b><small>AWAITING</small></div><i/><div className="flow-step"><span>04</span><b>CKB</b><small>SETTLEMENT</small></div></div>
          <div className="ops-preview-feed"><div><span><i/> Route and liquidity verified</span><time>04ms</time></div><div><span><i/> Idempotency key accepted</span><time>payment_2048</time></div></div>
        </div>
        <div className="ops-preview-foot"><span>FIBER NODE ONLINE</span><span>OUTBOX HEALTHY</span><span>0 INCIDENTS</span></div>
      </div>
    </section>

    <section className="ops-signal-strip" aria-label="Platform properties"><div><small>EXECUTION</small><strong><i/> NON-CUSTODIAL</strong></div><div><small>PAYMENT PATH</small><strong>FIBER</strong></div><div><small>TRUST LAYER</small><strong>CKB</strong></div><div><small>OPERATIONS</small><strong>OBSERVABLE</strong></div></section>

    <section className="ops-platform" id="products">
      <div className="ops-section-intro"><div className="ops-eyebrow"><span>02</span> THREE PRODUCT SURFACES</div><h2>From checkout<br/>to <em>settled.</em></h2><p>Each surface has one responsibility. Customer keys remain at the edge, business state lives in the service layer, and operators get deterministic telemetry.</p></div>
      <div className="ops-capability-grid">{products.map(({icon: Icon, eyebrow, title, text, link, action}, index) => <button className="ops-capability-card" onClick={() => openDocument(link)} key={title}><div className="ops-capability-top"><span>0{index+1}</span><Icon size={21}/></div><small>{eyebrow}</small><h3>{title}</h3><p>{text}</p><b>{action} <ChevronRight size={14}/></b></button>)}</div>
    </section>

    <section className="ops-ai-callout ops-architecture-callout" id="architecture"><div className="ops-ai-orb"><GitBranch size={28}/><span/></div><div><div className="ops-eyebrow"><span>03</span> HYBRID FIBER ARCHITECTURE</div><h2>Edge custody. Managed reliability.</h2><p>Browser Fiber WASM gives users a local identity and channels. Rust orchestration and managed native nodes provide merchant uptime, shared liquidity, reconciliation and event delivery.</p></div><button className="ops-primary-button" onClick={() => openDocument("/platform")}>View architecture <ArrowRight size={17}/></button></section>

    <section className="ops-final-cta"><div><Waypoints size={25}/><span>PAYMENTS YOU CAN OPERATE</span></div><h2>Build on Fiber.<br/><em>Settle on CKB.</em></h2><p>Start with a browser-local checkout or open the operations control center.</p><div className="ops-hero-actions"><button className="ops-primary-button" onClick={() => openDocument("/checkout")}><Zap size={17}/> Start FiberPay</button><button className="ops-text-button" onClick={() => openDocument("/fiber-ai")}><Bot size={16}/> Ask operations AI</button></div></section>

    <footer className="ops-landing-footer"><div className="ops-landing-brand"><span className="ops-brand-mark"><Zap size={18}/></span><span><strong>FIBER<span>PAY</span></strong><small>NERVOS PAYMENT PLATFORM</small></span></div><p>Fiber for instant payments. CKB for ownership and settlement.</p><span><i/> TESTNET READY</span></footer>
  </main>;
}
