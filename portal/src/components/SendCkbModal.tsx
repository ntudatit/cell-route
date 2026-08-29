import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { ccc } from "@ckb-ccc/connector-react";
import { backendApi } from "../api/backend";

export function SendCkbModal({ onClose, onSent }: { onClose: () => void; onSent: () => Promise<void> | void }) {
 const signer = ccc.useSigner();
 const [recipient, setRecipient] = useState("");
 const [amount, setAmount] = useState("100");
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");

 async function submit(event: FormEvent) {
  event.preventDefault();
  if (!signer) {
   setMessage("Connect a wallet first.");
   return;
  }

  if (!recipient.trim()) {
   setMessage("Recipient address is required.");
   return;
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
   setMessage("Amount must be greater than 0.");
   return;
  }

  setBusy(true);
  setMessage("Building transaction with CCC...");

  try {
   const sender = await signer.getRecommendedAddress();
   const { script: recipientLock } = await ccc.Address.fromString(recipient.trim(), signer.client);

   const tx = ccc.Transaction.from({
    outputs: [
     {
      lock: recipientLock,
      capacity: ccc.fixedPointFrom(amount.trim()),
     },
    ],
   });

   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer);

   setMessage("Confirm the transaction in your wallet...");
   const txHash = await signer.sendTransaction(tx);
   setMessage(`Broadcast successfully: ${txHash}`);

   await backendApi.trackTransaction({
    txHash,
    walletAddress: sender,
    recipient: recipient.trim(),
    amountCkb: amount.trim(),
    direction: "SEND",
   });

   await onSent();
  } catch (error) {
   setMessage(error instanceof Error ? error.message : String(error));
  } finally {
   setBusy(false);
  }
 }

 return (
  <div className="modal-backdrop" onMouseDown={onClose}>
   <div className="send-modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="panel-title"><h3>Send CKB</h3><button onClick={onClose}><X size={18}/></button></div>
    <form onSubmit={submit}>
     <label>Recipient address<input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="ckt1..." required /></label>
     <label>Amount (CKB)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required /></label>
     <button className="primary" disabled={!signer || busy}>{busy ? "Processing..." : "Build, sign & send"}</button>
    </form>
    {message && <div className="tx-message">{message}</div>}
   </div>
  </div>
 );
}
