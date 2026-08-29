import { useMemo, useState } from "react";
import { Bot, BrainCircuit, DatabaseZap, Send, ShieldCheck, Sparkles, TerminalSquare, Wrench } from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";
import { aiApi, fiberOpsApi, type AiChatResponse } from "../../api/backend";

type Message = { role: "user" | "assistant"; text: string; response?: AiChatResponse };

const prompts = [
  "Why could a Fiber payment fail even when the node is online?",
  "Analyze current channel liquidity and tell me what needs attention.",
  "What should I check before retrying a failed cross-chain payment?",
  "Summarize the current operational risk from the latest Fiber telemetry.",
];

export function FiberAiCopilotPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "FiberOps AI is ready. I use Browser WASM telemetry + the FiberOps knowledge base. I am read-only: I will not send payments, close channels, or expose keys." },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lastResponse = useMemo(() => [...messages].reverse().find((m) => m.response)?.response, [messages]);

  async function ask(text = input) {
    const question = text.trim();
    if (!question || loading) return;
    setInput(""); setError(""); setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    try {
      const [overview, channels, incidents] = await Promise.allSettled([
        fiberOpsApi.overview(), fiberOpsApi.channels(), fiberOpsApi.incidents(),
      ]);
      const runtimeContext = {
        overview: overview.status === "fulfilled" ? overview.value : { unavailable: true },
        channels: channels.status === "fulfilled" ? channels.value : { unavailable: true },
        incidents: incidents.status === "fulfilled" ? incidents.value : [],
      };
      void aiApi.syncRuntimeSnapshot(runtimeContext).catch(() => undefined);
      const response = await aiApi.chat({ message: question, runtimeContext, maxChunks: 5 });
      setMessages((prev) => [...prev, { role: "assistant", text: response.answer, response }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", text: `Unable to complete the analysis: ${msg}` }]);
    } finally { setLoading(false); }
  }

  return (
    <AppLayout>
      <section className="ops-title-row ai-title-row">
        <div>
          <span className="page-eyebrow">FIBEROPS // AI-NATIVE OPERATIONS</span>
          <h1>AI Operations Copilot</h1>
          <p>RAG-assisted diagnosis over live Fiber WASM telemetry, incidents and operational knowledge.</p>
        </div>
        <div className="ai-safety-pill"><ShieldCheck size={15}/> READ-ONLY AI</div>
      </section>

      {error && <div className="ops-alert warning">{error}</div>}

      <section className="ai-layout-grid">
        <article className="panel ops-panel ai-chat-panel">
          <div className="panel-title">
            <div><span className="panel-kicker">OPERATOR COPILOT</span><h3><Bot size={18}/> FiberOps AI</h3></div>
            <span className="ops-badge healthy">RAG ONLINE</span>
          </div>
          <div className="ai-message-list">
            {messages.map((message, index) => (
              <div className={`ai-message ${message.role}`} key={index}>
                <div className="ai-message-role">{message.role === "assistant" ? <BrainCircuit size={15}/> : <TerminalSquare size={15}/>} {message.role}</div>
                <div className="ai-message-body">{message.text}</div>
                {message.response?.sources?.length ? (
                  <div className="ai-inline-sources">
                    {message.response.sources.slice(0,3).map((source) => <span key={source.id}>{source.title}</span>)}
                  </div>
                ) : null}
              </div>
            ))}
            {loading && <div className="ai-message assistant"><div className="ai-message-role"><Sparkles size={15}/> analyzing</div><div className="ai-typing"><i/><i/><i/></div></div>}
          </div>
          <div className="ai-prompt-chips">
            {prompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)} disabled={loading}>{prompt}</button>)}
          </div>
          <div className="ai-composer">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="Ask about routing, liquidity, incidents, reconciliation, Fiber WASM..." />
            <button className="btn primary" onClick={() => void ask()} disabled={loading || !input.trim()}><Send size={16}/> Ask</button>
          </div>
        </article>

        <aside className="ai-side-stack">
          <article className="panel ops-panel">
            <div className="panel-title"><div><span className="panel-kicker">GROUNDING</span><h3><DatabaseZap size={17}/> Context Sources</h3></div></div>
            <div className="ai-capability-list">
              <div><b>Fiber WASM</b><span>node / peers / channels</span></div>
              <div><b>Incident DB</b><span>diagnosis + timeline</span></div>
              <div><b>RAG Knowledge</b><span>runbooks + Fiber guidance</span></div>
              <div><b>Payment State</b><span>readiness + reconciliation</span></div>
            </div>
          </article>
          <article className="panel ops-panel">
            <div className="panel-title"><div><span className="panel-kicker">AGENT INTERFACE</span><h3><Wrench size={17}/> MCP Tools</h3></div></div>
            <code className="ai-endpoint">POST /mcp</code>
            <div className="ai-tool-list">
              <span>fiberops_latest_snapshot</span>
              <span>fiberops_list_incidents</span>
              <span>fiberops_search_knowledge</span>
              <span>fiberops_explain</span>
            </div>
            <p className="muted-copy">MCP is intentionally read-only. No payment or channel mutation tools are exposed.</p>
          </article>
          <article className="panel ops-panel ai-safety-card">
            <div className="panel-title"><div><span className="panel-kicker">POLICY</span><h3><ShieldCheck size={17}/> Safety Boundary</h3></div></div>
            <ul>
              <li>Private keys stay inside wallet / browser runtime.</li>
              <li>LLM only receives sanitized telemetry.</li>
              <li>Recovery actions require operator approval.</li>
              <li>Protocol validation wins over AI suggestions.</li>
            </ul>
            {lastResponse && <small>Provider: {lastResponse.provider}{lastResponse.model ? ` · ${lastResponse.model}` : ""}</small>}
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
