import { Activity, ArrowRight, Boxes, Code2, CreditCard, Gauge, RadioTower, ShieldCheck, Store } from "lucide-react";
import { AppLayout, PageHero } from "../components/layout/AppLayout";

const surfaces = [
  { icon: CreditCard, eyebrow: "CUSTOMER", title: "FiberPay Checkout", copy: "Create and pay Fiber invoices from a browser-local, non-custodial node.", to: "/checkout", action: "Open checkout" },
  { icon: Store, eyebrow: "MERCHANT", title: "Merchant Console", copy: "Manage orders, invoices, payment attempts and auditable commerce state.", to: "/merchant", action: "Manage commerce" },
  { icon: Gauge, eyebrow: "OPERATIONS", title: "FiberOps", copy: "Monitor nodes, channels, liquidity, payment readiness, reconciliation and incidents.", to: "/fiber-ops", action: "Open control center" },
] as const;

export function PlatformOverviewPage() {
  return <AppLayout>
    <PageHero eyebrow="Nervos CKB + Fiber" title="FiberPay Platform" description="Instant Fiber payments, reliable merchant orchestration and CKB settlement—separated into clear production boundaries." />
    <section className="fiberpay-surface-grid">
      {surfaces.map(({ icon: Icon, eyebrow, title, copy, to, action }) => <article className="panel fiberpay-surface" key={to}>
        <div className="fiberpay-surface-icon"><Icon size={22}/></div><span className="ops-kicker">{eyebrow}</span><h2>{title}</h2><p>{copy}</p>
        <a href={to}>{action}<ArrowRight size={15}/></a>
      </article>)}
    </section>
    <section className="panel fiberpay-architecture">
      <div><span className="ops-kicker">EXECUTION MODEL</span><h2>One platform, two Fiber runtimes</h2><p>Browser WASM protects user custody. Managed native nodes provide merchant uptime, shared liquidity and routing reliability.</p></div>
      <div className="fiberpay-boundaries">
        <article><RadioTower/><b>Browser edge</b><span>WASM Worker · IndexedDB · WSS</span></article>
        <ArrowRight className="fiberpay-flow-arrow"/>
        <article><Activity/><b>Rust orchestration</b><span>State machine · idempotency · audit</span></article>
        <ArrowRight className="fiberpay-flow-arrow"/>
        <article><Boxes/><b>Settlement layer</b><span>CKB · xUDT · Spore</span></article>
      </div>
    </section>
    <section className="fiberpay-principles">
      <span><ShieldCheck/>Private keys never enter the API or AI layer</span><span><Code2/>Critical writes are idempotent and auditable</span>
    </section>
  </AppLayout>;
}
