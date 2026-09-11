import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { createSpore, meltSpore, transferSpore } from "@ckb-ccc/spore";
import { CodeBlock, GuideHeader, GuideSection, GuideShell, ResultBox, StepList } from "../../components/GuideShell";

const createCode = `const { tx, id } = await createSpore({
 signer,
 data: {
  contentType: "text/plain",
  content: new TextEncoder().encode(content),
 },
});

await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);`;

export function SporeProtocolGuide() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [content, setContent] = useState("Hello, Spore!");
 const [sporeId, setSporeId] = useState("");
 const [recipient, setRecipient] = useState("");
 const [result, setResult] = useState("");
 const [error, setError] = useState("");

 const guard = () => {
  if (!signer) { setError("Connect a wallet first."); return false; }
  setError(""); setResult(""); return true;
 };

 async function create(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'create');
 try {

  event.preventDefault(); if (!guard() || !signer) return;
  try {
   const { tx, id } = await createSpore({ signer, data: { contentType: "text/plain", content: new TextEncoder().encode(content) } });
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer);
   const hash = await signer.sendTransaction(tx);
   setSporeId(id); setResult(`Spore ID: ${id} | Tx: ${hash}`);
  } catch (e) { featureOperation.fail(e);  setError(e instanceof Error ? e.message : String(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function transfer() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'transfer');
 try {

  if (!guard() || !signer) return;
  try {
   const { script: to } = await ccc.Address.fromString(recipient.trim(), signer.client);
   const { tx } = await transferSpore({ signer, id: sporeId.trim(), to });
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer);
   setResult(`Transfer tx: ${await signer.sendTransaction(tx)}`);
  } catch (e) { featureOperation.fail(e);  setError(e instanceof Error ? e.message : String(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function melt() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'melt');
 try {

  if (!guard() || !signer) return;
  if (!window.confirm("Melt this Spore? This action is irreversible.")) return;
  try {
   const { tx } = await meltSpore({ signer, id: sporeId.trim() });
   await tx.completeFeeBy(signer);
   setResult(`Melt tx: ${await signer.sendTransaction(tx)}`);
  } catch (e) { featureOperation.fail(e);  setError(e instanceof Error ? e.message : String(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return (
  <GuideShell>
   <GuideHeader title="Spore Protocol" description="Create, transfer, and melt permanent on-chain Digital Objects (DOBs) with the official CCC Spore package." docsHref="https://docs.ckbccc.com/docs/guides/spore-protocol" />
   <div className="guide-grid two">
    <GuideSection title="Create a text Spore" description="Spore content consumes on-chain CKB capacity; test with a funded Testnet wallet.">
     <form className="guide-form" onSubmit={create}>
      <label>Content<textarea rows={4} value={content} onChange={e => setContent(e.target.value)} /></label>
      <button className="btn primary">Create Spore</button>
     </form>
     <div className="separator"/>
     <label className="standalone-label">Spore ID<input value={sporeId} onChange={e => setSporeId(e.target.value)} placeholder="0x..." /></label>
     <label className="standalone-label">New owner address<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="ckt1..." /></label>
     <div className="button-row">
      <button className="btn secondary" onClick={transfer} disabled={!sporeId || !recipient}>Transfer</button>
      <button className="btn danger" onClick={melt} disabled={!sporeId}>Melt</button>
     </div>
     {error && <div className="alert error">{error}</div>}
     <ResultBox value={result}/>
    </GuideSection>
    <GuideSection title="Create Spore code"><CodeBlock code={createCode}/></GuideSection>
   </div>
   <GuideSection title="Spore lifecycle">
    <StepList items={[
     "Create content bytes and a MIME contentType.",
     "createSpore() builds a new Spore cell and returns its deterministic Spore ID.",
     "Complete capacity and fee, then sign and broadcast.",
     "transferSpore() changes the owner lock while preserving the Digital Object.",
     "meltSpore() permanently destroys the Spore and reclaims its locked CKB capacity.",
    ]}/>
   </GuideSection>
  </GuideShell>
 );
}
