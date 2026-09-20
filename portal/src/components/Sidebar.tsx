import { useFeatureCcc, useFeatureSigner } from '../dev-console/hooks';
import {
  Activity,
  Boxes,
  ArrowLeftRight,
  Coins,
  Database,
  Droplets,
  FileCode2,
  LayoutDashboard,
  PenLine,
  Search,
  Sprout,
  WalletCards,
  Store,
  Gauge,
  Route,
  HeartPulse,
  GitCompareArrows,
  Siren,
  Cpu,
  Bot,
  Network,
  CreditCard,
  Code2,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ccc } from "@ckb-ccc/connector-react";
import { Logo } from "./Logo";
import { isFiberRoute } from "../utils/routes";

const commerce = [
  { to: "/platform", label: "Platform Overview", icon: LayoutDashboard },
  { to: "/checkout", label: "FiberPay Checkout", icon: CreditCard, external: true },
  { to: "/merchant", label: "Merchant Console", icon: Store, external: true },
];

const settlement = [
  { to: "/dashboard", label: "CKB Dashboard", icon: LayoutDashboard },
  { to: "/wallet", label: "Wallet", icon: WalletCards },
  { to: "/cells", label: "Live Cells", icon: Database },
  { to: "/transfer-ckb", label: "Transfer CKB", icon: ArrowLeftRight },
  { to: "/store-data", label: "Store Data", icon: FileCode2 },
  { to: "/fungible-token", label: "Fungible Token", icon: Coins },
  { to: "/dob-spore", label: "DOB / Spore", icon: Sprout },
  { to: "/spore-clusters", label: "Spore Clusters", icon: Boxes },
  { to: "/assets", label: "My Assets", icon: Boxes },
  { to: "/sign-message", label: "Sign Message", icon: PenLine },
  { to: "/activity-log", label: "Activity Log", icon: Activity },
];


const fiberOps = [
  { to: "/fiber-ops", label: "Operations Overview", icon: Gauge, external: true },
  { to: "/fiber-node", label: "Browser Fiber Node", icon: Cpu, external: true },
  { to: "/fiber-transfers", label: "Payments & Routing", icon: Network, external: true },
  { to: "/fiber-lab", label: "Two Node Lab", icon: Route, external: true },
  { to: "/fiber-ai", label: "AI Operations Copilot", icon: Bot, external: true },
];

const tools = [
  { to: "/reports/week-6", label: "Week 6 Report", icon: FileCode2 },
  { to: "/simple-lock", label: "Simple Lock Lab", icon: FileCode2 },
  { to: "/docs", label: "FiberPay API", icon: Code2 },
  { to: "/explorer", label: "CKB Explorer", icon: Search },
  { to: "/faucet", label: "Testnet Faucet", icon: Droplets },
];

type NavItem = { to: string; label: string; icon: LucideIcon; external?: boolean };

function NavGroup({
  label,
  items,
  locked,
}: {
  label: string;
  items: readonly NavItem[];
  locked?: boolean;
}) {
  const { open } = useFeatureCcc();
  return (
    <>
      <div className="sidebar-section-label">{label}</div>
      <nav>
        {items.map(({ to, label: itemLabel, icon: Icon, external }) => {
          if (locked) {
            return (
              <button
                className="navLink navLocked"
                key={to}
                type="button"
                title="Connect wallet to unlock this feature"
                onClick={open}
              >
                <Icon size={17} />
                <span>{itemLabel}</span>
                <span className="nav-lock">🔒</span>
              </button>
            );
          }

          if (external) {
            return <a className={window.location.pathname === to ? "navLink active" : "navLink"} href={to} key={to}><Icon size={17}/><span>{itemLabel}</span></a>;
          }

          return (
            <NavLink
              className={({ isActive }) => (isActive ? "active" : "")}
              to={to}
              key={to}
            >
              <Icon size={17} />
              <span>{itemLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({ network, tip, connected = false }: { network: string; tip: string; connected?: boolean }) {
  const signer = useFeatureSigner();
  const navigate = useNavigate();
  const fiberRoute = isFiberRoute();

  return (
    <aside className="sidebar">
      <button className="sidebar-logo-button" onClick={() => fiberRoute ? window.location.assign("/") : navigate(signer ? "/dashboard" : "/")}>
        <Logo />
      </button>

      <div className="sidebar-scroll">
        <NavGroup label="FiberPay" items={commerce} />
        <NavGroup label="FiberOps" items={fiberOps} />
        <NavGroup label="CKB Settlement" items={settlement} locked={!signer} />
        <NavGroup label="Developers" items={tools.filter(item => network !== "mainnet" || !["/faucet", "/simple-lock"].includes(item.to))} />
      </div>

      <div className="network-box">
        <div>
          <span className="network-live"><i /> CKB Network</span>
          <span className="connected">{connected ? "Live" : "Connecting"}</span>
        </div>
        <hr />
        <div className="network-row">
          <span>{network || "..."}</span>
          <span>#{tip || "..."}</span>
        </div>
      </div>

    </aside>
  );
}
