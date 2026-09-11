import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { FormEvent, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { createSporeCluster, transferSporeCluster } from "@ckb-ccc/spore";
import { recordSubmittedAsset } from "../../utils/submission";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { TransactionLifecycle } from "../../components/transactions/TransactionLifecycle";

export function SporeClusterPage() {
 const featureConsoleScope = currentScope();

 const signer = useFeatureSigner();
 const [name, setName] = useState("CKBuilder Collection");
 const [description, setDescription] = useState("A curated collection of on-chain DOBs.");
 const [clusterId, setClusterId] = useState("");
 const [recipient, setRecipient] = useState("");
 const [txHash, setTxHash] = useState("");
 const [status, setStatus] = useState("");
 const [busy, setBusy] = useState(false);

 async function create(event: FormEvent) {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'create');
 try {

  event.preventDefault();
  if (!signer) return;
  setBusy(true);
  try {
   const ownerAddress = await signer.getRecommendedAddress();
   setStatus("Building Cluster transaction...");
   const { tx, id } = await createSporeCluster({ signer, data: { name: name.trim(), description: description.trim() } });
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer, 2000);
   const hash = await signer.sendTransaction(tx);
   setClusterId(id); setTxHash(hash);
   setStatus(await recordSubmittedAsset(signer.client, {
    assetKind: "CLUSTER", action: "CREATE", assetId: id, ownerAddress,
    displayName: name.trim(), txHash: hash,
    metadataJson: JSON.stringify({ description: description.trim() }),
   }));
  } catch (e) { featureOperation.fail(e);  setStatus(e instanceof Error ? e.message : String(e)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 async function transfer() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'transfer');
 try {

  if (!signer || !clusterId.trim() || !recipient.trim()) return;
  setBusy(true);
  try {
   const ownerAddress = await signer.getRecommendedAddress();
   const { script: to } = await ccc.Address.fromString(recipient.trim(), signer.client);
   const { tx } = await transferSporeCluster({ signer, id: clusterId.trim(), to });
   await tx.completeInputsByCapacity(signer);
   await tx.completeFeeBy(signer, 1000);
   const hash = await signer.sendTransaction(tx);
   setTxHash(hash);
   setStatus(await recordSubmittedAsset(signer.client, {
    assetKind: "CLUSTER", action: "TRANSFER", assetId: clusterId.trim(), ownerAddress,
    displayName: name.trim(), txHash: hash,
    metadataJson: JSON.stringify({ recipient: recipient.trim() }),
   }));
  } catch (e) { featureOperation.fail(e);  setStatus(e instanceof Error ? e.message : String(e)); }
  finally { setBusy(false); }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

 return <AppLayout>
  <PageHero eyebrow="Spore Protocol · Collections" title="Spore Cluster Studio" description="Create named on-chain collections, attach new Spores to a Cluster ID, and transfer collection ownership." />
  <div className="token-product-grid">
   <section className="panel">
    <form className="product-form" onSubmit={create}>
     <label>Cluster name<input value={name} onChange={e => setName(e.target.value)} maxLength={128} required /></label>
     <label>Description<textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} /></label>
     <button className="primary action-wide" disabled={busy}>{busy ? "Processing..." : "Create Cluster"}</button>
    </form>
    <div className="separator" />
    <label className="standalone-label">Cluster ID<input value={clusterId} onChange={e => setClusterId(e.target.value)} placeholder="0x..." /></label>
    <label className="standalone-label">New owner<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="ckt1..." /></label>
    <button className="secondary action-wide" disabled={busy || !clusterId || !recipient} onClick={() => void transfer()}>Transfer Cluster</button>
    {status && <p className="status-line">{status}</p>}
   </section>
   <section className="panel">
    <span className="page-eyebrow">Cluster identity</span>
    <div className="result-field"><span>Cluster ID</span><code>{clusterId || "—"}</code></div>
    <div className="result-field"><span>Transaction Hash</span><code>{txHash || "—"}</code></div>
    {txHash && <TransactionLifecycle txHash={txHash}/>}
   </section>
  </div>
 </AppLayout>;
}
