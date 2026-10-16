import { useFeatureObject } from "../../dev-console/hooks";
import { beginOperation } from "../../dev-console/store";
import { currentScope } from "../../dev-console/features";
import { useFeatureSigner } from "../../dev-console/hooks";
import { parseCapacity } from "../../utils/network";
import { setFeatureNetwork } from "../../dev-console/features";
import { useEffect, useMemo, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";

import {
  buildUnlock,
  deriveLock,
  liveCells,
  preimageBytes,
  verifyDeployment,
  parseDeployment,
  type Deployment,
} from "../../utils/simpleLock";

export function SimpleLockLabPage() {
  const [deployment, setDeployment] = useState<Deployment>();
  const [error, setError] = useState("");
  if (deployment)
    return (
      <ConfiguredSimpleLock
        key={
          deployment.genesisHash +
          deployment.rpcUrl +
          String(deployment.code.codeHash)
        }
        meta={deployment}
        onReset={() => setDeployment(undefined)}
      />
    );
  return (
    <AppLayout>
      <PageHero
        eyebrow="Custom deployed contracts"
        title="Simple Lock Lab"
        description="Load your deployment manifest to derive, fund and unlock real hash-lock Cells."
      />
      <section className="panel product-form">
        <label>
          Deployment manifest JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 262144)
                  throw Error("Manifest exceeds 256 KiB.");
                setDeployment(parseDeployment(await file.text()));
                setError("");
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Invalid manifest",
                );
              }
            }}
          />
        </label>
        <p>
          Use the public manifest exported by your contract deployment,
          including network, genesis, RPC, code and VM OutPoints. No keys are
          accepted or stored.
        </p>
        {error && <p role="alert">{error}</p>}
      </section>
    </AppLayout>
  );
}
function ConfiguredSimpleLock({
  meta,
  onReset,
}: {
  meta: Deployment;
  onReset: () => void;
}) {
  const signer = useFeatureSigner();
  const rawClient = useMemo(
    () =>
      meta.network === "mainnet"
        ? new ccc.ClientPublicMainnet({
            url: meta.rpcUrl,
            fallbacks: [],
            scripts: meta.knownScripts,
          })
        : new ccc.ClientPublicTestnet({
            url: meta.rpcUrl,
            fallbacks: [],
            scripts: meta.knownScripts,
          }),
    [meta],
  );
  const client = useFeatureObject(rawClient, "ckb");
  const [preimage, setPreimage] = useState("");
  const [digest, setDigest] = useState("");
  const [address, setAddress] = useState("");
  const [recipient, setRecipient] = useState("");
  const [cells, setCells] = useState<ccc.Cell[]>([]);
  const [selected, setSelected] = useState(0);
  const [prepared, setPrepared] = useState<ccc.Transaction>();
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState(
    "Derive a lock using a preimage, or paste an existing digest.",
  );
  const [busy, setBusy] = useState(false);
  const [fundAmount, setFundAmount] = useState("200");
  const [feeRate, setFeeRate] = useState("1000");
  useEffect(() => {
    setFeatureNetwork(
      "/simple-lock",
      meta.network.includes("devnet") ? "devnet" : meta.network,
    );
    return () => setFeatureNetwork("/simple-lock");
  }, [meta]);
  useEffect(() => {
    setPrepared(undefined);
  }, [signer]);
  async function run(label: string, action: () => Promise<void>) {
    const operation = beginOperation(currentScope(), "action", label);
    setBusy(true);
    try {
      await action();
      operation.complete();
    } catch (e) {
      operation.fail(e);
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await verifyDeployment(client, meta);
    const lock = deriveLock(meta, digest);
    setAddress((await ccc.Address.fromScript(lock, client)).toString());
    setCells(await liveCells(client, lock));
    setSelected(0);
    setPrepared(undefined);
    setStatus("Live capacity refreshed. Only plain capacity Cells are listed.");
  }
  return (
    <AppLayout>
      <PageHero
        eyebrow={meta.network}
        title="Simple Lock Lab"
        description="Protect a Cell with a hash, then unlock it by revealing the preimage."
      />
      <p className="status-line">
        Learning contract: anyone who knows the preimage can spend the Cell to
        any address. The preimage becomes public when submitted. Verify the
        deployment and preserve your preimage before funding.
      </p>
      <button className="btn secondary" disabled={busy} onClick={onReset}>
        Change deployment
      </button>
      <div className="store-data-grid">
        <section className="panel product-form">
          <h2>1. Derive and fund</h2>
          <label>
            Preimage (UTF-8, kept in memory)
            <input
              type="password"
              autoComplete="off"
              value={preimage}
              disabled={busy}
              onChange={(e) => {
                setPreimage(e.target.value);
                setPrepared(undefined);
              }}
            />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run("Derive lock", async () => {
                await verifyDeployment(client, meta);
                const hash = ccc.hashCkb(preimageBytes(preimage));
                setDigest(hash);
                setCells([]);
                setPrepared(undefined);
                setAddress(
                  (
                    await ccc.Address.fromScript(deriveLock(meta, hash), client)
                  ).toString(),
                );
                setStatus(
                  "Lock derived. Save the digest and preimage before funding.",
                );
              })
            }
          >
            Derive from preimage
          </button>
          <label>
            Stored digest (Script application args)
            <input
              value={digest}
              disabled={busy}
              onChange={(e) => {
                setDigest(e.target.value);
                setAddress("");
                setCells([]);
                setPrepared(undefined);
              }}
            />
          </label>
          <button
            className="btn secondary action-wide"
            disabled={busy || !digest}
            onClick={() => void run("Check live capacity", refresh)}
          >
            Check address and live capacity
          </button>
          <div className="result-field">
            <span>Protected address</span>
            <code style={{ overflowWrap: "anywhere" }}>{address || "—"}</code>
          </div>
          <label>
            Funding amount (CKB)
            <input
              value={fundAmount}
              disabled={busy}
              onChange={(e) => setFundAmount(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !signer || !address}
            onClick={() =>
              void run("Fund protected Cell", async () => {
                if (!signer)
                  throw new Error(
                    "Connect a wallet on the deployment network.",
                  );
                await verifyDeployment(signer.client, meta);
                const sender = await signer.getRecommendedAddress();
                const tx = ccc.Transaction.from({
                  outputs: [
                    {
                      lock: deriveLock(meta, digest),
                      capacity: parseCapacity(fundAmount),
                    },
                  ],
                  outputsData: ["0x"],
                });
                await tx.completeInputsByCapacity(signer);
                await tx.completeFeeBy(signer, 1000);
                await verifyDeployment(signer.client, meta);
                if (sender !== (await signer.getRecommendedAddress()))
                  throw Error(
                    "Wallet account changed. Rebuild funding transaction.",
                  );
                const hash = await signer.sendTransaction(tx);
                setTxHash(hash);
                setStatus(
                  "Funding submitted. Check transaction status for commitment.",
                );
              })
            }
          >
            Fund with connected wallet
          </button>
          {meta.network.includes("devnet") && (
            <>
              <p>Or fund from the OffCKB terminal:</p>
              <code style={{ overflowWrap: "anywhere" }}>
                offckb deposit {address || "&lt;protected-address&gt;"} 200
              </code>
            </>
          )}
        </section>
        <section className="panel product-form">
          <h2>2. Construct and unlock</h2>
          <p>
            Listed live capacity (up to100 Cells):{" "}
            <strong>
              {ccc.fixedPointToString(
                cells.reduce((sum, cell) => sum + cell.cellOutput.capacity, 0n),
              )}{" "}
              CKB
            </strong>
          </p>
          <label>
            Protected Cell
            <select
              value={selected}
              disabled={busy}
              onChange={(e) => {
                setSelected(Number(e.target.value));
                setPrepared(undefined);
              }}
            >
              {!cells.length && (
                <option value={0}>
                  Refresh capacity after funding commits
                </option>
              )}
              {cells.map((cell, i) => (
                <option key={i} value={i}>
                  {cell.outPoint.txHash}:{cell.outPoint.index.toString()} ·{" "}
                  {ccc.fixedPointToString(cell.cellOutput.capacity)} CKB
                </option>
              ))}
            </select>
          </label>
          <label>
            Fee rate (shannons/KB)
            <input
              value={feeRate}
              disabled={busy}
              onChange={(e) => {
                setFeeRate(e.target.value);
                setPrepared(undefined);
              }}
            />
          </label>
          <label>
            Recipient CKB address
            <input
              value={recipient}
              disabled={busy}
              onChange={(e) => {
                setRecipient(e.target.value);
                setPrepared(undefined);
              }}
            />
          </label>
          <button
            className="btn secondary action-wide"
            disabled={busy || !cells[selected]}
            onClick={() =>
              void run("Construct unlock", async () => {
                await verifyDeployment(client, meta);
                const target = await ccc.Address.fromString(recipient, client);
                const cell = await client.getCellLiveNoCache(
                  cells[selected].outPoint,
                  true,
                );
                if (!cell)
                  throw new Error(
                    "Cell has already been spent. Refresh capacity.",
                  );
                setPrepared(
                  buildUnlock(
                    meta,
                    cell,
                    target.script,
                    preimage,
                    Number(feeRate),
                  ),
                );
                setStatus(
                  "Unlock constructed. Review recipient and fee, then submit.",
                );
              })
            }
          >
            Construct unlocking transaction
          </button>
          {prepared && (
            <div className="result-field">
              <span>Transaction preview</span>
              <p>One input → {recipient}</p>
              <p>
                Output: {ccc.fixedPointToString(prepared.outputs[0].capacity)}{" "}
                CKB · Fee:{" "}
                {ccc.fixedPointToString(
                  cells[selected].cellOutput.capacity -
                    prepared.outputs[0].capacity,
                )}{" "}
                CKB
              </p>
              <p>
                Witness: {preimageBytes(preimage).length} preimage bytes (will
                be public)
              </p>
              <code style={{ overflowWrap: "anywhere" }}>
                Input: {prepared.inputs[0].previousOutput.txHash}
              </code>
            </div>
          )}
          <button
            className="primary"
            disabled={busy || !prepared}
            onClick={() =>
              void run("Submit unlock", async () => {
                if (!prepared) return;
                await verifyDeployment(client, meta);
                if (
                  !(await client.getCellLiveNoCache(
                    prepared.inputs[0].previousOutput,
                  ))
                )
                  throw new Error("Cell already spent.");
                const hash = await client.sendTransaction(prepared);
                setTxHash(hash);
                setPrepared(undefined);
                setCells([]);
                setStatus(
                  "Unlock submitted. Check transaction status for commitment.",
                );
              })
            }
          >
            Submit unlock
          </button>
          <div className="result-field">
            <span>Transaction hash</span>
            <code style={{ overflowWrap: "anywhere" }}>{txHash || "—"}</code>
          </div>
          <button
            className="btn secondary action-wide"
            disabled={busy || !txHash}
            onClick={() =>
              void run("Check transaction status", async () => {
                const tx = await client.getTransaction(txHash);
                setStatus(`Transaction ${tx?.status ?? "not found"}.`);
              })
            }
          >
            Check transaction status
          </button>
        </section>
      </div>
      <p role="status" aria-live="polite" className="status-line">
        {busy ? "Working… " : ""}
        {status}
      </p>
      <section className="panel">
        <h2>Deployment and validation</h2>
        <p>RPC: {meta.rpcUrl}</p>
        <p>
          Deployed bytecode hash:{" "}
          <code style={{ overflowWrap: "anywhere" }}>
            {String(meta.code.codeHash)}
          </code>
        </p>
        <p>
          Code OutPoint:{" "}
          <code style={{ overflowWrap: "anywhere" }}>
            {String(meta.code.cellDeps?.[0].cellDep.outPoint.txHash)}:{String(meta.code.cellDeps?.[0].cellDep.outPoint.index)}
          </code>
        </p>
        <p>
          VM code hash:{" "}
          <code style={{ overflowWrap: "anywhere" }}>
            {String(meta.vm.codeHash)}
          </code>
        </p>
        <p>
          Inputs consume live Cells; outputs create new Cells. Identical input
          locks execute once as a Script group. This lock reads the first group
          input’s raw witness. Exit 0 accepts; 5 means invalid args, 6 missing
          witness, 7 wrong preimage, and 8 oversized preimage. Every Script must
          pass before the transaction can commit.
        </p>
      </section>
    </AppLayout>
  );
}
