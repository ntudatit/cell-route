import { CodeBlock, GuideHeader, GuideSection, GuideShell, StepList } from "../../components/GuideShell";

const nodeCode = `import { ccc } from "@ckb-ccc/shell";

const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(
 client,
 process.env.CKB_PRIVATE_KEY!,
);

await signer.connect();
const balance = await signer.getBalance();`;

const javaCode = `// This starter intentionally uses for its application backend.
// Browser wallet signing remains in React + CCC.

@Service
@RequiredArgsConstructor
public class CkbRpcService {
 private final RestClient ckbRestClient;

 public JsonNode getTransaction(String txHash) {
  return call("get_transaction", List.of(txHash));
 }
}`;

export function NodeBackendGuide() {
 return (
  <GuideShell>
   <GuideHeader title="Node.js Backend" description="CCC also supports autonomous server-side signing through @ckb-ccc/shell. This is an optional guide in this -based starter, not a replacement for Backend." docsHref="https://docs.ckbccc.com/docs/guides/node-js-backend" />
   <div className="guide-grid two">
    <GuideSection title="Official CCC server-side pattern"><CodeBlock code={nodeCode}/></GuideSection>
    <GuideSection title="How this project differs"><CodeBlock code={javaCode}/></GuideSection>
   </div>
   <GuideSection title="Choose the right backend responsibility">
    <StepList items={[
     "User-owned wallet transaction: keep signing in the browser with @ckb-ccc/connector-react.",
     " application backend: use Backend for business APIs, persistence, tx tracking, and CKB JSON-RPC reads.",
     "Autonomous service-owned wallet: optionally add a separate Node.js worker using @ckb-ccc/shell and a secrets manager.",
     "Never hardcode a service private key in source control.",
    ]}/>
   </GuideSection>
  </GuideShell>
 );
}