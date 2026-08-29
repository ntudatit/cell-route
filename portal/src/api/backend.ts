import { beginLoadingActivity } from "../utils/loadingActivity";
const getFiberRuntime = async () => (await import("../fiber-wasm/runtime")).fiberWasmRuntime;
const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api").replace(/\/$/, "");
const TOKEN_KEY = "ckb-asset-studio.access-token";

export const authTokenStore = {
 get: () => localStorage.getItem(TOKEN_KEY) ?? "",
 set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
 clear: () => localStorage.removeItem(TOKEN_KEY),
};

export type NetworkResponse = { network: string; rpcUrl: string; indexerUrl?: string };
export type TipResponse = { hex: string; decimal: string };
export type TransactionStatus = { txHash: string; status: string; blockHash?: string | null; reason?: unknown };
export type TrackedTransaction = {
 txHash: string; walletAddress: string; recipient?: string | null; amountCkb?: string | null;
 direction: string; status: string; network: string; createdAt: string; updatedAt: string;
};
export type DashboardResponse = {
 network: string; tipBlockNumber: string; trackedTransactions: number; recentTransactions: TrackedTransaction[];
};
export type TrackTransactionRequest = {
 txHash: string; walletAddress: string; recipient?: string; amountCkb?: string; direction: "SEND" | "RECEIVE";
};

export type AuthChallenge = { nonce: string; walletAddress: string; message: string; expiresAt: string };
export type AuthToken = { accessToken: string; tokenType: string; expiresIn: number; walletAddress: string };
export type AuthMe = { walletAddress: string; network: string; expiresAt: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
 const finishLoading = beginLoadingActivity("api");
 try {
 const token = authTokenStore.get();
 const response = await fetch(`${API_URL}${path}`, {
  ...init,
  headers: {
   "Content-Type": "application/json",
   ...(token ? { Authorization: `Bearer ${token}` } : {}),
   ...(init?.headers ?? {}),
  },
 });
 if (!response.ok) {
  let detail = `${response.status} ${response.statusText}`;
  try {
   const body = await response.json();
   detail = body.message ?? body.error ?? detail;
  } catch { /* keep status */ }
  if (response.status === 401) authTokenStore.clear();
  throw new Error(detail);
 }
 return response.json() as Promise<T>;
 } finally {
  finishLoading();
 }
}

export const backendApi = {
 getNetwork: () => request<NetworkResponse>("/ckb/network"),
 getTip: () => request<TipResponse>("/ckb/tip"),
 getTransactionStatus: (txHash: string) => request<TransactionStatus>(`/transactions/${encodeURIComponent(txHash)}/status`),
 getDashboard: (address: string) => request<DashboardResponse>(`/dashboard/${encodeURIComponent(address)}`),
 trackTransaction: (body: TrackTransactionRequest) => request<TrackedTransaction>("/transactions", { method: "POST", body: JSON.stringify(body) }),
 createAuthChallenge: (walletAddress: string) => request<AuthChallenge>("/auth/challenge", { method: "POST", body: JSON.stringify({ walletAddress }) }),
 verifyAuth: (body: { walletAddress: string; nonce: string; signature: string; signType: string }) =>
  request<AuthToken>("/auth/verify", { method: "POST", body: JSON.stringify(body) }),
 authMe: () => request<AuthMe>("/auth/me"),
 transactionEventsUrl: (txHash: string) => `${API_URL}/transactions/${encodeURIComponent(txHash)}/events`,
};

export type AssetKind = "XUDT" | "SPORE" | "CLUSTER";
export type AssetAction = "CREATE" | "MINT" | "TRANSFER" | "MELT";
export type AssetEvent = {
 id: number; assetKind: AssetKind; action: AssetAction; assetId: string; ownerAddress: string;
 displayName?: string | null; symbol?: string | null; amount?: string | null; txHash: string;
 metadataJson?: string | null; network: string; createdAt: string;
};
export type CreateAssetEventRequest = {
 assetKind: AssetKind; action: AssetAction; assetId: string; ownerAddress: string;
 displayName?: string; symbol?: string; amount?: string; txHash: string; metadataJson?: string;
};
export const assetApi = {
 record: (body: CreateAssetEventRequest) => request<AssetEvent>("/assets/events", { method: "POST", body: JSON.stringify(body) }),
 listByOwner: (address: string) => request<AssetEvent[]>(`/assets/${encodeURIComponent(address)}`),
};

