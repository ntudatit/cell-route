import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FEATURES } from '../dev-console/features';
import { isFiberRoute } from '../utils/routes';
import { PortalLink as Link } from '../components/PortalLink';
import { Wallet, ShieldCheck, Layers, ArrowRight, Coins, Database, Boxes, Activity, RadioTower, Code2, Search, Star, BookOpen, LayoutDashboard, CreditCard } from 'lucide-react';
import { useFeatureCcc, useFeatureSigner } from '../dev-console/hooks';
import { clientNetwork } from '../utils/network';
import { AppLayout } from '../components/layout/AppLayout';
const services = [
 {title:'Wallet',to:'/wallet',icon:Wallet,color:'#0078d4',type:'Account'},
 {title:'Transfer CKB',to:'/transfer-ckb',icon:ArrowRight,color:'#0078d4',type:'Settlement'},
 {title:'Live Cells',to:'/cells',icon:Database,color:'#00a4a6',type:'Storage'},
 {title:'Fungible Token',to:'/fungible-token',icon:Coins,color:'#8661c5',type:'Asset'},
 {title:'DOB / Spore',to:'/dob-spore',icon:Boxes,color:'#d98916',type:'Asset'},
 {title:'Fiber Checkout',to:'/checkout',icon:CreditCard,color:'#0078d4',type:'Payments'},
 {title:'Browser Node',to:'/fiber-node',icon:RadioTower,color:'#00a4a6',type:'Infrastructure'},
 {title:'Activity Log',to:'/activity-log',icon:Activity,color:'#e26d30',type:'Monitoring'},
 {title:'Explorer',to:'/explorer',icon:Search,color:'#0078d4',type:'Tools'},
];
export function PlatformOverviewPage() {
 const {client,open}=useFeatureCcc(); const signer=useFeatureSigner(); const network=clientNetwork(client);
 const [params]=useSearchParams(); const navigate=useNavigate(); const prompted=useRef(false);
 useEffect(()=>{
  if(params.get('connect')!=='1') {prompted.current=false;return;}
  if(signer){const next=params.get('next')??'/dashboard';const target=Object.hasOwn(FEATURES,next)?next:'/dashboard';if(isFiberRoute(target))window.location.assign(target);else navigate(target,{replace:true});}
  else if(!prompted.current){prompted.current=true;void open();}
 },[params,signer,open,navigate]);
 const [tab,setTab]=useState('all');
 const [favorites,setFavorites]=useState<string[]>(()=>{try {const saved=JSON.parse(localStorage.getItem('cellroute.favorite-services')??'null');return Array.isArray(saved)?saved.filter((v:unknown)=>typeof v==='string'&&services.some(s=>s.to===v)):['/wallet','/cells'];}catch{return ['/wallet','/cells'];}});
 useEffect(()=>{try{localStorage.setItem('cellroute.favorite-services',JSON.stringify(favorites));}catch{/* Favorites still work for this session when storage is unavailable. */}},[favorites]);
 const rows=services.filter(s=>tab==='all'||favorites.includes(s.to));
 return <AppLayout><div className="azure-home">
  <section className="home-hero" aria-label="Welcome"><div className="home-hero-copy"><span className="home-eyebrow">THE NERVOS WORKSPACE</span><h1>Welcome to CellRoute</h1><p className="home-lead">Your assets. Your payments.<br/><em>One connected workspace.</em></p><p>Manage CKB assets, explore the Cell model, and operate Fiber payments — with signing controlled by your wallet.</p><div className="home-hero-actions">{signer ? <Link className="azure-primary" to="/dashboard">Open dashboard <ArrowRight size={16}/></Link> : <button className="azure-primary" onClick={()=>void open()}>Connect wallet <ArrowRight size={16}/></button>}<a href="#service-directory">Browse services <ArrowRight size={15}/></a></div><div className="home-context"><span><i/>{network} workspace</span><span><ShieldCheck size={14}/>{signer?'Wallet connected':'Wallet-controlled signing'}</span></div></div><div className="home-system"><div className="home-system-heading"><span>YOUR WORKSPACE</span><span>Nervos CKB + Fiber</span></div><Link to="/wallet" className="home-system-node"><span className="home-system-icon"><Wallet size={24}/></span><div><strong>Wallet & assets</strong><small>Connect · manage · sign</small></div><ArrowRight size={16}/></Link><div className="home-system-connector"/><Link to="/transfer-ckb" className="home-system-node"><span className="home-system-icon"><Database size={24}/></span><div><strong>CKB settlement</strong><small>Cells · tokens · digital objects</small></div><ArrowRight size={16}/></Link><div className="home-system-connector"/><Link to="/fiber-ops" className="home-system-node"><span className="home-system-icon"><RadioTower size={24}/></span><div><strong>Fiber payments</strong><small>Invoices · channels · operations</small></div><ArrowRight size={16}/></Link><p><ShieldCheck size={14}/>Your keys stay with your wallet.</p></div></section><div className="home-section-heading"><div><span className="home-eyebrow">GET STARTED</span><h2>What would you like to do?</h2></div><p>Choose a starting point. Connect your wallet when needed.</p></div>
  <section className="azure-start-grid" aria-label="Get started">
   {[{title:'Connect your wallet',copy:'Access your CKB account and manage assets with wallet-controlled signing.',to:'/wallet',action:'Open wallet',icon:Wallet,tone:'blue'}, {title:'Manage your assets',copy:'Explore live Cells, tokens, and digital objects in one workspace.',to:'/assets',action:'View assets',icon:ShieldCheck,tone:'cyan'}, {title:'Build with CellRoute',copy:'Learn CKB scripting and explore tools for your next application.',to:'/playground',action:'Explore tools',icon:Layers,tone:'purple'}].map(({title,copy,to,action,icon:Icon,tone})=><article key={to}><div className={`azure-illustration ${tone}`}><span/><Icon size={76} strokeWidth={1.2}/><i/></div><h2>{title}</h2><p>{copy}</p><Link className="azure-primary" to={to}>{action}</Link></article>)}
  </section>
  <section className="azure-section"><div className="azure-section-title"><h2>CellRoute services</h2><Link to="/playground">Explore tools <ArrowRight size={14}/></Link></div><div className="azure-services">{services.map(({title,to,icon:Icon,color})=><Link to={to} key={to}><Icon size={28} color={color}/><span>{title}</span></Link>)}</div></section>
  <section className="azure-section home-directory" id="service-directory"><div className="home-section-heading"><div><span className="home-eyebrow">EXPLORE YOUR TOOLS</span><h2>Service directory</h2></div><p>{rows.length} {rows.length===1?'service':'services'} · Pin favorites for your next visit</p></div><div className="azure-directory-toolbar"><div role="tablist" aria-label="Service directory"><button role="tab" aria-selected={tab==='all'} onClick={()=>setTab('all')}>All services</button><button role="tab" aria-selected={tab==='favorites'} onClick={()=>setTab('favorites')}>Favorites</button></div></div>
   <div className="azure-table-wrap"><table className="azure-table"><thead><tr><th>Name</th><th>Type</th><th>Favorite</th></tr></thead><tbody>{rows.map(({title,to,icon:Icon,type,color})=><tr key={to}><td><Link to={to}><Icon size={17} color={color}/>{title}</Link></td><td>{type}</td><td><button aria-label={`Favorite ${title}`} aria-pressed={favorites.includes(to)} onClick={()=>setFavorites(v=>v.includes(to)?v.filter(x=>x!==to):[...v,to])}><Star size={16} fill={favorites.includes(to)?'#0078d4':'none'}/></button></td></tr>)}</tbody></table>{!rows.length&&<div className="home-empty"><Star size={28}/><h3>Your favorites start here</h3><p>Select the star beside a service to keep it here.</p><button onClick={()=>setTab('all')}>Show all services</button></div>}</div>
  </section>
  <section className="azure-section"><h2>Keep building with CellRoute</h2><div className="azure-tools">{[{title:'Dashboard',to:'/dashboard',icon:LayoutDashboard,copy:'Your account at a glance'},{title:'Merchant Console',to:'/merchant',icon:CreditCard,copy:'Manage orders and invoices'},{title:'Fiber operations',to:'/fiber-ops',icon:Activity,copy:'Monitor channels and payments'},{title:'Developer guides',to:'/playground',icon:Code2,copy:'Build on Nervos CKB'}].map(({title,to,icon:Icon,copy})=><Link to={to} key={to}><Icon size={25}/><span>{title}<small>{copy}</small></span></Link>)}</div></section>
  <section className="azure-section azure-useful"><div><h2>Useful links</h2><Link to="/connect-wallets"><BookOpen size={15}/>Wallet connection guide</Link><Link to="/compose-transactions">Compose transactions</Link><Link to="/node-backend">Backend integration</Link></div><div><h2>Built for Nervos</h2><p>CKB settlement · Fiber payments<br/>Your keys stay with your wallet.</p></div></section>
 </div></AppLayout>;
}
