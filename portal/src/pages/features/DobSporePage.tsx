import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { createSpore, findSpore, meltSpore, transferSpore } from "@ckb-ccc/spore";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { recordSubmittedAsset } from "../../utils/submission";
import { TransactionLifecycle } from "../../components/transactions/TransactionLifecycle";

export function DobSporePage() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [name, setName] = useState("My CKB Spore");
 const [textContent, setTextContent] = useState("Hello, Spore!");
 const [file, setFile] = useState<File | null>(null);
 const [clusterId, setClusterId] = useState("");
 const [sporeId, setSporeId] = useState("");
 const [recipient, setRecipient] = useState("");
 const [status, setStatus] = useState("");
 const [txHash, setTxHash] = useState("");
 const [busy, setBusy] = useState(false);
 const [onChainContent, setOnChainContent] = useState<{ contentType: string; bytes: Uint8Array; clusterId?: string } | null>(null);
 const previewUrl = useMemo(() => file && file.type.startsWith("image/") ? URL.createObjectURL(file) : "", [file]);

 async function mint(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'mint');
 try {

  event.preventDefault();
  if (!signer) return setStatus("Connect a wallet first.");
  setBusy(true);
  try {
   const ownerAddress = await signer.getRecommendedAddress();
   const content = file ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(textContent);
   const contentType = file?.type || "text/plain";
   if (content.byteLength === 0) throw new Error("Spore content cannot be empty.");
   setStatus(`Building Spore Cell (${content.byteLength.toLocaleString()} bytes)...`);

   const data: { contentType: string; content: Uint8Array; clusterId?: string } = { contentType, content };
   if (clusterId.trim()) data.clusterId = clusterId.trim();
   const { tx, id } = await createSpore({
    signer, data,
    ...(clusterId.trim() ? { clusterMode: "clusterCell" as const } : {}),
   });
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer, 2000);
   const hash = await signer.sendTransaction(tx);
   setSporeId(id); setTxHash(hash);
   setStatus(await recordSubmittedAsset(signer.client, {
    assetKind: "SPORE", action: "MINT", assetId: id, ownerAddress,
    displayName: name.trim(), txHash: hash,
    metadataJson: JSON.stringify({ contentType, bytes: content.byteLength, clusterId: clusterId.trim() || null, fileName: file?.name || null }),
   }));
  } catch (error) { featureOperation.fail(error);  setStatus(error instanceof Error ? error.message : String(error)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function transfer() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'transfer');
 try {

  if (!signer || !sporeId || !recipient) return;
  setBusy(true);
  try {
   const ownerAddress = await signer.getRecommendedAddress();
   setStatus("Building Spore transfer...");
   const { script: to } = await ccc.Address.fromString(recipient.trim(), signer.client);
   const { tx } = await transferSpore({ signer, id: sporeId.trim(), to });
   await tx.completeInputsByCapacity(signer); await tx.completeFeeBy(signer, 1000);
   const hash = await signer.sendTransaction(tx); setTxHash(hash);
   setStatus(await recordSubmittedAsset(signer.client, { assetKind:"SPORE", action:"TRANSFER", assetId:sporeId.trim(), ownerAddress, displayName:name.trim(), txHash:hash, metadataJson:JSON.stringify({ recipient: recipient.trim() }) }));
  } catch (error) { featureOperation.fail(error);  setStatus(error instanceof Error ? error.message : String(error)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function melt() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'melt');
 try {

  if (!signer || !sporeId) return;
  if (!window.confirm("Melt this Spore? The Spore Cell will be consumed and this is irreversible.")) return;
  setBusy(true);
  try {
   const ownerAddress = await signer.getRecommendedAddress();
   setStatus("Melting Spore...");
   const { tx } = await meltSpore({ signer, id: sporeId.trim() });
   await tx.completeFeeBy(signer, 1000);
   const hash = await signer.sendTransaction(tx); setTxHash(hash);
   setStatus(await recordSubmittedAsset(signer.client, { assetKind:"SPORE", action:"MELT", assetId:sporeId.trim(), ownerAddress, displayName:name.trim(), txHash:hash }));
  } catch (error) { featureOperation.fail(error);  setStatus(error instanceof Error ? error.message : String(error)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function readFromChain() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'readFromChain');
 try {

  if (!signer) return setStatus("Connect a wallet first.");
  if (!sporeId.trim()) return setStatus("Enter a Spore ID first.");
  setBusy(true);
  try {
   setStatus("Finding the live Spore Cell and decoding its on-chain data...");
   const found = await findSpore(signer.client, sporeId.trim());
   if (!found) throw new Error("No live Spore Cell was found. It may be pending, transferred on another network, or melted.");
   const bytes = ccc.bytesFrom(found.sporeData.content);
   setOnChainContent({
    contentType: found.sporeData.contentType,
    bytes,
    clusterId: found.sporeData.clusterId ? ccc.hexFrom(found.sporeData.clusterId) : undefined,
   });
   setStatus(`Decoded ${bytes.length.toLocaleString()} bytes from the live Spore Cell.`);
  } catch (error) { featureOperation.fail(error);  setStatus(error instanceof Error ? error.message : String(error)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 const onChainUrl = useMemo(() => {
  if (!onChainContent || !onChainContent.contentType.startsWith("image/")) return "";
  const copy = new Uint8Array(onChainContent.bytes.byteLength);
  copy.set(onChainContent.bytes);
  return URL.createObjectURL(new Blob([copy.buffer], { type: onChainContent.contentType }));
 }, [onChainContent]);
 useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
 useEffect(() => () => { if (onChainUrl) URL.revokeObjectURL(onChainUrl); }, [onChainUrl]);

 return <AppLayout>
  <PageHero eyebrow="Asset Studio · CCC · Spore" title="Spore / DOB Studio" description="Mint text, images or binary files fully on-chain as Spore digital objects, optionally attach a Cluster ID, then transfer or melt them." />
  <div className="asset-pro-banner"><strong>Fully on-chain content</strong><span>The selected file bytes are encoded into the Spore Cell; your wallet remains the signer.</span></div>
  <div className="dob-product-grid">
   <section className="panel">
    <form className="product-form" onSubmit={mint}>
     <label>Display Name<input value={name} onChange={e=>setName(e.target.value)} maxLength={128}/></label>
     <label>Optional Cluster ID<input value={clusterId} onChange={e=>setClusterId(e.target.value)} placeholder="0x..." /></label>
     <label>Upload content<input type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)} /></label>
     {!file && <label>Or mint text content<textarea rows={6} value={textContent} onChange={e=>setTextContent(e.target.value)}/></label>}
     {file && <div className="file-preview-card"><strong>{file.name}</strong><span>{file.type || "application/octet-stream"} · {file.size.toLocaleString()} bytes</span>{previewUrl && <img src={previewUrl} alt="Spore preview"/>}<button type="button" className="link-button" onClick={()=>setFile(null)}>Use text instead</button></div>}
     <button className="primary action-wide" disabled={busy}>{busy ? "Processing..." : "Mint Spore"}</button>
    </form>
    <div className="separator"/>
    <label className="standalone-label">Spore ID<input value={sporeId} onChange={e=>setSporeId(e.target.value)} placeholder="0x..."/></label>
    <label className="standalone-label">New Owner<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="ckt1..."/></label>
    <div className="buttonRow"><button className="secondary" disabled={busy || !sporeId} onClick={()=>void readFromChain()}>Read On-chain</button><button className="secondary" disabled={busy || !sporeId || !recipient} onClick={()=>void transfer()}>Transfer</button><button className="danger" disabled={busy || !sporeId} onClick={()=>void melt()}>Melt</button></div>
   </section>
   <section className="panel dob-result-panel">
    <span className="page-eyebrow">DOB Result</span>
    <div className="asset-title-row"><div><strong>{name}</strong><span>{file?.type || "text/plain"}</span></div><span className="asset-kind-pill">Spore</span></div>
    <div className="result-field"><span>Spore ID</span><code>{sporeId || "—"}</code></div>
    <div className="result-field"><span>Cluster ID</span><code>{clusterId || "Standalone"}</code></div>
    <div className="result-field"><span>Transaction Hash</span><code>{txHash || "—"}</code></div>
    {onChainContent && <div className="file-preview-card"><strong>Decoded from live Cell</strong><span>{onChainContent.contentType} · {onChainContent.bytes.length.toLocaleString()} bytes</span>{onChainContent.clusterId && <code>{onChainContent.clusterId}</code>}{onChainUrl ? <img src={onChainUrl} alt="On-chain Spore content"/> : onChainContent.contentType.startsWith("text/") ? <pre>{new TextDecoder().decode(onChainContent.bytes)}</pre> : <code>{ccc.hexFrom(onChainContent.bytes)}</code>}</div>}
    {txHash && <TransactionLifecycle txHash={txHash}/>}
    {status && <p className="status-line">{status}</p>}
   </section>
  </div>
 </AppLayout>;
}
