import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useEffect, useState } from "react";
import { RefreshCw, Siren } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberOpsApi, type FiberIncident } from "../../api/backend";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";
function short(v:string){return v.length>22?`${v.slice(0,12)}…${v.slice(-7)}`:v}
export function IncidentCenterPage(){
 const featureConsoleScope = currentScope();
const[data,setData]=useState<FiberIncident[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(false);async function load(){
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'load');
 try {
setLoading(true);try{setError("");setData(await fiberOpsApi.incidents())}catch(e){ featureOperation.fail(e); setError(fiberErrorMessage(e))}finally{setLoading(false)}
 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}useEffect(()=>{void load()},[]);return <AppLayout>
 <PageHero eyebrow="Operations" title="Incident Center" description="Deduplicated operational findings generated from channel diagnostics and payment reconciliation." actions={<button className="btn secondary" disabled={loading} onClick={()=>void load()}><RefreshCw className={loading?"spin":""} size={16}/> {loading?"Refreshing...":"Refresh"}</button>}/>{error&&<div className="ops-alert critical">{error}</div>}
 <section className="incident-list">{data.map(i=><article className="panel incident-card" key={i.id}><div className="incident-icon"><Siren/></div><div><div className="incident-meta"><span className={`ops-badge ${i.severity.toLowerCase()}`}>{i.severity}</span><span>{i.incidentType}</span><span>{new Date(i.lastSeenAt).toLocaleString()}</span></div><h3>{i.title}</h3><code>{i.subjectType}: {short(i.subjectId)}</code><p>{i.diagnosis}</p>{i.recommendation&&<div className="incident-recommendation"><b>Recommended:</b> {i.recommendation}</div>}</div></article>)}{data.length===0&&<div className="panel empty-state">No open incidents. Run Channel Health or Reconciliation to refresh operational state.</div>}</section>
 </AppLayout>}
