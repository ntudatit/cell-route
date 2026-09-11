import { useFeatureCcc } from '../../dev-console/hooks';
import { useEffect, useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { clientNetwork, explorerUrl } from '../../utils/network';
export function TransactionLifecycle({ txHash, client: submittedClient }: { txHash: string; client?: ccc.Client }) {
 const { client: selectedClient } = useFeatureCcc();
 const client = submittedClient ?? selectedClient;
 const [status, setStatus] = useState('checking');
 const [block, setBlock] = useState('');
 const [error, setError] = useState('');
 useEffect(() => {
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  setStatus('checking'); setBlock(''); setError('');
  async function poll() {
   let terminal = false;
   try {
    const tx = await client.getTransaction(txHash);
    if (!active) return;
    setStatus(tx?.status ?? 'not found'); setBlock(tx?.blockHash ?? ''); setError('');
    terminal = tx?.status === 'committed' || tx?.status === 'rejected';
   } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)); }
   if (active && !terminal) timer = setTimeout(() => void poll(), 5000);
  }
  void poll();
  return () => { active = false; clearTimeout(timer); };
 }, [client, txHash]);
 const url = explorerUrl(clientNetwork(client), txHash);
 return <div className="tx-lifecycle" role="status"><div><strong>{status}</strong><span>{clientNetwork(client)}</span></div>{block && <code>{block}</code>}{error && <p>RPC check failed; retrying. {error}</p>}{url && <a href={url} target="_blank" rel="noreferrer">View on CKB Explorer</a>}</div>;
}
