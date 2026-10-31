import { ccc } from "@ckb-ccc/core";
import pins from "./pins.json";
export { pins };
export type IckbNetwork = keyof typeof pins.networks;
export const ONE = 100000000n,
  AR0 = 10000000000000000n;
export const U64 = (1n << 64n) - 1n,
  U128 = (1n << 128n) - 1n;
export const OCCUPIED = 82n * ONE,
  CAP = 100000n * ONE;
export const EXCHANGE_DELTA = (OCCUPIED * AR0) / (100000n * ONE);
export function integer(value: string, max = U64) {
  if (!/^(0|[1-9][0-9]{0,38})$/.test(value))
    throw Error("Expected a bounded unsigned integer.");
  const n = BigInt(value);
  if (n > max) throw Error("Amount exceeds the supported integer range.");
  return n;
}
export function units(value: string, max = U64) {
  if (!/^\d{1,20}(\.\d{1,8})?$/.test(value))
    throw Error("Use an unsigned amount with at most 8 decimal places.");
  const [whole, part = ""] = value.split(".");
  const n = BigInt(whole) * ONE + BigInt(part.padEnd(8, "0"));
  if (n > max) throw Error("Amount exceeds the supported integer range.");
  return n;
}
export function display(n: bigint) {
  return `${n / ONE}.${(n % ONE).toString().padStart(8, "0")}`;
}
export function rate(ar: bigint) {
  if (ar < AR0 || ar > U64) throw Error("Invalid DAO accumulated rate.");
  return ar;
}
// Receipt accounting uses FREE capacity and the deposit block AR; not the current exchange quote.
export function receiptValue(free: bigint, ar: bigint) {
  if (free < 0n || free > U64) throw Error("Free capacity outside uint64.");
  let amount = (free * AR0) / rate(ar);
  if (amount > CAP) amount -= (amount - CAP) / 10n;
  return amount;
}
export function indicative(
  amount: bigint,
  ar: bigint,
  direction: "ckb-to-ickb" | "ickb-to-ckb",
  fee = 10n,
  feeBase = 100000n,
) {
  if (amount <= 0n || amount > (direction === "ckb-to-ickb" ? U64 : U128))
    throw Error("Amount outside the supported range.");
  if (fee < 0n || feeBase <= 0n || fee >= feeBase)
    throw Error("Invalid order fee.");
  const denominator = rate(ar) + EXCHANGE_DELTA;
  const a = direction === "ckb-to-ickb" ? AR0 : denominator,
    b = direction === "ckb-to-ickb" ? denominator : AR0;
  const numerator = amount * a * (feeBase - fee),
    divisor = b * feeBase;
  const output = (numerator + divisor - 1n) / divisor;
  if (output > (direction === "ckb-to-ickb" ? U128 : U64))
    throw Error("Converted amount exceeds the supported on-chain range.");
  return {
    output,
    rounding: "ceiling" as const,
    fee,
    feeBase,
  };
}
export type Snapshot = {
  network: IckbNetwork;
  rpc: string;
  observedAt: string;
  header: Record<string, any>;
  ar: string;
  genesis: string;
  daoVerified: boolean;
  codeChecks: {
    codeHash: string;
    outPoint: { txHash: string; index: number };
  }[];
  raw: unknown[];
};
export function assertFresh(
  snapshot: Snapshot,
  network: IckbNetwork,
  now = Date.now(),
) {
  if (
    snapshot.network !== network ||
    snapshot.genesis !== pins.networks[network].genesis
  )
    throw Error("Snapshot network/genesis mismatch.");
  const observed = Date.parse(snapshot.observedAt),
    timestamp = Number(BigInt(snapshot.header.timestamp));
  if (
    !Number.isFinite(observed) ||
    now - observed > 300000 ||
    observed > now + 60000 ||
    now - timestamp > 1800000 ||
    timestamp > now + 300000
  )
    throw Error("Snapshot is stale or future-dated. Refresh before preview.");
  rate(integer(snapshot.ar));
  const expected = [
    pins.logic.codeHash,
    pins.xudtCodeHash,
    pins.ownedOwnerCodeHash,
    pins.orderCodeHash,
  ];
  if (
    !snapshot.daoVerified ||
    expected.some(
      (hash) => !snapshot.codeChecks.some((c) => c.codeHash === hash),
    )
  )
    throw Error("Unverified iCKB code dependencies.");
}
export function depositPlan(
  snapshot: Snapshot,
  free: bigint,
  lockLike: ccc.ScriptLike,
  now = Date.now(),
) {
  assertFresh(snapshot, snapshot.network, now);
  if (free < 1000n * ONE || free > 1000000n * ONE)
    throw Error(
      "Deposit free capacity must be 1,000–1,000,000 CKB (plus 82 CKB occupied).",
    );
  const lock = ccc.Script.from(lockLike);
  const receiptCapacity =
    (BigInt(8 + lock.occupiedSize) + BigInt(8 + lock.occupiedSize + 69 + 16)) *
      ONE +
    ONE;
  const tx = ccc.Transaction.default();
  tx.addCellDeps({
    outPoint: pins.networks[snapshot.network].depGroup,
    depType: "depGroup",
  });
  tx.addOutput(
    {
      capacity: free + OCCUPIED,
      lock: ccc.Script.from(pins.logic),
      type: ccc.Script.from(pins.dao),
    },
    "0x0000000000000000",
  );
  tx.addOutput(
    { capacity: receiptCapacity, lock, type: ccc.Script.from(pins.logic) },
    ccc.hexFrom(
      ccc.bytesConcat(ccc.numLeToBytes(1n, 4), ccc.numLeToBytes(free, 8)),
    ),
  );
  return {
    status: "unfunded-construction-preview" as const,
    network: snapshot.network,
    anchor: snapshot.header.hash,
    freeShannons: free.toString(),
    occupiedShannons: OCCUPIED.toString(),
    receiptCapacityShannons: receiptCapacity.toString(),
    requiredOutputCapacityShannons: (
      free +
      OCCUPIED +
      receiptCapacity
    ).toString(),
    estimatedReceiptRaw: receiptValue(free, integer(snapshot.ar)).toString(),
    valuation:
      "Estimate only: actual receipt value uses the deposit commitment header AR.",
    feeShannons: null,
    requiresFunding: true,
    broadcast: false,
    committed: false,
    transaction: {
      version: "0x0",
      cellDeps: tx.cellDeps,
      headerDeps: tx.headerDeps,
      inputs: tx.inputs,
      outputs: tx.outputs,
      outputsData: tx.outputsData,
      witnesses: tx.witnesses,
    },
    fingerprint: ccc.hexFrom(tx.toBytes()),
  };
}
