export function parseUnits(value: string, decimals: number): bigint {
 const normalized = value.trim();
 if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Amount must be a positive decimal number.");
 const [whole, fraction = ""] = normalized.split(".");
 if (fraction.length > decimals) throw new Error(`Amount has more than ${decimals} decimal places.`);
 return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
