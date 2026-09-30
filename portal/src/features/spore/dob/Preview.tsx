import { useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { currentScope } from "../../../dev-console/features";
import { traceCall } from "../../../dev-console/store";
import { decode } from "./adapter";
import { DNA, PATTERN, PIN } from "./fixture";
import { Attribute } from "./reference";
export function DobPreview() {
  const [dna, setDna] = useState(DNA);
  const [enabled, setEnabled] = useState(true);
  const [attributes, setAttributes] = useState<Attribute[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function preview() {
    setBusy(true);
    setError("");
    setAttributes(undefined);
    try {
      setAttributes(
        await traceCall(currentScope(), "feature", "Spore.dob-decode", () =>
          decode(dna, PATTERN, { enabled }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decoder unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>DOB/0 — pinned basic-loot preview</h2>
      <p>
        This local reference preview evaluates the official pattern in an
        isolated Worker. It does not prove minting or execute the deployed
        RISC-V decoder.
      </p>
      <div className="token-product-grid">
        <div>
          <h3>Raw / on-chain model</h3>
          <label>
            DNA (8 bytes)
            <input
              value={dna}
              maxLength={128}
              disabled={busy}
              onChange={(e) => {
                setDna(e.target.value);
                setAttributes(undefined);
              }}
            />
          </label>
          <pre style={{ overflow: "auto" }}>
            {JSON.stringify(
              {
                contentType: "dob/0",
                content: { dna },
                contentHash: ccc.hashCkb(
                  new TextEncoder().encode(JSON.stringify({ dna })),
                ),
                pattern: PATTERN,
                ...PIN,
              },
              null,
              2,
            )}
          </pre>
          <p>
            Mint stores JSON DNA in Spore content and the pattern/decoder
            reference in Cluster description. The decoder binary is referenced
            by code hash. This example needs no external image or HTML.
          </p>
        </div>
        <div>
          <h3>Decoded attributes</h3>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Enable trusted reference decoder
          </label>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void preview()}
          >
            Decode fixture
          </button>
          {error && (
            <p role="alert">{error}. Original metadata remains available.</p>
          )}
          {attributes && (
            <dl>
              {attributes.map((a) => (
                <div key={a.name}>
                  <dt>{a.name}</dt>
                  <dd>{String(Object.values(a.traits[0])[0])}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
