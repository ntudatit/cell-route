export interface SharedInvoice {
  invoice: string;
  paymentHash: string;
  nodePubkey: string;
  createdAt: string;
}
export function parseSharedInvoice(raw: string | null): SharedInvoice | null {
  if (!raw || raw.length > 16384) return null;
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value.invoice !== "string" ||
      !value.invoice ||
      value.invoice.length > 8192 ||
      typeof value.paymentHash !== "string" ||
      !/^0x[0-9a-f]{64}$/i.test(value.paymentHash) ||
      typeof value.nodePubkey !== "string" ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt))
    )
      return null;
    return {
      invoice: value.invoice,
      paymentHash: value.paymentHash,
      nodePubkey: value.nodePubkey,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}
