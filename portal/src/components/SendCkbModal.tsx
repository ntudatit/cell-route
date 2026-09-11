import { currentScope } from '../dev-console/features';
import { beginOperation } from '../dev-console/store';
import { useFeatureSigner } from '../dev-console/hooks';
import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { ccc } from "@ckb-ccc/connector-react";
import { recordSubmittedTransaction } from "../utils/submission";
import { parseCapacity } from "../utils/network";

export function SendCkbModal({ onClose, onSent }: { onClose: () => void; onSent: () => Promise<void> | void }) {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [recipient, setRecipient] = useState("");
 const [amount, setAmount] = useState("100");
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");

 async function submit(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'submit');
 try {

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
      capacity: parseCapacity(amount),
     },
    ],
   });

   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer);

   setMessage("Confirm the transaction in your wallet...");
   const txHash = await signer.sendTransaction(tx);
   setMessage(`Broadcast successfully: ${txHash}`);

   const auditStatus = await recordSubmittedTransaction(signer.client, {
    txHash,
    walletAddress: sender,
    recipient: recipient.trim(),
    amountCkb: amount.trim(),
    direction: "SEND",
   });

   setMessage(`${auditStatus} Hash: ${txHash}`);
   await Promise.resolve(onSent()).catch(() => undefined);
  } catch (error) { featureOperation.fail(error);
   setMessage(error instanceof Error ? error.message : String(error));
  } finally {
   setBusy(false);
  }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return (
  <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
   <div className="send-modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="panel-title"><h3>Send CKB</h3><button disabled={busy} onClick={onClose}><X size={18}/></button></div>
    <form onSubmit={submit}>
     <label>Recipient address<input value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={busy} placeholder={signer?.client.addressPrefix === "ckb" ? "ckb1..." : "ckt1..."} required /></label>
     <label>Amount (CKB)<input disabled={busy} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required /></label>
     <button className="primary" disabled={!signer || busy}>{busy ? "Processing..." : "Build, sign & send"}</button>
    </form>
    {message && <div className="tx-message">{message}</div>}
   </div>
  </div>
 );
}
