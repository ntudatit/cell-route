import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useState } from "react";
import { CheckCircle2, Route, Search, ShieldAlert, XCircle } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberOpsApi, type PaymentReadiness } from "../../api/backend";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";

export function PaymentReadinessPage() {
 const featureConsoleScope = currentScope();

 const [invoice, setInvoice] = useState(""); const [result, setResult] = useState<PaymentReadiness | null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
 async function analyze() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'analyze');
 try {
 setLoading(true); setError(""); try { setResult(await fiberOpsApi.readiness(invoice.trim())); } catch(e){ featureOperation.fail(e);  setError(fiberErrorMessage(e)); } finally{setLoading(false);}
 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}
 return <AppLayout><PageHero eyebrow="Payment Intelligence" title="Can I Pay?" description="Runs Fiber send_payment as a dry-run to check route construction and fee before sending real funds." />
  <section className="panel ops-panel"><label className="ops-label">Fiber invoice</label><textarea className="ops-textarea" rows={5} value={invoice} onChange={e=>setInvoice(e.target.value)} placeholder="fibt..."/><button className="btn primary" disabled={!invoice.trim()||loading} onClick={()=>void analyze()}><Search size={16}/>{loading?"Analyzing...":"Analyze payment"}</button>{error&&<div className="ops-alert critical">{error}</div>}</section>
  {result&&<section className={`panel ops-panel readiness-result ${result.status.toLowerCase()}`}><div className="readiness-head">{result.payable?<CheckCircle2/>:<XCircle/>}<div><span>Readiness</span><h2>{result.status}</h2></div></div><div className="ops-kpi-grid compact"><article><Route/><span>Routes</span><strong>{result.routeCount}</strong></article><article><ShieldAlert/><span>Estimated fee</span><strong>{result.feeRaw??"—"}</strong></article></div>{result.failure&&<div className="ops-alert critical"><b>Failure:</b> {result.failure}</div>}<h3>Recommendations</h3><ul className="ops-list">{result.recommendations.map(x=><li key={x}>{x}</li>)}</ul><details><summary>Raw Fiber dry-run</summary><pre className="guide-code">{JSON.stringify(result.dryRun,null,2)}</pre></details></section>}
 </AppLayout>;
}
