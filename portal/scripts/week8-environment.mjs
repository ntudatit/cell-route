// Read-only chain probe. Never submits or signs a transaction.
import { ccc } from "@ckb-ccc/core";
import {
  getSporeScriptInfo,
  getClusterScriptInfo,
  SporeVersion,
} from "@ckb-ccc/spore";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const directory = new URL("../../docs/evidence/week-8/", import.meta.url);
mkdirSync(directory, { recursive: true });
const client = new ccc.ClientPublicTestnet({
  url: "https://testnet.ckb.dev",
  fallbacks: [],
  timeout: 15000,
});
const expectedGenesis =
  "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
const record = {
  timestamp: new Date().toISOString(),
  packageManager: "npm",
  node: process.version,
  network: "testnet",
  rpcOrigin: new URL(client.url).origin,
  sdk: {},
  contractVersion: "V2 SDK deployment",
  contracts: [],
  status: "NOT EXECUTED",
};
for (const name of [
  "@ckb-ccc/core",
  "@ckb-ccc/connector-react",
  "@ckb-ccc/spore",
  "vitest",
  "@playwright/test",
])
  record.sdk[name] = JSON.parse(
    readFileSync(
      new URL(`../node_modules/${name}/package.json`, import.meta.url),
    ),
  ).version;
try {
  record.genesisHash = (await client.getBlockByNumber(0))?.header.hash;
  if (record.genesisHash !== expectedGenesis) throw Error("Genesis mismatch");
  for (const [name, info] of [
    ["spore", getSporeScriptInfo(client, SporeVersion.V2)],
    ["cluster", getClusterScriptInfo(client, SporeVersion.V2)],
  ]) {
    const cell = await client.getCellLiveNoCache(
      info.cellDeps[0].cellDep.outPoint,
      true,
    );
    if (!cell || ccc.hashCkb(cell.outputData) !== info.codeHash)
      throw Error("Code dependency verification failed");
    record.contracts.push({
      name,
      codeHash: info.codeHash,
      hashType: info.hashType,
      dependencies: info.cellDeps,
      live: true,
      dataBytes: ccc.bytesFrom(cell.outputData).length,
    });
  }
  record.status = "READ-ONLY DEPLOYMENT VERIFIED";
  // Official decoder hash from the pinned Cookbook/CCC configuration; never execute a mismatched binary.
  const decoderPoint = {
    txHash:
      "0x4a8a0d079f8438bed89e0ece1b14e67ab68e2aa7688a5f4917a59a185e0f8fd5",
    index: 0,
  };
  const decoder = await client.getCellLiveNoCache(decoderPoint, true);
  if (
    !decoder ||
    ccc.hashCkb(decoder.outputData) !==
      "0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c"
  )
    throw Error("Decoder code verification failed");
  const bytes = ccc.bytesFrom(decoder.outputData);
  const binary = new URL(
    "../../contracts/build/runtime-lab/dob0-decoder",
    import.meta.url,
  );
  writeFileSync(binary, bytes);
  record.decoder = {
    outPoint: decoderPoint,
    codeHash: ccc.hashCkb(bytes),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    verified: true,
  };
} catch (error) {
  record.error = error instanceof Error ? error.name : "ProbeError";
  record.note =
    "Incomplete probe; see verified fields only. No chain lifecycle actions executed.";
}
writeFileSync(
  new URL("environment.json", directory),
  JSON.stringify(
    record,
    (_, value) =>
      typeof value === "bigint" ? `0x${value.toString(16)}` : value,
    2,
  ) + "\n",
);
for (const operation of [
  "spore-create",
  "spore-read",
  "spore-transfer",
  "spore-melt",
  "cluster",
]) {
  const path = new URL(`${operation}.json`, directory);
  // Keep this command read-only: never overwrite operator-supplied chain receipts.
  try {
    writeFileSync(
      path,
      JSON.stringify(
        {
          operation,
          status: "NOT EXECUTED",
          reason:
            "Requires an interactive funded wallet and user-reviewed transactions. Read-only deployment probe is separate evidence.",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
console.log(
  JSON.stringify(
    record,
    (_, value) => (typeof value === "bigint" ? String(value) : value),
    2,
  ),
);
