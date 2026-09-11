import { useFeatureCcc } from '../../dev-console/hooks';
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from 'react-router-dom';
import { ccc } from '@ckb-ccc/connector-react';
import { LockKeyhole, RadioTower } from "lucide-react";
import { Header } from "../Header";
import { Sidebar } from "../Sidebar";
import { useWallet } from "../../hooks/useWallet";
import { clientNetwork } from '../../utils/network';

export function AppLayout({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:760px)').matches);
  const [desktopExpanded, setDesktopExpanded] = useState(() => { try { return localStorage.getItem('cellroute.menu-expanded') !== 'false'; } catch { return true; } });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuExpanded = mobile ? drawerOpen : desktopExpanded;
  function closeDrawer() { setDrawerOpen(false); menuButton.current?.focus(); }
  function toggleMenu() {
    if (mobile) setDrawerOpen(value => !value);
    else setDesktopExpanded(value => { try { localStorage.setItem('cellroute.menu-expanded', String(!value)); } catch { /* Session preference remains available. */ } return !value; });
  }
  useEffect(() => {
    const media = window.matchMedia('(max-width:760px)');
    const update = () => { setMobile(media.matches); setDrawerOpen(false); };
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!mobile || !drawerOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [mobile, drawerOpen]);
  const { client } = useFeatureCcc();
  const network = clientNetwork(client);
  const [tip, setTip] = useState('…');
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let active = true;
    setConnected(false); setTip('…');
    async function refresh() {
      try {
        const header = await client.getTipHeader();
        if (active) { setTip(header.number.toString()); setConnected(true); }
      } catch { if (active) { setConnected(false); setTip('unavailable'); } }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(id); };
  }, [client]);
  return <div className={`app-shell blockchain-shell ${menuExpanded ? 'menu-expanded' : 'menu-collapsed'}`}>
    <div id="azure-navigation" className="azure-navigation" hidden={!menuExpanded} onClick={event => { if (mobile && (event.target as Element).closest('a,button')) setDrawerOpen(false); }}>
      <Sidebar network={network} tip={tip} connected={connected} />
    </div>
    {mobile && drawerOpen && <button className="azure-menu-backdrop" aria-label="Close navigation menu" onClick={closeDrawer} />}
    <main className="content blockchain-content">
      <Header address={wallet.address} network={network} tip={tip} menuExpanded={menuExpanded} onToggleMenu={toggleMenu} menuButtonRef={menuButton} />
      <div className="content-body">{network === 'mainnet' && <p className="status-line" role="note">CKB Mainnet · Transactions use real CKB. Review the recipient, amount and fee in your wallet.</p>}{children}</div>
      <footer className="ops-footer-strip">
        <span><RadioTower size={13} /> FiberPay Platform <b>v1.5.0 · Hybrid Fiber</b></span>
        <span><LockKeyhole size={13} /> Wallet-controlled signing</span>
        <span><i className={connected ? 'footer-live' : 'footer-offline'} /> CKB {network} · {connected ? `tip #${tip}` : 'RPC unavailable'}</span>
      </footer>
    </main>
  </div>;
}

export function PageHero({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
 return <section className="page-hero"><div>{eyebrow && <span className="page-eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</section>;
}
