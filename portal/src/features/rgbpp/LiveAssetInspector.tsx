import { configuredNetwork } from "../../utils/network";
import { useEffect, useRef, useState } from "react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { inspectAsset, type AssetQuery } from "./live";
import { profiles } from "./profiles";
import { currentScope, setFeatureNetwork } from "../../dev-console/features";
import { traceCall } from "../../dev-console/store";
export function LiveAssetInspector({ onFixture }: { onFixture: () => void }) {
  const [query, setQuery] = useState<AssetQuery>({
    network: configuredNetwork === "mainnet" ? "mainnet" : "testnet3",
    kind: "cell",
    txid: "",
    index: 0,
  });
  const [receipt, setReceipt] =
    useState<Awaited<ReturnType<typeof inspectAsset>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController>();
  useEffect(() => {
    setFeatureNetwork(
      "/rgbpp",
      query.network === "mainnet" ? "mainnet" : "testnet",
    );
    return () => setFeatureNetwork("/rgbpp");
  }, [query.network]);
  useEffect(() => () => active.current?.abort(), []);
  function change(next: AssetQuery) {
    active.current?.abort();
    setQuery(next);
    setReceipt(undefined);
    setError("");
    setBusy(false);
  }
  async function run(cursor?: string) {
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setError("");
    setReceipt(undefined);
    try {
      const result = await traceCall(
        currentScope(),
        "api",
        "RGBPP.inspectAsset",
        () => inspectAsset({ ...query, cursor }, { signal: controller.signal }),
      );
      if (!controller.signal.aborted) setReceipt(result);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      if (active.current === controller) setBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(receipt, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "rgbpp-live-inspection.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <AppLayout>
      <PageHero
        eyebrow="Live blockchain tools"
        title="RGB++ Inspector"
        description="Look up your own asset by CKB OutPoint or Bitcoin UTXO. Data comes directly from node/indexer and Bitcoin APIs."
      />
      <section className="panel product-form rgbpp-panel">
        <p>
          Read-only. Bitcoin transaction inclusion is checked against the
          supplied block header when available. Full RGB++ SPV/lock execution
          remains a separate verification boundary.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label>
            Network pair
            <select
              value={query.network}
              onChange={(e) =>
                change({
                  ...query,
                  network: e.target.value as AssetQuery["network"],
                })
              }
            >
              {Object.entries(profiles).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lookup by
            <select
              value={query.kind}
              onChange={(e) =>
                change({ ...query, kind: e.target.value as AssetQuery["kind"] })
              }
            >
              <option value="cell">
                CKB Cell OutPoint (including historical)
              </option>
              <option value="utxo">
                Bitcoin UTXO (discover indexed live Cells)
              </option>
            </select>
          </label>
          <label>
            {query.kind === "cell"
              ? "CKB transaction hash"
              : "Bitcoin transaction ID"}
            <input
              required
              value={query.txid}
              onChange={(e) => change({ ...query, txid: e.target.value })}
              placeholder="Enter your transaction identifier"
            />
          </label>
          <label>
            Output index
            <input
              required
              type="number"
              min="0"
              max="4294967295"
              value={query.index}
              onChange={(e) =>
                change({ ...query, index: Number(e.target.value) })
              }
            />
          </label>
          <div className="rgbpp-actions">
            <button
              className="btn primary"
              disabled={busy || !query.txid.trim()}
            >
              Inspect asset
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!busy}
              onClick={() => {
                active.current?.abort();
                setBusy(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
        {busy && <p role="status">Reading current chain data…</p>}
        {error && <p role="alert">{error}</p>}
        {receipt && (
          <section aria-label="Live asset results">
            <h2>Live asset results</h2>
            <p>Lookup status: {receipt.status}</p>
            <p>
              {receipt.network} · {receipt.observedAt}
            </p>
            <p>
              Indexer: {receipt.indexerStatus}. Returned Cells are checked
              against node data; no matches does not prove no historical assets.
            </p>
            <div className="rgbpp-chains">
              <div>
                <h3>Bitcoin UTXO / inclusion</h3>
                <pre>{JSON.stringify(receipt.bitcoin, null, 2)}</pre>
              </div>
              <div>
                <h3>CKB Cells ({receipt.cells.length})</h3>
                <pre>{JSON.stringify(receipt.cells, null, 2)}</pre>
              </div>
            </div>
            <p>
              RGB++ proof: {receipt.proof.status}. Cross-chain completion is not
              inferred.
            </p>
            {receipt.cursor && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => void run(receipt.cursor!)}
              >
                Next live Cell page
              </button>
            )}
            <button
              className="btn secondary"
              disabled={busy}
              onClick={download}
            >
              Export live receipt
            </button>
            <details>
              <summary>Public node/API responses</summary>
              <pre>{JSON.stringify(receipt.raw, null, 2)}</pre>
            </details>
          </section>
        )}
        <details>
          <summary>Advanced / regression tools</summary>
          <p>Offline fixtures are isolated from live lookups.</p>
          <button className="btn secondary" onClick={onFixture}>
            Open offline regression lab
          </button>
        </details>
      </section>
    </AppLayout>
  );
}