export type IndexedAsset = {
 id: number; ownerAddress: string; assetKind: string; assetId: string; typeCodeHash: string;
 typeHashType: string; typeArgs: string; amountRaw?: string | null; outputData?: string | null;
 txHash: string; outputIndex: number; blockNumber?: number | null; network: string;
 isLive: boolean; firstSeenAt: string; lastSeenAt: string;
};
export type IndexerSyncResponse = {
 walletAddress: string; network: string; scannedCells: number; indexedAssets: number;
 cursor?: string | null; assets: IndexedAsset[];
};
export const indexerApi = {
 sync: (walletAddress: string) => request<IndexerSyncResponse>("/indexer/sync", {
  method: "POST", body: JSON.stringify({ walletAddress }),
 }),
 list: (walletAddress: string) => request<IndexedAsset[]>(`/indexer/assets/${encodeURIComponent(walletAddress)}`),
};

export type FiberNodeSummary = {
 endpoint: string; version?: string | null; commitHash?: string | null; nodeName?: string | null; pubkey?: string | null;
 features: string[]; addresses: string[]; chainHash?: string | null; reachable: boolean;
};
export type FiberCompatibility = {
 reachable: boolean; expectedVersion: string; actualVersion?: string | null; compatible: boolean; rpcEndpoint: string; notes: string[];
};
export type FiberInvoiceResult = {
 invoiceAddress?: string | null; paymentHash?: string | null; amountRaw: string; fiber: unknown;
};
export type FiberPaymentResult = { payment_hash?: string; paymentHash?: string; status?: string; fee?: string; failed_error?: unknown } & Record<string, unknown>;
export const fiberApi = {
 node: async () => (await getFiberRuntime()).nodeSummary() as Promise<FiberNodeSummary>,
 compatibility: async () => (await getFiberRuntime()).compatibility() as Promise<FiberCompatibility>,
 createInvoice: async (body: { amountRaw: string; description?: string; expirySeconds?: number }) => {
  const runtime = await getFiberRuntime();
  const fiber = await runtime.newInvoice(body);
  return {
   invoiceAddress: fiber?.invoice_address ?? fiber?.invoiceAddress ?? null,
   paymentHash: runtime.extractPaymentHash(fiber) ?? null,
   amountRaw: body.amountRaw,
   fiber,
  } as FiberInvoiceResult;
 },
 getInvoice: async (paymentHash: string) => (await getFiberRuntime()).getInvoice(paymentHash) as Promise<Record<string, unknown>>,
 parseInvoice: async (invoice: string) => (await getFiberRuntime()).parseInvoice(invoice) as Promise<Record<string, unknown>>,
 cancelInvoice: async (paymentHash: string) => (await getFiberRuntime()).cancelInvoice(paymentHash) as Promise<Record<string, unknown>>,
 payInvoice: async (_body: { walletAddress?: string; invoice: string; allowSelfPayment?: boolean }) =>
  (await getFiberRuntime()).sendPayment(_body.invoice, false, _body.allowSelfPayment === true) as Promise<FiberPaymentResult>,
 getPayment: async (paymentHash: string) => (await getFiberRuntime()).getPayment(paymentHash) as Promise<FiberPaymentResult>,
};

