import { useEffect, useRef, useState, type Ref } from 'react';
import { PortalLink as Link } from './PortalLink';
import { Search, Menu, CircleHelp, MoreHorizontal, ExternalLink } from 'lucide-react';
import { WalletButton } from './WalletButton';
import { BackendAuthButton } from './BackendAuthButton';
import { isFiberRoute } from '../utils/routes';
import { FEATURES } from '../dev-console/features';
export function Header({ address, network, menuExpanded, onToggleMenu, menuButtonRef }: { address: string; network?: string; tip?: string; menuExpanded: boolean; onToggleMenu: () => void; menuButtonRef: Ref<HTMLButtonElement> }) {
 const actionsRef = useRef<HTMLDetailsElement>(null);
 useEffect(() => {
  const close = (event: PointerEvent) => { if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) actionsRef.current.open = false; };
  document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close);
 }, []);
 const [query, setQuery] = useState('');
 const results = Object.entries(FEATURES).filter(([path,title]) => !path.includes('#') && title.toLowerCase().includes(query.toLowerCase())).slice(0,7);
 return <header className="topbar blockchain-topbar azure-header">
  <div className="azure-brand"><button ref={menuButtonRef} className="azure-menu-toggle" aria-label={menuExpanded ? "Collapse navigation menu" : "Expand navigation menu"} aria-expanded={menuExpanded} aria-controls="azure-navigation" onClick={onToggleMenu}><Menu size={20}/></button><Link to="/platform"><strong>CellRoute</strong></Link></div>
  <div className="azure-search"><Search size={15}/><input aria-label="Search services" placeholder="Search services, tools, and documentation" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setQuery('');}}/>
   {query && <div className="azure-search-results">{results.length ? results.map(([path,title])=><Link key={path} to={path} onClick={()=>setQuery('')}>{title}</Link>) : <p>No services found</p>}</div>}
  </div>
  <div className="topbar-actions" role="group" aria-label="Account and workspace actions">
   <span className="azure-network" title="Selected CKB network"><i/>{network || 'Unknown network'}</span>
   <div className="topbar-secondary"><Link className="topbar-help" to="/connect-wallets" aria-label="Help" title="Wallet connection guide"><CircleHelp size={18}/></Link>{!isFiberRoute() && <BackendAuthButton/>}</div>
   {isFiberRoute() ? <Link className="topbar-wallet-link" to="/wallet">Open wallet <ExternalLink size={14}/></Link> : <WalletButton address={address}/>}
   <details className="topbar-overflow" ref={actionsRef} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();if(actionsRef.current){actionsRef.current.open=false;actionsRef.current.querySelector('summary')?.focus();}}}}>
    <summary aria-label="More workspace actions" title="More workspace actions"><MoreHorizontal size={20}/></summary>
    <div className="topbar-popover"><strong>Workspace</strong><p>CKB {network || 'Unknown network'}</p>{!isFiberRoute() && <BackendAuthButton/>}<Link to="/connect-wallets" onClick={()=>{if(actionsRef.current)actionsRef.current.open=false;}}><CircleHelp size={16}/>Wallet connection guide</Link></div>
   </details>
  </div>
 </header>;
}
