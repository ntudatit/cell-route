import { Fiber, randomSecretKey } from "@nervosnetwork/fiber-js";
import { beginLoadingActivity } from "../utils/loadingActivity";
import type { FiberRpcScript, FiberRpcTransaction } from "./funding";
export type { FiberRpcScript } from "./funding";

const NETWORK = (import.meta.env.VITE_FIBER_NETWORK ?? "testnet").toLowerCase();
const CONFIG_PATH = import.meta.env.VITE_FIBER_CONFIG_PATH ?? `/fiber-config/${NETWORK}.yml`;
const EXPECTED_VERSION = import.meta.env.VITE_FIBER_EXPECTED_VERSION ?? "0.9.0";
const NODE_PROFILE = new URLSearchParams(globalThis.location?.search ?? "").get("node")?.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "default";
const DATABASE_PREFIX = `${import.meta.env.VITE_FIBER_DATABASE_PREFIX ?? `fiberops:${NETWORK}:browser-node-v1`}:${NODE_PROFILE}`;
const ID_DB = "fiberops-browser-identity";
const ID_STORE = "keys";
const ID_KEY = `${NETWORK}:${NODE_PROFILE}`;

type UnknownRecord = Record<string, any>;
type IdentityRecord = { id: string; fiberKey: number[]; ckbKey: number[]; createdAt: string };

function openIdentityDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ID_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ID_STORE)) db.createObjectStore(ID_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Unable to open Fiber identity IndexedDB"));
  });
}

