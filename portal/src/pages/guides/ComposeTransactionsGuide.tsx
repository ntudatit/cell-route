import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { backendApi } from "../../api/backend";
import { CodeBlock, GuideHeader, GuideSection, GuideShell, ResultBox, StepList } from "../../components/GuideShell";

const composeCode = `const { script: lock } = await ccc.Address.fromString(receiver, signer.client);

const tx = ccc.Transaction.from({
 outputs: [{
  capacity: ccc.fixedPointFrom(amount),
  lock,
 }],
});

await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);`;

export function ComposeTransactionsGuide() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [receiver, setReceiver] = useState("");
 const [amount, setAmount] = useState("100");
 const [txHash, setTxHash] = useState("");
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);

 async function submit(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'submit');
 try {

  event.preventDefault();
  if (!signer) return setError("Connect a wallet first.");
  try {
   setLoading(true); setError(""); setTxHash("");
   const { script: lock } = await ccc.Address.fromString(receiver.trim(), signer.client);
   const tx = ccc.Transaction.from({ outputs: [{ capacity: ccc.fixedPointFrom(amount), lock }] });
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer);
   const hash = await signer.sendTransaction(tx);
   setTxHash(hash);
   const fromAddress = await signer.getRecommendedAddress();
   await backendApi.trackTransaction({ txHash: hash, walletAddress: fromAddress, recipient: receiver.trim(), amountCkb: amount, direction: "SEND" });
  } catch (e) { featureOperation.fail(e);
   setError(e instanceof Error ? e.message : String(e));
  } finally { setLoading(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return (
  <GuideShell>
   <GuideHeader title="Compose Transactions" description="Build and send CKB using CCC's declare → fill inputs → pay fee → sign and broadcast pattern." docsHref="https://docs.ckbccc.com/docs/guides/compose-transactions" />
   <div className="guide-grid two">
    <GuideSection title="Send CKB on the connected network">
     <form className="guide-form" onSubmit={submit}>
      <label>Recipient address<input value={receiver} onChange={e => setReceiver(e.target.value)} placeholder="ckt1..." required/></label>
      <label>Amount (CKB)<input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="61" step="0.00000001" required/></label>
      <button className="btn primary" disabled={loading}>{loading ? "Preparing wallet..." : "Build, sign & send"}</button>
     </form>
     {error && <div className="alert error">{error}</div>}
     <ResultBox title="Transaction hash" value={txHash}/>
    </GuideSection>
    <GuideSection title="CCC transaction code"><CodeBlock code={composeCode}/></GuideSection>
   </div>
   <GuideSection title="Transaction lifecycle">
    <StepList items={[
     "Parse the recipient address into its lock Script.",
     "Declare the desired output with Transaction.from().",
     "Collect live input cells with completeInputsByCapacity(signer).",
     "Add change and calculate the fee with completeFeeBy(signer).",
     "Ask the connected wallet to sign and broadcast with signer.sendTransaction(tx).",
     "Send the resulting txHash to Backend so the backend can track status and dashboard history.",
    ]}/>
   </GuideSection>
  </GuideShell>
 );
}
