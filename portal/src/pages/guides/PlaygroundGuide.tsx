import { ExternalLink, PlayCircle } from "lucide-react";
import { CodeBlock, GuideHeader, GuideSection, GuideShell, StepList } from "../../components/GuideShell";

const transferExample = `import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

const receiver = await signer.getRecommendedAddress();
const { script: lock } = await ccc.Address.fromString(receiver, signer.client);

const tx = ccc.Transaction.from({
 outputs: [{ capacity: ccc.fixedPointFrom(100), lock }],
});

await render(tx);
await tx.completeInputsByCapacity(signer);
await render(tx);
await tx.completeFeeBy(signer, 1000);
await render(tx);

// When you are ready to broadcast:
// const txHash = await signer.sendTransaction(tx);`;

export function PlaygroundGuide() {
 return (
  <GuideShell>
   <GuideHeader
    eyebrow="Start here"
    title="CCC Playground"
    description="Use the browser IDE to learn CCC, inspect transactions step-by-step, and test on CKB Testnet before integrating the same flow into this React app."
    docsHref="https://docs.ckbccc.com/docs/playground"
   />
   <div className="guide-grid two">
    <GuideSection title="Playground workflow">
     <StepList items={[
      "Select Testnet and connect a wallet if the script needs to sign or broadcast.",
      "Write with @ckb-ccc/ccc and @ckb-ccc/playground helpers.",
      "Use render(tx) to inspect transaction state after each composition step.",
      "Use Step mode to pause at render() calls and inspect cells, inputs, outputs, fees, and change.",
      "Only call signer.sendTransaction(tx) after reviewing the final transaction.",
     ]} />
     <a className="btn primary inline-btn" href="https://playground.ckbccc.com/" target="_blank" rel="noreferrer">
      <PlayCircle size={17}/> Open CCC Playground <ExternalLink size={15}/>
     </a>
    </GuideSection>
    <GuideSection title="Canonical transfer example">
     <CodeBlock code={transferExample} />
    </GuideSection>
   </div>
   <GuideSection title="How this maps to the full-stack starter">
    <div className="guide-flow-row">
     <span>Playground experiment</span><b>→</b><span>React + CCC</span><b>→</b><span>Wallet signs</span><b>→</b><span>CKB</span><b>→</b><span> tracks tx</span>
    </div>
   </GuideSection>
  </GuideShell>
 );
}