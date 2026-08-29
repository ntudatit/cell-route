import { ChevronDown, LogOut } from "lucide-react";
import { ccc } from "@ckb-ccc/connector-react";

function short(value: string) {
 return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export function WalletButton({ address }: { address: string }) {
 const { open, disconnect, wallet, signerInfo } = ccc.useCcc();

 if (!signerInfo) {
  return <button className="wallet-top connect" onClick={open}>Connect wallet</button>;
 }

 return (
  <div className="wallet-actions">
   <button className="wallet-top" onClick={open} title="Open CCC connector">
    <div className="avatar">C</div>
    <div><b>{wallet?.name ?? "CKB Wallet"}</b><span>{address ? short(address) : "Connected"}</span></div>
    <ChevronDown size={15}/>
   </button>
   <button className="disconnect-btn" onClick={disconnect} title="Disconnect wallet"><LogOut size={16}/></button>
  </div>
 );
}
