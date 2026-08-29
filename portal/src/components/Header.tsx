import { Activity, ChevronDown, Clock3, Hexagon, Wifi } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { BackendAuthButton } from "./BackendAuthButton";
import { isFiberRoute } from "../utils/routes";

export function Header({ address, network, tip }: { address: string; network?: string; tip?: string }) {
  const fiberRoute = isFiberRoute();
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <header className="topbar blockchain-topbar">
      <div className="topbar-context">
        <span className="chain-pulse"><Hexagon size={14} /> {fiberRoute ? "FIBEROPS" : "CKB APPLICATION"}</span>
        <span className="chain-separator">//</span>
        <span className="chain-context-copy">{fiberRoute ? "OPERATIONS CONTROL PLANE" : "ASSET & WALLET PORTAL"}</span>
      </div>

      <div className="header-status-group">
        <span className="header-status-pill"><i className={network && network !== "offline" ? "online" : "offline"} /><small>NODE</small>{network && network !== "offline" ? "ONLINE" : "OFFLINE"}</span>
        <span className="header-status-pill"><Activity size={13} /><small>TIP</small>#{tip ?? "—"}</span>
        <span className="header-status-pill network"><Wifi size={13} /><small>NETWORK</small>{network || "—"}<ChevronDown size={12} /></span>
        <span className="header-status-pill"><Clock3 size={13} />{now}</span>
      </div>

      {!fiberRoute && <div className="topbar-actions"><BackendAuthButton /><WalletButton address={address} /></div>}
    </header>
  );
}
