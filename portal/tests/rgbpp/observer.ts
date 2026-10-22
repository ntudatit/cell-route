import { ccc } from "@ckb-ccc/core";
import { checkSample, pins, RgbppError, type Sample } from "./checker";
export interface Options {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}
export interface RawResponse {
  source: string;
  request: unknown;
  response: unknown;
}
type Json = Record<string, any>;
export function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RgbppError("Invalid API object.");
  return value as Json;
}
function hash(value: unknown, prefix = false): string {
  if (
    typeof value !== "string" ||
    !(prefix ? /^0x[0-9a-f]{64}$/ : /^[0-9a-f]{64}$/).test(value)
  )
    throw new RgbppError("Invalid API hash.");
  return value;
}
function height(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new RgbppError("Invalid block height.");
  return value as number;
}
function numberHex(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/.test(value))
    throw new RgbppError("Invalid CKB block number.");
  return value;
}
let sequence = 0;
export async function request(
  url: string,
  init: RequestInit,
  options: Options = {},
) {
  const timeout = options.timeoutMs ?? 12000;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30000)
    throw new RgbppError("Invalid timeout.");
  const controller = new AbortController();
  const abort = () => controller.abort(new RgbppError("Cancelled."));
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new RgbppError("API timeout; state is unknown.")),
    timeout,
  );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    controller.signal.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(url, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok)
      throw new RgbppError(`HTTP ${response.status}; state is unknown.`);
    if (
      !response.body ||
      Number(response.headers.get("content-length")) > 1048576
    )
      throw new RgbppError("Missing or oversized API response.");
    reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 1048576) throw new RgbppError("API response exceeds 1 MiB.");
      parts.push(next.value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      data.set(part, offset);
      offset += part.length;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof RgbppError) throw error;
    throw new RgbppError("API transport/schema failure; state is unknown.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* closed */
      }
    }
  }
}
function rpcScript(value: unknown) {
  const script = object(value);
  if (
    !["type", "data", "data1", "data2"].includes(script.hash_type) ||
    typeof script.args !== "string" ||
    !/^0x(?:[0-9a-f]{2})*$/.test(script.args)
  )
    throw new RgbppError("Invalid script schema.");
  return ccc.Script.from({
    codeHash: hash(script.code_hash, true),
    hashType: script.hash_type,
    args: script.args,
  });
}
function rpcOutput(value: unknown) {
  const output = object(value);
  return ccc.CellOutput.from({
    capacity: numberHex(output.capacity),
    lock: rpcScript(output.lock),
    type: output.type === null ? undefined : rpcScript(output.type),
  });
}
export function confirmationState(
  confirmed: boolean,
  canonical: boolean,
  blockHeight: number,
  tip: number,
  stable: boolean,
) {
  if (!canonical) return { state: "reorg-detected", confirmations: 0 };
  if (!stable || blockHeight > tip)
    return { state: "unknown", confirmations: 0 };
  if (!confirmed) return { state: "pending", confirmations: 0 };
  const confirmations = tip - blockHeight + 1;
  return {
    state:
      confirmations >= pins.confirmationPolicy.bitcoin
        ? "observed threshold reached"
        : "pending confirmations",
    confirmations,
  };
}
export async function observe(sample: Sample, options: Options = {}) {
  const linkage = await checkSample(sample);
  if (linkage.status !== "matched")
    throw new RgbppError(
      "Resolve fixture mismatches before reading chain state.",
    );
  const deadline = AbortSignal.timeout(45000);
  options = {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, deadline])
      : deadline,
  };
  const raw: RawResponse[] = [];
  async function btc(path: string, json = false) {
    const response = await request(pins.network.bitcoinApi + path, {}, options);
    raw.push({ source: pins.network.bitcoinApi, request: path, response });
    return json ? JSON.parse(response) : response.trim();
  }
  async function ckb(method: string, params: unknown[]) {
    const id = ++sequence;
    const body = { id, jsonrpc: "2.0", method, params };
    const text = await request(
      pins.network.ckbRpc,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options,
    );
    const response = object(JSON.parse(text));
    raw.push({ source: pins.network.ckbRpc, request: body, response });
    if (
      response.jsonrpc !== "2.0" ||
      response.id !== id ||
      !("result" in response) ||
      "error" in response
    )
      throw new RgbppError("CKB JSON-RPC error or response mismatch.");
    return response.result;
  }
  async function bitcoin() {
    if ((await btc("/block-height/0")) !== pins.network.bitcoinGenesis)
      throw new RgbppError("Bitcoin network/genesis mismatch.");
    const tipHash = hash(await btc("/blocks/tip/hash"));
    const tip = object(await btc(`/block/${tipHash}`, true));
    if (hash(tip.id) !== tipHash)
      throw new RgbppError("Bitcoin tip identity mismatch.");
    const tipHeight = height(tip.height);
    const tx = object(await btc(`/tx/${sample.bitcoin.txid}`, true));
    if (
      hash(tx.txid) !== sample.bitcoin.txid ||
      !Array.isArray(tx.vout) ||
      !tx.vout[sample.bitcoin.vout]
    )
      throw new RgbppError("Bitcoin transaction/output unavailable.");
    const status = object(tx.status);
    if (typeof status.confirmed !== "boolean")
      throw new RgbppError("Invalid confirmation status.");
    let canonical = true;
    let blockHeight = 0;
    if (status.confirmed) {
      blockHeight = height(status.block_height);
      canonical =
        (await btc(`/block-height/${blockHeight}`)) === hash(status.block_hash);
    }
    const spend = object(
      await btc(
        `/tx/${sample.bitcoin.txid}/outspend/${sample.bitcoin.vout}`,
        true,
      ),
    );
    if (
      typeof spend.spent !== "boolean" ||
      (spend.spent &&
        (typeof spend.vin !== "number" ||
          !Number.isSafeInteger(spend.vin) ||
          spend.vin < 0))
    )
      throw new RgbppError("Invalid outspend response.");
    const endTipHash = hash(await btc("/blocks/tip/hash"));
    const stable = tipHash === endTipHash;
    const confirmations = confirmationState(
      status.confirmed,
      canonical,
      blockHeight,
      tipHeight,
      stable,
    );
    return {
      state: spend.spent ? "spent" : "unspent",
      spendingTxid: spend.spent ? hash(spend.txid) : null,
      creationStatus: status,
      tip: { hash: tipHash, height: tipHeight },
      endTipHash,
      stable,
      confirmation: confirmations.state,
      confirmations: confirmations.confirmations,
    };
  }
  async function nervos() {
    if ((await ckb("get_block_hash", ["0x0"])) !== pins.network.ckbGenesis)
      throw new RgbppError("CKB network/genesis mismatch.");
    const tip = object(await ckb("get_tip_header", []));
    hash(tip.hash, true);
    numberHex(tip.number);
    const deployment = object(
      await ckb("get_transaction", [pins.network.rgbppLock.deployment.txHash]),
    );
    const depTx = object(deployment.transaction);
    if (
      object(deployment.tx_status).status !== "committed" ||
      depTx.hash !== pins.network.rgbppLock.deployment.txHash ||
      !Array.isArray(depTx.outputs) ||
      rpcScript(object(depTx.outputs[0]).type).hash() !==
        pins.network.rgbppLock.codeHash
    )
      throw new RgbppError("Deployment type hash/transaction mismatch.");
    const transaction = object(
      await ckb("get_transaction", [sample.ckb.outPoint.txHash]),
    );
    const tx = object(transaction.transaction);
    const txStatus = object(transaction.tx_status);
    if (
      tx.hash !== sample.ckb.outPoint.txHash ||
      !Array.isArray(tx.outputs) ||
      !Array.isArray(tx.outputs_data)
    )
      throw new RgbppError("Historical CKB transaction unavailable.");
    const index = Number(sample.ckb.outPoint.index);
    if (
      ccc.hexFrom(rpcOutput(tx.outputs[index]).toBytes()) !==
        ccc.hexFrom(ccc.CellOutput.from(sample.ckb.output).toBytes()) ||
      tx.outputs_data[index] !== sample.ckb.data
    )
      throw new RgbppError("Historical Cell differs from public fixture.");
    let canonical: boolean | null = null;
    if (txStatus.status === "committed") {
      const blockHash = hash(txStatus.block_hash, true);
      const header = object(await ckb("get_header", [blockHash]));
      if (header.hash !== blockHash)
        throw new RgbppError("CKB containing header identity mismatch.");
      canonical =
        (await ckb("get_block_hash", [numberHex(header.number)])) === blockHash;
    }
    const live = object(
      await ckb("get_live_cell", [
        {
          tx_hash: sample.ckb.outPoint.txHash,
          index: sample.ckb.outPoint.index,
        },
        true,
      ]),
    );
    if (!["live", "dead", "unknown"].includes(live.status))
      throw new RgbppError("Invalid live Cell response.");
    if (live.status === "live") {
      const cell = object(live.cell);
      if (
        ccc.hexFrom(rpcOutput(cell.output).toBytes()) !==
          ccc.hexFrom(ccc.CellOutput.from(sample.ckb.output).toBytes()) ||
        object(cell.data).content !== sample.ckb.data
      )
        throw new RgbppError("Live Cell identity mismatch.");
    }
    const endTip = object(await ckb("get_tip_header", []));
    hash(endTip.hash, true);
    numberHex(endTip.number);
    return {
      state: live.status,
      transactionStatus: txStatus.status,
      canonical,
      tip: { hash: tip.hash, number: tip.number },
      endTip: { hash: endTip.hash, number: endTip.number },
      stable: tip.hash === endTip.hash,
      deployment: "type hash matched configured deployment",
      confirmation:
        canonical === false
          ? "reorg-detected"
          : txStatus.status === "committed" && canonical
            ? "observed committed; not irreversible finality"
            : "pending/unknown",
    };
  }
  const results = await Promise.allSettled([bitcoin(), nervos()]);
  function outcome<T>(r: PromiseSettledResult<T>) {
    return r.status === "fulfilled"
      ? r.value
      : {
          state: "unknown",
          error:
            r.reason instanceof RgbppError
              ? r.reason.message
              : "API schema/availability failure; state is unknown.",
        };
  }
  options.signal?.throwIfAborted();
  return {
    observedAt: new Date().toISOString(),
    profile: pins.profile,
    layer: "Public API/node observations; not independent proof verification",
    bitcoin: outcome(results[0]),
    ckb: outcome(results[1]),
    proof: { status: "not verified" as const, reason: pins.spv.reason },
    crossChainComplete: false,
    transfer: "not performed",
    policy: pins.confirmationPolicy,
    trust:
      "Fixed public APIs are trusted observations. Sequential reads and the two chains are not an atomic snapshot. Refresh replaces previous observations.",
    raw,
  };
}
