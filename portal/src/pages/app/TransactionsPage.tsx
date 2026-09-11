import { useFeatureCcc } from '../../dev-console/hooks';
import { ccc } from "@ckb-ccc/connector-react";
import { clientNetwork } from "../../utils/network";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { backendApi, type TrackedTransaction } from "../../api/backend";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { LoadingBlock, LoadingSpinner } from "../../components/Loading";
import { useWallet } from "../../hooks/useWallet";

const isPending = (status: string) =>
  !["committed", "rejected"].includes((status || "").toLowerCase());

export function TransactionsPage() {
  const wallet = useWallet();
  const { client } = useFeatureCcc();
  const [rows, setRows] = useState<TrackedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!wallet.address) {
      setRows([]);
      return;
    }

    if (!quiet) setLoading(true);
    try {
      setError("");
      const backend = await backendApi.getNetwork();
      if (backend.network.toLowerCase() !== clientNetwork(client)) { setRows([]); throw new Error("Activity service uses another network."); }
      const dashboard = await backendApi.getDashboard(wallet.address);
      setRows(dashboard.recentTransactions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [wallet.address, client]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!wallet.address || !rows.some(tx => isPending(tx.status))) return;
    const id = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(id);
  }, [wallet.address, rows, load]);

  return (
    <AppLayout>
      <PageHero
        eyebrow="Application · Audit"
        title="Activity Log"
        description="Transactions broadcast by CCC and tracked by the backend services."
        actions={
          <button className="btn secondary compact" disabled={loading} onClick={() => void load()}>
            {loading ? <LoadingSpinner /> : <RefreshCw size={16}/>}
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <section className="data-card">
        <div className="table-head">
          <span>Transaction</span><span>Direction</span><span>Amount</span><span>Status</span><span>Created</span>
        </div>

        {loading && <LoadingBlock label="Loading transactions..." />}

        {!loading && !wallet.address && (
          <div className="empty-state">Connect a wallet to load your tracked transaction history.</div>
        )}

        {!loading && wallet.address && rows.length === 0 && (
          <div className="empty-state">No tracked transactions yet.</div>
        )}

        {!loading && rows.map(tx => (
          <div className="table-row" key={tx.txHash}>
            <div className="tx-cell">
              <span className={`round-icon ${tx.direction === "RECEIVE" ? "in" : ""}`}>
                {tx.direction === "RECEIVE" ? <ArrowDownLeft/> : <ArrowUpRight/>}
              </span>
              <div>
                <strong>{tx.txHash.slice(0,12)}...{tx.txHash.slice(-6)}</strong>
                <small>{tx.recipient ? `To ${tx.recipient.slice(0,14)}...` : "CKB transaction"}</small>
              </div>
            </div>
            <span>{tx.direction}</span>
            <strong className={tx.direction === "RECEIVE" ? "green" : "red"}>
              {tx.amountCkb ? `${tx.amountCkb} CKB` : "—"}
            </strong>
            <span className={`status-pill status-${tx.status.toLowerCase()}`}>
              {isPending(tx.status) && <LoadingSpinner size={12}/>}
              {tx.status}
            </span>
            <span>{new Date(tx.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </section>
    </AppLayout>
  );
}
