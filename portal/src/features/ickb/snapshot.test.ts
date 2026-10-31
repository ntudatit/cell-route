import { expect, it, vi } from "vitest";
import { loadSnapshot } from "./snapshot";
import { request } from "../rgbpp/http";
it("rejects cross-network RPC data before reading deployments", async () => {
  const fetcher = vi.fn(async (_url, init) => {
    const q = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: q.id,
        result: "0x" + "00".repeat(32),
      }),
    );
  }) as typeof fetch;
  await expect(loadSnapshot("testnet", { fetcher })).rejects.toThrow("genesis");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("reports transport and malformed response failures without fallback data", async () => {
  await expect(
    loadSnapshot("testnet", {
      fetcher: async () => new Response("unavailable", { status: 503 }),
    }),
  ).rejects.toThrow("503");
  await expect(
    loadSnapshot("testnet", { fetcher: async () => new Response("{}") }),
  ).rejects.toThrow("envelope");
});
it("cancels before a request when the caller has already aborted", async () => {
  const active = new AbortController();
  active.abort();
  const fetcher = vi.fn();
  await expect(
    loadSnapshot("testnet", { signal: active.signal, fetcher }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("enforces explicit response limits for code reads", async () => {
  await expect(
    request(
      "https://rpc.invalid",
      {},
      {
        fetcher: async () => new Response("x".repeat(64)),
        maxResponseBytes: 32,
      },
    ),
  ).rejects.toThrow("exceeds");
  await expect(
    request("https://rpc.invalid", {}, { maxResponseBytes: 9 * 1048576 }),
  ).rejects.toThrow("limit");
});
