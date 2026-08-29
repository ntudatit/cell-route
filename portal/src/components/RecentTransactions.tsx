import { ArrowUpRight, ExternalLink, RefreshCw } from "lucide-react";
import type { TrackedTransaction } from "../api/backend";
import { LoadingSpinner } from "./Loading";

function shortHash(hash: string) {
  return `${hash.slice(0, 9)}...${hash.slice(-7)}`;
}

function isPending(status: string) {
  return !["committed", "rejected"].includes((status || "").toLowerCase());
}

export function RecentTransactions({
  rows,
  onRefresh,
  loading = false,
}: {
  rows: TrackedTransaction[];
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <section className="panel recent" id="transactions">
      <div className="panel-title">
        <h3>Recent tracked transactions</h3>
        <button disabled={loading} onClick={onRefresh}>
          {loading ? <LoadingSpinner size={14}/> : <RefreshCw size={14}/>}
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {!loading && rows.length === 0 && (
        <p className="empty">No transactions tracked yet.</p>
      )}

      {rows.map(tx => (
        <div className="tx" key={tx.txHash}>
          <span className="txicon"><ArrowUpRight/></span>
          <div className="txmain">
            <b>{shortHash(tx.txHash)}</b>
            <span className={`tx-status status-${tx.status.toLowerCase()}`}>
              {isPending(tx.status) && <LoadingSpinner size={11}/>}
              {tx.status} • {new Date(tx.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="txamount">
            <b className="red">-{tx.amountCkb || "?"} CKB</b>
            <span>{tx.network}</span>
          </div>
          <ExternalLink size={14}/>
        </div>
      ))}
    </section>
  );
}
