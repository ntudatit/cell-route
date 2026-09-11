import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useMemo, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { recordSubmittedAsset } from "../../utils/submission";
import { TransactionLifecycle } from "../../components/transactions/TransactionLifecycle";
import { parseUnits } from "../../utils/units";

type TokenCell = {
 outPoint: string;
 ownerLockHash: string;
 rawAmount: string;
};

const safeJson = (value: unknown) =>
 JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);

async function buildXudtType(signer: ccc.Signer, args: string) {
 return ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, args);
}

export function FungibleTokenPage() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [name, setName] = useState("CKBuilder Token");
 const [symbol, setSymbol] = useState("CKBT");
 const [decimals, setDecimals] = useState(8);
 const [tokenArgs, setTokenArgs] = useState("");
 const [receiver, setReceiver] = useState("");
 const [amount, setAmount] = useState("1000");
 const [status, setStatus] = useState("");
 const [txHash, setTxHash] = useState("");
 const [preview, setPreview] = useState("");
 const [tokenCells, setTokenCells] = useState<TokenCell[]>([]);
 const [busy, setBusy] = useState(false);

 const rawAmount = useMemo(() => {
  try { return parseUnits(amount, decimals).toString(); } catch { return "—"; }
 }, [amount, decimals]);

 async function useMyLockAsIssuer() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'useMyLockAsIssuer');
 try {

  if (!signer) return;
  const owner = await signer.getRecommendedAddressObj();
  // The official CKB xUDT tutorial uses issuer lock hash + 4-byte extension placeholder.
  setTokenArgs(`${owner.script.hash()}00000000`);
  if (!receiver) setReceiver(await signer.getRecommendedAddress());

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function issueOrMint(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'issueOrMint');
 try {

  event.preventDefault();
  if (!signer) return setStatus("Connect a wallet first.");
  setBusy(true);
  try {
   setStatus("Building xUDT mint transaction...");
   const owner = await signer.getRecommendedAddressObj();
   const ownerAddress = await signer.getRecommendedAddress();
   const args = tokenArgs.trim() || `${owner.script.hash()}00000000`;
   setTokenArgs(args);
   const destination = receiver.trim() || ownerAddress;
   setReceiver(destination);
   const { script: to } = await ccc.Address.fromString(destination, signer.client);
   const xUdtType = await buildXudtType(signer, args);
   const raw = parseUnits(amount, decimals);

   const tx = ccc.Transaction.from({
    outputs: [{ lock: to, type: xUdtType }],
    outputsData: [ccc.numLeToBytes(raw, 16)],
   });
   await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer, 1000);
   setPreview(safeJson(tx));

   const hash = await signer.sendTransaction(tx);
   setTxHash(hash);
   setStatus("xUDT mint submitted. Recording asset audit event...");
   setStatus(await recordSubmittedAsset(signer.client, {
    assetKind: "XUDT", action: "MINT", assetId: args, ownerAddress,
    displayName: name.trim(), symbol: symbol.trim().toUpperCase(), amount,
    txHash: hash,
    metadataJson: JSON.stringify({ decimals, receiver: destination, rawAmount: raw.toString() }),
   }));
  } catch (error) { featureOperation.fail(error);
   setStatus(error instanceof Error ? error.message : String(error));
  } finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function transfer() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'transfer');
 try {

  if (!signer) return setStatus("Connect a wallet first.");
  if (!tokenArgs.trim()) return setStatus("Token Args are required for transfer.");
  setBusy(true);
  try {
   setStatus("Building xUDT transfer transaction...");
   const ownerAddress = await signer.getRecommendedAddress();
   const { script: to } = await ccc.Address.fromString(receiver.trim(), signer.client);
   const { script: change } = await signer.getRecommendedAddressObj();
   const xUdtType = await buildXudtType(signer, tokenArgs.trim());
   const raw = parseUnits(amount, decimals);
   const tx = ccc.Transaction.from({
    outputs: [{ lock: to, type: xUdtType }],
    outputsData: [ccc.numLeToBytes(raw, 16)],
   });
   await tx.completeInputsByUdt(signer, xUdtType);
   const balanceDiff = (await tx.getInputsUdtBalance(signer.client, xUdtType)) - tx.getOutputsUdtBalance(xUdtType);
   if (balanceDiff > ccc.Zero) tx.addOutput({ lock: change, type: xUdtType }, ccc.numLeToBytes(balanceDiff, 16));
   await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer, 2000);
   setPreview(safeJson(tx));
   const hash = await signer.sendTransaction(tx);
   setTxHash(hash);
   setStatus(await recordSubmittedAsset(signer.client, {
    assetKind: "XUDT", action: "TRANSFER", assetId: tokenArgs.trim(), ownerAddress,
    displayName: name.trim(), symbol: symbol.trim().toUpperCase(), amount, txHash: hash,
    metadataJson: JSON.stringify({ decimals, receiver: receiver.trim(), rawAmount: raw.toString() }),
   }));
  } catch (error) { featureOperation.fail(error);
   setStatus(error instanceof Error ? error.message : String(error));
  } finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function queryTokenCells() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'queryTokenCells');
 try {

  if (!signer) return setStatus("Connect a wallet first.");
  if (!tokenArgs.trim()) return setStatus("Token Args are required to query holders.");
  setBusy(true);
  try {
   setStatus("Querying live xUDT Cells from the connected network...");
   const xUdtType = await buildXudtType(signer, tokenArgs.trim());
   const cells: TokenCell[] = [];
   for await (const cell of signer.client.findCellsByType(xUdtType, true, "desc", 100)) {
    cells.push({
     outPoint: `${cell.outPoint.txHash}:${cell.outPoint.index}`,
     ownerLockHash: cell.cellOutput.lock.hash(),
     rawAmount: ccc.udtBalanceFrom(cell.outputData).toString(),
    });
   }
   setTokenCells(cells);
   setStatus(`Found ${cells.length} live xUDT Cell${cells.length === 1 ? "" : "s"}.`);
  } catch (error) { featureOperation.fail(error);
   setStatus(error instanceof Error ? error.message : String(error));
  } finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return <AppLayout>
  <PageHero eyebrow="Asset Studio · CCC · xUDT" title="Token Studio" description="Issue, mint and transfer xUDT assets with wallet signing, exact u128 token amounts and backend audit history." />
  <div className="asset-pro-banner"><strong>Production-style flow</strong><span>Wallet signs client-side → CKB validates xUDT → Rust API stores searchable asset audit metadata.</span></div>
  <div className="token-product-grid">
   <section className="panel">
    <form className="product-form" onSubmit={issueOrMint}>
     <div className="form-grid-2">
      <label>Token Name<input value={name} maxLength={128} onChange={e=>setName(e.target.value)} required /></label>
      <label>Symbol<input value={symbol} maxLength={16} onChange={e=>setSymbol(e.target.value.toUpperCase())} required /></label>
     </div>
     <label>Decimals<input type="number" min="0" max="18" value={decimals} onChange={e=>setDecimals(Number(e.target.value))}/></label>
     <label>Token Args / xUDT ID<input value={tokenArgs} onChange={e=>setTokenArgs(e.target.value)} placeholder="issuer lock hash + 00000000" /></label>
     <button className="btn secondary action-wide" type="button" onClick={()=>void useMyLockAsIssuer()}>Generate xUDT ID From My Wallet</button>
     <label>Receiver<input value={receiver} onChange={e=>setReceiver(e.target.value)} placeholder="ckt1..." required /></label>
     <label>Human Amount<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" required /></label>
     <div className="result-field"><span>Raw u128 amount</span><code>{rawAmount}</code></div>
     <div className="buttonRow">
      <button className="primary" disabled={busy} type="submit">{busy ? "Processing..." : "Create / Mint xUDT"}</button>
      <button className="secondary" type="button" disabled={busy || !tokenArgs} onClick={()=>void transfer()}>Transfer</button>
     </div>
    </form>
    {status && <p className="status-line">{status}</p>}
   </section>
   <section className="panel token-result-panel">
    <span className="page-eyebrow">Asset Identity</span>
    <div className="asset-title-row"><div><strong>{name || "Unnamed Token"}</strong><span>{symbol || "—"} · {decimals} decimals</span></div><span className="asset-kind-pill">xUDT</span></div>
    <div className="result-field"><span>xUDT Args</span><code>{tokenArgs || "—"}</code></div>
    <div className="result-field"><span>Transaction Hash</span><code>{txHash || "—"}</code></div>
    <button className="btn secondary action-wide" type="button" disabled={busy || !tokenArgs} onClick={()=>void queryTokenCells()}>Query Live Token Cells</button>
    {tokenCells.length > 0 && <div className="token-cell-list">
     {tokenCells.map(cell => <details key={cell.outPoint}><summary>{cell.rawAmount} raw units</summary><div className="result-field"><span>Owner lock hash</span><code>{cell.ownerLockHash}</code></div><div className="result-field"><span>OutPoint</span><code>{cell.outPoint}</code></div></details>)}
    </div>}
    {txHash && <TransactionLifecycle txHash={txHash}/>}
    {preview && <details><summary>Transaction JSON</summary><pre>{preview}</pre></details>}
   </section>
  </div>
 </AppLayout>;
}
