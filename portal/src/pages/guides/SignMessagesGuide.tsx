import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { CodeBlock, GuideHeader, GuideSection, GuideShell, ResultBox, StepList } from "../../components/GuideShell";

const code = `const signer = ccc.useSigner();
const message = "Sign in to CKB CCC Starter";

const signature = await signer.signMessage(message);

// For server/off-chain verification, use CCC's
// verifyMessage API with the signer/address context required
// by the connected wallet ecosystem.`;

export function SignMessagesGuide() {
 const signer = ccc.useSigner();
 const [message, setMessage] = useState("Sign in to CKB CCC Starter");
 const [signature, setSignature] = useState("");
 const [error, setError] = useState("");

 async function submit(event: FormEvent) {
  event.preventDefault();
  if (!signer) return setError("Connect a wallet first.");
  try {
   setError("");
   const result = await signer.signMessage(message);
   setSignature(typeof result === "string" ? result : JSON.stringify(result));
  } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
 }

 return (
  <GuideShell>
   <GuideHeader title="Sign Messages" description="Prove control of a connected wallet without sending an on-chain transaction. This is useful for login challenges and off-chain authorization." docsHref="https://docs.ckbccc.com/docs/guides/sign-message" />
   <div className="guide-grid two">
    <GuideSection title="Live signing demo">
     <form className="guide-form" onSubmit={submit}>
      <label>Message<textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} /></label>
      <button className="btn primary">Request wallet signature</button>
     </form>
     {error && <div className="alert error">{error}</div>}
     <ResultBox title="Signature" value={signature}/>
    </GuideSection>
    <GuideSection title="Frontend pattern"><CodeBlock code={code}/></GuideSection>
   </div>
   <GuideSection title="Recommended authentication flow">
    <StepList items={[
     "Backend creates a short-lived random challenge/nonce.",
     "React asks the connected CCC signer to sign the challenge.",
     "React returns address, challenge, and signature to the backend.",
     "Backend verifies the signature using an ecosystem-compatible verifier, then issues an application session/JWT.",
     "Never ask the browser wallet for its private key and never send a private key to Backend.",
    ]}/>
   </GuideSection>
  </GuideShell>
 );
}