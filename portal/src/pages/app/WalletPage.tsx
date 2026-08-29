import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ccc } from "@ckb-ccc/connector-react";
import {
 ArrowLeftRight,
 Copy,
 Database,
 PenLine,
 RefreshCw,
 ShieldCheck,
} from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { useWallet } from "../../hooks/useWallet";

export function WalletPage() {
 const walletState = useWallet();
 const { wallet, signerInfo, client } = ccc.useCcc();
 const signer = ccc.useSigner();
 const [signerType, setSignerType] = useState("-");
 const [signType, setSignType] = useState("-");

 useEffect(() => {
  if (!signer) {
   setSignerType("-");
   setSignType("-");
   return;
  }
  setSignerType(String(signer.type ?? "CCC Signer"));
  setSignType(String(signer.signType ?? "Wallet dependent"));
 }, [signer]);

 const network = client.addressPrefix === "ckb" ? "CKB Mainnet" : "CKB Testnet";

 return (
  <AppLayout>
   <PageHero
    eyebrow="CCC · Connect Wallets"
    title="Wallet"
    description="Use CCC's unified connector and Signer interface across supported wallet ecosystems."
    actions={
     <div className="page-action-row">
      <button className="btn secondary compact" onClick={() => void walletState.refresh()}>
       <RefreshCw size={16}/> Refresh
      </button>
      {signerInfo && (
       <button className="btn secondary compact" onClick={() => void walletState.refresh()}>
        Change Network
       </button>
      )}
     </div>
    }
   />

   {walletState.error && <div className="alert error">{walletState.error}</div>}

   <div className="wallet-product-grid">
    <section className="panel wallet-information">
     <div className="panel-title-row">
      <div>
       <span className="page-eyebrow">Account</span>
       <h2>Wallet Information</h2>
      </div>
      <ShieldCheck className={signer ? "green" : ""}/>
     </div>

     <div className="wallet-address-box">
      <span>Address</span>
      <div>
       <code>{walletState.address || "Connect a wallet to continue"}</code>
       {walletState.address && (
        <button
         className="copy-mini"
         onClick={() => navigator.clipboard.writeText(walletState.address)}
        >
         <Copy size={14}/>
        </button>
       )}
      </div>
     </div>

     <div className="wallet-meta-grid">
      <div><span>Wallet</span><strong>{wallet?.name ?? "-"}</strong></div>
      <div><span>Signer Type</span><strong>{signerType}</strong></div>
      <div><span>Sign Type</span><strong>{signType}</strong></div>
      <div><span>Network</span><strong className="green">● {network}</strong></div>
     </div>
    </section>

    <div className="wallet-side-column">
     <section className="panel balance-panel">
      <span className="page-eyebrow">Balance</span>
      <strong className="wallet-balance">{walletState.balanceCkb} <small>CKB</small></strong>
      <p>Live balance from the active CCC signer.</p>
     </section>

     <section className="panel quick-wallet-actions">
      <span className="page-eyebrow">Quick actions</span>
      <Link to="/cells"><Database size={17}/> View Cells</Link>
      <Link to="/transfer-ckb"><ArrowLeftRight size={17}/> Transfer CKB</Link>
      <Link to="/sign-message"><PenLine size={17}/> Sign Message</Link>
     </section>
    </div>
   </div>

   <section className="panel about-ccc-panel">
    <span className="page-eyebrow">About CCC</span>
    <p>
     CCC provides one unified interface for wallet connection, chain queries,
     transaction composition and signing. Private keys stay in the wallet.
    </p>
   </section>
  </AppLayout>
 );
}