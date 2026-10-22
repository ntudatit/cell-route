import { ccc } from "@ckb-ccc/core";
import {
  decodeBinding,
  encodeBinding,
  bytes,
  hex,
  hash256,
  RgbppError,
} from "./encoding";
import {
  object,
  request,
  confirmationState,
  type Options,
  type RawResponse,
} from "./http";
import { profiles, type ProfileName } from "./profiles";
export type AssetQuery = {
  network: ProfileName;
  kind: "cell" | "utxo";
  txid: string;
  index: number;
  cursor?: string;
};
export function validateQuery(value: AssetQuery) {
  if (
    !Object.hasOwn(profiles, value.network) ||
    !["cell", "utxo"].includes(value.kind)
  )
    throw new RgbppError("Unsupported network or lookup kind.");
  if (
    !Number.isSafeInteger(value.index) ||
    value.index < 0 ||
    value.index > 0xffffffff
  )
    throw new RgbppError("Output index must be uint32.");
  const txid = value.txid.trim().toLowerCase().replace(/^0x/, "");
  bytes(txid, 32);
  if (value.cursor && !/^0x[0-9a-f]{2,512}$/.test(value.cursor))
    throw new RgbppError("Invalid indexer cursor.");
  return { ...value, txid };
}
function script(value: unknown) {
  const s = object(value);
  if (!["data", "type", "data1", "data2"].includes(s.hash_type))
    throw new RgbppError("Invalid script hash type.");
  bytes(s.code_hash, 32);
  bytes(s.args);
  return ccc.Script.from({
    codeHash: s.code_hash,
    hashType: s.hash_type,
    args: s.args,
  });
}
function output(value: unknown) {
  const o = object(value);
  if (typeof o.capacity !== "string" || !/^0x[0-9a-f]+$/i.test(o.capacity))
    throw new RgbppError("Invalid Cell capacity.");
  return ccc.CellOutput.from({
    capacity: o.capacity,
    lock: script(o.lock),
    type: o.type ? script(o.type) : undefined,
  });
}
function hash(value: unknown, prefix = false) {
  if (
    typeof value !== "string" ||
    !(prefix ? /^0x[0-9a-f]{64}$/ : /^[0-9a-f]{64}$/).test(value)
  )
    throw new RgbppError("Invalid API hash.");
  return value;
}
// Merkle inclusion against a supplied header is deliberately separate from header-chain/SPV validation.
export async function verifyInclusion(
  txid: string,
  proof: unknown,
  headerHex: string,
  blockHash: string,
) {
  const p = object(proof),
    header = bytes(headerHex, 80);
  hash(txid);
  hash(blockHash);
  if (
    !Number.isSafeInteger(p.pos) ||
    p.pos < 0 ||
    p.pos > 0xffffffff ||
    !Array.isArray(p.merkle) ||
    p.merkle.length > 32 ||
    !Number.isSafeInteger(p.block_height) ||
    p.block_height < 0
  )
    throw new RgbppError("Invalid Merkle proof schema.");
  if (hex(bytes(await hash256(header)).reverse()) !== blockHash)
    throw new RgbppError("Bitcoin header hash mismatch.");
  let current = bytes(txid).reverse(),
    position = p.pos;
  for (const sibling of p.merkle) {
    const other = bytes(sibling, 32).reverse();
    const pair = new Uint8Array(64);
    pair.set(position % 2 ? other : current);
    pair.set(position % 2 ? current : other, 32);
    current = bytes(await hash256(pair));
    position = Math.floor(position / 2);
  }
  if (position !== 0 || hex(current) !== hex(header.slice(36, 68)))
    throw new RgbppError("Bitcoin Merkle inclusion mismatch.");
  return {
    status: "matched",
    blockHash,
    blockHeight: p.block_height,
    position: p.pos,
    merkleRoot: hex(current.slice().reverse()),
    headerChain: "not independently verified",
    scope:
      "Transaction inclusion in API-supplied header only; not full RGB++ SPV verification",
  };
}
let sequence = 0;
export async function inspectAsset(input: AssetQuery, options: Options = {}) {
  const query = validateQuery(input),
    profile = profiles[query.network];
  const deadline = AbortSignal.timeout(45000);
  options = {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, deadline])
      : deadline,
  };
  const raw: RawResponse[] = [];
  async function btc(path: string, json = true) {
    const text = await request(profile.bitcoinApi + path, {}, options);
    raw.push({ source: profile.bitcoinApi, request: path, response: text });
    return json ? JSON.parse(text) : text.trim();
  }
  async function rpc(method: string, params: unknown[]) {
    const id = ++sequence,
      body = { id, jsonrpc: "2.0", method, params };
    const text = await request(
      profile.ckbRpc,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options,
    );
    const r = object(JSON.parse(text));
    raw.push({ source: profile.ckbRpc, request: body, response: r });
    if (r.id !== id || r.jsonrpc !== "2.0" || "error" in r || !("result" in r))
      throw new RgbppError("CKB RPC error/correlation mismatch.");
    return r.result;
  }
  const identities = await Promise.allSettled([
    btc("/block-height/0", false),
    rpc("get_block_hash", ["0x0"]),
  ]);
  if (identities.some((r) => r.status === "rejected"))
    throw new RgbppError(
      "Cannot establish both network identities. Check RPC/API availability and retry.",
    );
  if (
    (identities[0] as PromiseFulfilledResult<unknown>).value !==
      profile.bitcoinGenesis ||
    (identities[1] as PromiseFulfilledResult<unknown>).value !==
      profile.ckbGenesis
  )
    throw new RgbppError("Network/genesis mismatch.");
  const dep = object(
    await rpc("get_transaction", [profile.rgbppLock.deployment.txHash]),
  );
  if (
    dep.tx_status?.status !== "committed" ||
    dep.transaction?.hash !== profile.rgbppLock.deployment.txHash ||
    script(dep.transaction?.outputs?.[0]?.type).hash() !==
      profile.rgbppLock.codeHash
  )
    throw new RgbppError("RGB++ deployment identity mismatch.");
  const tips = await Promise.allSettled([
    btc("/blocks/tip/hash", false),
    rpc("get_tip_header", []),
  ]);
  const cells: {
    outPoint: { txHash: string; index: string };
    output: Record<string, unknown>;
    data: string;
    capacityCkb: string;
    liveStatus: string;
    transactionStatus: string;
    blockHash: string | null;
  }[] = [];
  let binding: { txid: string; vout: number };
  let cursor: string | null = null;
  let indexerStatus = "not requested";
  async function loadCell(
    txHash: string,
    index: number,
    expectedArgs?: string,
  ) {
    const response = await rpc("get_transaction", [txHash]);
    if (response === null) return { state: "not found", cell: null };
    const r = object(response);
    if (!r.transaction)
      return { state: r.tx_status?.status ?? "not found", cell: null };
    const t = object(r.transaction);
    if (
      t.hash !== txHash ||
      !Array.isArray(t.outputs) ||
      !t.outputs[index] ||
      !Array.isArray(t.outputs_data)
    )
      throw new RgbppError("CKB transaction/output unavailable.");
    const cellOutput = output(t.outputs[index]);
    bytes(t.outputs_data[index]);
    if (
      cellOutput.lock.codeHash !== profile.rgbppLock.codeHash ||
      cellOutput.lock.hashType !== "type"
    )
      throw new RgbppError(
        "Selected Cell is not an RGB++ asset on this network.",
      );
    const decoded = decodeBinding(cellOutput.lock.args);
    if (expectedArgs && cellOutput.lock.args !== expectedArgs)
      throw new RgbppError("Indexer binding does not match node data.");
    let liveStatus = "unknown";
    try {
      const live = object(
        await rpc("get_live_cell", [
          { tx_hash: txHash, index: `0x${index.toString(16)}` },
          true,
        ]),
      );
      if (!["live", "dead", "unknown"].includes(live.status)) throw Error();
      liveStatus = live.status;
      if (
        liveStatus === "live" &&
        (hex(output(live.cell.output).toBytes()) !==
          hex(cellOutput.toBytes()) ||
          live.cell.data.content !== t.outputs_data[index])
      )
        throw new RgbppError("Live Cell and historical transaction disagree.");
    } catch (error) {
      if (error instanceof RgbppError && error.message.includes("disagree"))
        throw error;
    }
    const cell = {
      outPoint: { txHash, index: `0x${index.toString(16)}` },
      output: object(t.outputs[index]),
      data: t.outputs_data[index] as string,
      capacityCkb: ccc.fixedPointToString(cellOutput.capacity),
      liveStatus,
      transactionStatus: String(r.tx_status?.status ?? "unknown"),
      blockHash: r.tx_status?.block_hash ?? null,
    };
    cells.push(cell);
    return { state: "found", cell, binding: decoded };
  }
  if (query.kind === "cell") {
    const found = await loadCell(`0x${query.txid}`, query.index);
    if (!found.cell || !found.binding)
      return {
        query,
        network: profile.name,
        observedAt: new Date().toISOString(),
        status: found.state,
        cells,
        bitcoin: null,
        indexerStatus,
        cursor,
        proof: { status: "not verified" },
        crossChainComplete: false,
        raw,
      };
    binding = found.binding;
  } else {
    binding = { txid: query.txid, vout: query.index };
    const args = encodeBinding(binding.txid, binding.vout);
    try {
      const result = object(
        await rpc("get_cells", [
          {
            script: {
              code_hash: profile.rgbppLock.codeHash,
              hash_type: "type",
              args,
            },
            script_type: "lock",
            script_search_mode: "exact",
            with_data: true,
          },
          "asc",
          "0xa",
          ...(query.cursor ? [query.cursor] : []),
        ]),
      );
      if (
        !Array.isArray(result.objects) ||
        result.objects.length > 10 ||
        typeof result.last_cursor !== "string"
      )
        throw new RgbppError("Invalid indexer page.");
      cursor = result.objects.length === 10 ? result.last_cursor : null;
      indexerStatus = result.objects.length
        ? "indexed live candidates (node rechecked)"
        : "no indexed live matches; historical/dead Cells are not searched";
      for (const row of result.objects) {
        const p = object(object(row).out_point);
        hash(p.tx_hash, true);
        const n = Number(p.index);
        if (!Number.isInteger(n) || n < 0 || n > 0xffffffff)
          throw new RgbppError("Invalid indexed OutPoint.");
        await loadCell(p.tx_hash, n, args);
      }
    } catch (error) {
      indexerStatus =
        error instanceof Error
          ? `unknown: ${error.message}`
          : "indexer unavailable";
    }
  }
  let bitcoin: Record<string, unknown>;
  try {
    const tx = object(await btc(`/tx/${binding.txid}`));
    if (
      tx.txid !== binding.txid ||
      !Array.isArray(tx.vout) ||
      !tx.vout[binding.vout]
    )
      throw new RgbppError("Bitcoin transaction/output not available.");
    const out = object(tx.vout[binding.vout]);
    const status = object(tx.status);
    if (
      typeof status.confirmed !== "boolean" ||
      !Number.isSafeInteger(out.value) ||
      out.value < 0 ||
      typeof out.scriptpubkey !== "string"
    )
      throw new RgbppError("Invalid Bitcoin output/status.");
    const spend = object(
      await btc(`/tx/${binding.txid}/outspend/${binding.vout}`),
    );
    if (typeof spend.spent !== "boolean")
      throw new RgbppError("Invalid spend status.");
    let inclusion: Record<string, unknown> = {
      status: "not available",
      reason: "Transaction is unconfirmed",
    };
    let confirmations = { state: "pending", confirmations: 0 };
    if (status.confirmed) {
      try {
        hash(status.block_hash);
        if (
          !Number.isSafeInteger(status.block_height) ||
          status.block_height < 0
        )
          throw Error();
        const [proof, header, canonical] = await Promise.all([
          btc(`/tx/${binding.txid}/merkle-proof`),
          btc(`/block/${status.block_hash}/header`, false),
          btc(`/block-height/${status.block_height}`, false),
        ]);
        if (canonical !== status.block_hash)
          throw new RgbppError("Containing block is no longer canonical.");
        const checked = await verifyInclusion(
          binding.txid,
          proof,
          header,
          status.block_hash,
        );
        if (checked.blockHeight !== status.block_height)
          throw new RgbppError("Proof height mismatch.");
        inclusion = checked;
        if (tips[0].status === "fulfilled") {
          const tipHash = hash(tips[0].value);
          const tipBlock = object(await btc(`/block/${tipHash}`));
          if (tipBlock.id !== tipHash || !Number.isSafeInteger(tipBlock.height))
            throw Error();
          const endHash = await btc("/blocks/tip/hash", false);
          confirmations = confirmationState(
            true,
            true,
            status.block_height,
            tipBlock.height,
            endHash === tipHash,
          );
        }
      } catch (error) {
        inclusion = {
          status: "not verified",
          reason: error instanceof Error ? error.message : "Proof unavailable",
        };
        confirmations = { state: "unknown", confirmations: 0 };
      }
    }
    bitcoin = {
      state: spend.spent ? "spent" : "unspent",
      txid: binding.txid,
      vout: binding.vout,
      valueSats: out.value,
      script: out.scriptpubkey,
      address: out.scriptpubkey_address ?? null,
      spendingTxid: spend.spent ? hash(spend.txid) : null,
      status,
      confirmation: confirmations,
      inclusion,
    };
  } catch (error) {
    bitcoin = {
      state: "unknown",
      error: error instanceof Error ? error.message : "Bitcoin API unavailable",
    };
  }
  options.signal?.throwIfAborted();
  return {
    query,
    network: profile.name,
    observedAt: new Date().toISOString(),
    status: "observed",
    binding,
    cells,
    bitcoin,
    indexerStatus,
    cursor,
    tips: tips.map((r) => (r.status === "fulfilled" ? r.value : "unknown")),
    proof: {
      status: "not verified",
      scope:
        "RGB++ SPV/CKB lock execution not verified; Bitcoin inclusion is reported separately",
    },
    crossChainComplete: false,
    raw,
  };
}
