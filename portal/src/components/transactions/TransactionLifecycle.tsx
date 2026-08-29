import { useEffect, useState } from "react";
import { backendApi } from "../../api/backend";

type EventData = { txHash: string; status: string; blockHash?: string | null; observedAt?: string; terminal?: boolean };

export function TransactionLifecycle({ txHash }: { txHash: string }) {
 const [current, setCurrent] = useState<EventData>({ txHash, status: "connecting" });
 const [connected, setConnected] = useState(false);

 useEffect(() => {
  if (!txHash) return;
  const source = new EventSource(backendApi.transactionEventsUrl(txHash));
  const onStatus = (event: MessageEvent) => {
   try {
    setCurrent(JSON.parse(event.data) as EventData);
    setConnected(true);
   } catch { /* ignore malformed event */ }
  };
  const onError = () => setConnected(false);
  source.addEventListener("transaction-status", onStatus as EventListener);
  source.addEventListener("transaction-error", onStatus as EventListener);
  source.onerror = onError;
  return () => source.close();
 }, [txHash]);

 return <div className="tx-lifecycle">
  <div><span className={`status-dot ${current.terminal ? "terminal" : ""}`}/><strong>{current.status}</strong><span>{connected ? "SSE live" : "reconnecting"}</span></div>
  {current.blockHash && <code>{current.blockHash}</code>}
 </div>;
}
