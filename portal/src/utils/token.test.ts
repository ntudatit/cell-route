import { expect, it, vi } from "vitest";
import { ccc } from "@ckb-ccc/core";
import {
  encodeAmount,
  decodeAmount,
  parseTokenAmount,
  sumAmounts,
  U128_MAX,
  assertTokenAccounting,
  tokenArgs,
  tokenType,
  moleculeExample,
  verifyTokenDeployment,
  ownedTokenCells,
  submitToken,
  type TokenReview,
} from "./token";
const script = ccc.Script.from({
  codeHash: "0x" + "11".repeat(32),
  hashType: "type",
  args: "0x1234",
});
it("uses exact uint128 little-endian vectors", () => {
  expect(encodeAmount(0n)).toBe("0x" + "00".repeat(16));
  expect(encodeAmount(1n)).toBe("0x01" + "00".repeat(15));
  expect(encodeAmount(9007199254740993n)).toBe(
    "0x01000000000020000000000000000000",
  );
  expect(encodeAmount(U128_MAX)).toBe("0x" + "ff".repeat(16));
  for (const n of [0n, 1n, 9007199254740993n, U128_MAX])
    expect(decodeAmount(encodeAmount(n))).toBe(n);
});
it("rejects invalid and overflowing amounts", () => {
  for (const n of [-1n, U128_MAX + 1n]) expect(() => encodeAmount(n)).toThrow();
  for (const s of ["-1", "1e3", "1.001", "NaN"])
    expect(() => parseTokenAmount(s, 2)).toThrow();
  expect(parseTokenAmount("9007199254740993.25", 2)).toBe(900719925474099325n);
  expect(() => decodeAmount("0x01")).toThrow();
  expect(() => sumAmounts([U128_MAX, 1n])).toThrow();
});
it("forbids implicit burn and inflation in transfers", () => {
  expect(() => assertTokenAccounting("TRANSFER", 1000n, 999n, 250n)).toThrow();
  expect(() => assertTokenAccounting("TRANSFER", 1000n, 1001n, 250n)).toThrow();
  assertTokenAccounting("TRANSFER", 1000n, 1000n, 250n);
  assertTokenAccounting("BURN", 750n, 700n, 50n);
  assertTokenAccounting("BURN", 50n, 0n, 50n);
});
it("keeps sUDT and basic xUDT args separate", () => {
  const deployment = {
    network: "test",
    genesisHash: "0x",
    script: { ...script, cellDeps: [] },
  };
  expect(tokenArgs("SUDT", script)).toHaveLength(66);
  expect(tokenArgs("XUDT", script)).toHaveLength(74);
  expect(() =>
    tokenType("SUDT", tokenArgs("XUDT", script), deployment),
  ).toThrow();
  expect(() =>
    tokenType("XUDT", tokenArgs("SUDT", script), deployment),
  ).toThrow();
});
it("Molecule roundtrips Script and WitnessArgs with table offsets", () => {
  const example = moleculeExample(script);
  expect(example.script).toBe(
    "0x37000000100000003000000031000000" + "11".repeat(32) + "01020000001234",
  );
  expect(example.witness).toBe(
    "0x1b00000010000000160000001b00000002000000123401000000ab",
  );
  expect(example.decodedScript.eq(script)).toBe(true);
  expect(example.decodedWitness.lock).toBe("0x1234");
});
it("rejects wrong genesis before reading dependencies", async () => {
  const live = vi.fn();
  const client = {
    getBlockByNumber: async () => ({ header: { hash: "wrong" } }),
    getCellLive: live,
  } as unknown as ccc.Client;
  await expect(
    verifyTokenDeployment(client, {
      network: "devnet",
      genesisHash: "expected",
      script: { ...script, cellDeps: [] },
    }),
  ).rejects.toThrow("genesis");
  expect(live).not.toHaveBeenCalled();
});
it("refuses to discard trailing token data", async () => {
  const signer = {
    async *findCells() {
      yield {
        cellOutput: { type: script },
        outputData: encodeAmount(1n) + "aa",
      };
    },
  } as unknown as ccc.Signer;
  await expect(ownedTokenCells(signer, script)).rejects.toThrow("Extended");
});
it("blocks changed wallets and mutated previews before signing", async () => {
  const send = vi.fn();
  const signer = {
    getRecommendedAddress: async () => "sender",
    sendTransaction: send,
  } as unknown as ccc.Signer;
  const tx = ccc.Transaction.default();
  const review = {
    signer,
    sender: "sender",
    tx,
    fingerprint: ccc.hexFrom(tx.toBytes()),
  } as TokenReview;
  await expect(
    submitToken(review, { ...signer } as ccc.Signer),
  ).rejects.toThrow("Wallet changed");
  tx.witnesses.push("0x01");
  await expect(submitToken(review, signer)).rejects.toThrow(
    "changed after preview",
  );
  expect(send).not.toHaveBeenCalled();
});
it("keeps extension flags and unknown trailing args out of the basic xUDT builder", () => {
  const deployment = {
    network: "test",
    genesisHash: "0x",
    script: { ...script, cellDeps: [] },
  };
  const owner = script.hash();
  for (const suffix of [
    "01000000",
    "02000000",
    "03000000",
    "01000020",
    "00000000aa",
  ])
    expect(() => tokenType("XUDT", owner + suffix, deployment)).toThrow(
      "basic xUDT",
    );
  expect(tokenType("XUDT", owner + "00000000", deployment).args).toBe(
    owner + "00000000",
  );
});
it.each(["extension", "owner-args", "dependency"])(
  "invalidates a reviewed transaction after %s mutation",
  async (variant) => {
    const send = vi.fn();
    const signer = {
      getRecommendedAddress: async () => "sender",
      sendTransaction: send,
    } as unknown as ccc.Signer;
    const tx = ccc.Transaction.default();
    tx.outputs.push(
      ccc.CellOutput.from({
        capacity: 20000000000n,
        lock: script,
        type: script.clone(),
      }),
    );
    tx.outputsData.push(encodeAmount(1n));
    const review = {
      signer,
      sender: "sender",
      tx,
      fingerprint: ccc.hexFrom(tx.toBytes()),
    } as TokenReview;
    if (variant === "dependency")
      tx.cellDeps.push(
        ccc.CellDep.from({
          outPoint: { txHash: "0x" + "22".repeat(32), index: 0 },
          depType: "code",
        }),
      );
    else
      tx.outputs[0].type!.args = ccc.hexFrom(
        script.hash() + (variant === "extension" ? "01000000" : "00000000"),
      );
    await expect(submitToken(review, signer)).rejects.toThrow(
      "changed after preview",
    );
    expect(send).not.toHaveBeenCalled();
  },
);
