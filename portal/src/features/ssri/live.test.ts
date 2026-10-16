import { expect, it } from "vitest";
import { ccc } from "@ckb-ccc/core";
import { queryScript, type Identity } from "./client";
const txHash = "0x" + "11".repeat(32),
  data = "0x1234";
const identity: Identity = {
  network: "testnet",
  nodeUrl: "https://node.example",
  serverUrl: "https://ssri.example",
  genesisHash:
    "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
  outPoint: { txHash, index: 0 },
  codeHash: ccc.hashCkb(data),
};
function fetcher(result: unknown) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    const q = JSON.parse(String(init?.body));
    const value = String(url).includes("ssri.example")
      ? result
      : q.method === "get_block_hash"
        ? identity.genesisHash
        : q.method === "get_tip_header"
          ? { hash: "0x" + "22".repeat(32), number: "0x1" }
          : {
              tx_status: { status: "committed" },
              transaction: {
                hash: txHash,
                outputs: [{}],
                outputs_data: [data],
              },
            };
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: q.id, result: value }),
    );
  }) as typeof fetch;
}
it("queries an arbitrary deployed method and exposes legacy bytes without fake metadata", async () => {
  const r = await queryScript(identity, "MyContract.metadata", ["0x01"], {
    fetcher: fetcher("0x6869"),
  });
  expect(r.content).toBe("0x6869");
  expect(r.utf8).toBe("hi");
  expect(r.method).toBe("MyContract.metadata");
});
it("supports VmResult envelopes without claiming script-defined schemas were verified", async () => {
  const r = await queryScript(identity, "UDT.name", [], {
    fetcher: fetcher({ content: "0x6869", cell_deps: [] }),
  });
  expect(r.content).toBe("0x6869");
  expect(r.validation).toContain("script-defined");
});
it("rejects invalid argument shapes and incompatible response envelopes", async () => {
  await expect(
    queryScript(identity, "UDT.name", ["bad"]),
  ).rejects.toMatchObject({ code: "CONFIG" });
  await expect(
    queryScript(identity, "UDT.name", [], {
      fetcher: fetcher({ content: null, cell_deps: [] }),
    }),
  ).rejects.toMatchObject({ code: "SCHEMA" });
});
it("rejects a wrong expected network before any RPC", async () => {
  await expect(
    queryScript({ ...identity, network: "mainnet" }, "UDT.name", []),
  ).rejects.toMatchObject({ code: "CONFIG" });
});
