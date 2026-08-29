import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ccc } from "@ckb-ccc/connector-react";
import {
 Activity,
 ArrowLeftRight,
 Coins,
 Database,
 FileCode2,
 PenLine,
 Sprout,
 WalletCards,
} from "lucide-react";
import {
 backendApi,
 type DashboardResponse,
 type NetworkResponse,
} from "../api/backend";
import { AppLayout, PageHero } from "../components/layout/AppLayout";
import { RecentTransactions } from "../components/RecentTransactions";
import { LoadingSpinner } from "../components/Loading";
import { useWallet } from "../hooks/useWallet";

const emptyDashboard: DashboardResponse = {
 network: "",
 tipBlockNumber: "",
 trackedTransactions: 0,
 recentTransactions: [],
};

export function Dashboard() {
 const wallet = useWallet();
 const signer = ccc.useSigner();
 const { client, open } = ccc.useCcc();
 const navigate = useNavigate();

 const [network, setNetwork] = useState<NetworkResponse>({
  network: "",
  rpcUrl: "",
 });
 const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
 const [liveCellCount, setLiveCellCount] = useState(0);
 const [backendError, setBackendError] = useState("");
 const [backendLoading, setBackendLoading] = useState(false);
 const [cellsLoading, setCellsLoading] = useState(false);

 const loadBackend = useCallback(async () => {
  try {
   setBackendLoading(true);
   setBackendError("");
   const networkInfo = await backendApi.getNetwork();
   setNetwork(networkInfo);

   if (wallet.address) {
    setDashboard(await backendApi.getDashboard(wallet.address));
   }
  } catch (error) {
   setBackendError(error instanceof Error ? error.message : String(error));
  } finally {
   setBackendLoading(false);
  }
 }, [wallet.address]);

 const loadCells = useCallback(async () => {
  if (!signer) {
   setLiveCellCount(0);
   return;
  }

  let count = 0;
  setCellsLoading(true);
  try {
   for await (const _cell of signer.findCells({}, true, "desc", 50)) {
    count += 1;
   }
   setLiveCellCount(count);
  } catch {
   setLiveCellCount(0);
  } finally {
   setCellsLoading(false);
  }
 }, [signer]);

 useEffect(() => {
  void loadBackend();
  void loadCells();
 }, [loadBackend, loadCells]);

 useEffect(() => {
  const hasPending = dashboard.recentTransactions.some(
   tx => !["committed", "rejected"].includes((tx.status || "").toLowerCase()),
  );
  if (!wallet.address || !hasPending) return;
  const id = window.setInterval(() => void loadBackend(), 5000);
  return () => window.clearInterval(id);
 }, [wallet.address, dashboard.recentTransactions, loadBackend]);

 function goFeature(path: string) {
  if (!signer) {
   open();
   return;
  }
  navigate(path);
 }

 const frontendNetwork =
  client.addressPrefix === "ckb" ? "mainnet" : "testnet";

 const networkMismatch =
  network.network &&
  network.network !== "offline" &&
  network.network.toLowerCase() !== frontendNetwork;

 const activityRows = useMemo(
  () => dashboard.recentTransactions.slice(0, 6),
  [dashboard.recentTransactions],
 );

 return (
  <AppLayout>
   <PageHero
    eyebrow="Overview"
    title="CKB DApp Dashboard"
    description="One application integrating CCC wallet connection, Cell queries, CKB transactions, xUDT, Spore/DOB and message signing."
   />

   {backendError && (
    <div className="alert error">Backend unavailable: {backendError}</div>
   )}

   {networkMismatch && (
    <div className="alert warning">
     Network mismatch: CCC is {frontendNetwork}, backend is {network.network}.
    </div>
   )}

   <section className="dashboard-kpis">
    <article className="kpi-card">
     <span>Total Balance</span>
     <strong>{wallet.balanceCkb} <small>CKB</small></strong>
     <p>Connected wallet</p>
    </article>

    <article className="kpi-card">
     <span>Live Cells</span>
     <strong>{cellsLoading ? <LoadingSpinner size={22}/> : liveCellCount}</strong>
     <p>Up to first 50 queried Cells</p>
    </article>

    <article className="kpi-card">
     <span>Transactions</span>
     <strong>{backendLoading ? <LoadingSpinner size={22}/> : dashboard.trackedTransactions}</strong>
     <p>Tracked by Backend</p>
    </article>

    <article className="kpi-card">
     <span>Network</span>
     <strong className="kpi-network">{network.network || frontendNetwork}</strong>
     <p>Tip #{dashboard.tipBlockNumber || "—"}</p>
    </article>
   </section>

   <div className="dashboard-product-grid">
    <section className="panel recent-product">
     <div className="panel-title-row">
      <div>
       <span className="page-eyebrow">Activity</span>
       <h2>Recent Activities</h2>
      </div>
      <Link to="/activity-log">View all</Link>
     </div>

     <RecentTransactions
      rows={activityRows}
      onRefresh={() => void loadBackend()}
      loading={backendLoading}
     />
    </section>

    <section className="panel quick-actions-panel">
     <span className="page-eyebrow">Quick actions</span>
     <h2>Build on CKB</h2>

     <div className="dashboard-actions">
      <button onClick={() => goFeature("/wallet")}><WalletCards/><span><b>Wallet</b><small>Connect and inspect account</small></span></button>
      <button onClick={() => goFeature("/cells")}><Database/><span><b>Live Cells</b><small>Query Cell state</small></span></button>
      <button onClick={() => goFeature("/transfer-ckb")}><ArrowLeftRight/><span><b>Transfer CKB</b><small>Compose and sign transaction</small></span></button>
      <button onClick={() => goFeature("/store-data")}><FileCode2/><span><b>Store Data</b><small>Write bytes into Cell data</small></span></button>
      <button onClick={() => goFeature("/fungible-token")}><Coins/><span><b>Fungible Token</b><small>Work with xUDT</small></span></button>
      <button onClick={() => goFeature("/dob-spore")}><Sprout/><span><b>DOB / Spore</b><small>Create digital objects</small></span></button>
      <button onClick={() => goFeature("/sign-message")}><PenLine/><span><b>Sign Message</b><small>Off-chain wallet proof</small></span></button>
      <button onClick={() => goFeature("/activity-log")}><Activity/><span><b>Activity Log</b><small>Backend-tracked transactions</small></span></button>
     </div>
    </section>
   </div>
  </AppLayout>
 );
}
