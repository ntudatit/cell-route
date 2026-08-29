import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LockKeyhole, RadioTower } from "lucide-react";
import { backendApi, type NetworkResponse } from "../../api/backend";
import { Header } from "../Header";
import { Sidebar } from "../Sidebar";
import { useWallet } from "../../hooks/useWallet";

export function AppLayout({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [network, setNetwork] = useState<NetworkResponse>({ network: "", rpcUrl: "" });
  const [tip, setTip] = useState("-");
  const [loading, setLoading] = useState(true);

  const refreshNetwork = useCallback(async () => {
    setLoading(true);
    try {
      const [n, t] = await Promise.all([backendApi.getNetwork(), backendApi.getTip()]);
      setNetwork(n);
      setTip(t.decimal);
    } catch {
      setNetwork({ network: "offline", rpcUrl: "" });
      setTip("-");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshNetwork(); }, [refreshNetwork]);

  const networkLabel = loading ? "loading" : network.network;
  const tipLabel = loading ? "..." : tip;

  return (
    <div className="app-shell blockchain-shell">
      <Sidebar network={networkLabel} tip={tipLabel} />
      <main className="content blockchain-content">
        <Header address={wallet.address} network={networkLabel} tip={tipLabel} />
        <div className="content-body">{children}</div>
        <footer className="ops-footer-strip">
          <span><RadioTower size={13} /> FiberPay Platform <b>v1.5.0 · Hybrid Fiber</b></span>
          <span><LockKeyhole size={13} /> Secure application boundary <em>TLS / JWT</em></span>
          <span><i className={network.network && network.network !== "offline" ? "footer-live" : "footer-offline"} /> CKB {network.network || "offline"} · tip #{tip}</span>
        </footer>
      </main>
    </div>
  );
}

export function PageHero({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <section className="page-hero">
      <div>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </section>
  );
}
