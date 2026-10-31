import { useEffect, useRef, useState } from "react";
import { ccc } from "@ckb-ccc/core";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { currentScope, setFeatureNetwork } from "../../dev-console/features";
import { traceCall } from "../../dev-console/store";
import { configuredNetwork } from "../../utils/network";
import {
  assertFresh,
  depositPlan,
  display,
  indicative,
  integer,
  pins,
  receiptValue,
  units,
  U128,
  type IckbNetwork,
  type Snapshot,
} from "../../features/ickb/model";
import { loadSnapshot, publicJson } from "../../features/ickb/snapshot";
export function IckbInspectorPage() {
  const [network, setNetwork] = useState<IckbNetwork>(
      configuredNetwork === "mainnet" ? "mainnet" : "testnet",
    ),
    [snapshot, setSnapshot] = useState<Snapshot>(),
    [amount, setAmount] = useState(""),
    [recipient, setRecipient] = useState(""),
    [direction, setDirection] = useState<"ckb-to-ickb" | "ickb-to-ckb">(
      "ckb-to-ickb",
    ),
    [result, setResult] = useState<unknown>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController>(),
    revision = useRef(0);
  useEffect(() => {
    setFeatureNetwork("/ickb", network);
    return () => {
      setFeatureNetwork("/ickb");
      controller.current?.abort();
      revision.current++;
    };
  }, [network]);
  function invalidate() {
    revision.current++;
    controller.current?.abort();
    setBusy(false);
    setResult(undefined);
    setError("");
  }
  async function refresh() {
    invalidate();
    setSnapshot(undefined);
    const active = new AbortController();
    controller.current = active;
    const generation = revision.current;
    setBusy(true);
    try {
      const s = await traceCall(
        currentScope(),
        "api",
        "ICKB.readSnapshot",
        () => loadSnapshot(network, { signal: active.signal }),
      );
      if (generation === revision.current) setSnapshot(s);
    } catch (e) {
      if (!active.signal.aborted)
        setError(e instanceof Error ? e.message : "Snapshot read failed.");
    } finally {
      if (generation === revision.current) setBusy(false);
    }
  }
  async function preview() {
    invalidate();
    if (!snapshot) return;
    const generation = revision.current;
    try {
      assertFresh(snapshot, network);
      const raw = units(amount, direction === "ckb-to-ickb" ? undefined : U128),
        ar = integer(snapshot.ar);
      const quote = indicative(raw, ar, direction);
      let construction;
      if (direction === "ckb-to-ickb" && recipient.trim()) {
        const client =
          network === "mainnet"
            ? new ccc.ClientPublicMainnet()
            : new ccc.ClientPublicTestnet();
        const address = await ccc.Address.fromString(recipient.trim(), client);
        if (address.prefix !== (network === "mainnet" ? "ckb" : "ckt"))
          throw Error("Recipient address network mismatch.");
        construction = depositPlan(snapshot, raw, address.script);
      }
      if (generation !== revision.current) return;
      setResult({
        network,
        anchor: snapshot.header.hash,
        blockNumber: snapshot.header.number,
        source: pins.sdk,
        asset: {
          decimals: 8,
          type: {
            codeHash: pins.xudtCodeHash,
            hashType: "data1",
            args: ccc.Script.from(pins.logic).hash() + "00000080",
          },
        },
        rawInput: raw.toString(),
        inputUnit:
          direction === "ckb-to-ickb"
            ? "CKB shannons"
            : "iCKB raw (8 decimals)",
        indicativeOrderOutput: quote.output.toString(),
        displayOutput: display(quote.output),
        rounding: quote.rounding,
        orderFee: {
          numerator: quote.fee.toString(),
          denominator: quote.feeBase.toString(),
          networkFee: "not estimated",
        },
        receiptAccounting:
          direction === "ckb-to-ickb"
            ? {
                freeCapacityOnly: true,
                estimatedRaw: receiptValue(raw, ar).toString(),
                note: "Deposit commitment header AR determines the actual receipt value; this is not the order quote.",
              }
            : undefined,
        construction: construction ?? null,
        withdrawal: {
          status: "not evaluated",
          reason:
            "No mature pool deposit or account was selected. A quote is not evidence of redemption readiness.",
        },
        submitted: false,
        committed: false,
      });
    } catch (e) {
      if (generation === revision.current)
        setError(e instanceof Error ? e.message : "Preview failed.");
    }
  }
  function download() {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([publicJson({ snapshot, result })], {
          type: "application/json",
        }),
      );
    a.href = url;
    a.download = "ickb-inspection.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <AppLayout>
      <PageHero
        eyebrow="DAO and token tools"
        title="iCKB Inspector"
        description="Read public chain state, compare conversion units and review an unfunded deposit construction. No signing or submission."
      />
      <section className="panel product-form">
        <p>
          Read-only. Indicative order pricing, receipt accounting and withdrawal
          readiness are different checks. No immediate redemption or 1:1 CKB
          exchange is implied.
        </p>
        <label>
          iCKB network
          <select
            value={network}
            onChange={(e) => {
              invalidate();
              setSnapshot(undefined);
              setNetwork(e.target.value as IckbNetwork);
            }}
          >
            <option value="testnet">CKB Testnet</option>
            <option value="mainnet">CKB Mainnet</option>
          </select>
        </label>
        <button
          className="btn primary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Read chain snapshot
        </button>
        <button className="btn secondary" disabled={!busy} onClick={invalidate}>
          Cancel
        </button>
        {busy && (
          <p role="status">
            Checking genesis, header hash and live code dependencies…
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {snapshot && (
          <>
            <h2>Snapshot identity</h2>
            <dl>
              <dt>Block hash</dt>
              <dd>
                <code>{snapshot.header.hash}</code>
              </dd>
              <dt>DAO accumulated rate</dt>
              <dd>{snapshot.ar}</dd>
              <dt>Observed</dt>
              <dd>{snapshot.observedAt}</dd>
              <dt>Code dependencies checked</dt>
              <dd>{snapshot.codeChecks.length}</dd>
            </dl>
            <label>
              Conversion direction
              <select
                value={direction}
                onChange={(e) => {
                  invalidate();
                  setDirection(e.target.value as typeof direction);
                }}
              >
                <option value="ckb-to-ickb">CKB → iCKB</option>
                <option value="ickb-to-ckb">iCKB → CKB</option>
              </select>
            </label>
            <label>
              {direction === "ckb-to-ickb" ? "Free CKB amount" : "iCKB amount"}
              <input
                value={amount}
                inputMode="decimal"
                onChange={(e) => {
                  invalidate();
                  setAmount(e.target.value);
                }}
              />
            </label>
            {direction === "ckb-to-ickb" && (
              <label>
                Recipient CKB address (optional, for deposit construction)
                <input
                  value={recipient}
                  onChange={(e) => {
                    invalidate();
                    setRecipient(e.target.value);
                  }}
                />
              </label>
            )}
            <p>
              A construction requires 1,000–1,000,000 CKB free capacity, another
              82 CKB occupied capacity, a receipt reserve and actual
              funding/fees. Without a recipient, only indicative conversions are
              shown.
            </p>
            <button
              className="btn primary"
              disabled={!amount || busy}
              onClick={() => void preview()}
            >
              Review conversion
            </button>
            {result !== undefined && (
              <section aria-label="iCKB review">
                <h2>Conversion review</h2>
                <p>
                  Unsigned and unsubmitted. Order fills and mature withdrawals
                  have not been checked. Limit-order execution is not exposed by
                  this inspector.
                </p>
                <pre
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {publicJson(result)}
                </pre>
              </section>
            )}
            <button
              className="btn secondary"
              disabled={busy}
              onClick={download}
            >
              Export public receipt
            </button>
            <details>
              <summary>Public snapshot responses</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {publicJson(snapshot.raw).slice(0, 64000)}
                {publicJson(snapshot.raw).length > 64000
                  ? "\nDisplay truncated; export the public receipt for full responses."
                  : ""}
              </pre>
            </details>
          </>
        )}
        <p>
          SDK reference: {pins.sdk.package} {pins.sdk.version}. Its Node 26
          validation package is separate from this portal.
        </p>
      </section>
    </AppLayout>
  );
}
