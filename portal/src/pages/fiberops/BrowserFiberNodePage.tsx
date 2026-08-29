import { useEffect, useRef, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { Play, RefreshCw, Square, Trash2, Wifi, Database, ShieldCheck, PlugZap, CircleDollarSign, Unplug, Power } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberErrorMessage, fiberWasmRuntime } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";
import { assertOnlyWitnessesChanged, cccTransactionToRpc, fiberFundingStore, rpcScriptFromCcc, rpcTransactionToCcc, type FiberRpcTransaction } from "../../fiber-wasm/funding";

export function BrowserFiberNodePage() {
  const signer = ccc.useSigner();
  const runtime = useFiberRuntime();
  const fundingSubmitStarted = useRef(false);
  const [busy, setBusy] = useState(false);
  const { node: info, peers, channels } = runtime;
  const [operationError, setError] = useState("");
  const [peerAddress, setPeerAddress] = useState("");
  const [peerPubkey, setPeerPubkey] = useState("");
  const [fundingAmount, setFundingAmount] = useState("49900000000");
  const [operationResult, setOperationResult] = useState<Record<string, any> | null>(null);
  const capability = fiberWasmRuntime.browserCapability();

  const refresh = runtime.refresh;
  const pageBusy = busy || runtime.loading;
  const error = operationError || runtime.error;

  useEffect(() => {
    if (!peerPubkey && peers[0]?.pubkey) setPeerPubkey(String(peers[0].pubkey));
  }, [peerPubkey, peers]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("funding") !== "submit" || fundingSubmitStarted.current) return;
    const draft = fiberFundingStore.get();
    if (!draft?.signedTransaction) return;
    fundingSubmitStarted.current = true;
    setBusy(true); setError("");
    void fiberWasmRuntime.submitSignedFundingTransaction(draft.channelId, draft.signedTransaction)
      .then((result) => {
        setOperationResult((result ?? { status: "Funding submitted" }) as Record<string, any>);
        fiberFundingStore.clear();
        window.history.replaceState({}, "", `/fiber-node?node=${encodeURIComponent(fiberWasmRuntime.profile)}`);
        return refresh();
      })
      .catch((e) => setError(fiberErrorMessage(e)))
      .finally(() => setBusy(false));
  }, []);

  async function stop() { setBusy(true); try { await runtime.stop(); } finally { setBusy(false); } }
  async function reset() {
    const activeChannels = channels.filter((channel) => !/closed/i.test(String(channel.state?.state_name ?? channel.state?.stateName ?? channel.state ?? "")));
    if (activeChannels.length > 0) { setError("Close all active channels before resetting the browser Fiber identity."); return; }
    if (!confirm("Reset this browser Fiber identity? Existing local Fiber state may no longer be accessible with the new identity.")) return;
    setBusy(true); try { await runtime.resetIdentity(); } finally { setBusy(false); }
  }

  async function connectPeer() {
    if (!peerAddress.trim() && !peerPubkey.trim()) return;
    setBusy(true); setError(""); setOperationResult(null);
    try {
      await fiberWasmRuntime.connectPeer({ address: peerAddress.trim() || undefined, pubkey: peerAddress.trim() ? undefined : peerPubkey.trim() });
      setOperationResult({ status: "Peer connected" });
      await refresh();
    } catch (e) { setError(fiberErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function disconnectPeer(pubkey: string) {
    setBusy(true); setError("");
    try { await fiberWasmRuntime.disconnectPeer(pubkey); await refresh(); }
    catch (e) { setError(fiberErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function setChannelEnabled(channelId: string, enabled: boolean) {
    setBusy(true); setError("");
    try { await fiberWasmRuntime.updateChannel(channelId, enabled); await refresh(); }
    catch (e) { setError(fiberErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function closeChannel(channelId: string) {
    if (!confirm("Close this Fiber channel cooperatively?")) return;
    setBusy(true); setError("");
    try { await fiberWasmRuntime.shutdownChannel(channelId, false); await refresh(); }
    catch (e) { setError(fiberErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function openChannel() {
    if (!peerPubkey.trim() || BigInt(fundingAmount || "0") <= 0n) return;
    if (!signer) { setError("Connect a CKB wallet before preparing external channel funding."); return; }
    if (!confirm(`Prepare a public Fiber channel with ${fundingAmount} raw CKB units?`)) return;
    setBusy(true); setError(""); setOperationResult(null);
    try {
      const { script } = await signer.getRecommendedAddressObj();
      const lockCandidates = [
        ccc.KnownScript.Secp256k1Blake160,
        ccc.KnownScript.JoyId,
        ccc.KnownScript.OmniLock,
        ccc.KnownScript.PWLock,
        ccc.KnownScript.NostrLock,
        ccc.KnownScript.DidCkb,
      ];
      const knownLocks = await Promise.allSettled(lockCandidates.map(candidate => signer.client.getKnownScript(candidate)));
      const fundingLock = knownLocks
        .filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof signer.client.getKnownScript>>> => entry.status === "fulfilled")
        .map(entry => entry.value)
        .find(candidate => script.codeHash === candidate.codeHash && script.hashType === candidate.hashType);
      if (!fundingLock) throw new Error(`Unsupported wallet lock script ${script.codeHash}. Its CKB cell deps are not registered in CCC.`);
      const cellDeps = fundingLock.cellDeps.map(({ cellDep }) => ({
        dep_type: cellDep.depType === "depGroup" ? "dep_group" : "code",
        out_point: { tx_hash: cellDep.outPoint.txHash, index: ccc.numToHex(cellDep.outPoint.index) },
      }));
      const depKey = (dep: FiberRpcTransaction["cell_deps"][number]) => `${dep.out_point.tx_hash.toLowerCase()}:${BigInt(dep.out_point.index).toString()}:${dep.dep_type}`;
      const uniqueDeps = (deps: FiberRpcTransaction["cell_deps"]) => [...new Map(deps.map(dep => [depKey(dep), dep])).values()];
      const coreBody = (tx: FiberRpcTransaction) => JSON.stringify({ ...tx, cell_deps: [], witnesses: [] });
      let requiredDeps = uniqueDeps(cellDeps);
      let stableDraft: { channelId: string; transaction: FiberRpcTransaction } | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await fiberWasmRuntime.openChannelWithExternalFunding({
          pubkey: peerPubkey.trim(), fundingAmountRaw: fundingAmount,
          fundingLockScript: rpcScriptFromCcc(script), shutdownScript: rpcScriptFromCcc(script),
          fundingLockScriptCellDeps: requiredDeps,
        });
        const prepared = cccTransactionToRpc(await signer.prepareTransaction(rpcTransactionToCcc(result.unsigned_funding_tx)));
        if (coreBody(prepared) !== coreBody(result.unsigned_funding_tx)) {
          await fiberWasmRuntime.abandonChannel(result.channel_id);
          throw new Error("Wallet preparation changed funding inputs or outputs. External channel funding cannot safely continue.");
        }
        try {
          assertOnlyWitnessesChanged(result.unsigned_funding_tx, prepared);
          stableDraft = { channelId: result.channel_id, transaction: prepared };
          break;
        } catch {
          await fiberWasmRuntime.abandonChannel(result.channel_id);
          requiredDeps = uniqueDeps(prepared.cell_deps);
        }
      }
      if (!stableDraft) throw new Error("Wallet cell dependencies did not stabilize after three funding attempts.");
      fiberFundingStore.set({ channelId: stableDraft.channelId, unsignedTransaction: stableDraft.transaction, createdAt: new Date().toISOString(), returnUrl: `/fiber-node?node=${encodeURIComponent(fiberWasmRuntime.profile)}&funding=submit` });
      window.location.assign("/fiber-funding");
    } catch (e) { setError(fiberErrorMessage(e)); }
    finally { setBusy(false); }
  }

  const content = <>
    <PageHero eyebrow="FIBER NODE" title="Browser Fiber Node" description="Operate the Fiber node, inspect connectivity and monitor channel state." />
    <div className="ops-grid ops-grid-4">
      <div className="ops-stat-card"><ShieldCheck/><span>Cross-Origin Isolated</span><strong>{capability.crossOriginIsolated ? "YES" : "NO"}</strong></div>
      <div className="ops-stat-card"><Database/><span>Storage</span><strong>IndexedDB</strong></div>
      <div className="ops-stat-card"><Wifi/><span>Transport</span><strong>WSS</strong></div>
      <div className="ops-stat-card"><RefreshCw/><span>Runtime</span><strong>{info ? "RUNNING" : "IDLE"}</strong></div>
    </div>
    {!capability.crossOriginIsolated && <div className="ops-alert critical"><b>Browser isolation is unavailable.</b><span>Open this route directly or reload it. The document response must include COOP: same-origin and COEP: require-corp.</span></div>}
    {error && <div className="ops-alert critical"><b>Fiber operation failed</b><span>{error}</span></div>}
    <section className="ops-panel">
      <div className="ops-panel-head"><div><span className="ops-kicker">NODE LIFECYCLE</span><h2>Local browser node</h2></div><div className="ops-actions">
        <button className="btn primary" disabled={pageBusy || !capability.crossOriginIsolated} onClick={() => void refresh()}><Play size={16}/> Start / Refresh</button>
        <button className="btn secondary" disabled={pageBusy || !info} onClick={() => void stop()}><Square size={16}/> Stop</button>
        <button className="btn secondary" disabled={pageBusy} onClick={() => void reset()}><Trash2 size={16}/> Reset Identity</button>
      </div></div>
      <div className="ops-detail-grid">
        <div><span>Network</span><b>{fiberWasmRuntime.network}</b></div>
        <div><span>Node profile</span><b>{fiberWasmRuntime.profile.toUpperCase()}</b></div>
        <div><span>Config</span><b>{fiberWasmRuntime.configPath}</b></div>
        <div><span>Version</span><b>{String(info?.version ?? "-")}</b></div>
        <div><span>Pubkey</span><b className="mono">{String(info?.pubkey ?? "-")}</b></div>
        <div><span>Peers</span><b>{peers.length}</b></div>
        <div><span>Channels</span><b>{channels.length}</b></div>
      </div>
      <pre className="rpc-output">{JSON.stringify(info ?? { status: "idle" }, null, 2)}</pre>
    </section>
    <section className="ops-panel fiber-channel-operations">
      <div className="ops-panel-head"><div><span className="ops-kicker">PEER & CHANNEL OPERATIONS</span><h2>Channel funding</h2></div></div>
      <div className="fiber-operation-grid">
        <div className="fiber-operation-form">
          <label className="ops-label">Peer WSS multi-address</label>
          <div className="ops-inline"><input value={peerAddress} onChange={e => setPeerAddress(e.target.value)} placeholder="/dns4/router.example/tcp/443/wss/p2p/Qm..."/><button className="btn secondary" disabled={busy || (!peerAddress.trim() && !peerPubkey.trim())} onClick={() => void connectPeer()}><PlugZap size={16}/>{peerAddress.trim() ? "Connect address" : "Connect from gossip"}</button></div>
          <small className="fiber-field-help">The trailing /p2p value is a libp2p Peer ID. To connect from graph data, leave this address empty and enter the peer Fiber pubkey.</small>
        </div>
        <div className="fiber-operation-form">
          <label className="ops-label">Fiber pubkey</label>
          <input list="fiber-peer-pubkeys" value={peerPubkey} onChange={e => setPeerPubkey(e.target.value)} placeholder="02... or 03..." autoComplete="off" />
          <datalist id="fiber-peer-pubkeys">
            {peers.map((peer, index) => <option value={String(peer.pubkey ?? "")} key={String(peer.pubkey ?? index)} />)}
          </datalist>
          <small className="fiber-field-help">Compressed Fiber identity key beginning with 02 or 03; it is used for channel operations.</small>
          <label className="ops-label">Funding amount (raw CKB units)</label>
          <input value={fundingAmount} inputMode="numeric" onChange={e => setFundingAmount(e.target.value.replace(/\D/g, ""))}/>
          <button className="btn primary" disabled={busy || !peerPubkey || BigInt(fundingAmount || "0") <= 0n} onClick={() => void openChannel()}><CircleDollarSign size={16}/> Fund with CKB wallet</button>
        </div>
      </div>
      <div className="fiber-runtime-lists">
        <div><span className="ops-kicker">CONNECTED PEERS</span>{peers.length === 0 ? <p className="empty">No connected peers</p> : peers.map((peer, index) => <div className="fiber-runtime-row" key={String(peer.pubkey ?? index)}><code>{String(peer.pubkey ?? "Unknown")}</code><button className="btn secondary" disabled={busy || !peer.pubkey} onClick={() => void disconnectPeer(String(peer.pubkey))}><Unplug size={14}/> Disconnect</button></div>)}</div>
        <div><span className="ops-kicker">CHANNELS</span>{channels.length === 0 ? <p className="empty">No channels</p> : channels.map((channel, index) => { const channelId = String(channel.channel_id ?? channel.channelId ?? ""); const enabled = channel.enabled !== false; const state = typeof channel.state === "string" ? channel.state : String(channel.state?.state_name ?? channel.state?.stateName ?? "Unknown"); return <div className="fiber-runtime-row channel" key={channelId || index}><span><code>{channelId || "Unknown"}</code><small>{state}</small></span><div><button className="btn secondary" disabled={busy || !channelId} onClick={() => void setChannelEnabled(channelId, !enabled)}><Power size={14}/>{enabled ? "Disable" : "Enable"}</button><button className="btn secondary" disabled={busy || !channelId || /closed/i.test(state)} onClick={() => void closeChannel(channelId)}>Close</button></div></div>})}</div>
      </div>
      {operationResult && <pre className="rpc-output">{JSON.stringify(operationResult, null, 2)}</pre>}
    </section>
  </>;

  return <AppLayout>{content}</AppLayout>;
}
