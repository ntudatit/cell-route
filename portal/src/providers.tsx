import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { ccc } from "@ckb-ccc/connector-react";

export function CccProvider({ children }: { children: ReactNode }) {
 const configuredNetwork = (import.meta.env.VITE_CKB_NETWORK ?? "testnet").toLowerCase();

 const defaultClient = useMemo(
  () =>
   configuredNetwork === "mainnet"
    ? new ccc.ClientPublicMainnet()
    : new ccc.ClientPublicTestnet(),
  [configuredNetwork],
 );

 const clientOptions = useMemo(
  () => [
   { name: "CKB Testnet", client: new ccc.ClientPublicTestnet() },
   { name: "CKB Mainnet", client: new ccc.ClientPublicMainnet() },
  ],
  [],
 );

 return (
  <ccc.Provider
   name="FiberPay"
   defaultClient={defaultClient}
   clientOptions={clientOptions}
   connectorProps={{
    style: {
     "--background": "#0b1220",
     "--divider": "rgba(255,255,255,.08)",
     "--btn-primary": "#6d45f7",
     "--btn-primary-hover": "#7c5cff",
     "--btn-secondary": "#151d2b",
     "--btn-secondary-hover": "#1d2738",
     "--icon-primary": "#ffffff",
     "--icon-secondary": "rgba(255,255,255,.65)",
     "--tip-color": "#8f9bb0",
     color: "#fff",
    } as CSSProperties,
   }}
  >
   {children}
  </ccc.Provider>
 );
}
