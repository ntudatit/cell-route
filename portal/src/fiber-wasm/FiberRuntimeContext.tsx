import { useFeatureObject } from "../dev-console/hooks";
import { currentScope } from "../dev-console/features";
import { beginOperation } from "../dev-console/store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type RecordValue = Record<string, any>;
type FiberRuntimeSnapshot = {
  node: RecordValue | null;
  peers: RecordValue[];
  channels: RecordValue[];
  channelHealth: {
    scanned: number;
    healthy: number;
    warning: number;
    critical: number;
    totalLocalBalanceRaw: string;
    totalRemoteBalanceRaw: string;
    channels: RecordValue[];
  } | null;
  loading: boolean;
  error: string;
  refreshedAt: string | null;
  refresh: () => Promise<void>;
  stop: () => Promise<void>;
  resetIdentity: () => Promise<void>;
};

const FiberRuntimeContext = createContext<FiberRuntimeSnapshot | null>(null);

export function FiberRuntimeProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<RecordValue | null>(null);
  const [peers, setPeers] = useState<RecordValue[]>([]);
  const [channels, setChannels] = useState<RecordValue[]>([]);
  const [channelHealth, setChannelHealth] = useState<FiberRuntimeSnapshot["channelHealth"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const operation = beginOperation(currentScope(), "fiber", "Runtime.refresh");
    setLoading(true); setError("");
    try {
      const { fiberWasmRuntime } = await import("./runtime");
      await fiberWasmRuntime.start();
      const [nextNode, nextPeers, nextChannels, nextHealth] = await Promise.all([
        fiberWasmRuntime.nodeInfo(),
        fiberWasmRuntime.listPeers(),
        fiberWasmRuntime.listChannels(),
        fiberWasmRuntime.channelHealth(),
      ]);
      setNode(nextNode); setPeers(nextPeers); setChannels(nextChannels); setChannelHealth(nextHealth);
      setRefreshedAt(new Date().toISOString());
      operation.complete();
    } catch (cause) {
      operation.fail(cause);
      const { fiberErrorMessage } = await import("./runtime");
      setError(fiberErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const clear = useCallback(() => {
    setNode(null); setPeers([]); setChannels([]); setChannelHealth(null); setRefreshedAt(null);
  }, []);

  const stop = useCallback(async () => {
    const { fiberWasmRuntime } = await import("./runtime");
    await fiberWasmRuntime.stop();
    clear();
  }, [clear]);

  const resetIdentity = useCallback(async () => {
    const { fiberWasmRuntime } = await import("./runtime");
    await fiberWasmRuntime.resetIdentity();
    clear();
  }, [clear]);

  const value = useMemo(() => ({ node, peers, channels, channelHealth, loading, error, refreshedAt, refresh, stop, resetIdentity }), [node, peers, channels, channelHealth, loading, error, refreshedAt, refresh, stop, resetIdentity]);
  return <FiberRuntimeContext.Provider value={value}>{children}</FiberRuntimeContext.Provider>;
}

export function useFiberRuntime() {
  const value = useContext(FiberRuntimeContext);
  if (!value) throw new Error("useFiberRuntime must be used inside FiberRuntimeProvider");
  return useFeatureObject(value, "fiber");
}
