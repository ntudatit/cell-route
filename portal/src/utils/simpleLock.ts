import { MAINNET_GENESIS } from "./network";
import { ccc } from "@ckb-ccc/connector-react";
export interface Deployment {
  network: string;
  rpcUrl: string;
  genesisHash: string;
  code: ccc.ScriptInfoLike;
  vm: ccc.ScriptInfoLike;
  knownScripts: Record<ccc.KnownScript, ccc.ScriptInfoLike | undefined>;
}
export function preimageBytes(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (!bytes.length || bytes.length > 1024)
    throw new Error("Preimage must be 1–1024 UTF-8 bytes.");
  return bytes;
}
export function deriveLock(meta: Deployment, digest: string) {
  if (!/^0x[0-9a-f]{64}$/i.test(digest))
    throw new Error("Digest must be 32 bytes of hex.");
  return ccc.Script.from({
    ...meta.vm,
    args: ccc.hexFrom(
      "0x0000" +
        ccc.hexFrom(meta.code.codeHash).slice(2) +
        ccc.hexFrom(ccc.hashTypeToBytes(meta.code.hashType)).slice(2) +
        digest.slice(2),
    ),
  });
}
export async function verifyDeployment(client: ccc.Client, meta: Deployment) {
  if (!["offckb-devnet", "devnet", "testnet", "mainnet"].includes(meta.network))
    throw new Error("Unsupported deployment network.");
  if (meta.network === "mainnet" && meta.genesisHash !== MAINNET_GENESIS)
    throw new Error("Mainnet genesis identity mismatch.");
  if (
    meta.network === "testnet" &&
    meta.genesisHash !==
      "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606"
  )
    throw new Error("Testnet genesis identity mismatch.");
  const genesis = await client.getBlockByNumber(0);
  if (genesis?.header.hash !== meta.genesisHash)
    throw new Error(
      "Wrong network or reset Devnet. Re-deploy and export metadata.",
    );
  for (const info of [meta.code, meta.vm]) {
    const dep = info.cellDeps?.[0]?.cellDep;
    if (!dep || dep.depType !== "code")
      throw new Error("Missing code Cell dependency.");
    const cell = await client.getCellLiveNoCache(dep.outPoint, true);
    if (!cell) throw new Error("Deployed code Cell is no longer live.");
    const hash =
      info.hashType === "type"
        ? cell.cellOutput.type?.hash()
        : ccc.hashCkb(cell.outputData);
    if (hash !== info.codeHash) throw new Error("Deployed code hash mismatch.");
  }
}
export async function liveCells(client: ccc.Client, lock: ccc.Script) {
  const cells: ccc.Cell[] = [];
  for await (const cell of client.findCells({
    script: lock,
    scriptType: "lock",
    scriptSearchMode: "exact",
    withData: true,
  })) {
    if (!cell.cellOutput.type && cell.outputData === "0x") cells.push(cell);
    if (cells.length >= 100) break;
  }
  return cells;
}
export function buildUnlock(
  meta: Deployment,
  cell: ccc.Cell,
  recipient: ccc.Script,
  preimage: string,
  feeRate?: number,
) {
  const bytes = preimageBytes(preimage);
  const expected = deriveLock(meta, ccc.hashCkb(bytes));
  if (cell.cellOutput.lock.hash() !== expected.hash())
    throw new Error("Wrong preimage (contract exit code 7).");
  if (cell.cellOutput.type || cell.outputData !== "0x")
    throw new Error("Only plain capacity Cells are supported.");
  const fee = 100_000n; // 0.001 CKB; ample for one input and a <=1024-byte witness.
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ capacity: cell.cellOutput.capacity - fee, lock: recipient }],
    outputsData: ["0x"],
    cellDeps: [...(meta.vm.cellDeps ?? []), ...(meta.code.cellDeps ?? [])].map(
      (d) => d.cellDep,
    ),
    witnesses: [ccc.hexFrom(bytes)],
  });
  if (feeRate !== undefined) {
    if (!Number.isSafeInteger(feeRate) || feeRate < 1000 || feeRate > 100000)
      throw new Error("Invalid fee rate.");
    tx.outputs[0].capacity = cell.cellOutput.capacity - tx.estimateFee(feeRate);
  }
  if (
    tx.outputs[0].capacity <
    BigInt(tx.outputs[0].occupiedSize) * 100_000_000n
  )
    throw new Error(
      "Recipient requires more capacity than this Cell contains.",
    );
  return tx;
}

export function parseDeployment(text: string): Deployment {
  if (new TextEncoder().encode(text).length > 262144)
    throw new Error("Deployment manifest exceeds 256 KiB.");
  const value = JSON.parse(text) as Deployment;
  const stack: unknown[] = [value];
  while (stack.length) {
    const next = stack.pop();
    if (next && typeof next === "object") {
      for (const [key, item] of Object.entries(next)) {
        if (/^(private_?key|mnemonic|seed|seed_?phrase|secret)$/i.test(key))
          throw new Error(
            "Signing material is not accepted in deployment manifests.",
          );
        if (item && typeof item === "object") stack.push(item);
      }
    }
  }
  if (
    !value ||
    !["offckb-devnet", "devnet", "testnet", "mainnet"].includes(
      value.network,
    ) ||
    !/^0x[0-9a-f]{64}$/i.test(value.genesisHash)
  )
    throw new Error("Invalid deployment network/genesis.");
  const url = new URL(value.rpcUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use a public RPC URL without embedded credentials.");
  for (const info of [value.code, value.vm]) {
    if (
      !info ||
      !/^0x[0-9a-f]{64}$/i.test(String(info.codeHash)) ||
      !["data", "type", "data1", "data2"].includes(String(info.hashType))
    )
      throw new Error("Invalid code identity.");
    if (
      info.cellDeps?.length !== 1 ||
      info.cellDeps[0].cellDep.depType !== "code"
    )
      throw new Error(
        "One explicit code dependency required for each executable.",
      );
    const p = info.cellDeps[0].cellDep.outPoint;
    if (
      !/^0x[0-9a-f]{64}$/i.test(String(p.txHash)) ||
      BigInt(String(p.index)) < 0n ||
      BigInt(String(p.index)) > 0xffffffffn
    )
      throw new Error("Invalid code OutPoint.");
  }
  return value;
}
