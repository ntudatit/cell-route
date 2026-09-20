// Ephemeral demo wallets exist only in memory. Evidence contains public data only.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ccc } from "@ckb-ccc/core";
import metadata from "../public/token.devnet.json";
import {
  prepareToken,
  submitToken,
  tokenArgs,
  tokenType,
  encodeAmount,
  ownedTokenCells,
  decodeAmount,
  sumAmounts,
  verifyTokenDeployment,
  type TokenStandard,
} from "../src/utils/token";

async function main() {
  const client = new ccc.ClientPublicTestnet({
    url: metadata.rpcUrl,
    fallbacks: [],
    scripts: metadata.knownScripts as unknown as Record<
      ccc.KnownScript,
      ccc.ScriptInfoLike
    >,
  });
  if (!/^http:\/\/127\.0\.0\.1:28114\/?$/.test(client.url))
    throw Error("Demo requires local OffCKB Devnet.");
  const owner = new ccc.SignerCkbPrivateKey(
    client,
    ccc.hexFrom(randomBytes(32)),
  );
  const holder = new ccc.SignerCkbPrivateKey(
    client,
    ccc.hexFrom(randomBytes(32)),
  );
  const ownerAddress = await owner.getRecommendedAddress(),
    holderAddress = await holder.getRecommendedAddress();
  const evidence: any = {
    network: "devnet",
    genesisHash: metadata.genesisHash,
    createdAt: new Date().toISOString(),
    ownerAddress,
    holderAddress,
    runs: [],
  };
  await verifyTokenDeployment(client, {
    network: "devnet",
    genesisHash: metadata.genesisHash,
    script: metadata.knownScripts.SUdt as ccc.ScriptInfoLike,
  });
  for (const address of [ownerAddress, holderAddress]) {
    // Invoke the installed CLI directly without shell interpolation or reading its accounts.
    const cli =
      process.env.OFFCKB_CLI ??
      join(
        process.env.APPDATA ?? "",
        "npm/node_modules/@offckb/cli/build/index.js",
      );
    const output = execFileSync(
      process.execPath,
      [cli, "deposit", address, "2000", "--network", "devnet"],
      { encoding: "utf8", timeout: 60000 },
    );
    const hashes = output.match(/0x[0-9a-f]{64}/gi);
    if (!hashes?.length) throw Error("No deposit transaction hash returned.");
    const funded = await client.waitTransaction(
      hashes[hashes.length - 1],
      0,
      90000,
    );
    if (funded?.status !== "committed") throw Error("Funding did not commit.");
  }
  for (const standard of ["SUDT", "XUDT"] as TokenStandard[]) {
    const deployment = {
      network: "devnet",
      genesisHash: metadata.genesisHash,
      script: metadata.knownScripts[
        standard === "SUDT" ? "SUdt" : "XUdt"
      ] as ccc.ScriptInfoLike,
    };
    const args = tokenArgs(
      standard,
      (await owner.getRecommendedAddressObj()).script,
    );
    const type = tokenType(standard, args, deployment);
    const run: any = { standard, type, transactions: [] };
    for (const [action, signer, amount, recipient] of [
      ["MINT", owner, 1000n, holderAddress],
      ["TRANSFER", holder, 250n, ownerAddress],
      ["BURN", holder, 50n, holderAddress],
    ] as const) {
      const review = await prepareToken(
        signer,
        deployment,
        standard,
        action,
        args,
        amount,
        recipient,
      );
      const inputCapacity = await review.tx.getInputsCapacity(client);
      const outputCapacity = review.tx.getOutputsCapacity();
      const txHash = await submitToken(review, signer);
      const committed = await client.waitTransaction(txHash, 0, 90000);
      if (committed?.status !== "committed")
        throw Error(`${action} did not commit.`);
      const ownerBalance = sumAmounts(
        (await ownedTokenCells(owner, type)).map((c) =>
          decodeAmount(c.outputData),
        ),
      );
      const holderBalance = sumAmounts(
        (await ownedTokenCells(holder, type)).map((c) =>
          decodeAmount(c.outputData),
        ),
      );
      run.transactions.push({
        action,
        txHash,
        status: committed.status,
        blockNumber: committed.blockNumber,
        inputAmount: review.inputAmount,
        outputAmount: review.outputAmount,
        inputCapacity,
        outputCapacity,
        fee: review.fee,
        ownerBalance,
        holderBalance,
      });
      console.log(`${standard} ${action}: committed ${txHash}`);
    }
    // Deliberately violate normal-mode supply conservation, with only holder inputs.
    const bad = ccc.Transaction.default();
    bad.addOutput(
      { lock: (await holder.getRecommendedAddressObj()).script, type },
      encodeAmount(1n),
    );
    bad.cellDeps.push(
      ...ccc.ScriptInfo.from(deployment.script).cellDeps.map((d) => d.cellDep),
    );
    await bad.completeInputsByCapacity(holder);
    await bad.completeFeeBy(holder, 2000);
    let rejection = "";
    try {
      await holder.sendTransaction(bad);
    } catch (error) {
      rejection = String(error);
    }
    if (!rejection.includes("-52"))
      throw Error(
        `Unauthorized mint did not return expected -52: ${rejection}`,
      );
    run.unauthorizedMint = { expectedExitCode: -52, error: rejection };
    evidence.runs.push(run);
  }
  mkdirSync("contracts/deployment", { recursive: true });
  writeFileSync(
    "contracts/deployment/week6-evidence.json",
    JSON.stringify(
      evidence,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ) + "\n",
  );
  console.log(
    "Saved public evidence to contracts/deployment/week6-evidence.json",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
