import { currentScope } from "../../dev-console/features";
import { beginOperation } from "../../dev-console/store";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Network,
  RefreshCw,
  Route,
  Send,
} from "lucide-react";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
import { fiberErrorMessage, fiberWasmRuntime } from "../../fiber-wasm/runtime";
import { useFiberRuntime } from "../../fiber-wasm/FiberRuntimeContext";
import {
  parseSharedInvoice,
  type SharedInvoice,
} from "../../fiber-wasm/labInvoice";
const LAB_INVOICE_KEY = `fiberops.${fiberWasmRuntime.network}.two-node.invoice.v2`;
export function FiberTwoNodeLabPage() {
  const runtime = useFiberRuntime(),
    profile = fiberWasmRuntime.profile === "b" ? "B" : "A";
  const [relay, setRelay] = useState(
    profile === "A"
      ? import.meta.env.VITE_FIBER_RELAY_A || ""
      : import.meta.env.VITE_FIBER_RELAY_B || "",
  );
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState<SharedInvoice | null>(() => {
    try {
      return parseSharedInvoice(localStorage.getItem(LAB_INVOICE_KEY));
    } catch {
      return null;
    }
  });
  const [trampoline, setTrampoline] = useState(""),
    [payment, setPayment] = useState<Record<string, unknown> | null>(null),
    [verification, setVerification] = useState<Record<string, unknown> | null>(
      null,
    ),
    [resources, setResources] = useState<Record<string, unknown> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key === LAB_INVOICE_KEY) {
        setInvoice(parseSharedInvoice(event.newValue));
        setPayment(null);
        setVerification(null);
      }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);
  async function execute<T>(label: string, action: () => Promise<T>) {
    const operation = beginOperation(currentScope(), "action", label);
    setBusy(true);
    setError("");
    try {
      const result = await action();
      operation.complete();
      return result;
    } catch (cause) {
      operation.fail(cause);
      setError(fiberErrorMessage(cause));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function connectRelay() {
    await execute("connectRelay", async () => {
      await fiberWasmRuntime.connectPeer({ address: relay.trim() });
      await runtime.refresh();
    });
  }
  async function scanGossip() {
    const value = await execute("scanGossip", () =>
      fiberWasmRuntime.networkResources(),
    );
    if (value) setResources(value);
  }
  async function createInvoice() {
    await execute("createInvoice", async () => {
      if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n)
        throw Error("Enter a positive invoice amount.");
      const value = await fiberWasmRuntime.newInvoice({
        amountRaw: amount,
        description: "Payment to connected node",
        expirySeconds: 1800,
      });
      const paymentHash = fiberWasmRuntime.extractPaymentHash(value);
      if (typeof value?.invoice_address !== "string" || !paymentHash)
        throw Error("Node returned an invalid invoice.");
      const shared = {
        invoice: value.invoice_address,
        paymentHash,
        nodePubkey: String(runtime.node?.pubkey ?? ""),
        createdAt: new Date().toISOString(),
      };
      const parsed = parseSharedInvoice(JSON.stringify(shared));
      if (!parsed) throw Error("Invalid invoice data.");
      localStorage.setItem(LAB_INVOICE_KEY, JSON.stringify(parsed));
      setInvoice(parsed);
      setVerification(null);
    });
  }
  async function resolveInvoice() {
    if (!invoice?.invoice) throw Error("Enter an invoice.");
    const parsed = await fiberWasmRuntime.parseInvoice(invoice.invoice);
    const paymentHash = fiberWasmRuntime.extractPaymentHash(parsed);
    if (!paymentHash)
      throw Error(
        "Unable to extract payment hash from node-validated invoice.",
      );
    const checked = { ...invoice, paymentHash };
    setInvoice(checked);
    return checked;
  }
  async function sendPayment(dryRun: boolean) {
    if (
      !dryRun &&
      !confirm("Send payment to the recipient encoded in this invoice?")
    )
      return;
    setPayment(null);
    setVerification(null);
    const value = await execute(
      dryRun ? "dryRunPayment" : "sendPayment",
      async () => {
        const checked = await resolveInvoice();
        const hops = trampoline.split(/[,\s]+/).filter(Boolean);
        return fiberWasmRuntime.sendPaymentAdvanced({
          invoice: checked.invoice,
          dryRun,
          maxParts: hops.length > 1 ? 1 : 4,
          maxFeeAmountRaw: "100000000",
          timeoutSeconds: 90,
          trampolineHops: hops,
        });
      },
    );
    if (value) setPayment(value);
  }
  async function verify() {
    setVerification(null);
    const value = await execute("verifyPayment", async () => {
      const checked = await resolveInvoice();
      return profile === "B"
        ? fiberWasmRuntime.getInvoice(checked.paymentHash)
        : fiberWasmRuntime.getPayment(checked.paymentHash);
    });
    if (value) setVerification(value);
  }

  return (
    <AppLayout>
      <div className="fiber-lab-page">
        <PageHero
          eyebrow="Fiber Integration Lab"
          title={`Local Node ${profile}`}
          description="Build Node A → Relay 1 → Relay 2 → Node B with independent browser identities, public channels and gossip routing."
          actions={
            <>
              <a
                className="btn secondary"
                href="/fiber-lab?node=a"
                target="_blank"
              >
                <ExternalLink size={15} /> Open A
              </a>
              <a
                className="btn secondary"
                href="/fiber-lab?node=b"
                target="_blank"
              >
                <ExternalLink size={15} /> Open B
              </a>
            </>
          }
        />
        {error && (
          <div className="ops-alert critical">
            <b>Fiber operation failed</b>
            <span>{error}</span>
          </div>
        )}
        <div className="ops-kpi-grid">
          <article>
            <Network />
            <span>Profile</span>
            <strong>{profile}</strong>
          </article>
          <article>
            <CheckCircle2 />
            <span>Node</span>
            <strong>{runtime.node ? "Online" : "Starting"}</strong>
          </article>
          <article>
            <Route />
            <span>Peers</span>
            <strong>{runtime.peers.length}</strong>
          </article>
          <article>
            <Route />
            <span>Channels</span>
            <strong>{runtime.channels.length}</strong>
          </article>
        </div>
        <section className="panel ops-panel">
          <span className="ops-kicker">
            1–3 · CONNECTIVITY & PUBLIC CAPACITY
          </span>
          <h2>{profile === "A" ? "Node A → Relay 1" : "Relay 2 → Node B"}</h2>
          <label className="ops-label">
            {profile === "A" ? "Relay 1" : "Relay 2"} WSS multi-address
          </label>
          <div className="ops-inline">
            <input value={relay} onChange={(e) => setRelay(e.target.value)} />
            <button
              className="btn primary"
              disabled={busy || !relay}
              onClick={() => void connectRelay()}
            >
              Connect relay
            </button>
          </div>
          <div className="ops-actions">
            <a
              className="btn secondary"
              href={`/fiber-node?node=${profile.toLowerCase()}`}
            >
              Open/fund public channel
            </a>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => void scanGossip()}
            >
              <RefreshCw size={15} /> Verify public gossip graph
            </button>
          </div>
          {resources && (
            <pre className="rpc-output">
              {JSON.stringify(resources, null, 2)}
            </pre>
          )}
        </section>
        {profile === "B" ? (
          <section className="panel ops-panel">
            <span className="ops-kicker">4 · NODE B</span>
            <h2>Create recipient invoice</h2>
            <label className="ops-label">Amount (raw units)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            />
            <button
              className="btn primary"
              disabled={busy || !amount}
              onClick={() => void createInvoice()}
            >
              Create MPP / trampoline invoice
            </button>
            {invoice && (
              <div className="fiber-result">
                <textarea readOnly value={invoice.invoice} />
                <button
                  className="btn secondary"
                  onClick={() =>
                    void navigator.clipboard.writeText(invoice.invoice)
                  }
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="panel ops-panel">
            <span className="ops-kicker">5 · NODE A</span>
            <h2>Route and send payment</h2>
            <label className="ops-label">Node B invoice</label>
            <textarea
              className="ops-textarea"
              value={invoice?.invoice ?? ""}
              onChange={(e) => {
                setInvoice({
                  invoice: e.target.value,
                  paymentHash: "",
                  nodePubkey: "",
                  createdAt: new Date().toISOString(),
                });
                setPayment(null);
                setVerification(null);
              }}
            />
            <label className="ops-label">
              Trampoline pubkeys (optional, max 5, comma separated)
            </label>
            <input
              value={trampoline}
              onChange={(e) => setTrampoline(e.target.value)}
              placeholder="relay_1_pubkey, relay_2_pubkey"
            />
            <div className="ops-actions">
              <button
                className="btn secondary"
                disabled={busy || !invoice?.invoice}
                onClick={() => void sendPayment(true)}
              >
                Dry-run gossip route
              </button>
              <button
                className="btn primary"
                disabled={busy || !invoice?.invoice}
                onClick={() => void sendPayment(false)}
              >
                <Send size={15} /> Send payment
              </button>
            </div>
            {payment && (
              <pre className="rpc-output">
                {JSON.stringify(payment, null, 2)}
              </pre>
            )}
          </section>
        )}
        <section className="panel ops-panel">
          <span className="ops-kicker">VERIFY</span>
          <h2>{profile === "B" ? "Invoice settlement" : "Payment session"}</h2>
          <button
            className="btn secondary"
            disabled={busy || !invoice?.invoice}
            onClick={() => void verify()}
          >
            Refresh verification
          </button>
          {verification && (
            <pre className="rpc-output">
              {JSON.stringify(verification, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
