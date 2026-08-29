import { useCallback, useEffect, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";

export type WalletSnapshot = {
 address: string;
 balanceCkb: string;
 loading: boolean;
 error: string;
};

export function useWallet() {
 const signer = ccc.useSigner();
 const [snapshot, setSnapshot] = useState<WalletSnapshot>({
  address: "",
  balanceCkb: "0",
  loading: false,
  error: "",
 });

 const refresh = useCallback(async () => {
  if (!signer) {
   setSnapshot({ address: "", balanceCkb: "0", loading: false, error: "" });
   return;
  }

  setSnapshot((current) => ({ ...current, loading: true, error: "" }));
  try {
   const [address, balance] = await Promise.all([
    signer.getRecommendedAddress(),
    signer.getBalance(),
   ]);
   setSnapshot({
    address,
    balanceCkb: ccc.fixedPointToString(balance),
    loading: false,
    error: "",
   });
  } catch (error) {
   setSnapshot((current) => ({
    ...current,
    loading: false,
    error: error instanceof Error ? error.message : String(error),
   }));
  }
 }, [signer]);

 useEffect(() => {
  void refresh();
 }, [refresh]);

 return { signer, ...snapshot, refresh };
}