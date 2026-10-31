import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
if (Number(process.versions.node.split(".")[0]) < 26)
  throw Error(
    "Run this isolated SDK check with Node 26; do not upgrade the portal to run it.",
  );
const bridge = await import("../build/ickb/bridge.mjs");
const { ccc } = await import("@ckb-ccc/core");
const sdk = await import("@ickb/sdk");
const base = new URL(".", import.meta.resolve("@ickb/sdk"));
// These pinned internal helpers are comparison/construction oracles ONLY, not portal APIs.
const udt = await import(new URL("udt.js", base));
const { getConfig } = await import(new URL("constants.js", base));
const dao = await import(new URL("dao.js", base));
const network = process.argv[2] ?? "testnet";
if (!["mainnet", "testnet"].includes(network))
  throw Error("Use testnet or mainnet.");
const root = fileURLToPath(new URL("../../", import.meta.url));
const replay = process.argv.includes("--replay");
const directory = new URL(
  replay ? "../build/ickb/replay/" : "../../docs/evidence/week-12/",
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
const json = (name, value) =>
  writeFileSync(new URL(name, directory), bridge.publicJson(value) + "\n");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const files = [
  "udt.js",
  "constants.js",
  "logic.js",
  "dao.js",
  "order/conversion.js",
];
const moduleHashes = Object.fromEntries(
  files.map((f) => [f, sha(readFileSync(new URL(f, base)))]),
);
const pinned = JSON.parse(
  readFileSync(new URL("sdk-module-hashes.json", import.meta.url), "utf8"),
);
assert.deepEqual(
  moduleHashes,
  pinned,
  "Pinned SDK comparison source bytes changed",
);
const records = [];
function check(name, layer, input, expected, actual) {
  assert.deepEqual(actual, expected, name);
  records.push({ name, layer, input, expected, actual, status: "passed" });
}
function rejects(name, fn) {
  let message;
  try {
    fn();
  } catch (e) {
    message = e.message;
  }
  assert.ok(message, name);
  records.push({
    name,
    layer: "local validation negative case",
    expected: "reject",
    actual: message,
    status: "passed",
  });
}
json("environment.json", {
  status: "running",
  mode: replay ? "historical snapshot replay" : "live RPC",
  startedAt: new Date().toISOString(),
});
let snapshot;
try {
  snapshot = replay
    ? JSON.parse(
        readFileSync(
          new URL(
            "../../docs/evidence/week-12/snapshot-" + network + ".json",
            import.meta.url,
          ),
          "utf8",
        ),
      )
    : await bridge.loadSnapshot(network);
} catch (e) {
  json("environment.json", {
    status: "blocked",
    network,
    reason: e.message,
    sdk: bridge.pins.sdk,
    measuredAt: new Date().toISOString(),
    runtime: process.version,
  });
  throw e;
}
json(`snapshot-${network}.json`, snapshot);
const verificationNow = replay ? Date.parse(snapshot.observedAt) : Date.now();
bridge.assertFresh(snapshot, network, verificationNow);
const raw = snapshot.header,
  daoBytes = ccc.bytesFrom(raw.dao),
  num = (i) => ccc.numFromBytes(daoBytes.slice(i * 8, i * 8 + 8));
const header = ccc.ClientBlockHeader.from({
  compactTarget: raw.compact_target,
  dao: { c: num(0), ar: num(1), s: num(2), u: num(3) },
  epoch: raw.epoch,
  extraHash: raw.extra_hash,
  hash: raw.hash,
  nonce: raw.nonce,
  number: raw.number,
  parentHash: raw.parent_hash,
  proposalsHash: raw.proposals_hash,
  timestamp: raw.timestamp,
  transactionsRoot: raw.transactions_root,
  version: raw.version,
});
const ar = BigInt(snapshot.ar),
  one = bridge.ONE,
  cap = bridge.CAP;
const ratio = sdk.ickbExchangeRatio(header);
check(
  "exchange ratio",
  "SDK public API",
  snapshot.header.hash,
  { ckbScale: bridge.AR0, udtScale: ar + bridge.EXCHANGE_DELTA },
  ratio,
);
const threshold = (cap * ar + bridge.AR0 - 1n) / bridge.AR0;
const amounts = [
  0n,
  1n,
  82n * one,
  1000n * one,
  cap - 1n,
  cap,
  threshold - 1n,
  threshold,
  threshold + 1n,
  threshold + 100n,
  2n * threshold,
  1000000n * one,
  bridge.U64,
];
for (const n of amounts) {
  check(
    `receipt-${n}`,
    "pinned internal SDK arithmetic",
    { freeShannons: n, header: raw.hash },
    udt.ickbValue(n, header),
    bridge.receiptValue(n, ar),
  );
  const back = (bridge.receiptValue(n, ar) * ar) / bridge.AR0;
  assert.ok(back <= n, "receipt round trip must not create value");
}
for (const dir of ["ckb-to-ickb", "ickb-to-ckb"])
  for (const n of [1n, 1000n * one, 100000n * one, 1000000n * one]) {
    const actual = sdk.quoteConversion(
      dir === "ckb-to-ickb",
      ratio,
      {
        ckbValue: dir === "ckb-to-ickb" ? n : 0n,
        udtValue: dir === "ickb-to-ckb" ? n : 0n,
      },
      { fee: sdk.DEFAULT_ORDER_FEE, feeBase: sdk.DEFAULT_ORDER_FEE_BASE },
    );
    check(
      `quote-${dir}-${n}`,
      "SDK public quote; not an order fill",
      { amount: n, header: raw.hash },
      actual.convertedAmount,
      bridge.indicative(n, ar, dir).output,
    );
  }
check(
  "default order fee",
  "SDK public constants",
  null,
  { fee: 10n, base: 100000n },
  { fee: sdk.DEFAULT_ORDER_FEE, base: sdk.DEFAULT_ORDER_FEE_BASE },
);
const config = getConfig(network);
check(
  "deployment logic",
  "pinned SDK configuration",
  network,
  config.ickbLogic.script.toHex(),
  ccc.Script.from(bridge.pins.logic).toHex(),
);
check(
  "deployment group",
  "pinned SDK configuration",
  network,
  config.ickbLogic.cellDeps[0].outPoint.toHex(),
  ccc.OutPoint.from(bridge.pins.networks[network].depGroup).toHex(),
);
const publicLock = ccc.Script.from({
  codeHash:
    "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type",
  args: "0x" + "00".repeat(20),
});
const free = 1000n * one;
const sdkTx = config.ickbLogic.deposit(
  ccc.Transaction.default(),
  1,
  free + bridge.OCCUPIED,
  publicLock,
);
const plan = bridge.depositPlan(snapshot, free, publicLock, verificationNow);
check(
  "deposit construction",
  "pinned internal SDK construction; UNFUNDED",
  { freeShannons: free, lock: publicLock, header: raw.hash },
  sdkTx.toHex(),
  plan.fingerprint,
);
json("deposit-construction.json", {
  ...plan,
  oracle: "LogicManager.deposit from pinned SDK internals",
  owner:
    "Public synthetic zero-args lock for construction only; no signer/key/funds",
  sdkTransactionHex: sdkTx.toHex(),
  execution: "not run",
  funded: false,
  submission: "not performed",
});
for (const [name, dir, amount, reason] of [
  ["negative amount", "ckb-to-ickb", -1n, "amount-negative"],
  ["insufficient CKB", "ckb-to-ickb", 1n, "insufficient-ckb"],
  ["insufficient iCKB", "ickb-to-ckb", 1n, "insufficient-ickb"],
]) {
  const guarded = await sdk.IckbSdk.fromChain(
    network,
  ).buildConversionTransaction({
    direction: dir,
    amount,
    context: { ckbAvailable: 0n, ickbAvailable: 0n, estimatedMaturity: 0n },
    signer: new Proxy(
      {},
      {
        get() {
          throw Error("No wallet should be consulted for an invalid request");
        },
      },
    ),
  });
  check(
    name,
    "SDK public builder early guard only",
    { amount, direction: dir },
    reason,
    guarded.reason,
  );
}
for (const [offset, ready] of [
  [1n, false],
  [8n, true],
  [72n, false],
  [120n, false],
]) {
  const claim = header.epoch.add(
    ccc.Epoch.from([offset / 4n, offset % 4n, 4n]),
  );
  const result = dao.depositMaturity(claim, header, sdk.WALLET_LOCK_UP);
  check(
    `withdrawal-window-${offset}/4`,
    "pinned SDK timing policy; not spendability",
    { offsetQuarters: offset, header: raw.hash },
    ready,
    result.isReady,
  );
}
rejects("negative user amount", () => bridge.units("-1"));
rejects("too many decimals", () => bridge.units("1.000000001"));
rejects("uint64 overflow", () => bridge.integer((bridge.U64 + 1n).toString()));
rejects("uint128 overflow", () =>
  bridge.indicative(bridge.U128 + 1n, ar, "ickb-to-ckb"),
);
rejects("invalid AR", () => bridge.receiptValue(1n, 0n));
rejects("network mismatch", () =>
  bridge.assertFresh(
    snapshot,
    network === "mainnet" ? "testnet" : "mainnet",
    verificationNow,
  ),
);
rejects("stale quote", () =>
  bridge.assertFresh(
    snapshot,
    network,
    Date.parse(snapshot.observedAt) + 300001,
  ),
);
rejects("missing dependency identity", () =>
  bridge.assertFresh({ ...snapshot, codeChecks: [] }, network, verificationNow),
);
rejects("bad group encoding", () => bridge.decodeDepGroup("0x01000000"));
rejects("header corruption", () =>
  bridge.validateHeader({ ...snapshot.header, dao: "0x" + "00".repeat(32) }),
);
rejects("deposit below minimum", () =>
  config.ickbLogic.deposit(
    ccc.Transaction.default(),
    1,
    999n * one + bridge.OCCUPIED,
    publicLock,
  ),
);
rejects("deposit above maximum", () =>
  config.ickbLogic.deposit(
    ccc.Transaction.default(),
    1,
    1000001n * one + bridge.OCCUPIED,
    publicLock,
  ),
);
rejects("zero deposit quantity", () =>
  config.ickbLogic.deposit(
    ccc.Transaction.default(),
    0,
    free + bridge.OCCUPIED,
    publicLock,
  ),
);
rejects("invalid order fee", () =>
  sdk.quoteConversion(
    true,
    ratio,
    { ckbValue: free, udtValue: 0n },
    { fee: 1n, feeBase: 1n },
  ),
);
json("conversion-vectors.json", {
  status: "passed",
  measuredAt: new Date().toISOString(),
  anchor: raw.hash,
  network,
  records,
});
json("environment.json", {
  status: "passed",
  mode: replay ? "historical snapshot replay" : "live RPC",
  measuredAt: new Date().toISOString(),
  network,
  runtime: process.version,
  sdk: bridge.pins.sdk,
  migration: bridge.pins.migration,
  sdkModuleHashes: moduleHashes,
  lockSha256: sha(readFileSync(new URL("package-lock.json", import.meta.url))),
  snapshot: raw.hash,
  genesis: snapshot.genesis,
  codeChecks: snapshot.codeChecks,
  layers: [
    "actual public RPC observation",
    "actual SDK pure arithmetic and construction",
    "independent integer arithmetic",
    "SDK public builder rejection guards",
  ],
  notPerformed: [
    "funded wallet preparation",
    "VM validation of the deposit construction",
    "signing",
    "broadcast",
    "commitment",
    "deposit/redeem lifecycle",
  ],
});
console.log(
  `PASS ${records.length} comparisons/negative cases against SDK ${bridge.pins.sdk.version}; construction unfunded, no broadcast.`,
);
