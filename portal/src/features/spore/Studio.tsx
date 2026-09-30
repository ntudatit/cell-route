import { useEffect, useRef, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { useFeatureCcc, useFeatureSigner } from "../../dev-console/hooks";
import { currentScope } from "../../dev-console/features";
import { traceCall } from "../../dev-console/store";
import { clientNetwork } from "../../utils/network";
import {
  CONTENT_LIMIT,
  json,
  observe,
  prepare,
  Prepared,
  readSpore,
  Request,
  signPrepared,
  verifyCommitted,
  verifyNetwork,
} from "./lifecycle";
import { DobPreview } from "./dob/Preview";
import { clusterDescription, DNA } from "./dob/fixture";
import { recordSubmittedAsset } from "../../utils/submission";
import "./studio.css";

function download(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([json(value)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "spore-evidence.json";
  link.click();
  URL.revokeObjectURL(url);
}
export function SporeStudio({ cluster = false }: { cluster?: boolean }) {
  const signer = useFeatureSigner();
  const { client } = useFeatureCcc();
  const scope = currentScope();
  const [name, setName] = useState("Simple loot");
  const [content, setContent] = useState("Xin chào CKB — Spore!");
  const [description, setDescription] = useState(
    "A collection of on-chain objects.",
  );
  const [file, setFile] = useState<File>();
  const [id, setId] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [dobMode, setDobMode] = useState(false);
  const [prepared, setPrepared] = useState<Prepared>();
  const [meltConfirmed, setMeltConfirmed] = useState(false);
  const [phase, setPhase] = useState("Idle");
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Awaited<ReturnType<typeof readSpore>>>();
  const [evidence, setEvidence] = useState<unknown>();
  const [audit, setAudit] = useState("");
  const original = useRef<{ id: string; bytes?: string; hash?: string }>();
  const [comparison, setComparison] = useState("");
  const controller = useRef<AbortController>();
  const generation = useRef(0);
  const active = useRef(false);
  useEffect(() => {
    generation.current++;
    original.current = undefined;
    setComparison("");
    setPrepared(undefined);
    setHash("");
    setEvidence(undefined);
    setLive(undefined);
    setPhase("Idle");
    setBusy(false);
    active.current = false;
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [signer, client]);
  const log = <T,>(name: string, fn: () => T) =>
    traceCall(scope, "feature", `Spore.${name}`, fn);
  async function build(operation: Request["operation"]) {
    if (!signer) {
      setError("Connect a wallet first.");
      return;
    }
    if (active.current) return;
    active.current = true;
    const current = ++generation.current;
    setAudit("");
    setBusy(true);
    setPrepared(undefined);
    setMeltConfirmed(false);
    setError("");
    setHash("");
    setEvidence(undefined);
    setPhase("Preparing");
    try {
      if (file && file.size > CONTENT_LIMIT)
        throw Error("File exceeds the 16 KiB Studio limit.");
      if (dobMode && !cluster && !clusterId.trim())
        throw Error(
          "DOB/0 requires the Cluster created with the pinned pattern.",
        );
      const bytes = dobMode
        ? new TextEncoder().encode(JSON.stringify({ dna: DNA }))
        : file
          ? new Uint8Array(await file.arrayBuffer())
          : new TextEncoder().encode(content);
      const p = await log(`prepare.${operation}`, () =>
        prepare(client, signer, {
          operation,
          id,
          clusterId,
          recipient,
          pinnedDob: dobMode,
          name,
          description: dobMode ? clusterDescription(client) : description,
          content: bytes,
          contentType: dobMode
            ? "dob/0"
            : file?.type || (file ? "application/octet-stream" : "text/plain"),
        }),
      );
      if (current !== generation.current) return;
      setPrepared(p);
      setId(p.id);
      setPhase("Prepared — review required");
      log("review", () => undefined);
      if (operation === "create")
        original.current = {
          id: p.id,
          bytes: p.contentHex,
          hash: p.review.contentHash,
        };
    } catch (e) {
      if (current === generation.current) {
        setError(e instanceof Error ? e.message : "Preparation failed.");
        setPhase("Failed");
      }
    } finally {
      if (current === generation.current) {
        setBusy(false);
        active.current = false;
      }
    }
  }
  async function check(p: Prepared, txHash: string) {
    const current = generation.current;
    const result = await log("verify-committed", () =>
      verifyCommitted(client, p, txHash),
    );
    if (current === generation.current) setEvidence(result);
  }
  async function submit() {
    if (!signer || !prepared || active.current || hash) return;
    active.current = true;
    setBusy(true);
    setError("");
    const current = generation.current;
    controller.current = new AbortController();
    try {
      setPhase("Sign");
      const signed = await log("sign-start", () =>
        signPrepared(client, signer, prepared, meltConfirmed),
      );
      if (current !== generation.current) return;
      setPhase("Signed");
      await verifyNetwork(client, signer);
      if ((await signer.getRecommendedAddress()) !== prepared.sender)
        throw Error("Wallet changed after signing. Nothing broadcast.");
      if (current !== generation.current) return;
      setPhase("Broadcast");
      const txHash = await log("broadcast.sendTransaction", () =>
        client.sendTransaction(signed),
      );
      // Keep a public receipt even if the user switches wallet while RPC is in flight.
      download({
        transactionHash: txHash,
        status: "broadcast (not commitment)",
        environment: prepared.environment,
        review: prepared.review,
      });
      if (current !== generation.current) return;
      setHash(txHash);
      log("tx-hash.sendTransaction", () => txHash);
      // Optional backend audit must not block node observation or discard the receipt.
      void log("audit-submit", () => recordSubmittedAsset(client, {
        assetKind: prepared.operation.startsWith("cluster") ? "CLUSTER" : "SPORE",
        action: prepared.operation === "create" ? "MINT" : prepared.operation === "cluster-create" ? "CREATE" : prepared.operation === "melt" ? "MELT" : "TRANSFER",
        assetId: prepared.id, ownerAddress: prepared.sender, displayName: name, txHash,
        metadataJson: json(prepared.review),
      })).then(message => { if (current === generation.current) setAudit(message); }).catch(() => { if (current === generation.current) setAudit("Asset audit unavailable; use the transaction receipt."); });
      const observed = await log("observe", () =>
        observe(
          client,
          txHash,
          (state) => {
            if (current === generation.current) setPhase(state);
          },
          controller.current!.signal,
        ),
      );
      if (current !== generation.current) return;
      if (observed?.status === "committed") {
        log("committed", () => undefined);
        await check(prepared, txHash);
      } else if (observed?.status === "rejected")
        throw Error("Node rejected this transaction.");
    } catch (e) {
      if (current === generation.current) {
        setError(e instanceof Error ? e.message : "Transaction failed.");
        setPhase((previous) =>
          previous === "committed" ? "committed" : "Failed",
        );
      }
    } finally {
      if (current === generation.current) {
        setBusy(false);
        active.current = false;
      }
    }
  }
  async function read() {
    const current = generation.current;
    setError("");
    setBusy(true);
    try {
      const found = await log("read-live-cell", () => readSpore(client, id));
      if (current === generation.current) {
        setLive(found);
        setComparison(
          "No original create bytes in this session; inspect the exported creation receipt.",
        );
        if (original.current?.id === found.id) {
          if (
            ccc.hexFrom(found.content) !== original.current.bytes ||
            found.contentHash !== original.current.hash
          )
            throw Error(
              "Live content differs from the reviewed creation bytes/hash.",
            );
          setComparison(
            "Verified: original reviewed bytes and hash equal live Cell content.",
          );
        }
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Read failed.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <AppLayout>
      <div className="spore-studio">
        <PageHero
          eyebrow={`Spore V2 · ${clientNetwork(client)}`}
          title={cluster ? "Spore Cluster Studio" : "Spore / DOB Studio"}
          description="Prepare → review → sign → broadcast → observe. A transaction hash is not a commitment."
        />
        <div className="token-product-grid">
          <section className="panel product-form">
            <fieldset
              disabled={busy || !!prepared}
              style={{ border: 0, padding: 0 }}
            >
              {cluster ? (
                <>
                  <label>
                    Cluster name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={128}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Optional Cluster ID
                    <input
                      value={clusterId}
                      onChange={(e) => setClusterId(e.target.value)}
                    />
                  </label>
                  <label>
                    Public content (16 KiB maximum)
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </label>
                  <label>
                    File
                    <input
                      type="file"
                      onChange={async (e) => {
                        const value = e.target.files?.[0];
                        setFile(value);
                      }}
                    />
                  </label>
                </>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={dobMode}
                  onChange={(e) => setDobMode(e.target.checked)}
                />{" "}
                Use pinned DOB/0 basic-loot{" "}
                {cluster ? "Cluster pattern" : "DNA"}
              </label>
              <button
                className="primary"
                onClick={() =>
                  void build(cluster ? "cluster-create" : "create")
                }
              >
                Prepare {cluster ? "Cluster" : "Spore"}
              </button>
              <label>
                {cluster ? "Cluster" : "Spore"} ID
                <input value={id} onChange={(e) => setId(e.target.value)} />
              </label>
              <label>
                Recipient address
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </label>
              <div className="buttonRow">
                <button
                  className="secondary"
                  onClick={() =>
                    void build(cluster ? "cluster-transfer" : "transfer")
                  }
                >
                  Prepare transfer
                </button>
                {!cluster && (
                  <>
                    <button
                      className="danger"
                      onClick={() => void build("melt")}
                    >
                      Prepare melt
                    </button>
                    <button className="secondary" onClick={() => void read()}>
                      Read live Cell
                    </button>
                  </>
                )}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
            <p role="status">{phase}</p>
            {hash && audit && <p>{audit}</p>}
            {hash && (
              <div className="result-field">
                <span>Transaction hash</span>
                <code>{hash}</code>
                <p>
                  Observation may time out while the transaction remains
                  pending. Do not submit it again.
                </p>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (prepared)
                      void check(prepared, hash).catch((e) =>
                        setError(e.message),
                      );
                  }}
                >
                  Recheck commitment and live state
                </button>
              </div>
            )}
            {evidence !== undefined && (
              <button onClick={() => download(evidence)}>
                Export verified evidence
              </button>
            )}
          </section>
          <section className="panel">
            <h2>Transaction review</h2>
            <p>
              Capacities and fee below are in shannons (100,000,000 = 1 CKB).
              Change is untyped capacity returned to the sender; it is not the
              fee.
            </p>
            {prepared ? (
              <>
                <dl className="spore-review-summary">
                  <dt>Network / operation</dt>
                  <dd>
                    {prepared.environment.network} · {prepared.operation}
                  </dd>
                  <dt>Object capacity</dt>
                  <dd>
                    {ccc.fixedPointToString(BigInt(prepared.review.assetCapacity))}{" "}
                    CKB
                  </dd>
                  <dt>Transaction fee</dt>
                  <dd>
                    {ccc.fixedPointToString(BigInt(prepared.review.feeShannons))} CKB
                  </dd>
                  <dt>Untyped change to sender</dt>
                  <dd>
                    {ccc.fixedPointToString(
                      BigInt(prepared.review.untypedChangeToSender),
                    )}{" "}
                    CKB
                  </dd>
                  <dt>Prepared size</dt>
                  <dd>{prepared.review.serializedBytes} bytes</dd>
                </dl>
                <p
                  className={
                    prepared.operation === "melt" ? "spore-warning" : ""
                  }
                >
                  {prepared.review.warning}
                </p>
                <details>
                  <summary>Inspect exact transaction review</summary>
                  <pre style={{ overflow: "auto", maxHeight: 520 }}>
                    {json(prepared.review)}
                  </pre>
                </details>
                {prepared.operation === "melt" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={meltConfirmed}
                      onChange={(e) => setMeltConfirmed(e.target.checked)}
                    />{" "}
                    This operation consumes the live Spore Cell and cannot be
                    undone.
                  </label>
                )}
                <div className="buttonRow">
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !!hash ||
                      (prepared.operation === "melt" && !meltConfirmed)
                    }
                    onClick={() => void submit()}
                  >
                    Confirm and sign
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setPrepared(undefined);
                      setHash("");
                      setPhase("Idle");
                      setError("");
                      log("review-cancel", () => undefined);
                    }}
                  >
                    Close review
                  </button>
                </div>
              </>
            ) : (
              <p>
                Prepare an operation to review its exact inputs, outputs,
                content, capacity and fee.
              </p>
            )}
          </section>
        </div>
        {live && (
          <section className="panel">
            <h2>Live Spore — node checked</h2>
            <pre style={{ overflow: "auto" }}>
              {json({ ...live, content: undefined })}
            </pre>
            <p>{comparison} ID persists across transfer; OutPoint changes.</p>
            <button
              onClick={() =>
                download({
                  status: "NODE LIVE CELL VERIFIED",
                  network: clientNetwork(client),
                  timestamp: new Date().toISOString(),
                  ...live,
                  content: ccc.hexFrom(live.content),
                  comparison,
                })
              }
            >
              Export read evidence
            </button>
          </section>
        )}
        {!cluster && <DobPreview />}
      </div>
    </AppLayout>
  );
}
