import { useFeatureCcc } from '../../dev-console/hooks';
import { ccc } from "@ckb-ccc/connector-react";
import { GuideHeader, GuideSection, GuideShell, CodeBlock, ResultBox, StepList } from "../../components/GuideShell";
import { useWallet } from "../../hooks/useWallet";

const providerCode = `import { ccc } from "@ckb-ccc/connector-react";

<ccc.Provider
 name="CKB CCC Starter"
 defaultClient={new ccc.ClientPublicTestnet()}
 clientOptions={[
  { name: "CKB Testnet", client: new ccc.ClientPublicTestnet() },
  { name: "CKB Mainnet", client: new ccc.ClientPublicMainnet() },
 ]}
>
 <App />
</ccc.Provider>`;

export function ConnectWalletsGuide() {
 const { open, disconnect, wallet, signerInfo } = useFeatureCcc();
 const walletState = useWallet();

 return (
  <GuideShell>
   <GuideHeader
    title="Connect Wallets"
    description="Connect CKB, EVM, BTC, Nostr, and Doge-capable wallets through CCC's unified React connector and obtain a Signer for the next guides."
    docsHref="https://docs.ckbccc.com/docs/guides/connect-wallets"
   />
   <div className="guide-grid two">
    <GuideSection title="Live wallet demo" description="This uses the same ccc.Provider mounted at the root of this starter.">
     <div className="wallet-demo-card">
      <div><span>Status</span><strong>{signerInfo ? "Connected" : "Not connected"}</strong></div>
      <div><span>Wallet</span><strong>{wallet?.name ?? "-"}</strong></div>
      <div><span>Address</span><strong className="mono-break">{walletState.address || "-"}</strong></div>
      <div><span>Balance</span><strong>{walletState.balanceCkb} CKB</strong></div>
     </div>
     {!signerInfo ? (
      <button className="btn primary" onClick={open}>Connect Wallet</button>
     ) : (
      <button className="btn secondary" onClick={disconnect}>Disconnect</button>
     )}
     <ResultBox title="Signer ready" value={signerInfo ? "ccc.useSigner() is available" : "Connect a wallet first"}/>
    </GuideSection>
    <GuideSection title="Provider setup">
     <CodeBlock code={providerCode}/>
    </GuideSection>
   </div>
   <GuideSection title="Recommended React path">
    <StepList items={[
     "Wrap the application in ccc.Provider.",
     "Use ccc.useCcc() for modal, wallet state, disconnect, and client switching.",
     "Use ccc.useSigner() when you only need the active signer.",
     "Read address with signer.getRecommendedAddress() and balance with signer.getBalance().",
     "Pass the same signer into transaction, message, UDT, and Spore APIs.",
    ]}/>
   </GuideSection>
  </GuideShell>
 );
}
