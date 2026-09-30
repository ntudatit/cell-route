// Bounded reference implementation for the pinned Cookbook pattern, not an arbitrary decoder loader.
// Numeric segments use little endian; the official range upper bound is exclusive.
import { PATTERN } from "./fixture";
export class DecodeError extends Error {
  constructor(
    public code:
      "DNA" | "PATTERN" | "UNAVAILABLE" | "TIMEOUT" | "SIZE" | "SCHEMA",
  ) {
    super(`DOB decoder: ${code}`);
  }
}
export interface Attribute {
  name: string;
  traits: ({ String: string } | { Number: number })[];
}
export function validateInput(dna: string, pattern: unknown) {
  if (!/^[0-9a-f]{16}$/i.test(dna)) throw new DecodeError("DNA");
  try {
    if (JSON.stringify(pattern) !== JSON.stringify(PATTERN))
      throw new DecodeError("PATTERN");
  } catch {
    throw new DecodeError("PATTERN");
  }
}
export function decodeReference(dna: string, pattern: unknown): Attribute[] {
  validateInput(dna, pattern);
  const bytes = Uint8Array.from(dna.match(/../g)!, (value) =>
    parseInt(value, 16),
  );
  return [
    {
      name: "BackgroundColor",
      traits: [
        { String: ["red", "blue", "green", "black", "white"][bytes[0] % 5] },
      ],
    },
    { name: "Type", traits: [{ Number: 10 + (bytes[1] % 40) }] },
    {
      name: "Timestamp",
      traits: [{ Number: new DataView(bytes.buffer).getUint32(2, true) }],
    },
  ];
}
export function validateResponse(text: string, maxBytes = 4096): Attribute[] {
  if (new TextEncoder().encode(text).length > maxBytes)
    throw new DecodeError("SIZE");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DecodeError("SCHEMA");
  }
  if (!Array.isArray(data) || data.length !== 3)
    throw new DecodeError("SCHEMA");
  for (const [index, item] of data.entries()) {
    if (
      !item ||
      item.name !== PATTERN[index][0] ||
      !Array.isArray(item.traits) ||
      item.traits.length !== 1
    )
      throw new DecodeError("SCHEMA");
    const trait = item.traits[0];
    if (
      !trait ||
      Object.keys(trait).length !== 1 ||
      (index === 0
        ? typeof trait.String !== "string" || trait.String.length > 128
        : !Number.isSafeInteger(trait.Number) || trait.Number < 0)
    )
      throw new DecodeError("SCHEMA");
  }
  return data;
}
