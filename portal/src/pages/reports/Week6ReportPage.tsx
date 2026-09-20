import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import evidence from "../../../../contracts/deployment/week6-evidence.json";
import report from "../../../../README-WEEK-6.md?raw";
import guide from "../../../../docs/week-6-response-check.md?raw";
import "./week-report.css";

const rpcUrl = "http://127.0.0.1:28114";
type Check = { status: string; detail: string };

async function rpc(method: string, params: string[]): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "JSON-RPC error");
  if (!("result" in body)) throw new Error("Invalid JSON-RPC response");
  return body.result;
}

export function Week6ReportPage() {
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Not checked this session. Recorded evidence is separate from live node status.");

  async function checkTransactions() {
    setBusy(true);
    setChecks({});
    setMessage("Checking local Devnet genesis and recorded transactions…");
    try {
      const genesis = await rpc("get_block_hash", ["0x0"]);
      if (genesis !== evidence.genesisHash) throw new Error("Genesis mismatch. Export metadata and rerun the Week 6 demo on this Devnet.");
      const entries = await Promise.all(evidence.runs.flatMap(run => run.transactions).map(async tx => {
        try {
          const result = await rpc("get_transaction", [tx.txHash]);
          if (!result) return [tx.txHash, { status: "Unavailable", detail: "This node has no record of the transaction. The chain may have been reset." }] as const;
          const status = result.tx_status?.status;
          if (typeof status !== "string") throw new Error("Missing transaction status in response");
          if (status === "committed" && !result.tx_status.block_hash) throw new Error("Committed response is missing its block hash");
          return [tx.txHash, { status, detail: JSON.stringify(result.tx_status, null, 2) }] as const;
        } catch (error) {
          return [tx.txHash, { status: "Error", detail: error instanceof Error ? error.message : String(error) }] as const;
        }
      }));
      setChecks(Object.fromEntries(entries));
      const count = entries.filter(([, check]) => check.status === "committed").length;
      setMessage(`${count}/${entries.length} transactions confirmed committed on local Devnet. Checked ${new Date().toLocaleString()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <AppLayout>
    <div className="week-report">
      <PageHero eyebrow="Weekly reports · OffCKB Devnet" title="Week 6 Report" description="sUDT and basic xUDT: mint, transfer, burn, and verify transaction responses." actions={<Link className="btn secondary" to="/fungible-token">Open Token Lab</Link>} />
      <section className="panel">
        <h2>What was delivered</h2>
        <p>Token Lab supports owner-authorized minting, transfers with token change, and explicit burns. Transaction review checks token accounting, deployment identity, wallet changes, and live inputs.</p>
        <div className="week-report-summary">
          <div><strong>2 standards</strong><span>sUDT and basic xUDT</span></div>
          <div><strong>6 recorded commits</strong><span>Evidence: {new Date(evidence.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</span></div>
          <div><strong>2 rejected mints</strong><span>Recorded script exit code −52</span></div>
        </div>
        <p>Local checks on September 19, 2026: 11/11 native sUDT tests and 8/8 portal token tests passed. The artifact command verifies a pinned binary; compilation from C source has not been verified.</p>
        <div className="week-report-links">
          <a download="week6-evidence.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(evidence, null, 2))}`}>Download evidence JSON</a>
          <a download="README-WEEK-6.md" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(report)}`}>Download full report</a>
          <a download="week-6-response-check.md" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(guide)}`}>Download Vietnamese check guide</a>
        </div>
      </section>
      <section className="panel">
        <h2>Check recorded transactions</h2>
        <p>The checker reads your local OffCKB node at <code>{rpcUrl}</code>, independently of the wallet network shown in the header. No wallet is required and no transactions are submitted.</p>
        <p>Start <code>offckb node</code> before checking. Old hashes may be unavailable after a reset, even when the genesis hash matches. Browser local-network permissions or CORS can block access; use the downloaded PowerShell guide if needed.</p>
        <button className="btn primary" disabled={busy} onClick={() => void checkTransactions()}>{busy ? "Checking…" : "Check local Devnet responses"}</button>
        <p role="status" aria-live="polite">{message}</p>
        {evidence.runs.map(run => <section key={run.standard} className="week-report-standard">
          <h3>{run.standard}</h3>
          <p>Recorded unauthorized mint: rejected with exit code <strong>{run.unauthorizedMint.expectedExitCode}</strong>. This read-only check does not repeat the rejection test.</p>
          <div className="week-report-table"><table>
            <caption>{run.standard} transaction evidence and live responses</caption>
            <thead><tr><th>Action / hash</th><th>Token input → output</th><th>Owner / holder</th><th>Recorded</th><th>Live response</th></tr></thead>
            <tbody>{run.transactions.map(tx => <tr key={tx.txHash}>
              <td><strong>{tx.action}</strong><code className="week-report-hash">{tx.txHash}</code></td>
              <td>{tx.inputAmount} → {tx.outputAmount}</td><td>{tx.ownerBalance} / {tx.holderBalance}</td><td>{tx.status}</td>
              <td>{checks[tx.txHash] ? <><strong>{checks[tx.txHash].status}</strong><details><summary>Response details</summary><pre>{checks[tx.txHash].detail}</pre></details></> : "Not checked"}</td>
            </tr>)}</tbody>
          </table></div>
        </section>)}
        <p>Amounts are raw token units. Mint: holder receives 1,000; transfer: owner receives 250; burn: holder removes 50. Final balances are owner 250 and holder 700 per standard.</p>
      </section>
      <section className="panel">
        <h2>How to check a response</h2>
        <ol>
          <li>Open Token Lab on Devnet, select a standard, and prepare a mint, transfer, or burn. Review the transaction before signing.</li>
          <li>Open DevTools → Network → Fetch/XHR. Select the local RPC request and inspect its method, result, and error fields.</li>
          <li>A transaction hash confirms submission only. Query <code>get_transaction</code> until <code>result.tx_status.status</code> is <code>committed</code> with a block hash.</li>
          <li><code>pending</code> or <code>proposed</code> means wait and query again; a null result means the node cannot find that hash. HTTP 200 alone does not prove success.</li>
          <li>Refresh live token balances. Use the Dev Console for operation summaries and the downloaded guide for PowerShell checks.</li>
        </ol>
        <details><summary>Reproduce the local demo</summary><p>Install dependencies in portal and contracts, then start OffCKB in a separate terminal. From the repository root:</p><pre>{`offckb system-scripts --output contracts/deployment/week6-system-scripts.json
cd contracts
npm run week6:build
npm run week6:export
npm run week6:test
npm run week6:demo`}</pre><p>The demo writes fresh evidence using ephemeral wallets and local funds. Restart or rebuild the portal to include regenerated evidence.</p></details>
      </section>
    </div>
  </AppLayout>;
}
