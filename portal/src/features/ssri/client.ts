import { ccc } from "@ckb-ccc/core";
import pins from "./pins.json";
export { pins };
export const METHODS = [
  "SSRI.version",
  "SSRI.get_methods",
  "SSRI.has_methods",
  "SSRI.get_cell_deps",
  "UDT.name",
  "UDT.symbol",
  "UDT.decimals",
  "UDT.balance",
] as const;
export type Method = (typeof METHODS)[number];
export type ErrorCode =
  | "CONFIG"
  | "HTTP"
  | "TRANSPORT"
  | "TIMEOUT"
  | "ABORTED"
  | "SIZE"
  | "SCHEMA"
  | "RPC"
  | "IDENTITY"
  | "UNSUPPORTED";
export class SsriError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public diagnostic?: unknown,
  ) {
    super(message);
  }
}
export function methodPath(name: string) {
  return ccc.hashCkb(new TextEncoder().encode(name)).slice(0, 18);
}
export function u64(value: bigint) {
  if (value < 0n || value > 0xffffffffffffffffn)
    throw new SsriError("CONFIG", "Expected u64.");
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return ccc.hexFrom(bytes);
}
export function isHex(value: unknown, bytes?: number): value is string {
  return (
    typeof value === "string" &&
    /^0x(?:[0-9a-f]{2})*$/i.test(value) &&
    (bytes === undefined || value.length === bytes * 2 + 2)
  );
}
export function publicEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SsriError("CONFIG", "Enter an absolute HTTP(S) URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new SsriError(
      "CONFIG",
      "Use a public endpoint without credentials, query tokens or fragments.",
    );
  return url.href;
}
export interface TransportOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}
let sequence = 0;
export async function rpc(
  endpoint: string,
  method: string,
  params: unknown[],
  options: TransportOptions = {},
) {
  const url = publicEndpoint(endpoint);
  const id = ++sequence;
  const request = { id, jsonrpc: "2.0", method, params };
  const timeout = options.timeoutMs ?? 10000,
    limit = options.maxBytes ?? 262144;
  if (
    !Number.isFinite(timeout) ||
    timeout < 1 ||
    timeout > 30000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 4194304
  )
    throw new SsriError("CONFIG", "Invalid transport bounds.");
  const controller = new AbortController();
  const abort = () =>
    controller.abort(new SsriError("ABORTED", "Query cancelled."));
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(
    () =>
      controller.abort(
        new SsriError(
          "TIMEOUT",
          "SSRI/RPC deadline exceeded. Retry explicitly.",
        ),
      ),
    timeout,
  );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    controller.signal.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new SsriError("HTTP", `HTTP ${response.status}`, {
        status: response.status,
      });
    if (Number(response.headers.get("content-length")) > limit)
      throw new SsriError("SIZE", "Response exceeds client limit.");
    if (!response.body)
      throw new SsriError("SCHEMA", "Response body is missing.");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > limit)
        throw new SsriError("SIZE", "Stream exceeds client limit.");
      chunks.push(part.value);
    }
    const buffer = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, position);
      position += chunk.length;
    }
    const rawText = new TextDecoder().decode(buffer);
    let envelope: Record<string, unknown>;
    try {
      envelope = JSON.parse(rawText);
    } catch {
      throw new SsriError("SCHEMA", "Invalid JSON response.", { rawText });
    }
    if (
      !envelope ||
      typeof envelope !== "object" ||
      envelope.jsonrpc !== "2.0" ||
      envelope.id !== id ||
      "result" in envelope === "error" in envelope
    )
      throw new SsriError(
        "SCHEMA",
        "JSON-RPC envelope or request ID mismatch.",
        { rawText },
      );
    if ("error" in envelope)
      throw new SsriError(
        "RPC",
        "Server returned a JSON-RPC error; see raw diagnostic.",
        { rawText, error: envelope.error },
      );
    return { request, rawText, result: envelope.result };
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof SsriError) throw error;
    throw new SsriError(
      "TRANSPORT",
      "RPC unavailable, blocked by CORS, or connection failed. No automatic retry.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* connection already closed */
      }
    }
  }
}
export interface Identity {
  nodeUrl: string;
  serverUrl: string;
  network: "devnet" | "testnet" | "mainnet";
  genesisHash: string;
  outPoint: { txHash: string; index: number };
  codeHash: string;
}
export async function verifyIdentity(
  identity: Identity,
  options: TransportOptions = {},
) {
  const canonical = {
    mainnet:
      "0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5",
    testnet:
      "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
  };
  if (
    identity.network !== "devnet" &&
    identity.genesisHash !== canonical[identity.network]
  )
    throw new SsriError(
      "CONFIG",
      "Selected network and expected genesis disagree.",
    );
  publicEndpoint(identity.nodeUrl);
  publicEndpoint(identity.serverUrl);
  if (
    ![identity.genesisHash, identity.outPoint.txHash, identity.codeHash].every(
      (v) => isHex(v, 32),
    ) ||
    !Number.isInteger(identity.outPoint.index) ||
    identity.outPoint.index < 0 ||
    identity.outPoint.index > 0xffffffff
  )
    throw new SsriError(
      "CONFIG",
      "Expected 32-byte identities and a uint32 output index.",
    );
  const genesis = await rpc(
    identity.nodeUrl,
    "get_block_hash",
    ["0x0"],
    options,
  );
  if (genesis.result !== identity.genesisHash)
    throw new SsriError("IDENTITY", "Genesis mismatch; SSRI was not called.");
  const tx = await rpc(
    identity.nodeUrl,
    "get_transaction",
    [identity.outPoint.txHash],
    { ...options, maxBytes: 4194304 },
  );
  const result = tx.result as {
    tx_status?: { status?: string };
    transaction?: {
      hash?: string;
      outputs?: unknown[];
      outputs_data?: unknown[];
    };
  } | null;
  const transaction = result?.transaction;
  const data = transaction?.outputs_data?.[identity.outPoint.index];
  if (
    result?.tx_status?.status !== "committed" ||
    transaction?.hash !== identity.outPoint.txHash ||
    !transaction.outputs?.[identity.outPoint.index] ||
    !isHex(data) ||
    ccc.hashCkb(data) !== identity.codeHash
  )
    throw new SsriError(
      "IDENTITY",
      "Committed code OutPoint unavailable or code hash mismatch; SSRI was not called.",
    );
  const tip = await rpc(identity.nodeUrl, "get_tip_header", [], options);
  const header = tip.result as { hash?: string; number?: string };
  if (
    !header ||
    !isHex(header.hash, 32) ||
    typeof header.number !== "string" ||
    !/^0x[0-9a-f]+$/i.test(header.number)
  )
    throw new SsriError("SCHEMA", "Invalid observed tip header.");
  return {
    ...identity,
    nodeOrigin: new URL(identity.nodeUrl).origin,
    serverOrigin: new URL(identity.serverUrl).origin,
    codeBytes: ccc.bytesFrom(data).length,
    observedTip: { hash: header.hash, number: header.number },
    context: "Code",
    timestamp: new Date().toISOString(),
    trust:
      "Node code identity verified. Server execution is trusted, not cryptographically attested. Observed tip is not a pinned execution snapshot.",
  };
}
export function encodeArgs(method: Method, offset = 0n, limit = 64n) {
  if (!METHODS.includes(method))
    throw new SsriError(
      "UNSUPPORTED",
      "Method is outside this readonly profile.",
    );
  if (method === "SSRI.has_methods")
    throw new SsriError(
      "UNSUPPORTED",
      "has_methods is discovered but not invoked by this Inspector.",
    );
  if (offset < 0n || offset > 64n || limit < 1n || limit > 64n)
    throw new SsriError(
      "CONFIG",
      "Inspector pagination must stay within 0–64 offset and 1–64 limit.",
    );
  return method === "SSRI.get_methods" || method === "SSRI.get_cell_deps"
    ? [methodPath(method), u64(offset), u64(limit)]
    : [methodPath(method)];
}
export function decodeResult(method: Method, content: unknown): unknown {
  if (!isHex(content))
    throw new SsriError(
      "SCHEMA",
      "Expected legacy hex result; null or modern VmResult is not accepted.",
      content,
    );
  const bytes = ccc.bytesFrom(content);
  if (method === "SSRI.get_methods") {
    if (!bytes.length || bytes.length % 8 || bytes.length > 64 * 8)
      throw new SsriError("SCHEMA", "Expected 1–64 raw 8-byte method paths.");
    return Array.from({ length: bytes.length / 8 }, (_, index) => {
      const path = ccc.hexFrom(bytes.slice(index * 8, index * 8 + 8));
      return {
        path,
        name:
          METHODS.find((name) => methodPath(name) === path) ??
          "Unknown (not callable)",
      };
    });
  }
  if (method === "UDT.name" || method === "UDT.symbol") {
    if (!bytes.length || bytes.length > 256)
      throw new SsriError("SCHEMA", "Expected bounded raw UTF-8 metadata.");
    try {
      const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (/[\u0000-\u001f\u007f]/.test(value)) throw Error();
      return value;
    } catch {
      throw new SsriError("SCHEMA", "Invalid UTF-8 metadata.");
    }
  }
  if (method === "SSRI.version" || method === "UDT.decimals") {
    if (bytes.length !== 1) throw new SsriError("SCHEMA", "Expected one byte.");
    return bytes[0];
  }
  if (method === "UDT.balance") {
    if (bytes.length !== 16)
      throw new SsriError("SCHEMA", "Expected little-endian u128.");
    return bytes
      .reduceRight((n, byte) => n * 256n + BigInt(byte), 0n)
      .toString();
  }
  if (method === "SSRI.get_cell_deps" && content === "0x00000000") return [];
  throw new SsriError(
    "UNSUPPORTED",
    "No decoder for this method/result in the pinned profile.",
  );
}
export async function inspect(
  identity: Identity,
  method: Method,
  options: TransportOptions = {},
  offset = 0n,
  limit = 64n,
) {
  const args = encodeArgs(method, offset, limit);
  const verified = await verifyIdentity(identity, options);
  const discovery = await rpc(
    identity.serverUrl,
    pins.server.rpc,
    [
      identity.outPoint.txHash,
      identity.outPoint.index,
      encodeArgs("SSRI.get_methods"),
    ],
    options,
  );
  let methods: { path: string; name: string }[];
  try {
    methods = decodeResult(
      "SSRI.get_methods",
      discovery.result,
    ) as typeof methods;
  } catch (error) {
    throw new SsriError(
      "SCHEMA",
      error instanceof Error ? error.message : "Discovery schema failure",
      discovery,
    );
  }
  if (!methods.some((entry) => entry.path === methodPath(method)))
    throw new SsriError(
      "UNSUPPORTED",
      "Requested method was not advertised by this script.",
      discovery,
    );
  const call =
    method === "SSRI.get_methods" && offset === 0n && limit === 64n
      ? discovery
      : await rpc(
          identity.serverUrl,
          pins.server.rpc,
          [identity.outPoint.txHash, identity.outPoint.index, args],
          options,
        );
  let decoded: unknown;
  try {
    decoded = decodeResult(method, call.result);
  } catch (error) {
    throw new SsriError(
      "SCHEMA",
      error instanceof Error ? error.message : "Result schema failure",
      call,
    );
  }
  // Identity and explicit context travel with the result; never merge into Token Lab metadata.
  return {
    layer: "SSRI query (not on-chain validation)",
    profile: pins.profile,
    identity: { ...verified, nodeUrl: undefined, serverUrl: undefined },
    method,
    discovery,
    call,
    decoded,
  };
}

