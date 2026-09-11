import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { ccc } from '@ckb-ccc/connector-react';
import { clientNetwork } from '../utils/network';
import { scopeFor, type LogScope } from './features';
import { beginOperation, clearLogs, exportLogs, snapshot, subscribe, LOG_LIMIT, type LogEntry } from './store';
import './console.css';
export function FeatureDevConsole() {
 const location = useLocation(); const { client } = ccc.useCcc();
 const [hash, setHash] = useState(globalThis.location.hash);
 useEffect(() => { const update = () => setHash(globalThis.location.hash); window.addEventListener('hashchange', update); window.addEventListener('feature-log-scope', update); return () => { window.removeEventListener('hashchange', update); window.removeEventListener('feature-log-scope', update); }; }, []);
 useEffect(() => setHash(globalThis.location.hash), [location.pathname, location.hash]);
 const scope = scopeFor(location.pathname, hash, clientNetwork(client));
 return <ConsolePanel key={scope.key} scope={scope} />;
}
function ConsolePanel({ scope }: { scope: LogScope }) {
 const entries = useSyncExternalStore(useCallback(listener => subscribe(scope.key, listener), [scope.key]), () => snapshot(scope.key), () => snapshot(scope.key));
 const [open, setOpen] = useState(false); const [paused, setPaused] = useState<readonly LogEntry[] | null>(null);
 const [level, setLevel] = useState('all'); const [query, setQuery] = useState(''); const [follow, setFollow] = useState(true);
 const list = useRef<HTMLDivElement>(null); const panel = useRef<HTMLElement>(null);
 useEffect(() => {
  if (!open || !panel.current) return;
  const root = document.documentElement;
  const resize = () => root.style.setProperty('--dev-console-height', `${panel.current!.getBoundingClientRect().height + 32}px`);
  resize(); root.classList.add('dev-console-open');
  const observer = new ResizeObserver(resize); observer.observe(panel.current);
  return () => { observer.disconnect(); root.classList.remove('dev-console-open'); root.style.removeProperty('--dev-console-height'); };
 }, [open]);
 useEffect(() => { const event = beginOperation(scope, 'feature', 'Feature opened'); event.complete(); }, [scope.key]);
 const visible = (paused ?? entries).filter(entry => (level === 'all' || entry.level === level) && `${entry.operation} ${entry.source} ${entry.phase} ${JSON.stringify(entry.details)}`.toLowerCase().includes(query.toLowerCase()));
 useEffect(() => { if (open && follow && !paused && list.current) list.current.scrollTop = list.current.scrollHeight; }, [entries, open, follow, paused]);
 function download() {
  const url = URL.createObjectURL(new Blob([exportLogs(scope, paused ?? entries)], { type: 'application/x-ndjson' }));
  const link = document.createElement('a'); link.href = url; link.download = `${scope.feature.replace(/[^a-z0-9]/gi, '-')}-${scope.network}-console.jsonl`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 }
 if (!open) return <button className="dev-console-launch" aria-expanded="false" onClick={() => setOpen(true)}>Dev Console · {scope.title} <span>{entries.length}</span></button>;
 return <section ref={panel} className="dev-console" aria-label={`${scope.title} developer console`}>
  <header><div><strong>{scope.title} · Dev Console</strong><span>{scope.network} · {paused ? 'Paused view · capture continues' : 'Live'} · {entries.length}/{LOG_LIMIT}</span></div><button aria-label="Collapse developer console" onClick={() => setOpen(false)}>Collapse</button></header>
  <div className="dev-console-toolbar"><label>Level<select aria-label="Level" value={level} onChange={e => setLevel(e.target.value)}><option value="all">All</option><option value="info">Info</option><option value="success">Success</option><option value="error">Errors</option></select></label><label>Filter<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Operation or status" /></label><label className="dev-follow"><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)}/> Follow</label><button onClick={() => setPaused(paused ? null : entries)}>{paused ? 'Resume' : 'Pause'}</button><button onClick={() => { clearLogs(scope.key); if (paused) setPaused([]); }}>Clear</button><button onClick={download} disabled={!(paused ?? entries).length}>Export JSONL</button></div>
  <div className="dev-console-entries" ref={list} role="log" aria-live={paused ? 'off' : 'polite'} aria-label="Feature events">
   {!visible.length && <p className="dev-console-empty">No matching events. Run an action in this feature.</p>}
   {visible.map(entry => <div className={`dev-console-entry dev-level-${entry.level}`} key={entry.id}><time dateTime={entry.time}>{entry.time.slice(11, 23)}</time><span>{entry.level}</span><code>{entry.source} · {entry.operation} · {entry.phase} <small>#{entry.operationId}{entry.durationMs != null ? ` · ${entry.durationMs} ms` : ''}</small>{Object.keys(entry.details).length > 0 && <pre>{JSON.stringify(entry.details)}</pre>}</code></div>)}
  </div><footer>Memory only · Each feature/network has its own bounded log · Request bodies and signing material are excluded</footer>
 </section>;
}
