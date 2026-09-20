import { hexFrom, Transaction, numLeToBytes } from "@ckb-ccc/core";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  Resource,
  Verifier,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
} from "ckb-testtool";

const amount = (n: bigint) => hexFrom(numLeToBytes(n, 16));
function fixture(
  inputs: string[],
  outputs: string[],
  ownerMode = false,
  args?: string,
  secondGroup = false,
) {
  const resource = Resource.default(),
    tx = Transaction.default();
  const holder = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false,
  );
  const owner = holder.clone();
  owner.args = "0x01";
  const type = resource.deployCell(
    hexFrom(readFileSync("vendor/sudt/simple_udt")),
    tx,
    false,
  );
  type.args = hexFrom(args ?? owner.hash());
  tx.inputs.push(
    Resource.createCellInput(resource.mockCell(ownerMode ? owner : holder)),
  );
  for (const data of inputs)
    tx.inputs.push(
      Resource.createCellInput(resource.mockCell(holder, type, hexFrom(data))),
    );
  for (const data of outputs) {
    tx.outputs.push(Resource.createCellOutput(holder, type));
    tx.outputsData.push(hexFrom(data));
  }
  if (secondGroup) {
    const other = type.clone();
    other.args = holder.clone().hash();
    // Distinct owner hash with no matching input keeps both groups in normal mode.
    other.args = hexFrom("0x" + "42".repeat(32));
    tx.inputs.push(
      Resource.createCellInput(resource.mockCell(holder, other, amount(9n))),
    );
    tx.outputs.push(Resource.createCellOutput(holder, other));
    tx.outputsData.push(amount(9n));
  }
  const verifier = Verifier.from(resource, tx);
  verifier.debugger =
    process.env.CKB_DEBUGGER ??
    (process.env.LOCALAPPDATA
      ? join(
          process.env.LOCALAPPDATA,
          "offckb-nodejs/Data/tools/ckb-debugger.exe",
        )
      : "ckb-debugger");
  return verifier;
}
test("owner input mints 1000", async () => {
  await fixture([], [amount(1000n)], true).verifySuccess();
});
test("unauthorized mint rejects with -52", async () => {
  const v = fixture([], [amount(1n)]);
  mkdirSync("build/week6", { recursive: true });
  writeFileSync(
    "build/week6/unauthorized-mint.json",
    JSON.stringify(v.txFile(), null, 2),
  );
  await v.verifyFailure(-52);
});
test("multiple inputs transfer with token change", async () => {
  await fixture(
    [amount(600n), amount(400n)],
    [amount(250n), amount(750n)],
  ).verifySuccess();
});
test("explicit burn and full burn", async () => {
  await fixture([amount(750n)], [amount(700n)]).verifySuccess();
  await fixture([amount(700n)], []).verifySuccess();
});
test("short input/output amount rejects with -2 in normal mode", async () => {
  await fixture(["0x01"], [amount(1n)]).verifyFailure(-2);
  await fixture([amount(1n)], ["0x01"]).verifyFailure(-2);
});
test("owner mode bypasses amount validation", async () => {
  await fixture([], ["0x01"], true).verifySuccess();
});
test("input sum overflow rejects with -51", async () => {
  await fixture([amount((1n << 128n) - 1n), amount(1n)], []).verifyFailure(-51);
});
test("output sum overflow rejects with -51", async () => {
  await fixture(
    [amount(1n)],
    [amount((1n << 128n) - 1n), amount(1n)],
  ).verifyFailure(-51);
});
test("malformed args rejects with -1", async () => {
  await fixture([], [amount(1n)], true, "0x1234").verifyFailure(-1);
});
test("distinct type groups cannot subsidize inflation", async () => {
  await fixture(
    [amount(1n)],
    [amount(2n)],
    false,
    undefined,
    true,
  ).verifyFailure(-52);
});
test("independent type groups both conserve tokens", async () => {
  await fixture(
    [amount(10n)],
    [amount(7n), amount(3n)],
    false,
    undefined,
    true,
  ).verifySuccess();
});