export async function queryScript(
  identity: Identity,
  name: string,
  params: unknown,
  options: TransportOptions = {},
) {
  if (!/^[A-Za-z_][A-Za-z0-9_.]{0,127}$/.test(name))
    throw new SsriError("CONFIG", "Enter a method signature such as UDT.name.");
  if (
    !Array.isArray(params) ||
    params.length > 32 ||
    params.some((p) => !isHex(p) || p.length > 8194)
  )
    throw new SsriError(
      "CONFIG",
      "Arguments must be a JSON array of at most32 hex byte strings (4KiB each).",
    );
  const verified = await verifyIdentity(identity, options);
  const call = await rpc(
    identity.serverUrl,
    pins.server.rpc,
    [
      identity.outPoint.txHash,
      identity.outPoint.index,
      [methodPath(name), ...params],
    ],
    options,
  );
  let content: unknown = call.result,
    cellDeps: unknown;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const envelope = content as { content?: unknown; cell_deps?: unknown };
    content = envelope.content;
    cellDeps = envelope.cell_deps;
    if (!Array.isArray(cellDeps) || cellDeps.length > 256)
      throw new SsriError("SCHEMA", "Invalid VmResult dependency list.", call);
  }
  if (!isHex(content))
    throw new SsriError(
      "SCHEMA",
      "Expected legacy hex or modern VmResult content.",
      call,
    );
  let utf8: string | undefined;
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(
      ccc.bytesFrom(content),
    );
    if (value.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(value))
      utf8 = value;
  } catch {
    /* binary result */
  }
  return {
    layer: "Live SSRI read-only query; no signing or on-chain mutation",
    identity: { ...verified, nodeUrl: undefined, serverUrl: undefined },
    method: name,
    path: methodPath(name),
    content,
    utf8,
    cellDeps,
    call,
    validation:
      "Code identity checked; server execution trusted; result schema is script-defined",
  };
}
