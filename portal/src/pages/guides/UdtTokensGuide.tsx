import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { CodeBlock, GuideHeader, GuideSection, GuideShell, ResultBox, StepList } from "../../components/GuideShell";

const code = `const type = await ccc.Script.fromKnownScript(
 signer.client,
 ccc.KnownScript.XUdt,
 tokenArgs,
);

const known = await signer.client.getKnownScript(ccc.KnownScript.XUdt);
const code = (await signer.client.getCellDeps(known.cellDeps))[0].outPoint;
const udt = new ccc.udt.Udt(code, type);

const { script: to } = await ccc.Address.fromString(receiver, signer.client);
let { res: tx } = await udt.transfer(signer, [
 { to, amount: ccc.fixedPointFrom(amount) },
]);

tx = await udt.completeBy(tx, signer);
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);`;

export function UdtTokensGuide() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [tokenArgs, setTokenArgs] = useState("");
 const [receiver, setReceiver] = useState("");
 const [amount, setAmount] = useState("1");
 const [result, setResult] = useState("");
 const [error, setError] = useState("");

 async function submit(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'submit');
 try {

  event.preventDefault();
  if (!signer) return setError("Connect a wallet first.");
  try {
   setError(""); setResult("");
   const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, tokenArgs.trim());
   const known = await signer.client.getKnownScript(ccc.KnownScript.XUdt);
   const codeOutPoint = (await signer.client.getCellDeps(known.cellDeps))[0].outPoint;
   const udt = new ccc.udt.Udt(codeOutPoint, type);
   const { script: to } = await ccc.Address.fromString(receiver.trim(), signer.client);
   let { res: tx } = await udt.transfer(signer, [{ to, amount: ccc.fixedPointFrom(amount) }]);
   tx = await udt.completeBy(tx, signer);
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer);
   setResult(await signer.sendTransaction(tx));
  } catch (e) { featureOperation.fail(e);  setError(e instanceof Error ? e.message : String(e)); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return (
  <GuideShell>
   <GuideHeader title="UDT Tokens" description="Transfer xUDT using CCC's Udt abstraction. Token amounts live in cell data while CCC handles UDT input collection and change." docsHref="https://docs.ckbccc.com/docs/guides/udt-tokens" />
   <div className="guide-grid two">
    <GuideSection title="xUDT transfer demo" description="Use Testnet first and provide the args for an xUDT you actually own.">
     <form className="guide-form" onSubmit={submit}>
      <label>xUDT type args<input value={tokenArgs} onChange={e => setTokenArgs(e.target.value)} placeholder="0x..." required /></label>
      <label>Recipient<input value={receiver} onChange={e => setReceiver(e.target.value)} placeholder="ckt1..." required /></label>
      <label>Token amount<input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0.00000001" step="0.00000001" required /></label>
      <button className="btn primary">Transfer xUDT</button>
     </form>
     {error && <div className="alert error">{error}</div>}
     <ResultBox title="UDT transaction" value={result}/>
    </GuideSection>
    <GuideSection title="CCC UDT flow"><CodeBlock code={code}/></GuideSection>
   </div>
   <GuideSection title="What changes compared with a CKB transfer?">
    <StepList items={[
     "Construct the xUDT type script and Udt instance.",
     "Create desired token outputs with udt.transfer().",
     "Collect token-bearing input cells and create token change with udt.completeBy().",
     "Collect CKB capacity for the output cells with completeInputsByCapacity().",
     "Complete the transaction fee and let the wallet sign/broadcast.",
    ]}/>
   </GuideSection>
  </GuideShell>
 );
}
