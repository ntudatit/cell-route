import { expect, it } from "vitest";
import { ccc } from "@ckb-ccc/core";
import {
  AR0,
  ONE,
  CAP,
  U64,
  U128,
  pins,
  units,
  integer,
  receiptValue,
  indicative,
  assertFresh,
  depositPlan,
  type Snapshot,
} from "./model";
import { validateHeader, decodeDepGroup } from "./snapshot";
const now = Date.now();
const snapshot = (): Snapshot => ({
  network: "testnet",
  rpc: pins.networks.testnet.rpc,
  observedAt: new Date(now).toISOString(),
  header: { timestamp: `0x${now.toString(16)}`, hash: "0x" + "11".repeat(32) },
  ar: (AR0 + 1000n).toString(),
  genesis: pins.networks.testnet.genesis,
  daoVerified: true,
  codeChecks: [
    pins.logic.codeHash,
    pins.xudtCodeHash,
    pins.ownedOwnerCodeHash,
    pins.orderCodeHash,
  ].map((codeHash) => ({
    codeHash,
    outPoint: { txHash: "0x" + "22".repeat(32), index: 0 },
  })),
  raw: [],
});
const lock = ccc.Script.from({
  codeHash: "0x" + "33".repeat(32),
  hashType: "data1",
  args: "0x" + "44".repeat(20),
});
it("keeps eight-decimal amounts exact and rejects invalid ranges", () => {
  expect(units("0.00000001")).toBe(1n);
  expect(units("90071992.54740993")).toBe(9007199254740993n);
  for (const v of ["-1", "1e3", "1.000000001", "Infinity"])
    expect(() => units(v)).toThrow();
  expect(() => integer((U64 + 1n).toString())).toThrow();
});
it("values free capacity with floor rounding and per-deposit excess discount", () => {
  expect(receiptValue(1n, AR0 + 1n)).toBe(0n);
  expect(receiptValue(CAP, AR0)).toBe(CAP);
  expect(receiptValue(CAP + 100n, AR0)).toBe(CAP + 90n);
  expect(receiptValue(2n * (CAP + 100n), AR0)).not.toBe(
    2n * receiptValue(CAP + 100n, AR0),
  );
});
it("does not create value through floor accounting round trips", () => {
  const ar = AR0 + 123456789n;
  for (const n of [1n, 100n, 100000n * ONE, U64]) {
    const token = receiptValue(n, ar);
    expect((token * ar) / AR0).toBeLessThanOrEqual(n);
  }
});
it("separates gross price ceiling/fees from deposit accounting", () => {
  const quote = indicative(1000n * ONE, AR0, "ckb-to-ickb");
  expect(quote.output).toBeLessThan(receiptValue(1000n * ONE, AR0));
  expect(quote.rounding).toBe("ceiling");
  expect(() => indicative(0n, AR0, "ckb-to-ickb")).toThrow();
  expect(() => indicative(U128 + 1n, AR0, "ickb-to-ckb")).toThrow();
  expect(() => indicative(1n, AR0, "ckb-to-ickb", 1n, 1n)).toThrow();
});
it("rejects invalid ARs before conversion", () => {
  for (const ar of [0n, AR0 - 1n, U64 + 1n])
    expect(() => receiptValue(1n, ar)).toThrow();
});
it("invalidates stale, cross-network and unverified code state", () => {
  expect(() => assertFresh(snapshot(), "testnet", now)).not.toThrow();
  expect(() => assertFresh(snapshot(), "mainnet", now)).toThrow("network");
  expect(() => assertFresh(snapshot(), "testnet", now + 300001)).toThrow(
    "stale",
  );
  const s = snapshot();
  s.codeChecks = [];
  expect(() => assertFresh(s, "testnet", now)).toThrow("dependencies");
  s.codeChecks = snapshot().codeChecks;
  s.daoVerified = false;
  expect(() => assertFresh(s, "testnet", now)).toThrow("dependencies");
});
it("constructs an explicitly unfunded deposit/receipt plan with occupied capacity", () => {
  const p = depositPlan(snapshot(), 1000n * ONE, lock, now);
  expect(p.status).toBe("unfunded-construction-preview");
  expect(p.transaction.inputs).toHaveLength(0);
  expect(p.transaction.outputs).toHaveLength(2);
  expect(p.transaction.outputs[0].capacity).toBe(1082n * ONE);
  expect(p.transaction.outputsData[1]).toBe(
    ccc.hexFrom(
      ccc.bytesConcat(
        ccc.numLeToBytes(1n, 4),
        ccc.numLeToBytes(1000n * ONE, 8),
      ),
    ),
  );
  expect(p.broadcast).toBe(false);
  expect(p.feeShannons).toBeNull();
});
it("enforces SDK deposit bounds without substituting smaller amounts", () => {
  expect(() => depositPlan(snapshot(), 999n * ONE, lock, now)).toThrow("1,000");
  expect(() => depositPlan(snapshot(), 1000001n * ONE, lock, now)).toThrow(
    "1,000",
  );
});
it("bounds and validates dep-group OutPoint vectors", () => {
  expect(() => decodeDepGroup("0x01000000")).toThrow();
  expect(() => decodeDepGroup("0x11000000" + "00".repeat(36 * 17))).toThrow();
  expect(
    decodeDepGroup("0x01000000" + "11".repeat(32) + "02000000")[0].index,
  ).toBe(2);
});
it("rejects corrupted headers before trusting DAO rate", () => {
  expect(() =>
    validateHeader({
      hash: "0x" + "00".repeat(32),
      dao: "0x" + "00".repeat(32),
    }),
  ).toThrow();
});
it("rejects indicative CKB output above uint64 capacity", () => {
  expect(() => indicative(U128, AR0, "ickb-to-ckb")).toThrow("on-chain range");
});
