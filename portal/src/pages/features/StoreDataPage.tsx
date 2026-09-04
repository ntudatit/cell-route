import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { Copy } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { backendApi } from "../../api/backend";

function utf8ToHex(value: string): `0x${string}` {
 const bytes = new TextEncoder().encode(value);
 return `0x${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
}

function hexToUtf8(value: string) {
 const clean = value.startsWith("0x") ? value.slice(2) : value;
 const bytes = new Uint8Array(
  (clean.match(/.{1,2}/g) ?? []).map(pair => Number.parseInt(pair, 16)),
 );
 return new TextDecoder().decode(bytes);
}

export function StoreDataPage() {
 const signer = ccc.useSigner();
 const [message, setMessage] = useState("Hello CKB! This is stored on cell via CCC.");
 const [feeRate, setFeeRate] = useState("1000");
 const [encoded, setEncoded] = useState("");
 const [txHash, setTxHash] = useState("");
 const [decoded, setDecoded] = useState("");
 const [status, setStatus] = useState("");

 async function store(event: FormEvent) {
  event.preventDefault();
  if (!signer) {
   setStatus("Connect a wallet first.");
   return;
  }

  try {
   setStatus("Creating Cell with data...");
   const owner = await signer.getRecommendedAddressObj();
   const data = utf8ToHex(message);
   const tx = ccc.Transaction.from({
    outputs: [{
     lock: owner.script,
    }],
    outputsData: [data],
   });

   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer, Number(feeRate));

   const hash = await signer.sendTransaction(tx);
   setEncoded(data);
   setTxHash(hash);
   setStatus("Transaction submitted. The output Cell contains your UTF-8 bytes.");

   await backendApi.trackTransaction({
    txHash: hash,
    walletAddress: await signer.getRecommendedAddress(),
    amountCkb: ccc.fixedPointToString(tx.outputs[0].capacity),
    direction: "SEND",
   });
  } catch (error) {
   setStatus(error instanceof Error ? error.message : String(error));
  }
 }

 async function readOutput() {
  if (!signer || !txHash) return;

  try {
   setStatus("Reading output #0...");
   const cell = await signer.client.getCellLive(
    { txHash, index: "0x0" },
    true,
   );

   if (!cell) {
    setStatus("Output is not live yet. Wait for confirmation and try again.");
    return;
   }

   setDecoded(hexToUtf8(cell.outputData));
   setStatus("Live Cell data decoded successfully.");
  } catch (error) {
   setStatus(error instanceof Error ? error.message : String(error));
  }
 }

 return (
  <AppLayout>
   <PageHero
    eyebrow="CKB Cell Data"
    title="Store Data on Cell"
    description="Encode UTF-8 text into outputsData, store it in a CKB Cell, then read and decode the live output."
   />

   <div className="store-data-grid">
    <section className="panel">
     <form className="product-form" onSubmit={store}>
      <label>
       Data (UTF-8)
       <textarea rows={6} value={message} onChange={e => setMessage(e.target.value)}/>
      </label>

      <label>
       Fee Rate (Shannons/KB)
       <input value={feeRate} onChange={e => setFeeRate(e.target.value)} type="number"/>
      </label>

      <button className="primary action-wide">Store Data</button>
     </form>

     {status && <p className="status-line">{status}</p>}
    </section>

    <section className="panel result-panel">
     <span className="page-eyebrow">Result</span>

     <div className="result-field">
      <span>Transaction Hash</span>
      <div>
       <code>{txHash || "—"}</code>
       {txHash && (
        <button className="copy-mini" onClick={() => navigator.clipboard.writeText(txHash)}>
         <Copy size={14}/>
        </button>
       )}
      </div>
     </div>

     <div className="result-field">
      <span>Output Index</span>
      <strong>0</strong>
     </div>

     <div className="result-field">
      <span>Cell Data (Hex)</span>
      <code>{encoded || "—"}</code>
     </div>

     <button className="btn secondary action-wide" disabled={!txHash} onClick={() => void readOutput()}>
      Read Live Cell
     </button>

     <div className="result-field">
      <span>Cell Data (UTF-8)</span>
      <strong>{decoded || "—"}</strong>
     </div>
    </section>
   </div>
  </AppLayout>
 );
}
