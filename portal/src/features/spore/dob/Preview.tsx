import { useEffect, useRef, useState } from "react";
import { useFeatureCcc } from "../../../dev-console/hooks";
import { currentScope } from "../../../dev-console/features";
import { traceCall } from "../../../dev-console/store";
import { json } from "../lifecycle";
import { readDob } from "./pattern";
export function DobPreview() {
  const { client } = useFeatureCcc();
  const [id, setId] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof readDob>>>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setResult(undefined);
    setError("");
    return () => {
      generation.current++;
    };
  }, [client]);
  async function read() {
    const current = ++generation.current;
    setBusy(true);
    setResult(undefined);
    setError("");
    try {
      const value = await traceCall(
        currentScope(),
        "ckb",
        "Spore.readDob",
        () => readDob(client, id),
      );
      if (current === generation.current) setResult(value);
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "DOB unavailable");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <section className="panel product-form">
      <h2>Read an on-chain DOB</h2>
      <p>
        Load DNA, Cluster pattern and decoder identity from live Cells.
        Supported DOB/0 traits are previewed locally; unsupported decoders are
        not replaced with an example.
      </p>
      <label>
        DOB Spore ID
        <input
          value={id}
          onChange={(e) => {
            generation.current++;
            setId(e.target.value);
            setResult(undefined);
            setError("");
            setBusy(false);
          }}
        />
      </label>
      <button
        className="btn secondary"
        disabled={busy || !id.trim()}
        onClick={() => void read()}
      >
        Read DOB metadata and attributes
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <dl>
            {result.attributes.map((a) => (
              <div key={a.name}>
                <dt>{a.name}</dt>
                <dd>{String(a.value)}</dd>
              </div>
            ))}
          </dl>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {json(result)}
          </pre>
        </>
      )}
    </section>
  );
}
