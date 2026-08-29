import { describe, expect, it } from "vitest";
import { assertOnlyWitnessesChanged, cccTransactionToRpc, rpcTransactionToCcc, type FiberRpcTransaction } from "./funding";

const unsigned: FiberRpcTransaction = {
  version: "0x0",
  cell_deps: [{ dep_type: "dep_group", out_point: { tx_hash: `0x${"11".repeat(32)}`, index: "0x0" } }],
  header_deps: [],
  inputs: [{ previous_output: { tx_hash: `0x${"22".repeat(32)}`, index: "0x1" }, since: "0x0" }],
  outputs: [{ capacity: "0x174876e800", lock: { code_hash: `0x${"33".repeat(32)}`, hash_type: "type", args: `0x${"44".repeat(20)}` } }],
  outputs_data: ["0x"],
  witnesses: ["0x"],
};

describe("Fiber external funding transaction bridge", () => {
  it("round-trips Fiber JSON-RPC transactions through CCC", () => {
    expect(cccTransactionToRpc(rpcTransactionToCcc(unsigned))).toEqual(unsigned);
  });

  it("allows witness signatures without changing the frozen body", () => {
    expect(() => assertOnlyWitnessesChanged(unsigned, { ...unsigned, witnesses: ["0x1234"] })).not.toThrow();
    expect(() => assertOnlyWitnessesChanged(unsigned, { ...unsigned, outputs_data: ["0x01"] })).toThrow(/changed the frozen/);
  });
});
