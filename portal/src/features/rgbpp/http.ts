import { RgbppError } from "./encoding";
import pins from "./pins.json";
export interface Options {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}
export interface RawResponse {
  source: string;
  request: unknown;
  response: unknown;
}
type Json = Record<string, any>;
export function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RgbppError("Invalid API object.");
  return value as Json;
}
export async function request(
  url: string,
  init: RequestInit,
  options: Options = {},
) {
  const timeout = options.timeoutMs ?? 12000;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30000)
    throw new RgbppError("Invalid timeout.");
  const controller = new AbortController();
  const abort = () => controller.abort(new RgbppError("Cancelled."));
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new RgbppError("API timeout; state is unknown.")),
    timeout,
  );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    controller.signal.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(url, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok)
      throw new RgbppError(`HTTP ${response.status}; state is unknown.`);
    if (
      !response.body ||
      Number(response.headers.get("content-length")) > 1048576
    )
      throw new RgbppError("Missing or oversized API response.");
    reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 1048576) throw new RgbppError("API response exceeds 1 MiB.");
      parts.push(next.value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      data.set(part, offset);
      offset += part.length;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof RgbppError) throw error;
    throw new RgbppError("API transport/schema failure; state is unknown.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* closed */
      }
    }
  }
}
export function confirmationState(
  confirmed: boolean,
  canonical: boolean,
  blockHeight: number,
  tip: number,
  stable: boolean,
) {
  if (!canonical) return { state: "reorg-detected", confirmations: 0 };
  if (!stable || blockHeight > tip)
    return { state: "unknown", confirmations: 0 };
  if (!confirmed) return { state: "pending", confirmations: 0 };
  const confirmations = tip - blockHeight + 1;
  return {
    state:
      confirmations >= pins.confirmationPolicy.bitcoin
        ? "observed threshold reached"
        : "pending confirmations",
    confirmations,
  };
}