async function loadIdentity(): Promise<{ fiberKey: Uint8Array; ckbKey: Uint8Array }> {
  const db = await openIdentityDb();
  const current = await new Promise<IdentityRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(ID_STORE, "readonly");
    const req = tx.objectStore(ID_STORE).get(ID_KEY);
    req.onsuccess = () => resolve(req.result as IdentityRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  if (current) return { fiberKey: new Uint8Array(current.fiberKey), ckbKey: new Uint8Array(current.ckbKey) };

  const fiberKey = randomSecretKey();
  const ckbKey = randomSecretKey();
  const record: IdentityRecord = {
    id: ID_KEY,
    fiberKey: Array.from(fiberKey),
    ckbKey: Array.from(ckbKey),
    createdAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ID_STORE, "readwrite");
    tx.objectStore(ID_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { fiberKey, ckbKey };
}

async function clearIdentity(): Promise<void> {
  const db = await openIdentityDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ID_STORE, "readwrite");
    tx.objectStore(ID_STORE).delete(ID_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function asArray(value: any, key: string): UnknownRecord[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function valueString(value: any): string {
  if (value == null) return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "0";
}

function parseRaw(value: any): bigint {
  const raw = valueString(value).trim();
  try { return raw.startsWith("0x") ? BigInt(raw) : BigInt(raw || "0"); } catch { return 0n; }
}

function stateName(value: any): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String(value.state_name ?? value.stateName ?? Object.keys(value)[0] ?? "Unknown");
  return "Unknown";
}

function extractPaymentHash(value: any): string | undefined {
  return value?.payment_hash ?? value?.paymentHash ?? value?.invoice?.payment_hash ?? value?.invoice?.paymentHash;
}

export function fiberErrorMessage(error: unknown): string {
  const value = error as { message?: unknown; data?: unknown; error?: { message?: unknown } } | null;
  const message = value?.message ?? value?.error?.message ?? value?.data;
  const raw = typeof message === "string" ? message : error instanceof Error ? error.message : String(message ?? error);
  const text = raw.match(/message:\s*"([\s\S]*?)"\s*,\s*data:/i)?.[1] ?? raw;
  return text
    .replace(/^Send payment error:\s*/i, "")
    .replace(/&#x20;|&nbsp;/gi, " ")
    .replace(/\\_+/g, "_")
    .replace(/\\\s*$/g, "")
    .trim();
}

export function validateBrowserPeerConnection(params: { address?: string; pubkey?: string }) {
  const address = params.address?.trim();
  const pubkey = params.pubkey?.trim();
  if (!address && !pubkey) throw new Error("Enter a peer WSS multi-address or Fiber pubkey.");
  if (address) {
    if (!address.startsWith("/")) throw new Error("Peer address must use libp2p multi-address format.");
    if (!/\/tcp\/\d+\/(wss|ws)(\/|$)/i.test(address)) throw new Error("Browser Fiber nodes require a /ws or /wss peer address; raw TCP peers are not browser reachable.");
    if (!/\/p2p\/[^/]+$/i.test(address)) throw new Error("Explicit peer address must end with /p2p/<peer-id>. The peer ID is not the Fiber pubkey.");
  }
  if (pubkey && !/^(02|03)[0-9a-fA-F]{64}$/.test(pubkey.replace(/^0x/, ""))) throw new Error("Fiber pubkey must be a compressed 33-byte key beginning with 02 or 03.");
  return { address, pubkey: pubkey?.replace(/^0x/, "") };
}

export class FiberWasmRuntime {
  private fiber: any | null = null;
  private startPromise: Promise<void> | null = null;
  private started = false;

  get isStarted() { return this.started; }
  get network() { return NETWORK; }
  get configPath() { return CONFIG_PATH; }
  get expectedVersion() { return EXPECTED_VERSION; }
  get profile() { return NODE_PROFILE; }

  browserCapability() {
    return {
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      indexedDb: typeof indexedDB !== "undefined",
      secureContext: globalThis.isSecureContext === true,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  private async startInternal(): Promise<void> {
    const finishLoading = beginLoadingActivity("connection");
    try {
    const cap = this.browserCapability();
    if (!cap.crossOriginIsolated || !cap.sharedArrayBuffer) {
      throw new Error(`Fiber WASM cannot start because this document is not cross-origin isolated (${globalThis.location?.pathname ?? "unknown route"}). Open the Fiber route directly or reload it after deploying COOP=same-origin and COEP=require-corp headers.`);
    }
    const response = await fetch(CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load Fiber WASM config: ${CONFIG_PATH}`);
    const config = await response.text();
    const identity = await loadIdentity();
    const fiber = new Fiber();
    await fiber.start(config, identity.fiberKey, identity.ckbKey, undefined, "info", DATABASE_PREFIX);
    this.fiber = fiber;
    this.started = true;
    } finally {
      finishLoading();
    }
  }

  async stop(): Promise<void> {
    if (this.fiber && this.started) await this.fiber.stop();
    this.fiber = null;
    this.started = false;
  }

  async resetIdentity(): Promise<void> {
    await this.stop();
    await clearIdentity();
  }

  private async node(): Promise<any> {
    await this.start();
    if (!this.fiber) throw new Error("Fiber WASM node failed to start");
    return this.fiber;
  }

  async nodeInfo(): Promise<UnknownRecord> { return await (await this.node()).nodeInfo(); }
  async listPeers(): Promise<UnknownRecord[]> { return asArray(await (await this.node()).listPeers(), "peers"); }
  async listChannels(includeClosed = true): Promise<UnknownRecord[]> {
    const result = await (await this.node()).listChannels({ include_closed: includeClosed });
    return asArray(result, "channels");
  }
  async graphNodes(): Promise<UnknownRecord[]> { return asArray(await (await this.node()).graphNodes({ limit: "0x64" }), "nodes"); }
  async graphChannels(): Promise<UnknownRecord[]> { return asArray(await (await this.node()).graphChannels({ limit: "0x64" }), "channels"); }

  async connectPeer(params: string | { address?: string; pubkey?: string }): Promise<unknown> {
    const finishLoading = beginLoadingActivity("connection");
    try {
      const connection = validateBrowserPeerConnection(typeof params === "string" ? { address: params } : params);
      return await (await this.node()).connectPeer({
        ...(connection.address ? { address: connection.address } : {}),
        ...(connection.pubkey ? { pubkey: connection.pubkey, addr_type: "wss" } : {}),
        save: true,
      });
    } finally {
      finishLoading();
    }
  }

  async disconnectPeer(pubkey: string): Promise<void> {
    await (await this.node()).disconnectPeer({ pubkey });
  }

  async updateChannel(channelId: string, enabled: boolean): Promise<void> {
    await (await this.node()).updateChannel({ channel_id: channelId, enabled });
  }

  async shutdownChannel(channelId: string, force = false): Promise<void> {
    await (await this.node()).shutdownChannel({ channel_id: channelId, force });
  }

  async abandonChannel(channelId: string): Promise<void> {
    await (await this.node()).abandonChannel({ channel_id: channelId });
  }

  async openChannel(params: { pubkey: string; fundingAmountRaw: string; public?: boolean }): Promise<unknown> {
    const fundingAmount = params.fundingAmountRaw.startsWith("0x")
      ? params.fundingAmountRaw
      : `0x${BigInt(params.fundingAmountRaw || "0").toString(16)}`;
    return await (await this.node()).openChannel({
      pubkey: params.pubkey,
      funding_amount: fundingAmount,
      public: params.public ?? true,
    });
  }

  async openChannelWithExternalFunding(params: {
    pubkey: string;
    fundingAmountRaw: string;
    fundingLockScript: FiberRpcScript;
    shutdownScript: FiberRpcScript;
    fundingLockScriptCellDeps?: FiberRpcTransaction["cell_deps"];
  }): Promise<{ channel_id: string; unsigned_funding_tx: FiberRpcTransaction }> {
    const fundingAmount = params.fundingAmountRaw.startsWith("0x")
      ? params.fundingAmountRaw
      : `0x${BigInt(params.fundingAmountRaw || "0").toString(16)}`;
    return await (await this.node()).openChannelWithExternalFunding({
      pubkey: params.pubkey,
      funding_amount: fundingAmount,
      public: true,
      funding_lock_script: params.fundingLockScript,
      shutdown_script: params.shutdownScript,
      funding_lock_script_cell_deps: params.fundingLockScriptCellDeps,
    });
  }

  async submitSignedFundingTransaction(channelId: string, signedTransaction: FiberRpcTransaction) {
    return await (await this.node()).submitSignedFundingTx({
      channel_id: channelId,
      signed_funding_tx: signedTransaction,
    });
  }

  async newInvoice(params: { amountRaw: string; description?: string; expirySeconds?: number; udtTypeScript?: FiberRpcScript }): Promise<any> {
    const amount = params.amountRaw.startsWith("0x") ? params.amountRaw : `0x${BigInt(params.amountRaw || "0").toString(16)}`;
    const expiry = params.expirySeconds ? `0x${BigInt(params.expirySeconds).toString(16)}` : undefined;
    return await (await this.node()).newInvoice({
      amount,
      currency: NETWORK === "mainnet" ? "Fibb" : "Fibt",
      payment_preimage: `0x${Array.from(randomSecretKey(), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
      description: params.description || undefined,
      expiry,
      udt_type_script: params.udtTypeScript,
      allow_mpp: true,
      allow_trampoline_routing: true,
    });
  }

  async getInvoice(paymentHash: string): Promise<any> {
    return await (await this.node()).getInvoice({ payment_hash: paymentHash });
  }

  async parseInvoice(invoice: string): Promise<any> {
    return await (await this.node()).parseInvoice({ invoice });
  }

  async cancelInvoice(paymentHash: string): Promise<any> {
    return await (await this.node()).cancelInvoice({ payment_hash: paymentHash });
  }

  async sendPayment(invoice: string, dryRun = false, allowSelfPayment = false): Promise<any> {
    return await (await this.node()).sendPayment({
      invoice,
      dry_run: dryRun,
      allow_self_payment: allowSelfPayment,
    });
  }

  async sendPaymentAdvanced(params: {
    invoice: string;
    dryRun?: boolean;
    allowSelfPayment?: boolean;
    maxParts?: number;
    maxFeeAmountRaw?: string;
    timeoutSeconds?: number;
    trampolineHops?: string[];
  }): Promise<any> {
    const hex = (value?: string | number) => value === undefined || value === "" ? undefined : `0x${BigInt(value).toString(16)}`;
    const trampolineHops = params.trampolineHops?.map(value => value.trim()).filter(Boolean) ?? [];
    if (trampolineHops.length > 5) throw new Error("Fiber supports at most 5 trampoline hops.");
    if (new Set(trampolineHops.map(value => value.toLowerCase())).size !== trampolineHops.length) throw new Error("Trampoline hops must not contain duplicates.");
    if (trampolineHops.length > 0 && !params.maxFeeAmountRaw) throw new Error("A maximum fee amount is required for trampoline routing.");
    if (trampolineHops.length > 1 && (params.maxParts ?? 1) > 1) throw new Error("MPP requires exactly one trampoline hop. Set max parts to 1 when using multiple trampoline hops.");
    if (trampolineHops.length > 0) {
      const parsed = await this.parseInvoice(params.invoice);
      const attrs = parsed?.invoice?.data?.attrs ?? parsed?.invoice?.attrs ?? [];
      const payee = Array.isArray(attrs) ? attrs.map((attr: any) => attr?.PayeePublicKey ?? attr?.payee_public_key).find(Boolean) : undefined;
      if (payee && trampolineHops.some(hop => hop.toLowerCase() === String(payee).toLowerCase())) throw new Error("The final invoice recipient cannot also be a trampoline hop.");
    }
    return await (await this.node()).sendPayment({
      invoice: params.invoice,
      dry_run: params.dryRun ?? false,
      allow_self_payment: params.allowSelfPayment ?? false,
      max_parts: hex(params.maxParts),
      max_fee_amount: hex(params.maxFeeAmountRaw),
      timeout: hex(params.timeoutSeconds),
      trampoline_hops: trampolineHops.length ? trampolineHops : undefined,
    });
  }

  async buildMultiHopRoute(params: {
    amountRaw: string;
    hops: Array<{ pubkey: string; channelOutpoint: string }>;
    udtTypeScript?: FiberRpcScript;
  }): Promise<any> {
    return await (await this.node()).buildRouter({
      amount: `0x${BigInt(params.amountRaw).toString(16)}`,
      udt_type_script: params.udtTypeScript,
      hops_info: params.hops.map(hop => ({ pubkey: hop.pubkey, channel_outpoint: hop.channelOutpoint })),
    });
  }

  async sendWithRouter(params: { router: any[]; udtTypeScript?: FiberRpcScript; dryRun?: boolean }): Promise<any> {
    return await (await this.node()).sendPaymentWithRouter({
      router: params.router,
      keysend: true,
      udt_type_script: params.udtTypeScript,
      dry_run: params.dryRun ?? false,
    });
  }

  async networkResources() {
    const [nodes, channels, peers, localChannels] = await Promise.all([
      this.graphNodes(), this.graphChannels(), this.listPeers(), this.listChannels(false),
    ]);
    const readyChannels = localChannels.filter(channel => /ready/i.test(stateName(channel.state)));
    const udtChannels = readyChannels.filter(channel => channel.funding_udt_type_script ?? channel.fundingUdtTypeScript);
    return {
      graphNodes: nodes.length,
      graphChannels: channels.length,
      connectedPeers: peers.length,
      localChannels: localChannels.length,
      readyChannels: readyChannels.length,
      udtChannels: udtChannels.length,
      nodes,
      channels,
      observedAt: new Date().toISOString(),
    };
  }

  async getPayment(paymentHash: string): Promise<any> {
    return await (await this.node()).getPayment({ payment_hash: paymentHash });
  }

  async nodeSummary() {
    try {
      const info = await this.nodeInfo();
      return {
        endpoint: "browser://fiber-wasm",
        version: info?.version ?? null,
        commitHash: info?.commit_hash ?? info?.commitHash ?? null,
        nodeName: info?.node_name ?? info?.nodeName ?? "Fiber WASM Browser Node",
        pubkey: info?.pubkey ?? null,
        features: Array.isArray(info?.features) ? info.features : [],
        addresses: Array.isArray(info?.addresses) ? info.addresses : [],
        chainHash: info?.chain_hash ?? info?.chainHash ?? null,
        reachable: true,
      };
    } catch {
      return { endpoint: "browser://fiber-wasm", features: [], addresses: [], reachable: false };
    }
  }

  async compatibility() {
    const node = await this.nodeSummary();
    const actualVersion = node.version ?? null;
    const compatible = !!actualVersion && String(actualVersion).includes(EXPECTED_VERSION);
    return {
      reachable: node.reachable,
      expectedVersion: EXPECTED_VERSION,
      actualVersion,
      compatible,
      rpcEndpoint: "browser://fiber-wasm",
      notes: [
        "Fiber runs inside the browser through @nervosnetwork/fiber-js; no localhost FNN RPC is required.",
        "The page must be cross-origin isolated and public peers must provide WSS transport.",
        ...(compatible || !actualVersion ? [] : [`Runtime version ${actualVersion} differs from expected ${EXPECTED_VERSION}.`]),
      ],
    };
  }

  analyzeChannel(raw: UnknownRecord) {
    const channelId = String(raw.channel_id ?? raw.channelId ?? "unknown");
    const peerPubkey = raw.pubkey ?? raw.peer_pubkey ?? raw.peerPubkey ?? null;
    const state = stateName(raw.state);
    const enabled = raw.enabled !== false;
    const local = parseRaw(raw.local_balance ?? raw.localBalance);
    const remote = parseRaw(raw.remote_balance ?? raw.remoteBalance);
    const total = local + remote;
    const outboundRatio = total === 0n ? 0 : Number((local * 10000n) / total) / 10000;
    const pendingTlcs = Array.isArray(raw.pending_tlcs ?? raw.pendingTlcs) ? (raw.pending_tlcs ?? raw.pendingTlcs).length : 0;
    const diagnosis: string[] = [];
    const recommendations: string[] = [];
    let severity = 0;
    if (state === "Closed") { severity = 2; diagnosis.push("Channel is closed."); recommendations.push("Use another Ready channel or create new capacity."); }
    else if (!/ready/i.test(state)) { severity = Math.max(severity, 2); diagnosis.push(`Channel is not Ready: ${state}.`); recommendations.push("Check peer WSS connectivity and funding confirmations."); }
    if (!enabled) { severity = Math.max(severity, 2); diagnosis.push("Forwarding is disabled."); recommendations.push("Review channel policy before enabling it."); }
    if (total > 0n && outboundRatio < 0.15) { severity = Math.max(severity, 2); diagnosis.push(`Low outbound liquidity (${(outboundRatio*100).toFixed(1)}%).`); recommendations.push("Rebalance or add outbound capacity before large payments."); }
    else if (total > 0n && outboundRatio < 0.30) { severity = Math.max(severity, 1); diagnosis.push(`Outbound liquidity is getting low (${(outboundRatio*100).toFixed(1)}%).`); recommendations.push("Plan a rebalance before larger payments."); }
    if (pendingTlcs >= 10) { severity = 3; diagnosis.push(`High pending TLC count (${pendingTlcs}).`); recommendations.push("Inspect payment lifecycle before adding more load."); }
    else if (pendingTlcs >= 3) { severity = Math.max(severity, 1); diagnosis.push(`Pending TLCs detected (${pendingTlcs}).`); recommendations.push("Monitor TLC age and payment failures."); }
    if (!diagnosis.length) diagnosis.push("Channel is Ready with acceptable local liquidity.");
    return {
      channelId, peerPubkey, state, enabled,
      localBalanceRaw: local.toString(), remoteBalanceRaw: remote.toString(), outboundRatio, pendingTlcs,
      health: severity >= 3 ? "CRITICAL" : severity >= 1 ? "WARNING" : "HEALTHY",
      diagnosis, recommendations, raw,
    };
  }

  async channelHealth() {
    const raw = await this.listChannels(false);
    const channels = raw.map((c) => this.analyzeChannel(c));
    const sum = (key: "localBalanceRaw" | "remoteBalanceRaw") => channels.reduce((v, c) => v + BigInt(c[key]), 0n).toString();
    return {
      scanned: channels.length,
      healthy: channels.filter(c => c.health === "HEALTHY").length,
      warning: channels.filter(c => c.health === "WARNING").length,
      critical: channels.filter(c => c.health === "CRITICAL").length,
      totalLocalBalanceRaw: sum("localBalanceRaw"),
      totalRemoteBalanceRaw: sum("remoteBalanceRaw"),
      channels,
      observedAt: new Date().toISOString(),
    };
  }

  async incidents() {
    const health = await this.channelHealth();
    return health.channels.filter(c => c.health !== "HEALTHY").map((c, index) => ({
      id: index + 1,
      fingerprint: `wasm-channel:${c.channelId}`,
      incidentType: "CHANNEL_HEALTH",
      severity: c.health === "CRITICAL" ? "CRITICAL" : "WARNING",
      status: "OPEN",
      subjectType: "CHANNEL",
      subjectId: c.channelId,
      title: `Browser channel ${c.channelId.slice(0, 12)}… is ${c.health}`,
      diagnosis: c.diagnosis.join("; "),
      recommendation: c.recommendations.join("; "),
      contextJson: c.raw,
      network: NETWORK,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      resolvedAt: null,
    }));
  }

  async overview() {
    const [node, peers, health, incidents] = await Promise.all([
      this.nodeSummary(), this.listPeers(), this.channelHealth(), this.incidents(),
    ]);
    return {
      nodeReachable: node.reachable,
      nodeVersion: node.version ?? null,
      nodePubkey: node.pubkey ?? null,
      peers: peers.length,
      channels: health.scanned,
      healthyChannels: health.healthy,
      warningChannels: health.warning,
      criticalChannels: health.critical,
      openIncidents: incidents.length,
      criticalIncidents: incidents.filter(i => i.severity === "CRITICAL").length,
      totalLocalBalanceRaw: health.totalLocalBalanceRaw,
      totalRemoteBalanceRaw: health.totalRemoteBalanceRaw,
      generatedAt: new Date().toISOString(),
    };
  }

  async readiness(invoice: string) {
    try {
      await this.parseInvoice(invoice);
      const dryRun = await this.sendPayment(invoice, true);
      const routes = dryRun?.routes ?? dryRun?.route ?? dryRun?.payment?.routes ?? [];
      const routeCount = Array.isArray(routes) ? routes.length : routes ? 1 : 0;
      const feeRaw = dryRun?.fee ?? dryRun?.fee_amount ?? dryRun?.feeRaw ?? null;
      return {
        status: "READY", payable: true, feeRaw, routeCount,
        failure: null,
        recommendations: [
          "A valid payment route was built by the browser WASM node without sending funds.",
          routeCount > 1 ? "Multiple route parts are available; MPP may improve reliability." : "Confirm invoice expiry and amount before sending the real payment.",
        ],
        dryRun,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const failure = fiberErrorMessage(error);
      return {
        status: "UNPAYABLE", payable: false, feeRaw: null, routeCount: 0, failure,
        recommendations: [
          /liquid|capacity/i.test(failure) ? "Inspect outbound channel liquidity or open additional capacity." : "Inspect browser peer connectivity and route availability.",
          "Do not retry a real payment until dry-run succeeds.",
        ],
        dryRun: null,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async reconcile(paymentHash: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(paymentHash)) throw new Error("Enter a valid 32-byte payment hash.");
    const [invoiceResult, paymentResult] = await Promise.allSettled([
      this.getInvoice(paymentHash), this.getPayment(paymentHash),
    ]);
    const invoice = invoiceResult.status === "fulfilled" ? invoiceResult.value : null;
    const payment = paymentResult.status === "fulfilled" ? paymentResult.value : null;
    const invoiceStatus = invoice?.status ?? invoice?.invoice?.status ?? null;
    const paymentStatus = payment?.status ?? payment?.payment?.status ?? null;
    const found = !!invoiceStatus || !!paymentStatus;
    const missingSide = !invoiceStatus || !paymentStatus;
    const invoiceDone = /paid|cancelled|expired/i.test(String(invoiceStatus ?? ""));
    const paymentDone = /success|failed/i.test(String(paymentStatus ?? ""));
    const inconsistent = !found || missingSide || invoiceDone !== paymentDone;
    return {
      paymentHash,
      invoiceStatus: invoiceStatus ? String(invoiceStatus) : null,
      paymentStatus: paymentStatus ? String(paymentStatus) : null,
      cchStatus: null,
      consistent: !inconsistent,
      severity: inconsistent ? "WARNING" : "INFO",
      diagnosis: !found ? "No local invoice or outbound payment was found for this payment hash." : inconsistent ? "Invoice and local payment lifecycle are incomplete or at different stages." : "Invoice and payment lifecycle are consistent.",
      recommendedAction: !found ? "Verify the payment hash and browser Fiber identity." : inconsistent ? "Refresh both states before retrying or taking recovery action." : "Continue monitoring until settlement completes.",
      snapshot: { invoice, payment },
      checkedAt: new Date().toISOString(),
    };
  }

  extractPaymentHash(value: any) { return extractPaymentHash(value); }
}

export const fiberWasmRuntime = new FiberWasmRuntime();
