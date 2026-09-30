import { Link } from "react-router-dom";
import { AppLayout, PageHero } from "../../components/layout/AppLayout";
export function SporeProtocolGuide() {
  return (
    <AppLayout>
      <PageHero
        eyebrow="Spore V2 · CCC 1.6.9"
        title="Spore, Cluster and DOB/0"
        description="Review exact transaction semantics before signing. A hash alone does not prove commitment."
      />
      <section className="panel">
        <h2>Open the Studios</h2>
        <p>
          <Link to="/dob-spore">Spore / DOB Studio</Link> ·{" "}
          <Link to="/spore-clusters">Cluster Studio</Link>
        </p>
        <p>
          Create a small public text object, including Vietnamese Unicode. The
          Studio measures UTF-8 bytes and enforces a 16 KiB product limit. It
          checks selected and wallet genesis plus live V2 code dependencies
          before preparation and signing. Devnet is blocked until an explicit
          deployment is supported.
        </p>
        <ol>
          <li>
            Prepare with your wallet connected; review network, owner, IDs,
            content hash, inputs, outputs, capacity, fee and change.
          </li>
          <li>
            Confirm to sign. The raw transaction hash must remain identical to
            the review.
          </li>
          <li>
            Broadcast and observe pending/proposed/committed or
            rejection/timeout. A public broadcast receipt is downloaded.
          </li>
          <li>
            After node commitment, verify consumed inputs, indexed live output
            and capacity. Export verified evidence. Recheck if the indexer is
            delayed; do not resubmit on timeout.
          </li>
        </ol>
      </section>
      <section className="panel">
        <h2>Cell identity and ownership</h2>
        <p>
          The Spore Type Script args hold its ID. Molecule Cell data contains
          contentType, content bytes and optional clusterId. The Lock Script
          controls spending authorization; the Spore Type Script validates
          object creation, preservation and permitted destruction.
        </p>
        <p>
          Transfer consumes the old Cell and creates a new Cell with the same
          type/ID and content under the recipient lock. Its OutPoint changes
          because it is a different transaction output. A transaction hash
          identifies a transaction; an OutPoint is its hash plus output index.
        </p>
        <p>
          Melt consumes the Spore Cell. It does not erase blockchain history.
          The Studio requires explicit confirmation, checks node commitment and
          consumed inputs, and reconciles all output capacity with the reviewed
          fee. Plain text created here has no immortal content-type parameter.
        </p>
        <p>
          Capacity stays locked in an object's Cell until spent. Fee is the
          difference between total input and output capacity; it is not the
          object's capacity. Untyped change may also include separately supplied
          funding.
        </p>
      </section>
      <section className="panel">
        <h2>Cluster authorization</h2>
        <p>
          Create the Cluster first and wait for commitment. A linked mint uses
          the installed SDK's clusterCell mode: consume and recreate the
          authorized Cluster Cell unchanged, include the Cluster Cell as a
          dependency and include the V2 code dependency/cobuild action. The
          connected wallet must own its lock. Invalid, missing or unauthorized
          Clusters fail; links are never silently removed.
        </p>
      </section>
      <section className="panel">
        <h2>DOB/0: DNA → pattern → decoder → attributes</h2>
        <p>
          Select the pinned basic-loot pattern when creating a Cluster, then
          select DOB/0 DNA and that Cluster ID when preparing a Spore. The
          Studio checks the exact Cluster description. DNA is JSON in Spore
          content; pattern and code-hash decoder reference are in Cluster
          description.
        </p>
        <p>
          The isolated Worker implements only this pinned pattern. Preview
          renders escaped text attributes without HTML or external images.
          Timeout, size/schema errors and disabled decoder states preserve raw
          metadata. It is a local reference preview, not proof of minting or
          deployed decoder execution.
        </p>
      </section>
      <section className="panel">
        <h2>Performance and evidence</h2>
        <p>
          The existing iterative Fibonacci runtime benchmark compares a
          redundant initial memory clear with ELF/BSS zero initialization,
          preserving clears on reuse. Run npm run runtime:benchmark in
          contracts. CKB-VM cycles measure execution; binary bytes measure ELF
          size; transaction bytes and fee require transaction measurements. RPC
          latency and node commitment are separate observations.
        </p>
        <p>
          See docs/week-8-report.md and docs/evidence/week-8 for measured
          results and explicit NOT EXECUTED chain actions. The official decoder
          binary was verified by code hash, but ckb-debugger 1.1.1 rejected an
          unsupported instruction; its execution is not claimed as verified.
        </p>
      </section>
    </AppLayout>
  );
}
