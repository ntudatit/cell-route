import { ccc } from "@ckb-ccc/connector-react";

export type FiberRpcScript = { code_hash: string; hash_type: "data" | "type" | "data1" | "data2"; args: string };
export type FiberRpcTransaction = {
  version: string;
  cell_deps: Array<{ dep_type: string; out_point: { tx_hash: string; index: string } }>;
  header_deps: string[];
  inputs: Array<{ previous_output: { tx_hash: string; index: string }; since: string }>;
  outputs: Array<{ capacity: string; lock: FiberRpcScript; type?: FiberRpcScript }>;
  outputs_data: string[];
  witnesses: string[];
};

export type FiberFundingDraft = {
  channelId: string;
  unsignedTransaction: FiberRpcTransaction;
  signedTransaction?: FiberRpcTransaction;
  createdAt: string;
  returnUrl?: string;
};

const STORAGE_KEY = "fiberops.external-funding.v1";

function hashType(value: string): "data" | "type" | "data1" | "data2" {
  if (["data", "type", "data1", "data2"].includes(value)) return value as "data" | "type" | "data1" | "data2";
  throw new Error(`Unsupported CKB hash type: ${value}`);
}

function depTypeFromRpc(value: string) { return value === "dep_group" ? "depGroup" as const : "code" as const; }
function depTypeToRpc(value: string) { return value === "depGroup" ? "dep_group" : "code"; }

export function rpcScriptFromCcc(script: { codeHash: string; hashType: string; args: string }): FiberRpcScript {
  return { code_hash: script.codeHash, hash_type: hashType(script.hashType), args: script.args };
}

export function rpcTransactionToCcc(tx: FiberRpcTransaction) {
  return ccc.Transaction.from({
    version: tx.version,
    cellDeps: tx.cell_deps.map((dep) => ({
      depType: depTypeFromRpc(dep.dep_type),
      outPoint: { txHash: dep.out_point.tx_hash, index: dep.out_point.index },
    })),
    headerDeps: tx.header_deps,
    inputs: tx.inputs.map((input) => ({
      previousOutput: { txHash: input.previous_output.tx_hash, index: input.previous_output.index },
      since: input.since,
    })),
    outputs: tx.outputs.map((output) => ({
      capacity: output.capacity,
      lock: { codeHash: output.lock.code_hash, hashType: output.lock.hash_type, args: output.lock.args },
      type: output.type ? { codeHash: output.type.code_hash, hashType: output.type.hash_type, args: output.type.args } : undefined,
    })),
    outputsData: tx.outputs_data,
    witnesses: tx.witnesses,
  });
}

export function cccTransactionToRpc(tx: ccc.Transaction): FiberRpcTransaction {
  return {
    version: ccc.numToHex(tx.version),
    cell_deps: tx.cellDeps.map((dep) => ({
      dep_type: depTypeToRpc(dep.depType),
      out_point: { tx_hash: dep.outPoint.txHash, index: ccc.numToHex(dep.outPoint.index) },
    })),
    header_deps: [...tx.headerDeps],
    inputs: tx.inputs.map((input) => ({
      previous_output: { tx_hash: input.previousOutput.txHash, index: ccc.numToHex(input.previousOutput.index) },
      since: ccc.numToHex(input.since),
    })),
    outputs: tx.outputs.map((output) => ({
      capacity: ccc.numToHex(output.capacity),
      lock: rpcScriptFromCcc(output.lock),
      ...(output.type ? { type: rpcScriptFromCcc(output.type) } : {}),
    })),
    outputs_data: [...tx.outputsData],
    witnesses: [...tx.witnesses],
  };
}

function transactionBody(tx: FiberRpcTransaction) {
  return JSON.stringify({ ...tx, witnesses: [] });
}

export function assertOnlyWitnessesChanged(unsigned: FiberRpcTransaction, signed: FiberRpcTransaction) {
  if (transactionBody(unsigned) !== transactionBody(signed)) {
    throw new Error("Wallet changed the frozen funding transaction structure. This wallet lock is not supported for external Fiber funding yet.");
  }
}

export const fiberFundingStore = {
  get(): FiberFundingDraft | null {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as FiberFundingDraft | null; }
    catch { return null; }
  },
  set(value: FiberFundingDraft) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); },
  clear() { localStorage.removeItem(STORAGE_KEY); },
};