export type FiberOpsOverview = {
 nodeReachable: boolean; nodeVersion?: string | null; nodePubkey?: string | null; peers: number;
 channels: number; healthyChannels: number; warningChannels: number; criticalChannels: number;
 openIncidents: number; criticalIncidents: number; totalLocalBalanceRaw: string; totalRemoteBalanceRaw: string;
 generatedAt: string;
};
export type ChannelHealth = {
 channelId: string; peerPubkey?: string | null; state: string; enabled: boolean;
 localBalanceRaw: string; remoteBalanceRaw: string; outboundRatio: number; pendingTlcs: number;
 health: "HEALTHY" | "WARNING" | "CRITICAL" | string; diagnosis: string[]; recommendations: string[];
 raw: unknown;
};
export type ChannelHealthResponse = {
 scanned: number; healthy: number; warning: number; critical: number;
 totalLocalBalanceRaw: string; totalRemoteBalanceRaw: string; channels: ChannelHealth[]; observedAt: string;
};
export type PaymentReadiness = {
 status: "READY" | "RISKY" | "UNPAYABLE" | string; payable: boolean; feeRaw?: string | null;
 routeCount: number; failure?: string | null; recommendations: string[]; dryRun: unknown; checkedAt: string;
};
export type ReconciliationResult = {
 paymentHash: string; invoiceStatus?: string | null; paymentStatus?: string | null; cchStatus?: string | null;
 consistent: boolean; severity: string; diagnosis: string; recommendedAction: string; snapshot: unknown; checkedAt: string;
};
export type FiberIncident = {
 id: number; fingerprint: string; incidentType: string; severity: string; status: string;
 subjectType: string; subjectId: string; title: string; diagnosis: string; recommendation?: string | null;
 contextJson: unknown; network: string; firstSeenAt: string; lastSeenAt: string; resolvedAt?: string | null;
};
export const fiberOpsApi = {
 compatibility: async () => (await getFiberRuntime()).compatibility() as Promise<FiberCompatibility>,
 overview: async () => (await getFiberRuntime()).overview() as Promise<FiberOpsOverview>,
 channels: async () => (await getFiberRuntime()).channelHealth() as Promise<ChannelHealthResponse>,
 readiness: async (invoice: string) => (await getFiberRuntime()).readiness(invoice) as Promise<PaymentReadiness>,
 reconcile: async (paymentHash: string) => (await getFiberRuntime()).reconcile(paymentHash) as Promise<ReconciliationResult>,
 incidents: async () => (await getFiberRuntime()).incidents() as Promise<FiberIncident[]>,
 // Browser WASM is controlled in-process. There is no localhost Fiber SSE endpoint.
 eventsUrl: () => "",
};

export type AiKnowledgeChunk = {
  id: number;
  source: string;
  title: string;
  content: string;
  sourceUrl?: string | null;
  score: number;
};
export type AiChatResponse = {
  answer: string;
  provider: string;
  model?: string | null;
  sources: AiKnowledgeChunk[];
  safety: {
    readOnly: boolean;
    privateKeysSentToLlm: boolean;
    automaticPayments: boolean;
    operatorApprovalRequiredForRecovery: boolean;
  };
};
export const aiApi = {
  chat: (body: { message: string; runtimeContext?: unknown; walletAddress?: string; maxChunks?: number }) =>
    request<AiChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify(body) }),
  searchKnowledge: (q: string, limit = 5) =>
    request<AiKnowledgeChunk[]>(`/ai/knowledge/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  syncRuntimeSnapshot: (body: { overview: unknown; channels: unknown; incidents: unknown }) =>
    request<{ status: string; network: string; runtime: string }>("/fiber/runtime/snapshot", { method: "POST", body: JSON.stringify(body) }),
};

export type FiberNetworkResources = {
  graphNodes: number; graphChannels: number; connectedPeers: number; localChannels: number;
  readyChannels: number; udtChannels: number; observedAt: string;
  nodes: unknown[]; channels: unknown[];
};
export const fiberRuntimeService = {
  storeResources: (resources: FiberNetworkResources) => request<{ status: string; network: string; runtime: string }>("/fiber/runtime/resources", { method: "POST", body: JSON.stringify({ resources }) }),
  latestResources: () => request<{ network: string; runtime: string; resources: FiberNetworkResources; capturedAt: string }>("/fiber/runtime/resources"),
};

export type MerchantOrder = {
  id: string; merchantWallet: string; customerReference?: string | null; amountRaw: string;
  assetKind: string; description?: string | null; status: string; paymentHash?: string | null;
  invoiceAddress?: string | null; network: string; paidAt?: string | null; createdAt: string; updatedAt: string;
};
export const merchantOrderApi = {
  create: (body: { customerReference?: string; amountRaw: string; assetKind?: string; description?: string; paymentHash?: string | null; invoiceAddress?: string | null }, idempotencyKey?: string) =>
    request<MerchantOrder>("/merchant/orders", { method: "POST", headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined, body: JSON.stringify(body) }),
  list: () => request<MerchantOrder[]>("/merchant/orders"),
  updateStatus: (orderId: string, status: string) => request<MerchantOrder>(`/merchant/orders/${encodeURIComponent(orderId)}`, { method: "POST", body: JSON.stringify({ status }) }),
  recordAttempt: (orderId: string, body: { paymentHash?: string; status: string; feeRaw?: string; routeParts?: number; failure?: string; raw?: unknown }) =>
    request<{ id: number; orderId: string; status: string }>(`/merchant/orders/${encodeURIComponent(orderId)}/attempts`, { method: "POST", body: JSON.stringify(body) }),
};
