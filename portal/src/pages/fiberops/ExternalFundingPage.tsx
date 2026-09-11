import { currentScope } from '../../dev-console/features';
import { beginOperation } from '../../dev-console/store';
import { useFeatureSigner } from '../../dev-console/hooks';
import { useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { CheckCircle2, PenLine, XCircle } from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { assertOnlyWitnessesChanged, cccTransactionToRpc, fiberFundingStore, rpcTransactionToCcc } from "../../fiber-wasm/funding";
import { fiberErrorMessage } from "../../fiber-wasm/runtime";

export function ExternalFundingPage() {
 const featureConsoleScope = currentScope();

  const signer = useFeatureSigner();
  const draft = fiberFundingStore.get();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signFunding() {
 const featureOperation = beginOperation(featureConsoleScope, 'action', 'signFunding');
 try {

    if (!signer || !draft) return;
    setBusy(true); setError("");
    try {
      const signed = await signer.signTransaction(rpcTransactionToCcc(draft.unsignedTransaction));
      const signedTransaction = cccTransactionToRpc(signed);
      assertOnlyWitnessesChanged(draft.unsignedTransaction, signedTransaction);
      fiberFundingStore.set({ ...draft, signedTransaction });
      window.location.assign(draft.returnUrl || "/fiber-node?funding=submit");
    } catch (e) { featureOperation.fail(e);
      setError(fiberErrorMessage(e));
    } finally {
      setBusy(false);
    }

 } catch (featureError) { featureOperation.fail(featureError); throw featureError; } finally { featureOperation.complete(); }
}

  return <AppLayout>
    <PageHero eyebrow="Channel Funding" title="Review funding transaction" description="Approve the channel funding transaction with your connected CKB wallet." />
    {!draft && <section className="panel funding-review-state"><XCircle/><h2>No pending funding transaction</h2><a className="btn secondary" href="/fiber-node">Return to Fiber Node</a></section>}
    {draft && <section className="panel funding-review-card">
      <div className="funding-review-row"><span>Channel ID</span><code>{draft.channelId}</code></div>
      <div className="funding-review-row"><span>Inputs</span><strong>{draft.unsignedTransaction.inputs.length}</strong></div>
      <div className="funding-review-row"><span>Outputs</span><strong>{draft.unsignedTransaction.outputs.length}</strong></div>
      <div className="funding-review-row"><span>Wallet</span><strong>{signer ? "Connected" : "Not connected"}</strong></div>
      {error && <div className="ops-alert critical">{error}</div>}
      <button className="btn primary" disabled={busy || !signer} onClick={() => void signFunding()}><PenLine size={16}/>{busy ? "Waiting for wallet..." : "Sign funding transaction"}</button>
      {signer && <div className="funding-ready"><CheckCircle2 size={15}/> Ready for wallet approval</div>}
    </section>}
  </AppLayout>;
}
