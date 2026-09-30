import { beforeEach, expect, it, vi } from "vitest";
import { ccc } from "@ckb-ccc/connector-react";
import * as spore from "@ckb-ccc/spore";
import {
  prepare,
  signPrepared,
  TESTNET_GENESIS,
  verifyNetwork,
} from "./lifecycle";
vi.mock("@ckb-ccc/spore", async (importOriginal) => {
  const original = await importOriginal<typeof spore>();
  return {
    ...original,
    createSpore: vi.fn(),
    createSporeCluster: vi.fn(),
    findCluster: vi.fn(),
    getSporeScriptInfo: vi.fn(),
    getClusterScriptInfo: vi.fn(),
  };
});
const lock = ccc.Script.from({
  codeHash: `0x${"11".repeat(32)}`,
  hashType: "data1",
  args: "0x",
});
const id = `0x${"22".repeat(32)}`;
const point = { txHash: `0x${"33".repeat(32)}`, index: 0 };
const codePoint = { txHash: `0x${"44".repeat(32)}`, index: 0 };
const code = ccc.Cell.from({
  outPoint: codePoint,
  cellOutput: { capacity: 20000000000n, lock },
  outputData: "0x1234",
});
const funding = ccc.Cell.from({
  outPoint: point,
  cellOutput: { capacity: 30000000000n, lock },
  outputData: "0x",
});
const script = spore.SporeScriptInfo.from({
  codeHash: ccc.hashCkb(code.outputData),
  hashType: "data1",
  cellDeps: [{ cellDep: { outPoint: codePoint, depType: "code" } }],
  cobuild: true,
});
const client = new ccc.ClientPublicTestnet();
const address = ccc.Address.fromScript(lock, client);
const signer = {
  client,
  getRecommendedAddress: async () => address.toString(),
  getRecommendedAddressObj: async () => address,
  getAddresses: async () => [address.toString()],
  prepareTransaction: async (tx: ccc.Transaction) => tx,
  signOnlyTransaction: vi.fn(),
} as unknown as ccc.Signer;
function built() {
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: point }],
    outputs: [
      {
        capacity: 20000000000n,
        lock,
        type: { codeHash: script.codeHash, hashType: "data1", args: id },
      },
      { capacity: 9999900000n, lock },
    ],
    outputsData: ["0x1234", "0x"],
    cellDeps: [{ outPoint: codePoint, depType: "code" }],
  });
  vi.spyOn(tx, "completeInputsByCapacity").mockResolvedValue(0);
  vi.spyOn(tx, "completeFeeBy").mockResolvedValue([0, false]);
  return { tx, id: id as ccc.Hex };
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(spore.createSpore).mockReset();
  vi.mocked(spore.findCluster).mockReset();
  vi.mocked(signer.signOnlyTransaction).mockReset();
  vi.mocked(spore.getSporeScriptInfo).mockReturnValue(script);
  vi.mocked(spore.getClusterScriptInfo).mockReturnValue(script);
  vi.spyOn(client, "getBlockByNumber").mockResolvedValue({
    header: { hash: TESTNET_GENESIS },
  } as unknown as Awaited<ReturnType<ccc.Client["getBlockByNumber"]>>);
  vi.spyOn(client, "getCellLiveNoCache").mockImplementation(async (p) =>
    ccc.OutPoint.from(p).txHash === codePoint.txHash ? code : funding,
  );
});
it("prepares a complete review without signing or broadcasting", async () => {
  vi.mocked(spore.createSpore).mockResolvedValue(built());
  const p = await prepare(client, signer, {
    operation: "create",
    content: new TextEncoder().encode("Xin chào"),
    contentType: "text/plain",
  });
  expect(p.review.network).toBe("testnet");
  expect(p.review.feeShannons).toBe("100000");
  expect(p.review.assetCapacity).toBe("20000000000");
  expect(p.review.untypedChangeToSender).toBe("9999900000");
  expect(p.review.inputs).toHaveLength(1);
  expect(p.review.outputs).toHaveLength(2);
  expect(p.review.serializedBytes).toBeGreaterThan(0);
  expect(signer.signOnlyTransaction).not.toHaveBeenCalled();
});
it("rejects unknown Cluster without falling back to standalone mint", async () => {
  vi.mocked(spore.findCluster).mockResolvedValue(undefined);
  await expect(
    prepare(client, signer, {
      operation: "create",
      clusterId: id,
      content: new Uint8Array([1]),
      contentType: "text/plain",
    }),
  ).rejects.toThrow("Unknown Cluster");
  expect(spore.createSpore).not.toHaveBeenCalled();
});
it("rejects missing deployment code", async () => {
  vi.mocked(client.getCellLiveNoCache).mockResolvedValue(undefined);
  await expect(verifyNetwork(client, signer)).rejects.toThrow("dependency");
});
it("rejects reviewed transaction mutation before signing", async () => {
  vi.mocked(spore.createSpore).mockResolvedValue(built());
  const p = await prepare(client, signer, {
    operation: "create",
    content: new Uint8Array([1]),
    contentType: "text/plain",
  });
  p.tx.outputs[0].capacity++;
  await expect(signPrepared(client, signer, p, false)).rejects.toThrow(
    "changed",
  );
});
it("rejects an authorized linked mint whose builder omits Cluster dependency", async () => {
  const clusterCell = ccc.Cell.from({
    ...funding,
    cellOutput: {
      ...funding.cellOutput,
      capacity: 20000000000n,
      type: { codeHash: script.codeHash, hashType: "data1", args: id },
    },
    outputData: "0x1234",
  });
  vi.mocked(spore.findCluster).mockResolvedValue({
    cell: clusterCell,
    cluster: clusterCell,
    clusterData: { name: "test", description: "test" },
    scriptInfo: script,
  });
  vi.mocked(spore.createSpore).mockResolvedValue(built());
  await expect(
    prepare(client, signer, {
      operation: "create",
      clusterId: id,
      content: new Uint8Array([1]),
      contentType: "text/plain",
    }),
  ).rejects.toThrow("Cluster input/dependency");
});
it("rejects mutation by the signer and refuses stale reviews", async () => {
  vi.mocked(spore.createSpore).mockResolvedValue(built());
  const p = await prepare(client, signer, {
    operation: "create",
    content: new Uint8Array([1]),
    contentType: "text/plain",
  });
  vi.mocked(signer.signOnlyTransaction).mockImplementation(async (value) => {
    const tx = ccc.Transaction.from(value);
    tx.outputs[0].capacity++;
    return tx;
  });
  await expect(signPrepared(client, signer, p, false)).rejects.toThrow(
    "Wallet changed",
  );
  p.createdAt = Date.now() - 300001;
  await expect(signPrepared(client, signer, p, false)).rejects.toThrow(
    "expired",
  );
});
it("accepts an unchanged signed transaction and rejects a spent input", async () => {
  vi.mocked(spore.createSpore).mockResolvedValue(built());
  const p = await prepare(client, signer, {
    operation: "create",
    content: new Uint8Array([1]),
    contentType: "text/plain",
  });
  vi.mocked(signer.signOnlyTransaction).mockImplementation(async (value) =>
    ccc.Transaction.from(value),
  );
  expect((await signPrepared(client, signer, p, false)).hash()).toBe(p.rawHash);
  vi.mocked(client.getCellLiveNoCache).mockImplementation(async (value) =>
    ccc.OutPoint.from(value).txHash === codePoint.txHash ? code : undefined,
  );
  await expect(signPrepared(client, signer, p, false)).rejects.toThrow("spent");
});
