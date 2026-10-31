import { ccc } from "@ckb-ccc/core";
import { request, object, type Options } from "../rgbpp/http";
import { pins, rate, type Snapshot, type IckbNetwork } from "./model";
const bytes = (hex: string, size?: number) => {
  if (typeof hex !== "string" || !/^0x(?:[a-f0-9]{2})*$/i.test(hex))
    throw Error("Invalid hexadecimal data.");
  const b = ccc.bytesFrom(hex);
  if (size !== undefined && b.length !== size)
    throw Error("Invalid field width.");
  return b;
};
const hash = (v: unknown) => {
  if (typeof v !== "string" || !/^0x[0-9a-f]{64}$/i.test(v))
    throw Error("Invalid hash.");
  return v.toLowerCase();
};
const num = (value: unknown, width: number) => {
  if (typeof value !== "string" || !/^0x[0-9a-f]{1,32}$/i.test(value))
    throw Error("Invalid numeric header field.");
  const n = BigInt(value);
  if (n >= 1n << BigInt(width * 8)) throw Error("Header field overflow.");
  return ccc.numLeToBytes(n, width);
};
export function validateHeader(value: unknown) {
  const h = object(value);
  hash(h.hash);
  const dao = bytes(h.dao, 32);
  const packed = ccc.bytesConcat(
    num(h.version, 4),
    num(h.compact_target, 4),
    num(h.timestamp, 8),
    num(h.number, 8),
    num(h.epoch, 8),
    bytes(hash(h.parent_hash), 32),
    bytes(hash(h.transactions_root), 32),
    bytes(hash(h.proposals_hash), 32),
    bytes(hash(h.extra_hash), 32),
    dao,
    num(h.nonce, 16),
  );
  if (ccc.hashCkb(packed) !== h.hash)
    throw Error("Header content hash mismatch.");
  const ar = ccc.numFromBytes(dao.slice(8, 16));
  rate(ar);
  return { header: h, ar: ar.toString() };
}
export function decodeDepGroup(content: string) {
  const b = bytes(content);
  if (b.length < 4) throw Error("Invalid dep group.");
  const n = new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);
  if (n < 1 || n > 16 || b.length !== 4 + 36 * n)
    throw Error("Unsupported dep group encoding/size.");
  return Array.from({ length: n }, (_, i) => ({
    txHash: ccc.hexFrom(b.slice(4 + 36 * i, 36 + 36 * i)),
    index: new DataView(b.buffer, b.byteOffset + 36 + 36 * i, 4).getUint32(
      0,
      true,
    ),
  }));
}
export async function loadSnapshot(
  network: IckbNetwork,
  options: Options = {},
): Promise<Snapshot> {
  if (!Object.hasOwn(pins.networks, network))
    throw Error("Unsupported iCKB network.");
  const profile = pins.networks[network];
  const env =
    import.meta.env ?? (typeof process !== "undefined" ? process.env : {});
  const configured =
    network === "testnet"
      ? env.VITE_ICKB_TESTNET_RPC
      : env.VITE_ICKB_MAINNET_RPC;
  const url = new URL(configured || profile.rpc);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("RPC must be a public HTTP URL without embedded credentials.");
  const rpcUrl = url.href.replace(/\/$/, "");
  const raw: unknown[] = [];
  let sequence = 0;
  const deadline = AbortSignal.timeout(60000);
  options = {
    ...options,
    maxResponseBytes: 4 * 1048576,
    signal: options.signal
      ? AbortSignal.any([options.signal, deadline])
      : deadline,
  };
  async function rpc(method: string, params: unknown[]) {
    const q = { jsonrpc: "2.0", id: ++sequence, method, params };
    const response = object(
      JSON.parse(
        await request(
          rpcUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(q),
          },
          options,
        ),
      ),
    );
    raw.push({ request: q, response });
    if (response.error || response.id !== q.id || !("result" in response))
      throw Error(
        `RPC ${method} failed: ${response.error?.message ?? "invalid envelope"}`,
      );
    return response.result;
  }
  const genesis = hash(await rpc("get_block_hash", ["0x0"]));
  if (genesis !== profile.genesis) throw Error("Network/genesis mismatch.");
  const { header, ar } = validateHeader(await rpc("get_tip_header", []));
  if (hash(await rpc("get_block_hash", [header.number])) !== header.hash)
    throw Error("Snapshot header is no longer canonical.");
  const group = object(
    await rpc("get_live_cell", [
      { tx_hash: profile.depGroup.txHash, index: "0x0" },
      true,
    ]),
  );
  if (group.status !== "live")
    throw Error("iCKB dependency group is not live.");
  const points = decodeDepGroup(object(object(group.cell).data).content);
  const codeChecks: Snapshot["codeChecks"] = [];
  const expected = [
    pins.logic.codeHash,
    pins.xudtCodeHash,
    pins.ownedOwnerCodeHash,
    pins.orderCodeHash,
  ];
  let daoFound = false;
  for (const outPoint of points) {
    const response = object(
      await rpc("get_live_cell", [
        { tx_hash: outPoint.txHash, index: `0x${outPoint.index.toString(16)}` },
        true,
      ]),
    );
    if (response.status !== "live")
      throw Error("iCKB code dependency is unavailable.");
    const cell = object(response.cell),
      data = bytes(object(cell.data).content),
      codeHash = ccc.hashCkb(data);
    if (expected.includes(codeHash)) codeChecks.push({ codeHash, outPoint });
    const type = object(cell.output).type;
    if (
      type &&
      ccc.Script.from({
        codeHash: type.code_hash,
        hashType: type.hash_type,
        args: type.args,
      }).hash() === pins.dao.codeHash
    )
      daoFound = true;
  }
  if (
    expected.some((h) => !codeChecks.some((c) => c.codeHash === h)) ||
    !daoFound
  )
    throw Error(
      "Deployed code identity does not match the pinned iCKB/DAO profile.",
    );
  if (hash(await rpc("get_block_hash", [header.number])) !== header.hash)
    throw Error("Snapshot reorg detected. Refresh.");
  return {
    network,
    rpc: rpcUrl,
    observedAt: new Date().toISOString(),
    header,
    ar,
    genesis,
    daoVerified: daoFound,
    codeChecks,
    raw,
  };
}
export const publicJson = (v: unknown) =>
  JSON.stringify(
    v,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
