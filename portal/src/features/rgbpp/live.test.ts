import { describe, expect, it } from "vitest";
import { inspectAsset, validateQuery, verifyInclusion } from "./live";
import { profiles } from "./profiles";
import { encodeBinding } from "./checker";
import vector from "./merkle-vector.json";
import deployment from "./deployment-type.json";
const txid = "aa".repeat(32),
  point = "0x" + "bb".repeat(32),
  tip = "cc".repeat(32);
function api({
  kind = "live",
  badNetwork = false,
  noCells = false,
}: { kind?: string; badNetwork?: boolean; noCells?: boolean } = {}) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === profiles.testnet3.ckbRpc) {
      const q = JSON.parse(String(init?.body));
      let result: unknown;
      if (q.method === "get_block_hash")
        result = badNetwork
          ? "0x" + "00".repeat(32)
          : profiles.testnet3.ckbGenesis;
      if (q.method === "get_tip_header")
        result = { hash: "0x" + tip, number: "0x1" };
      const output = {
        capacity: "0x174876e800",
        lock: {
          code_hash: profiles.testnet3.rgbppLock.codeHash,
          hash_type: "type",
          args: encodeBinding(txid, 0),
        },
        type: null,
      };
      if (q.method === "get_transaction")
        result =
          q.params[0] === profiles.testnet3.rgbppLock.deployment.txHash
            ? {
                tx_status: { status: "committed" },
                transaction: {
                  hash: q.params[0],
                  outputs: [{ type: deployment }],
                },
              }
            : {
                tx_status: { status: "committed" },
                transaction: {
                  hash: q.params[0],
                  outputs: [output],
                  outputs_data: ["0x"],
                },
              };
      if (q.method === "get_live_cell")
        result = {
          status: kind,
          ...(kind === "live"
            ? { cell: { output, data: { content: "0x" } } }
            : {}),
        };
      if (q.method === "get_cells")
        result = {
          objects: noCells
            ? []
            : [{ out_point: { tx_hash: point, index: "0x0" } }],
          last_cursor: "0x00",
        };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: q.id, result }));
    }
    const path = url.slice(profiles.testnet3.bitcoinApi.length);
    if (path === "/block-height/0")
      return new Response(profiles.testnet3.bitcoinGenesis);
    if (path === "/blocks/tip/hash") return new Response(tip);
    if (path.endsWith("/outspend/0")) return new Response('{"spent":false}');
    if (path.startsWith("/tx/"))
      return new Response(
        JSON.stringify({
          txid,
          vout: [{ value: 1000, scriptpubkey: "0014" + "11".repeat(20) }],
          status: { confirmed: false },
        }),
      );
    throw Error("Unexpected API");
  }) as typeof fetch;
}
describe("Live RGB++ (no virtual fixture prerequisite)", () => {
  it("reads an arbitrary Cell and derives the UTXO from its actual lock", async () => {
    const result = await inspectAsset(
      { network: "testnet3", kind: "cell", txid: point, index: 0 },
      { fetcher: api() },
    );
    expect(result.binding).toEqual({ txid, vout: 0 });
    expect(result.cells[0].liveStatus).toBe("live");
    expect(result.bitcoin?.state).toBe("unspent");
    expect(result.proof.status).toBe("not verified");
  });
  it("discovers node-checked live assets by UTXO", async () => {
    const result = await inspectAsset(
      { network: "testnet3", kind: "utxo", txid, index: 0 },
      { fetcher: api() },
    );
    expect(result.cells).toHaveLength(1);
    expect(result.indexerStatus).toContain("node rechecked");
  });
  it("does not call no indexer matches asset nonexistence", async () => {
    const result = await inspectAsset(
      { network: "testnet3", kind: "utxo", txid, index: 0 },
      { fetcher: api({ noCells: true }) },
    );
    expect(result.cells).toHaveLength(0);
    expect(result.indexerStatus).toContain("historical/dead");
    expect(result.bitcoin?.state).toBe("unspent");
  });
  it("preserves unknown Cell status", async () => {
    const result = await inspectAsset(
      { network: "testnet3", kind: "cell", txid: point, index: 0 },
      { fetcher: api({ kind: "unknown" }) },
    );
    expect(result.cells[0].liveStatus).toBe("unknown");
  });
  it("rejects wrong network genesis", async () => {
    await expect(
      inspectAsset(
        { network: "testnet3", kind: "cell", txid: point, index: 0 },
        { fetcher: api({ badNetwork: true }) },
      ),
    ).rejects.toThrow("genesis");
  });
  it("rejects invalid user identifiers and indexes", () => {
    expect(() =>
      validateQuery({ network: "testnet3", kind: "utxo", txid: "x", index: 0 }),
    ).toThrow();
    expect(() =>
      validateQuery({ network: "testnet3", kind: "utxo", txid, index: -1 }),
    ).toThrow();
    expect(() =>
      validateQuery({
        network: "unknown" as never,
        kind: "cell",
        txid,
        index: 0,
      }),
    ).toThrow();
  });
  it("verifies the real recorded Bitcoin inclusion vector", async () => {
    const r = await verifyInclusion(
      vector.txid,
      vector.proof,
      vector.header,
      vector.blockHash,
    );
    expect(r.status).toBe("matched");
    expect(r.headerChain).toBe("not independently verified");
  });
  it("rejects tampered proof, header and transaction", async () => {
    const proof = structuredClone(vector.proof);
    proof.merkle[0] = "11".repeat(32);
    await expect(
      verifyInclusion(vector.txid, proof, vector.header, vector.blockHash),
    ).rejects.toThrow("Merkle");
    await expect(
      verifyInclusion(
        vector.txid,
        vector.proof,
        "00".repeat(80),
        vector.blockHash,
      ),
    ).rejects.toThrow("header hash");
    await expect(
      verifyInclusion(
        "11".repeat(32),
        vector.proof,
        vector.header,
        vector.blockHash,
      ),
    ).rejects.toThrow("Merkle");
  });
});
it('returns not found for an absent historical transaction without inventing a UTXO',async()=>{
 const base=api();const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{if(String(input)===profiles.testnet3.ckbRpc){const q=JSON.parse(String(init?.body));if(q.method==='get_transaction'&&q.params[0]===point)return new Response(JSON.stringify({jsonrpc:'2.0',id:q.id,result:null}));}return base(input,init);})as typeof fetch;
 const r=await inspectAsset({network:'testnet3',kind:'cell',txid:point,index:0},{fetcher});expect(r.status).toBe('not found');expect(r.bitcoin).toBeNull();expect(r.cells).toHaveLength(0);
});
