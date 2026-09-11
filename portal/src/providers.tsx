import { setLogNetwork } from "./dev-console/features";
import { clientNetwork } from "./utils/network";
import { configuredNetwork, createClient } from "./utils/network";
import type { CSSProperties, ReactNode } from "react";
import { Fragment, useMemo } from "react";
import { ccc } from "@ckb-ccc/connector-react";

export function CccProvider({ children }: { children: ReactNode }) {
 const defaultClient = useMemo(() => createClient(configuredNetwork), []);
 const clientOptions = useMemo(() => (configuredNetwork === 'mainnet'
   ? [{ name: 'CKB Mainnet', client: defaultClient }]
   : [{ name: 'CKB Testnet', client: createClient('testnet') }, { name: 'OffCKB Devnet', client: createClient('devnet') }, { name: 'CKB Mainnet', client: createClient('mainnet') }]), [defaultClient]);
 return (
  <ccc.Provider
   name="FiberPay"
   defaultClient={defaultClient}
   clientOptions={clientOptions}
   connectorProps={{
    style: {
     "--background": "#ffffff",
     "--divider": "#edebe9",
     "--btn-primary": "#0078d4",
     "--btn-primary-hover": "#106ebe",
     "--btn-secondary": "#f3f2f1",
     "--btn-secondary-hover": "#edebe9",
     "--icon-primary": "#323130",
     "--icon-secondary": "#605e5c",
     "--tip-color": "#605e5c",
     color: "#323130",
    } as CSSProperties,
   }}
  >
   <NetworkScope>{children}</NetworkScope>
  </ccc.Provider>
 );
}

// Discard forms, previews and transaction observers when the selected chain changes.
function NetworkScope({ children }: { children: ReactNode }) {
 const { client } = ccc.useCcc();
 setLogNetwork(clientNetwork(client));
 return <Fragment key={client.url}>{children}</Fragment>;
}
