import { useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { useFeatureSigner } from "../../dev-console/hooks";
import { currentScope } from "../../dev-console/features";
import { beginOperation } from "../../dev-console/store";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { TransactionLifecycle } from "../../components/transactions/TransactionLifecycle";
import { recordSubmittedAsset } from "../../utils/submission";
import { getTokenDeployment } from "../../utils/tokenDeployment";
import {
  parseTokenAmount,
  tokenArgs,
  tokenType,
  verifyTokenDeployment,
  ownedTokenCells,
  decodeAmount,
  sumAmounts,
  prepareToken,
  submitToken,
  moleculeExample,
  type TokenStandard,
  type TokenAction,
  type TokenReview,
} from "../../utils/token";
const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
export function FungibleTokenPage() {
  const signer = useFeatureSigner();
  const scope = currentScope();
  const [standard, setStandard] = useState<TokenStandard>("XUDT");
  const [args, setArgs] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("1000");
  const [decimals, setDecimals] = useState(0);
  const [name, setName] = useState("Week 6 Token");
  const [symbol, setSymbol] = useState("W6");
  const [status, setStatus] = useState(
    "Choose a standard, generate issuer args, and prepare a transaction.",
  );
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<TokenReview>();
  const [confirmed, setConfirmed] = useState(false);
  const [hash, setHash] = useState("");
  const [cells, setCells] = useState<ccc.Cell[]>([]);
  const [queried, setQueried] = useState(false);
  let raw = "—";
  try {
    raw = parseTokenAmount(amount, decimals).toString();
  } catch {
    /* Validation is displayed when preparing. */
  }
  function invalidate() {
    setReview(undefined);
    setConfirmed(false);
  }
  async function run(label: string, action: () => Promise<void>) {
    const op = beginOperation(scope, "action", label);
    setBusy(true);
    try {
      await action();
      op.complete();
    } catch (error) {
      op.fail(error);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!signer) throw Error("Connect a wallet first.");
    setArgs(
      tokenArgs(standard, (await signer.getRecommendedAddressObj()).script),
    );
    setRecipient(await signer.getRecommendedAddress());
    invalidate();
    setCells([]);
    setQueried(false);
    setStatus(
      "Issuer args generated. Name, symbol and decimals are display metadata only.",
    );
  }
  async function prepare(action: TokenAction) {
    invalidate();
    if (!signer) throw Error("Connect a wallet first.");
    setStatus(`Preparing ${standard} ${action.toLowerCase()}...`);
    const deployment = await getTokenDeployment(signer.client, standard);
    const result = await prepareToken(
      signer,
      deployment,
      standard,
      action,
      args.trim(),
      parseTokenAmount(amount, decimals),
      recipient.trim(),
    );
    setReview(result);
    setStatus(
      "Prepared only. Review inputs, outputs, token amounts and fee before signing.",
    );
  }
  async function query() {
    if (!signer) throw Error("Connect a wallet first.");
    const deployment = await getTokenDeployment(signer.client, standard);
    await verifyTokenDeployment(signer.client, deployment);
    const type = tokenType(standard, args.trim(), deployment);
    const result = await ownedTokenCells(signer, type);
    setCells(result);
    setQueried(true);
    setStatus(`Found ${result.length} live token Cells owned by this wallet.`);
  }
  async function submit() {
    if (!signer || !review) throw Error("Prepare a transaction first.");
    if (review.action === "BURN" && !confirmed)
      throw Error("Confirm the burn before signing.");
    const pending = review;
    setReview(undefined);
    setConfirmed(false);
    const txHash = await submitToken(pending, signer);
    setHash(txHash);
    setCells([]);
    setQueried(false);
    setStatus("Submitted; waiting for on-chain status.");
    setStatus(
      await recordSubmittedAsset(signer.client, {
        assetKind: pending.standard,
        action: pending.action,
        assetId: pending.type.hash(),
        ownerAddress: pending.sender,
        displayName: name,
        symbol,
        amount,
        txHash,
        metadataJson: json({
          decimals,
          rawAmount: pending.amount,
          script: pending.type,
          recipient: pending.action === "BURN" ? pending.sender : recipient,
        }),
      }),
    );
  }
  return (
    <AppLayout>
      <PageHero
        eyebrow="Week 6 · sUDT / xUDT"
        title="Token Lab"
        description="Mint, transfer or explicitly burn fungible tokens. Prepare and review each transaction before wallet signing."
      />
      <p className="status-line">
        sUDT and xUDT use different contracts and args. This lab supports basic
        xUDT without extensions. Names, symbols and decimals are off-chain
        display metadata.
      </p>
      <div className="token-product-grid">
        <section className="panel">
          <fieldset
            disabled={busy}
            className="token-lab-fields"
            onChange={invalidate}
          >
            <label>
              Token standard
              <select
                value={standard}
                onChange={(e) => {
                  setStandard(e.target.value as TokenStandard);
                  setArgs("");
                  setCells([]);
                  setQueried(false);
                }}
              >
                <option value="XUDT">xUDT</option>
                <option value="SUDT">sUDT</option>
              </select>
            </label>
            <div className="form-grid-2">
              <label>
                Token name
                <input
                  value={name}
                  maxLength={128}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Symbol
                <input
                  value={symbol}
                  maxLength={16}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </label>
            </div>
            <label>
              Display decimals
              <input
                type="number"
                min="0"
                max="18"
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
              />
            </label>
            <label>
              Token args
              <input
                value={args}
                onChange={(e) => {
                  setArgs(e.target.value);
                  setCells([]);
                  setQueried(false);
                }}
                placeholder={
                  standard === "SUDT"
                    ? "32-byte owner lock hash"
                    : "owner lock hash + 00000000"
                }
              />
            </label>
            <button
              className="btn secondary"
              onClick={() => void run("Generate issuer args", generate)}
            >
              Generate issuer args
            </button>
            <label>
              Recipient
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Address on the selected network"
              />
            </label>
            <label>
              Amount
              <input
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <div className="result-field">
              <span>Raw uint128 amount</span>
              <code>{raw}</code>
            </div>
            <div className="buttonRow">
              {(["MINT", "TRANSFER", "BURN"] as const).map((action) => (
                <button
                  key={action}
                  className={action === "BURN" ? "btn danger" : "btn secondary"}
                  disabled={!args || !signer}
                  onClick={() =>
                    void run(`Prepare ${action.toLowerCase()}`, () =>
                      prepare(action),
                    )
                  }
                >
                  Prepare {action.toLowerCase()}
                </button>
              ))}
            </div>
          </fieldset>
          <p role="status" className="status-line">
            {busy ? "Working… " : ""}
            {status}
          </p>
        </section>
        <section className="panel">
          <h2>Wallet token Cells</h2>
          <button
            className="btn secondary"
            disabled={busy || !args || !signer}
            onClick={() => void run("Query owned token Cells", query)}
          >
            Refresh live balance
          </button>
          {queried && (
            <>
              <p>
                Balance:{" "}
                <strong>
                  {sumAmounts(
                    cells.map((c) => decodeAmount(c.outputData)),
                  ).toString()}{" "}
                  raw units
                </strong>
              </p>
              <p>
                {cells.length} live Cells. Refresh after commitment to see
                updated balances.
              </p>
              {cells.map((cell) => (
                <details key={cell.outPoint.txHash + cell.outPoint.index}>
                  <summary>
                    {decodeAmount(cell.outputData).toString()} raw units ·{" "}
                    {ccc.fixedPointToString(cell.cellOutput.capacity)} CKB
                  </summary>
                  <pre>
                    {json({
                      outPoint: cell.outPoint,
                      lock: cell.cellOutput.lock,
                      type: cell.cellOutput.type,
                    })}
                  </pre>
                </details>
              ))}
            </>
          )}
          {hash && (
            <>
              <h3>Last submitted transaction</h3>
              <code style={{ overflowWrap: "anywhere" }}>{hash}</code>
              <TransactionLifecycle txHash={hash} />
            </>
          )}
        </section>
      </div>
      {review && (
        <section
          className="panel token-review"
          aria-label="Token transaction preview"
        >
          <h2>
            {review.standard} {review.action.toLowerCase()} preview
          </h2>
          <p>
            Network: <strong>{review.deployment.network}</strong> · Fee:{" "}
            {ccc.fixedPointToString(review.fee)} CKB
          </p>
          <p>
            Tokens in: {review.inputAmount.toString()} · Tokens out:{" "}
            {review.outputAmount.toString()} ·{" "}
            {review.action === "BURN" ? "Explicit burn" : "Requested amount"}:{" "}
            {review.amount.toString()} raw
          </p>
          <p>
            {review.tx.inputs.length} inputs → {review.tx.outputs.length}{" "}
            outputs, including token/capacity change where required.
          </p>
          <h3>Outputs and recipients</h3>
          {review.tx.outputs.map((out, i) => (
            <details key={i} open>
              <summary>
                Output {i}: {ccc.fixedPointToString(out.capacity)} CKB
                {out.type?.eq(review.type)
                  ? ` · ${decodeAmount(review.tx.outputsData[i])} raw token units`
                  : " · capacity change"}
              </summary>
              <pre>{json(out)}</pre>
            </details>
          ))}
          <details>
            <summary>Input OutPoints</summary>
            <pre>{json(review.tx.inputs)}</pre>
          </details>
          <details open>
            <summary>Type script and code dependencies</summary>
            <pre>
              {json({
                type: review.type,
                dependencies: review.deployment.script.cellDeps,
              })}
            </pre>
          </details>
          <details>
            <summary>Molecule Script / WitnessArgs example</summary>
            <pre>{json(moleculeExample(review.type))}</pre>
          </details>
          <details>
            <summary>Full transaction JSON</summary>
            <pre>{json(review.tx)}</pre>
          </details>
          {review.action === "BURN" && (
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              I understand that {review.amount.toString()} raw token units will
              be permanently burned.
            </label>
          )}
          <button
            className="btn primary"
            disabled={busy || (review.action === "BURN" && !confirmed)}
            onClick={() =>
              void run("Sign and submit reviewed token transaction", submit)
            }
          >
            Sign and submit
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={invalidate}
          >
            Discard preview
          </button>
        </section>
      )}
    </AppLayout>
  );
}
