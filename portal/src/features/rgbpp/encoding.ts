import { ccc } from "@ckb-ccc/core";
export class RgbppError extends Error {}
export const hex = (value: Uint8Array) => ccc.hexFrom(value).slice(2);
export function bytes(value: string, length?: number) {
  if (
    typeof value !== "string" ||
    !/^(?:0x)?(?:[0-9a-f]{2})*$/i.test(value) ||
    value.length > 524290
  )
    throw new RgbppError("Invalid or oversized hexadecimal data.");
  const result = ccc.bytesFrom(value.startsWith("0x") ? value : `0x${value}`);
  if (length !== undefined && result.length !== length)
    throw new RgbppError(`Expected ${length} bytes.`);
  return new Uint8Array(result);
}
export function uint32(n: number) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff)
    throw new RgbppError("Expected uint32.");
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, n, true);
  return result;
}
export function decodeBinding(args: string) {
  const value = bytes(args, 36);
  return {
    vout: new DataView(value.buffer, value.byteOffset, 4).getUint32(0, true),
    txid: hex(value.slice(4).reverse()),
  };
}
export function encodeBinding(txid: string, vout: number) {
  return `0x${hex(uint32(vout))}${hex(bytes(txid, 32).slice().reverse())}`;
}
export function concat(parts: Uint8Array[]) {
  const size = parts.reduce((n, p) => n + p.length, 0);
  if (size > 1048576)
    throw new RgbppError("Commitment preimage exceeds 1 MiB.");
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export async function hash256(value: Uint8Array) {
  const first = await crypto.subtle.digest("SHA-256", new Uint8Array(value));
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", first)));
}
