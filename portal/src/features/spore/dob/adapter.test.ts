import { describe, expect, it, vi } from "vitest";
import { decode, DecoderWorker } from "./adapter";
import { DNA, PATTERN } from "./fixture";
import { decodeReference, validateResponse } from "./reference";
function worker(response?: unknown) {
  const instance: DecoderWorker = {
    onmessage: null,
    onerror: null,
    terminate: vi.fn(),
    postMessage() {
      if (response !== undefined)
        queueMicrotask(() =>
          instance.onmessage?.({ data: response } as MessageEvent),
        );
    },
  };
  return instance;
}
describe("pinned DOB/0 bounded decoder", () => {
  it("matches official little-endian and exclusive range semantics deterministically", async () => {
    const expected = [
      { name: "BackgroundColor", traits: [{ String: "blue" }] },
      { name: "Type", traits: [{ Number: 12 }] },
      { name: "Timestamp", traits: [{ Number: 100992003 }] },
    ];
    expect(decodeReference(DNA, PATTERN)).toEqual(expected);
    expect(decodeReference(DNA, PATTERN)).toEqual(expected);
    const w = worker({ result: JSON.stringify(expected) });
    expect(await decode(DNA, PATTERN, { worker: () => w })).toEqual(expected);
    expect(w.terminate).toHaveBeenCalled();
  });
  it("rejects malformed DNA and unsupported patterns before launching a worker", async () => {
    const factory = vi.fn();
    await expect(
      decode("xyz", PATTERN, { worker: factory }),
    ).rejects.toMatchObject({ code: "DNA" });
    await expect(decode(DNA, [], { worker: factory })).rejects.toMatchObject({
      code: "PATTERN",
    });
    expect(factory).not.toHaveBeenCalled();
  });
  it("reports unavailable and terminates timed out execution", async () => {
    await expect(
      decode(DNA, PATTERN, { enabled: false }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
    const w = worker();
    await expect(
      decode(DNA, PATTERN, { worker: () => w, timeoutMs: 1 }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(w.terminate).toHaveBeenCalled();
  });
  it("rejects oversized and malformed responses", async () => {
    await expect(
      decode(DNA, PATTERN, {
        worker: () => worker({ result: " ".repeat(4097) }),
      }),
    ).rejects.toMatchObject({ code: "SIZE" });
    await expect(
      decode(DNA, PATTERN, { worker: () => worker({ result: "{}" }) }),
    ).rejects.toMatchObject({ code: "SCHEMA" });
    expect(() => validateResponse("not-json")).toThrow();
    expect(() =>
      validateResponse(JSON.stringify([{ name: "<script>", traits: [] }])),
    ).toThrow();
  });
});
