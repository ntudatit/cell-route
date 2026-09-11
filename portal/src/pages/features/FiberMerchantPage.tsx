import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useEffect, useState } from "react";
import { Copy, RefreshCw, Store, Zap, Search, XCircle, ShoppingBag } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberApi } from "../../api/backend";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";
import { merchantOrderApi, type MerchantOrder } from "../../api/backend";
import { useBackendAuth } from "../../auth/AuthProvider";
import { BackendAuthButton } from "../../components/BackendAuthButton";

export function FiberMerchantPage() {
 const featureConsoleScope = currentScope();

 const runtime = useFiberRuntime();
 const auth = useBackendAuth();
 const nodeOnline = Boolean(runtime.node);
 const outboundLiquidity = runtime.channelHealth ? BigInt(runtime.channelHealth.totalLocalBalanceRaw || "0") : null;
 const [amount, setAmount] = useState("100000000");
 const [description, setDescription] = useState("Coffee order #1001");
 const [customerReference, setCustomerReference] = useState("customer-1001");
 const [orders, setOrders] = useState<MerchantOrder[]>([]);
 const [invoice, setInvoice] = useState("");
 const [invoiceHash, setInvoiceHash] = useState("");
 const [outboundPaymentHash, setOutboundPaymentHash] = useState("");
 const [payInvoice, setPayInvoice] = useState("");
 const [parsedInvoice, setParsedInvoice] = useState<Record<string, unknown> | null>(null);
 const [allowSelfPayment, setAllowSelfPayment] = useState(false);
 const [status, setStatus] = useState("");
 const [busy, setBusy] = useState(false);

 async function refreshOrders() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'refreshOrders');
 try {

  if (!auth.authenticated) { setOrders([]); return; }
  try { setOrders(await merchantOrderApi.list()); } catch (e) { featureOperation.fail(e);  setStatus(fiberErrorMessage(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 useEffect(() => { void refreshOrders(); }, [auth.authenticated]);

 async function createInvoice() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'createInvoice');
 try {

  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) return setStatus("Enter a valid invoice amount.");
  setBusy(true);
  try {
   const result = await fiberApi.createInvoice({ amountRaw: amount, description, expirySeconds: 900 });
   setInvoice(result.invoiceAddress ?? ""); setInvoiceHash(result.paymentHash ?? "");
   if (auth.authenticated) {
    await merchantOrderApi.create({ customerReference, amountRaw: amount, assetKind: "CKB", description, paymentHash: result.paymentHash, invoiceAddress: result.invoiceAddress }, `order:${customerReference}:${result.paymentHash ?? result.invoiceAddress}`);
    await refreshOrders();
    setStatus("Fiber invoice and merchant order created.");
   } else setStatus("Fiber invoice created locally. Authenticate the API to persist merchant orders and audit history.");
  } catch (e) { featureOperation.fail(e);  setStatus(fiberErrorMessage(e)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function sendPayment() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'sendPayment');
 try {

  if (!payInvoice.trim()) return setStatus("Paste a Fiber invoice first.");
  if (outboundLiquidity === 0n) return;
  setBusy(true);
  try {
   await fiberApi.parseInvoice(payInvoice.trim());
   const result = await fiberApi.payInvoice({ invoice: payInvoice.trim(), allowSelfPayment });
   setOutboundPaymentHash(String(result.payment_hash ?? result.paymentHash ?? ""));
   const relatedOrder = orders.find(order => order.invoiceAddress === payInvoice.trim());
   if (relatedOrder && auth.authenticated) await merchantOrderApi.recordAttempt(relatedOrder.id, { paymentHash: String(result.payment_hash ?? result.paymentHash ?? ""), status: String(result.status ?? "CREATED"), feeRaw: result.fee ? String(result.fee) : undefined, raw: result });
   setStatus(`Payment submitted: ${String(result.status ?? "Created")}`);
  } catch (e) { featureOperation.fail(e);
   const message = fiberErrorMessage(e);
   setStatus(/allow_self_payment|pay to self/i.test(message)
    ? "This invoice belongs to the current browser Fiber node. Enable local QA self-payment or pay it from another Fiber node."
    : /insufficient balance|outbound liquidity/i.test(message)
    ? "Insufficient outbound liquidity. Fund a Ready Fiber channel with more than the invoice amount plus routing fees, then refresh and retry."
    : message);
  }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function inspectInvoice() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'inspectInvoice');
 try {

  if (!payInvoice.trim()) return;
  setBusy(true); setStatus("");
  try { setParsedInvoice(await fiberApi.parseInvoice(payInvoice.trim())); setStatus("Invoice is valid."); }
  catch (e) { featureOperation.fail(e);  setParsedInvoice(null); setStatus(fiberErrorMessage(e)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function checkCreatedInvoice() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'checkCreatedInvoice');
 try {

  if (!invoiceHash) return;
  try { const result = await fiberApi.getInvoice(invoiceHash); const invoiceStatus = String(result.status ?? "UNKNOWN"); const order = orders.find(item => item.paymentHash === invoiceHash); if (order && auth.authenticated) { const status = /paid|received/i.test(invoiceStatus) ? "PAID" : /cancel/i.test(invoiceStatus) ? "CANCELLED" : /expir/i.test(invoiceStatus) ? "EXPIRED" : null; if (status) { await merchantOrderApi.updateStatus(order.id, status); await refreshOrders(); } } setStatus(`Invoice status: ${invoiceStatus}`); }
  catch (e) { featureOperation.fail(e);  setStatus(fiberErrorMessage(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function cancelCreatedInvoice() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'cancelCreatedInvoice');
 try {

  if (!invoiceHash || !confirm("Cancel this Fiber invoice?")) return;
  try { const result = await fiberApi.cancelInvoice(invoiceHash); setStatus(`Invoice status: ${String(result.status ?? "CANCELLED")}`); }
  catch (e) { featureOperation.fail(e);  setStatus(fiberErrorMessage(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function checkPayment() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'checkPayment');
 try {

  if (!outboundPaymentHash) return;
  try { const result = await fiberApi.getPayment(outboundPaymentHash); setStatus(`Payment status: ${String(result.status ?? "UNKNOWN")}`); }
  catch (e) { featureOperation.fail(e);  setStatus(fiberErrorMessage(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return <AppLayout>
  <PageHero eyebrow="Fiber Commerce" title="Merchant Gateway" description="Manage orders, Fiber invoices, payment lifecycle and auditable commerce state." actions={<><BackendAuthButton/><button className="btn secondary" disabled={runtime.loading} onClick={() => { void runtime.refresh(); void refreshOrders(); }}><RefreshCw className={runtime.loading ? "spin" : ""} size={15}/> Refresh</button></>} />

  <div className="asset-metrics-grid four">
   <div className="panel metric-card"><span>Fiber node</span><strong>{nodeOnline ? "Online" : runtime.loading ? "Starting" : "Offline"}</strong></div>
   <div className="panel metric-card"><span>Runtime</span><strong>Browser WASM</strong></div>
   <div className="panel metric-card"><span>Transport</span><strong>WSS</strong></div>
   <div className="panel metric-card"><span>Outbound liquidity</span><strong>{outboundLiquidity === null ? "—" : outboundLiquidity.toString()}</strong></div>
  </div>

  {(status || runtime.error) && <p className="status-line">{status || runtime.error}</p>}

  <div className="fiber-grid">
   <section className="panel fiber-card">
    <div className="panel-heading"><div><span className="page-eyebrow">Merchant</span><h2><Store size={20}/> Create invoice</h2></div></div>
    <label>Amount (raw units)</label>
    <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="100000000" />
    <label>Description</label>
    <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Order #1001" />
    <label>Customer reference</label>
    <input value={customerReference} onChange={e => setCustomerReference(e.target.value)} placeholder="customer-1001" />
    <button className="btn primary" disabled={busy || runtime.loading || !nodeOnline} onClick={() => void createInvoice()}>Create Fiber invoice</button>
    {invoice && <div className="fiber-result"><span>Invoice</span><textarea readOnly value={invoice}/><div className="fiber-result-actions"><button className="btn secondary" onClick={() => void navigator.clipboard.writeText(invoice)}><Copy size={14}/> Copy</button><button className="btn secondary" onClick={() => void checkCreatedInvoice()}><Search size={14}/> Status</button><button className="btn secondary" onClick={() => void cancelCreatedInvoice()}><XCircle size={14}/> Cancel</button></div></div>}
   </section>

   <section className="panel fiber-card">
    <div className="panel-heading"><div><span className="page-eyebrow">Customer / QA</span><h2><Zap size={20}/> Pay invoice</h2></div></div>
    <label>Fiber invoice</label>
    <textarea value={payInvoice} onChange={e => setPayInvoice(e.target.value)} placeholder="Paste invoice from another Fiber node..."/>
    <button className="btn secondary" disabled={busy || !payInvoice.trim()} onClick={() => void inspectInvoice()}><Search size={14}/> Inspect invoice</button>
    {parsedInvoice && <pre className="rpc-output">{JSON.stringify(parsedInvoice, null, 2)}</pre>}
    <label className="fiber-self-payment-option"><input type="checkbox" checked={allowSelfPayment} onChange={e => setAllowSelfPayment(e.target.checked)}/><span><b>Allow self-payment (testing)</b></span></label>
    <button className="btn primary" disabled={busy || runtime.loading || !nodeOnline || outboundLiquidity === 0n} onClick={() => void sendPayment()}>Send Fiber payment</button>
    {outboundPaymentHash && <div className="fiber-result"><span>Payment hash</span><code>{outboundPaymentHash}</code><button className="btn secondary" onClick={() => void checkPayment()}>Check payment status</button></div>}
   </section>
  </div>

  <section className="panel ops-panel merchant-orders-panel">
   <div className="ops-panel-head"><div><span className="ops-kicker">COMMERCE DATA</span><h2><ShoppingBag size={19}/> Merchant orders</h2></div><button className="btn secondary" disabled={!auth.authenticated} onClick={() => void refreshOrders()}><RefreshCw size={14}/> Load orders</button></div>
   {!auth.authenticated && <div className="empty-state">Authenticate the backend API to persist and view order history.</div>}
   {auth.authenticated && orders.length === 0 && <div className="empty-state">No persisted merchant orders.</div>}
   {orders.length > 0 && <div className="ops-table-wrap"><table className="ops-table merchant-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Payment hash</th><th>Status</th><th>Updated</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td><code>{order.id.slice(0, 8)}</code><small>{order.description}</small></td><td>{order.customerReference || "—"}</td><td>{order.amountRaw} <small>{order.assetKind}</small></td><td><code>{order.paymentHash ? `${order.paymentHash.slice(0, 10)}…` : "—"}</code></td><td><span className={`ops-badge ${order.status === "PAID" ? "healthy" : order.status === "FAILED" ? "critical" : "warning"}`}>{order.status}</span></td><td>{new Date(order.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
  </section>

 </AppLayout>;
}
