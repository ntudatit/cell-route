import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { CheckCircle2, Copy } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";

function safeJson(value: unknown) {
 return JSON.stringify(value, (_, item) =>
  typeof item === "bigint" ? item.toString() : item, 2);
}

export function SignMessagePage() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [message, setMessage] = useState("Hello CKB from CCC!");
 const [signature, setSignature] = useState("");
 const [identity, setIdentity] = useState("");
 const [signType, setSignType] = useState("");
 const [valid, setValid] = useState<boolean | null>(null);
 const [status, setStatus] = useState("");

 async function submit(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'submit');
 try {

  event.preventDefault();

  if (!signer) {
   setStatus("Connect a wallet first.");
   return;
  }

  try {
   setStatus("Waiting for wallet signature...");
   const result = await signer.signMessage(message);
   const verified = await ccc.Signer.verifyMessage(message, result);

   setSignature(typeof result === "string" ? result : safeJson(result));
   if (typeof result === "string") {
    setIdentity(await signer.getRecommendedAddress());
    setSignType(String(signer.signType ?? "Wallet signature"));
   } else {
    setIdentity(String(result.identity ?? ""));
    setSignType(String(result.signType ?? signer.signType ?? ""));
   }
   setValid(verified);
   setStatus("Message signed and verified.");
  } catch (error) { featureOperation.fail(error);
   setStatus(error instanceof Error ? error.message : String(error));
   setValid(false);
  }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return (
  <AppLayout>
   <PageHero
    eyebrow="CCC · Unified Signer"
    title="Sign Message"
    description="Prove wallet ownership off-chain without broadcasting a blockchain transaction."
   />

   <div className="sign-product-grid">
    <section className="panel">
     <form className="product-form" onSubmit={submit}>
      <label>
       Message
       <textarea rows={9} value={message} onChange={e => setMessage(e.target.value)}/>
      </label>

      <div className="result-field inline-field">
       <span>Sign Type</span>
       <strong>{signType || "Provided by connected wallet"}</strong>
      </div>

      <button className="primary action-wide">Sign Message</button>
     </form>

     {status && <p className="status-line">{status}</p>}
    </section>

    <section className="panel signature-panel">
     <span className="page-eyebrow">Signature</span>

     <div className="signature-code">
      <pre>{signature || "No signature yet."}</pre>
      {signature && (
       <button className="copy-mini" onClick={() => navigator.clipboard.writeText(signature)}>
        <Copy size={14}/>
       </button>
      )}
     </div>

     <div className="result-field">
      <span>Identity</span>
      <code>{identity || "—"}</code>
     </div>

     <div className="verification-row">
      <span>Valid</span>
      <strong className={valid ? "green" : valid === false ? "red" : ""}>
       {valid === null ? "—" : valid ? <><CheckCircle2 size={16}/> Yes</> : "No"}
      </strong>
     </div>
    </section>
   </div>
  </AppLayout>
 );
}
