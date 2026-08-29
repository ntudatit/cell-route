import { useCallback, useEffect, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { Copy, RefreshCw } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { LoadingBlock, LoadingSpinner } from "../../components/Loading";

type CellRow = {
 capacity: string;
 lock: string;
 type: string;
 data: string;
 outPoint: string;
 raw: unknown;
};

function json(value: unknown) {
 return JSON.stringify(value, (_, item) =>
  typeof item === "bigint" ? item.toString() : item, 2);
}

function shortJson(value: unknown, max = 26) {
 const text = typeof value === "string" ? value : json(value);
 return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function CellsPage() {
 const signer = ccc.useSigner();
 const [cells, setCells] = useState<CellRow[]>([]);
 const [selected, setSelected] = useState<CellRow | null>(null);
 const [status, setStatus] = useState("Connect a wallet to load live Cells.");
 const [loading, setLoading] = useState(false);

 const load = useCallback(async () => {
  if (!signer) {
   setCells([]);
   setStatus("Connect a wallet to load live Cells.");
   return;
  }

  setStatus("Loading live Cells...");
  try {
   const rows: CellRow[] = [];
   for await (const cell of signer.findCells({}, true, "desc", 20)) {
    rows.push({
     capacity: ccc.fixedPointToString(cell.cellOutput.capacity),
     lock: shortJson(cell.cellOutput.lock),
     type: cell.cellOutput.type ? shortJson(cell.cellOutput.type) : "-",
     data: typeof cell.outputData === "string" ? cell.outputData : json(cell.outputData),
     outPoint: shortJson(cell.outPoint),
     raw: cell,
    });
   }
   setCells(rows);
   setSelected(rows[0] ?? null);
   setStatus(`Live Cells (${rows.length})`);
  } catch (error) {
   setStatus(error instanceof Error ? error.message : String(error));
  }
 }, [signer]);

 useEffect(() => { void load(); }, [load]);

 return (
  <AppLayout>
   <PageHero
    eyebrow="CCC · Query the Chain"
    title="Live Cells"
    description="Query Cells controlled by the connected signer and inspect their capacity, scripts, data and OutPoint."
    actions={
     <button className="btn secondary compact" onClick={() => void load()}>
      {loading ? <LoadingSpinner size={16}/> : <RefreshCw size={16}/>} {loading ? "Loading..." : "Refresh"}
     </button>
    }
   />

   <section className="data-card cell-table-card">
    <div className="panel-title-row padded-title">
     <div><span className="page-eyebrow">On-chain state</span><h2>{status}</h2></div>
    </div>

    <div className="live-cell-table">
     <div className="live-cell-head">
      <span>#</span><span>Capacity (CKB)</span><span>Lock</span><span>Type</span><span>Data</span><span>Out Point</span>
     </div>

     {cells.length === 0 && (
      <div className="empty-state">{status}</div>
     )}

     {cells.map((cell, index) => (
      <button
       className={`live-cell-row ${selected === cell ? "selected" : ""}`}
       key={`${cell.outPoint}-${index}`}
       onClick={() => setSelected(cell)}
      >
       <span>{index + 1}</span>
       <strong>{cell.capacity}</strong>
       <code>{cell.lock}</code>
       <code>{cell.type}</code>
       <code>{cell.data || "0x"}</code>
       <code>{cell.outPoint}</code>
      </button>
     ))}
    </div>
   </section>

   {selected && (
    <section className="panel cell-detail-panel">
     <div className="panel-title-row">
      <div><span className="page-eyebrow">Selected Cell</span><h2>Cell Details</h2></div>
      <button
       className="btn secondary compact"
       onClick={() => navigator.clipboard.writeText(json(selected.raw))}
      >
       <Copy size={15}/> Copy JSON
      </button>
     </div>
     <pre>{json(selected.raw)}</pre>
    </section>
   )}
  </AppLayout>
 );
}