import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { sendReviewedTransaction, type ReviewedTransaction } from "../../utils/reviewedTransaction";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { clientNetwork, parseCapacity, parseFeeRate } from "../../utils/network";
import { recordSubmittedTransaction } from "../../utils/submission";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { TransactionLifecycle } from "../../components/transactions/TransactionLifecycle";

function safeJson(value: unknown) {
 return JSON.stringify(value, (_, item) =>
  typeof item === "bigint" ? item.toString() : item, 2);
}

export function TransferCkbPage() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [receiver, setReceiver] = useState("");
 const [amount, setAmount] = useState("62");
 const [feeRate, setFeeRate] = useState("1000");
 const [preview, setPreview] = useState("");
 const [txHash, setTxHash] = useState("");
 const [status, setStatus] = useState("");
 const [loading, setLoading] = useState(false);

 const [prepared, setPrepared] = useState<ReviewedTransaction>();
 useEffect(() => { setPrepared(undefined); setPreview(''); }, [receiver, amount, feeRate, signer]);
 const canSubmit = useMemo(
  () => Boolean(signer && receiver.trim() && Number(amount) > 0),
  [signer, receiver, amount],
 );

 async function buildTransaction() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'buildTransaction');
 try {

  if (!signer) throw new Error("Connect a wallet first.");

  const { script: lock } = await ccc.Address.fromString(
   receiver.trim(),
   signer.client,
  );

  const tx = ccc.Transaction.from({
   outputs: [{
    capacity: parseCapacity(amount),
    lock,
   }],
  });

  if (tx.outputs[0].capacity < BigInt(tx.outputs[0].occupiedSize) * 100_000_000n) throw new Error("Amount is below the recipient Cell minimum capacity.");
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, parseFeeRate(feeRate));

  return tx;

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function previewTx(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'previewTx');
 try {

  event.preventDefault();
  try {
   setLoading(true);
   setPrepared(undefined); setPreview("");
   setStatus("Building transaction preview...");
   setTxHash("");
   const tx = await buildTransaction();
   setPrepared({ tx, signer: signer!, sender: await signer!.getRecommendedAddress() });
   setPreview(safeJson(tx));
   setStatus("Transaction is ready for wallet approval.");
  } catch (error) { featureOperation.fail(error);
   setStatus(error instanceof Error ? error.message : String(error));
  } finally {
   setLoading(false);
  }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function send() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'send');
 try {

  if (!signer || !prepared) return;

  try {
   setLoading(true);
   setStatus("Waiting for wallet approval...");
   const hash = await sendReviewedTransaction(prepared, signer);
   setTxHash(hash);
   setStatus("Transaction submitted.");

   setPrepared(undefined);
   setStatus(await recordSubmittedTransaction(signer.client, {
    txHash: hash,
    walletAddress: prepared.sender,
    recipient: receiver.trim(),
    amountCkb: amount,
    direction: "SEND",
   }));
  } catch (error) { featureOperation.fail(error);
   setStatus(error instanceof Error ? error.message : String(error));
  } finally {
   setLoading(false);
  }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return (
  <AppLayout>
   <PageHero
    eyebrow="CCC · Compose Transactions"
    title="Transfer CKB"
    description="Create an output, let CCC collect input Cells and calculate fee/change, then approve signing in your wallet."
   />

   <div className="transfer-product-grid">
    <section className="panel">
     <form className="product-form" onSubmit={previewTx}>
      <label>
       Receiver Address
       <input
        disabled={loading}
        value={receiver}
        onChange={e => setReceiver(e.target.value)}
        placeholder={signer?.client.addressPrefix === "ckb" ? "ckb1..." : "ckt1..."}
        required
       />
      </label>

      <label>
       Amount (CKB)
       <input
        type="number"
        min="61"
        step="0.00000001"
        disabled={loading}
        value={amount}
        onChange={e => setAmount(e.target.value)}
        required
       />
      </label>

      <div className="fee-row">
       <label>
        Fee Rate (Shannons/KB)
        <input
         type="number"
         min="1000"
         disabled={loading}
         value={feeRate}
         onChange={e => setFeeRate(e.target.value)}
        />
       </label>
       <button className="btn secondary compact" type="submit" disabled={loading || !canSubmit}>
        Estimate Fee
       </button>
      </div>

      <button className="primary action-wide" disabled={!canSubmit || loading}>
       {loading ? "Preparing..." : "Preview Transaction"}
      </button>
     </form>

     {status && <p className="status-line">{status}</p>}
    </section>

    <aside className="panel tips-panel">
     <span className="page-eyebrow">Tips</span>
     <ul>
      <li>CKB output Cells require minimum capacity.</li>
      <li>CCC automatically selects input Cells.</li>
      <li>CCC calculates change and the transaction fee.</li>
      <li>Selected network: {signer ? clientNetwork(signer.client) : "connect a wallet"}.</li>
     </ul>
    </aside>
   </div>

   {preview && (
    <section className="panel transaction-preview-panel">
     <div className="panel-title-row">
      <div>
       <span className="page-eyebrow">Transaction Preview</span>
       <h2>Ready to sign</h2>
      </div>
      <CheckCircle2 className="green"/>
     </div>

     <pre>{preview}</pre>

     <div className="preview-actions">
      <button className="btn secondary" onClick={() => { setPreview(""); setPrepared(undefined); }}>
       Cancel
      </button>
      <button className="btn primary" onClick={() => void send()} disabled={loading || !prepared}>
       Send Transaction <ArrowRight size={16}/>
      </button>
     </div>
    </section>
   )}

   {txHash && (
    <section className="panel success-panel">
     <span className="page-eyebrow">Submitted</span>
     <h2>Transaction Hash</h2>
     <code className="hash-box">{txHash}</code>
     <TransactionLifecycle txHash={txHash} client={signer?.client}/>
    </section>
   )}
  </AppLayout>
 );
}
