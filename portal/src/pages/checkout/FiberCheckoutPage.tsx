import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useState } from "react";
import { CheckCircle2, Copy, CreditCard, RefreshCw, Route, ShieldCheck, Zap } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberApi, fiberOpsApi } from "../../api/backend";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";

export function FiberCheckoutPage() {
 const featureConsoleScope = currentScope();

  const runtime = useFiberRuntime();
  const [mode, setMode] = useState<"receive" | "pay">("receive");
  const [amount, setAmount] = useState("100000000");
  const [description, setDescription] = useState("FiberPay order");
  const [invoice, setInvoice] = useState("");
  const [paymentHash, setPaymentHash] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function createInvoice() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'createInvoice');
 try {

    if (!/^\d+$/.test(amount) || BigInt(amount) === 0n) return setResult("Enter an amount greater than zero.");
    setBusy(true); setResult("");
    try { const created = await fiberApi.createInvoice({ amountRaw: amount, description, expirySeconds: 900 }); setInvoice(created.invoiceAddress ?? ""); setPaymentHash(created.paymentHash ?? ""); setResult("Invoice ready for payment."); }
    catch (error) { featureOperation.fail(error);  setResult(fiberErrorMessage(error)); } finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  async function pay() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'pay');
 try {

    if (!paymentInvoice.trim()) return setResult("Paste a Fiber invoice first.");
    setBusy(true); setResult("");
    try {
      const readiness = await fiberOpsApi.readiness(paymentInvoice.trim());
      if (!readiness.payable) return setResult(`Payment unavailable: ${readiness.failure ?? readiness.recommendations.join(" ")}`);
      const payment = await fiberApi.payInvoice({ invoice: paymentInvoice.trim() });
      setPaymentHash(String(payment.payment_hash ?? payment.paymentHash ?? "")); setResult(`Payment ${String(payment.status ?? "submitted").toLowerCase()}.`);
    } catch (error) { featureOperation.fail(error);  setResult(fiberErrorMessage(error)); } finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  return <AppLayout>
    <PageHero eyebrow="FiberPay Checkout" title="Pay at Fiber speed" description="A non-custodial checkout powered by the browser-local Fiber node. Keys and node identity stay on this device." actions={<button className="btn secondary" onClick={() => void runtime.refresh()} disabled={runtime.loading}><RefreshCw className={runtime.loading ? "spin" : ""} size={15}/>Refresh node</button>}/>
    <div className="checkout-trust-row"><span><ShieldCheck/>Non-custodial</span><span><Zap/>Instant Fiber settlement</span><span><Route/>Readiness checked before payment</span></div>
    <div className="checkout-shell panel">
      <div className="checkout-tabs"><button className={mode === "receive" ? "active" : ""} onClick={() => setMode("receive")}>Receive</button><button className={mode === "pay" ? "active" : ""} onClick={() => setMode("pay")}>Pay invoice</button></div>
      {mode === "receive" ? <div className="checkout-form"><label>Amount (raw asset units)</label><input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/\D/g, ""))}/><label>Order description</label><input value={description} onChange={event => setDescription(event.target.value)}/><button className="btn primary" disabled={busy || runtime.loading || !runtime.node} onClick={() => void createInvoice()}><CreditCard size={16}/>{busy ? "Creating…" : "Create invoice"}</button>{invoice && <div className="checkout-result"><CheckCircle2/><div><b>Invoice created</b><textarea readOnly value={invoice}/><button className="btn secondary" onClick={() => void navigator.clipboard.writeText(invoice)}><Copy size={14}/>Copy invoice</button></div></div>}</div>
      : <div className="checkout-form"><label>Fiber invoice</label><textarea rows={6} value={paymentInvoice} onChange={event => setPaymentInvoice(event.target.value)} placeholder="fibt…"/><button className="btn primary" disabled={busy || runtime.loading || !runtime.node || !paymentInvoice.trim()} onClick={() => void pay()}><Zap size={16}/>{busy ? "Checking route…" : "Check & pay"}</button>{paymentHash && <code className="checkout-hash">{paymentHash}</code>}</div>}
      {(result || runtime.error) && <div className="checkout-message" role="status">{result || runtime.error}</div>}
    </div>
  </AppLayout>;
}
