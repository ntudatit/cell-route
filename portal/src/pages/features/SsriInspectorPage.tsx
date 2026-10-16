import { configuredNetwork } from "../../utils/network";
import { useEffect, useRef, useState } from "react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import {
  queryScript,
  SsriError,
  type Identity,
} from "../../features/ssri/client";
import { traceCall } from "../../dev-console/store";
import { currentScope, setFeatureNetwork } from "../../dev-console/features";
const genesis = {
  testnet: "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
  mainnet: "0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5",
  devnet: "",
};
export function SsriInspectorPage() {
  const [identity, setIdentity] = useState<Identity>({
    network: configuredNetwork,
    nodeUrl:
      import.meta.env.VITE_SSRI_NODE_URL ||
      (configuredNetwork === "mainnet"
        ? "https://mainnet.ckb.dev"
        : configuredNetwork === "testnet"
          ? "https://testnet.ckb.dev"
          : ""),
    serverUrl: import.meta.env.VITE_SSRI_SERVER_URL || "",
    genesisHash: genesis[configuredNetwork],
    codeHash: "",
    outPoint: { txHash: "", index: 0 },
  });
  const [name, setName] = useState("UDT.name"),
    [params, setParams] = useState("[]");
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef<AbortController>();
  useEffect(() => {
    setFeatureNetwork("/ssri", identity.network);
    return () => setFeatureNetwork("/ssri");
  }, [identity.network]);
  useEffect(() => () => active.current?.abort(), []);
  function invalidate() {
    active.current?.abort();
    setResult(undefined);
    setError("");
    setBusy(false);
  }
  function change(value: Identity) {
    invalidate();
    setIdentity(value);
  }
  async function run() {
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setResult(undefined);
    setError("");
    try {
      let args: unknown;
      try {
        args = JSON.parse(params);
      } catch {
        throw Error("Arguments must be valid JSON.");
      }
      const receipt = await traceCall(
        currentScope(),
        "api",
        "SSRI.queryScript",
        () => queryScript(identity, name, args, { signal: controller.signal }),
      );
      if (!controller.signal.aborted) setResult(receipt);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          JSON.stringify(
            e instanceof SsriError
              ? { code: e.code, message: e.message, diagnostic: e.diagnostic }
              : { message: e instanceof Error ? e.message : "Query failed" },
            null,
            2,
          ),
        );
    } finally {
      if (active.current === controller) setBusy(false);
    }
  }
  return (
    <AppLayout>
      <PageHero
        eyebrow="Live script queries"
        title="SSRI Inspector"
        description="Query your deployed script through a compatible SSRI service. No example deployment is loaded automatically."
      />
      <section className="panel product-form">
        <p>
          SSRI service and node must use the same chain. Code identity is
          checked against the node; execution on the service is trusted. Queries
          do not sign or authorize transactions.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label>
            Network
            <select
              value={identity.network}
              onChange={(e) => {
                const network = e.target.value as Identity["network"];
                change({
                  ...identity,
                  network,
                  genesisHash: genesis[network],
                  nodeUrl:
                    network === "mainnet"
                      ? "https://mainnet.ckb.dev"
                      : network === "testnet"
                        ? "https://testnet.ckb.dev"
                        : "",
                });
              }}
            >
              <option>testnet</option>
              <option>mainnet</option>
              <option>devnet</option>
            </select>
          </label>
          {(["nodeUrl", "serverUrl", "genesisHash", "codeHash"] as const).map(
            (key) => (
              <label key={key}>
                {key}
                <input
                  required
                  value={identity[key]}
                  onChange={(e) =>
                    change({ ...identity, [key]: e.target.value })
                  }
                />
              </label>
            ),
          )}
          <label>
            Code transaction hash
            <input
              required
              value={identity.outPoint.txHash}
              onChange={(e) =>
                change({
                  ...identity,
                  outPoint: { ...identity.outPoint, txHash: e.target.value },
                })
              }
            />
          </label>
          <label>
            Output index
            <input
              type="number"
              required
              min="0"
              max="4294967295"
              value={identity.outPoint.index}
              onChange={(e) =>
                change({
                  ...identity,
                  outPoint: {
                    ...identity.outPoint,
                    index: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Method signature
            <input
              required
              value={name}
              onChange={(e) => {
                invalidate();
                setName(e.target.value);
              }}
            />
          </label>
          <label>
            Encoded arguments (JSON hex array)
            <textarea
              value={params}
              maxLength={262144}
              onChange={(e) => {
                invalidate();
                setParams(e.target.value);
              }}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Verify identity and query
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={!busy}
            onClick={() => {
              active.current?.abort();
              setBusy(false);
            }}
          >
            Cancel
          </button>
        </form>
        {error && (
          <pre
            role="alert"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {error}
          </pre>
        )}
        {result !== undefined && (
          <>
            <h2>Live query receipt</h2>
            <button
              className="btn secondary"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(result, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "ssri-live-receipt.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export public receipt
            </button>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </>
        )}
      </section>
    </AppLayout>
  );
}
