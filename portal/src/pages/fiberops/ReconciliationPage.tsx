import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberOpsApi, type ReconciliationResult } from "../../api/backend";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";
export function ReconciliationPage(){
 const featureConsoleScope = currentScope();
const[hash,setHash]=useState("");const[result,setResult]=useState<ReconciliationResult|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState("");async function run(){
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'run');
 try {
setLoading(true);setError("");try{setResult(await fiberOpsApi.reconcile(hash.trim()))}catch(e){ featureOperation.fail(e); setError(fiberErrorMessage(e))}finally{setLoading(false)}
 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}return <AppLayout>
 <PageHero eyebrow="Reliability" title="Reconciliation Center" description="Cross-check invoice, payment and Cross-Chain Hub state before an operator retries or intervenes."/><section className="panel ops-panel"><label className="ops-label">Payment hash</label><div className="ops-inline"><input value={hash} onChange={e=>setHash(e.target.value)} placeholder="0x..."/><button className="btn primary" disabled={!hash.trim()||loading} onClick={()=>void run()}><GitCompareArrows size={16}/>{loading?"Checking...":"Reconcile"}</button></div>{error&&<div className="ops-alert critical">{error}</div>}</section>
 {result&&<section className="panel ops-panel"><div className="reconcile-status"><span className={`ops-badge ${result.consistent?"healthy":"critical"}`}>{result.consistent?"CONSISTENT":result.severity}</span><h2>{result.diagnosis}</h2><p>{result.recommendedAction}</p></div><div className="ops-state-grid"><div><span>Invoice</span><strong>{result.invoiceStatus??"Not found"}</strong></div><div><span>Payment</span><strong>{result.paymentStatus??"Not found"}</strong></div><div><span>CCH order</span><strong>{result.cchStatus??"Not applicable / not found"}</strong></div></div><details><summary>Full reconciliation snapshot</summary><pre className="guide-code">{JSON.stringify(result.snapshot,null,2)}</pre></details></section>}
 </AppLayout>}
