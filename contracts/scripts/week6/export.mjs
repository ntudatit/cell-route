import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ccc } from "@ckb-ccc/core";
import { createHash } from "node:crypto";
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
const system = JSON.parse(
  readFileSync("deployment/week6-system-scripts.json", "utf8"),
).devnet;
const client = new ccc.ClientPublicTestnet({
  url: "http://127.0.0.1:28114",
  fallbacks: [],
});
const genesisHash = (await client.getBlockByNumber(0)).header.hash;
const knownScripts = Object.fromEntries(
  [
    ["AnyoneCanPay", "anyone_can_pay"],
    ["OmniLock", "omnilock"],
    ["SUdt", "sudt"],
    ["XUdt", "xudt"],
    ["Secp256k1Blake160", "secp256k1_blake160_sighash_all"],
    ["NervosDao", "dao"],
  ].map(([key, value]) => [key, system[value].script]),
);
const binary = readFileSync("vendor/sudt/simple_udt");
for (const name of ["SUdt", "XUdt"]) {
  const info = knownScripts[name];
  const cell = await client.getCellLive(
    info.cellDeps[0].cellDep.outPoint,
    true,
  );
  if (!cell || cell.cellOutput.type?.hash() !== info.codeHash)
    throw Error("Dependency mismatch: " + name);
  if (name === "SUdt" && ccc.hashCkb(cell.outputData) !== ccc.hashCkb(binary))
    throw Error("Bundled binary differs from Devnet code");
}
const meta = {
  network: "devnet",
  rpcUrl: client.url,
  genesisHash,
  knownScripts,
  source: {
    repository: "https://github.com/nervosnetwork/ckb-production-scripts",
    referenceCommit: "e570c11aff3eca12a47237c21598429088c610d5",
    binaryOrigin:
      "OffCKB CLI 0.4.12 bundled sudt; verified against live Devnet code",
    dataHash: ccc.hashCkb(binary),
    sha256: createHash("sha256").update(binary).digest("hex"),
  },
};
writeFileSync(
  "deployment/token.devnet.json",
  JSON.stringify(meta, null, 2) + "\n",
);
copyFileSync(
  "deployment/token.devnet.json",
  "../portal/public/token.devnet.json",
);
mkdirSync("build/week6", { recursive: true });
copyFileSync("vendor/sudt/simple_udt", "build/week6/simple_udt");
console.log(
  "Verified sUDT / xUDT metadata exported. Data hash:",
  meta.source.dataHash,
);
