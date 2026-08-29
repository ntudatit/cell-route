import { FormEvent, useMemo, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { backendApi } from "../../api/backend";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { TransactionLifecycle } from "../../components/transactions/TransactionLifecycle";

function safeJson(value: unknown) {
 return JSON.stringify(value, (_, item) =>
  typeof item === "bigint" ? item.toString() : item, 2);
}

export function TransferCkbPage() {
 const signer = ccc.useSigner();
 const [receiver, setReceiver] = useState("");
 const [amount, setAmount] = useState("62");
 const [feeRate, setFeeRate] = useState("1000");
 const [preview, setPreview] = useState("");
 const [txHash, setTxHash] = useState("");
 const [status, setStatus] = useState("");
 const [loading, setLoading] = useState(false);

 const canSubmit = useMemo(
  () => Boolean(signer && receiver.trim() && Number(amount) > 0),
  [signer, receiver, amount],
 );

 async function buildTransaction() {
  if (!signer) throw new Error("Connect a wallet first.");

  const { script: lock } = await ccc.Address.fromString(
   receiver.trim(),
   signer.client,
  );

  const tx = ccc.Transaction.from({
   outputs: [{
    capacity: ccc.fixedPointFrom(amount),
    lock,
   }],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, Number(feeRate));

  return tx;
 }

 async function previewTx(event: FormEvent) {
  event.preventDefault();
  try {
   setLoading(true);
   setStatus("Building transaction preview...");
   setTxHash("");
   const tx = await buildTransaction();
   setPreview(safeJson(tx));
   setStatus("Transaction is ready for wallet approval.");
  } catch (error) {
   setStatus(error instanceof Error ? error.message : String(error));
  } finally {
   setLoading(false);
  }
 }

 async function send() {
  if (!signer) return;

  try {
   setLoading(true);
   setStatus("Waiting for wallet approval...");
   const tx = await buildTransaction();
   setPreview(safeJson(tx));

   const hash = await signer.sendTransaction(tx);
   setTxHash(hash);
   setStatus("Transaction submitted.");

   await backendApi.trackTransaction({
    txHash: hash,
    walletAddress: await signer.getRecommendedAddress(),
    recipient: receiver.trim(),
    amountCkb: amount,
    direction: "SEND",
   });
  } catch (error) {
   setStatus(error instanceof Error ? error.message : String(error));
  } finally {
   setLoading(false);
  }
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
        value={receiver}
        onChange={e => setReceiver(e.target.value)}
        placeholder="ckt1..."
        required
       />
      </label>

      <label>
       Amount (CKB)
       <input
        type="number"
        min="61"
        step="0.00000001"
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
         value={feeRate}
         onChange={e => setFeeRate(e.target.value)}
        />
       </label>
       <button className="btn secondary compact" type="button">
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
      <li>Use Testnet funds while practicing.</li>
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
      <button className="btn secondary" onClick={() => setPreview("")}>
       Cancel
      </button>
      <button className="btn primary" onClick={() => void send()} disabled={loading}>
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
     <TransactionLifecycle txHash={txHash}/>
    </section>
   )}
  </AppLayout>
 );
}