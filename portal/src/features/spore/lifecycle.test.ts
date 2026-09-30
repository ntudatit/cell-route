import { describe, expect, it, vi } from "vitest";
import { ccc } from "@ckb-ccc/connector-react";
import {
  assertGenesis,
  assertPreserved,
  checkedId,
  contentInfo,
  observe,
  ownedCell,
  requireMeltConfirmation,
  TESTNET_GENESIS,
  verifyCommitted,
  Prepared,
} from "./lifecycle";
const lock = ccc.Script.from({
  codeHash: `0x${"01".repeat(32)}`,
  hashType: "data1",
  args: "0x",
});
const type = ccc.Script.from({
  codeHash: `0x${"02".repeat(32)}`,
  hashType: "data1",
  args: `0x${"03".repeat(32)}`,
});
const cell = ccc.Cell.from({
  outPoint: { txHash: `0x${"04".repeat(32)}`, index: 0 },
  cellOutput: { capacity: 20000000000n, lock, type },
  outputData: "0x010203",
});
describe("Spore transaction safety", () => {
  it("counts UTF-8 bytes and hashes original Vietnamese content", () => {
    const text = "Xin chào Việt Nam";
    const bytes = new TextEncoder().encode(text);
    expect(bytes.length).toBeGreaterThan(text.length);
    expect(new TextDecoder().decode(bytes)).toBe(text);
    expect(contentInfo(bytes)).toEqual({
      bytes: bytes.length,
      hash: ccc.hashCkb(bytes),
    });
    expect(() => contentInfo(new Uint8Array(16385))).toThrow();
    expect(() => contentInfo(new Uint8Array())).toThrow();
  });
  it("fails closed on malformed Cluster IDs and network mismatch", () => {
    expect(() => checkedId("0x123")).toThrow();
    expect(checkedId(type.args)).toBe(type.args);
    expect(() => assertGenesis("devnet", TESTNET_GENESIS)).toThrow();
    expect(() => assertGenesis("mainnet", TESTNET_GENESIS)).toThrow();
    expect(() => assertGenesis("testnet", TESTNET_GENESIS)).not.toThrow();
  });
  it("requires explicit melt confirmation", () => {
    expect(() => requireMeltConfirmation("melt", false)).toThrow();
    expect(() => requireMeltConfirmation("melt", true)).not.toThrow();
  });
  it("preserves type identity and content while changing owner", () => {
    const recipient = ccc.Script.from({ ...lock, args: "0x99" });
    const tx = ccc.Transaction.from({
      outputs: [{ ...cell.cellOutput, lock: recipient }],
      outputsData: [cell.outputData],
    });
    expect(() => assertPreserved(cell, tx, 0, recipient)).not.toThrow();
    tx.outputsData[0] = "0x";
    expect(() => assertPreserved(cell, tx, 0, recipient)).toThrow();
  });
  it("rejects old owner using live asset lock, not UI ownership state", async () => {
    const client = new ccc.ClientPublicTestnet();
    const address = ccc.Address.fromScript(lock, client).toString();
    const signer = {
      client,
      getAddresses: async () => [address],
    } as unknown as ccc.Signer;
    const transferred = cell.clone();
    transferred.cellOutput.lock = ccc.Script.from({ ...lock, args: "0x99" });
    await expect(ownedCell(signer, transferred)).rejects.toThrow(
      "Authorization",
    );
  });
  it("observes node states, never promoting pending to committed", async () => {
    const getTransactionNoCache = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "proposed" })
      .mockResolvedValueOnce({ status: "committed" });
    const states: string[] = [];
    await observe(
      { getTransactionNoCache } as unknown as ccc.Client,
      "hash",
      (s) => states.push(s),
      new AbortController().signal,
      500,
      1,
    );
    expect(states).toEqual(["pending", "proposed", "committed"]);
    const state = vi.fn();
    await observe(
      { getTransactionNoCache: async () => undefined } as unknown as ccc.Client,
      "hash",
      state,
      new AbortController().signal,
      2,
      2,
    );
    expect(state).toHaveBeenLastCalledWith("timeout");
    const rejected = await observe(
      {
        getTransactionNoCache: async () => ({ status: "rejected" }),
      } as unknown as ccc.Client,
      "hash",
      state,
      new AbortController().signal,
    );
    expect(rejected?.status).toBe("rejected");
  });
  it("indexer absence cannot substitute for node commitment", async () => {
    const client = {
      getTransactionNoCache: async () => ({ status: "pending" }),
    } as unknown as ccc.Client;
    await expect(
      verifyCommitted(client, {} as Prepared, "hash"),
    ).rejects.toThrow("commitment");
  });
});
