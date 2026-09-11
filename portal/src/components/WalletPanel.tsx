import { useFeatureCcc } from '../dev-console/hooks';
import { Copy, RefreshCw, Send } from "lucide-react";
import { ccc } from "@ckb-ccc/connector-react";

function short(value: string) {
 return value ? `${value.slice(0, 12)}...${value.slice(-8)}` : "Not connected";
}

export function WalletPanel({ address, balance, loading, onRefresh, onSend }: {
 address: string;
 balance: string;
 loading: boolean;
 onRefresh: () => void;
 onSend: () => void;
}) {
 const { open, signerInfo } = useFeatureCcc();

 async function copyAddress() {
  if (address) await navigator.clipboard.writeText(address);
 }

 return (
  <section className="panel wallet-panel" id="wallet">
   <div className="panel-title"><h3>Wallet</h3><button onClick={onRefresh}><RefreshCw size={15}/>{loading ? "Loading" : "Refresh"}</button></div>
   <hr/>
   <div className="info-row"><span>Status</span><span className={signerInfo ? "connected" : "offline"}>{signerInfo ? "Connected" : "Disconnected"}</span></div>
   <div className="info-row"><span>Address</span><strong title={address}>{short(address)}</strong></div>
   <div className="info-row"><span>Balance</span><strong>{balance} CKB</strong></div>
   {!signerInfo ? (
    <button className="primary" onClick={open}>Connect with CCC</button>
   ) : (
    <>
     <button className="primary" onClick={onSend}><Send size={17}/>Send CKB</button>
     <button className="secondary" onClick={copyAddress}><Copy size={17}/>Copy receive address</button>
    </>
   )}
  </section>
 );
}
