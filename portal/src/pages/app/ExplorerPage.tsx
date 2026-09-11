import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureCcc } from '../../dev-console/hooks';
import { useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { AppLayout, PageHero } from '../../components/layout/AppLayout';
import { clientNetwork, explorerUrl } from '../../utils/network';
export function ExplorerPage() {
 const featureConsoleScope = currentScope();

 const { client } = useFeatureCcc();
 const [hash, setHash] = useState('');
 const [status, setStatus] = useState('');
 const [busy, setBusy] = useState(false);
 const network = clientNetwork(client);
 const url = explorerUrl(network);
 async function lookup() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'lookup');
 try {

  setBusy(true);
  try {
   if (!/^0x[0-9a-f]{64}$/i.test(hash.trim())) throw new Error('Enter a 32-byte transaction hash.');
   const tx = await client.getTransaction(hash.trim());
   setStatus(tx ? `${tx.status}${tx.blockHash ? ` · Block ${tx.blockHash}` : ''}` : 'Transaction not found on this network.');
  } catch (e) { featureOperation.fail(e);  setStatus(e instanceof Error ? e.message : String(e)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}
 return <AppLayout><PageHero eyebrow={network} title="CKB transaction lookup" description="Read transaction status directly from the selected CKB network."/><section className="feature-card explorer-card"><label className="standalone-label">Transaction hash<input value={hash} disabled={busy} onChange={e => { setHash(e.target.value); setStatus(''); }} placeholder="0x..."/></label><button className="primary search-action" disabled={busy || !hash.trim()} onClick={() => void lookup()}>Lookup transaction</button><p role="status" className="mono-break">{status}</p>{url && <a className="text-link" href={url} target="_blank" rel="noreferrer">Open {network} CKB Explorer</a>}</section></AppLayout>;
}
