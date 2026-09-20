import { ccc } from "@ckb-ccc/core";
export const U128_MAX = (1n << 128n) - 1n;
export type TokenStandard = "SUDT" | "XUDT";
export type TokenAction = "MINT" | "TRANSFER" | "BURN";
export type TokenDeployment = {
  network: string;
  genesisHash: string;
  script: ccc.ScriptInfoLike;
};
export function encodeAmount(value: bigint): ccc.Hex {
  if (typeof value !== "bigint" || value < 0n || value > U128_MAX)
    throw new Error("Amount outside uint128 range.");
  return ccc.hexFrom(ccc.numLeToBytes(value, 16));
}
export function decodeAmount(data: string): bigint {
  if (!/^0x(?:[0-9a-f]{2}){16,}$/i.test(data))
    throw new Error("Token data needs at least 16 valid bytes.");
  return ccc.numFromBytes(ccc.bytesFrom(data).slice(0, 16));
}
export function sumAmounts(values: Iterable<bigint>) {
  let total = 0n;
  for (const value of values) {
    encodeAmount(value);
    total += value;
    if (total > U128_MAX) throw new Error("Token group uint128 overflow.");
  }
  return total;
}
export function parseTokenAmount(text: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error("Decimals must be an integer from 0 to 18.");
  if (!/^\d+(\.\d+)?$/.test(text.trim()))
    throw new Error("Enter an unsigned decimal amount.");
  const [whole, fraction = ""] = text.trim().split(".");
  if (fraction.length > decimals) throw new Error("Too many decimal places.");
  const raw =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  encodeAmount(raw);
  return raw;
}
export function tokenArgs(standard: TokenStandard, owner: ccc.Script) {
  return standard === "SUDT" ? owner.hash() : `${owner.hash()}00000000`;
}
export function tokenType(
  standard: TokenStandard,
  args: string,
  deployment: TokenDeployment,
) {
  const pattern =
    standard === "SUDT" ? /^0x[0-9a-f]{64}$/i : /^0x[0-9a-f]{64}00000000$/i;
  if (!pattern.test(args))
    throw new Error(
      standard === "SUDT"
        ? "sUDT args must be the 32-byte owner lock hash."
        : "This lab supports basic xUDT: owner hash + 00000000, without extensions.",
    );
  return ccc.Script.from({ ...deployment.script, args });
}
export async function verifyTokenDeployment(
  client: ccc.Client,
  deployment: TokenDeployment,
) {
  if (
    (await client.getBlockByNumber(0))?.header.hash !== deployment.genesisHash
  )
    throw new Error("Network/genesis mismatch. Refresh deployment metadata.");
  const info = ccc.ScriptInfo.from(deployment.script);
  if (!info.cellDeps.length) throw new Error("Missing token dependency.");
  let matched = false;
  for (const { cellDep } of info.cellDeps) {
    if (cellDep.depType !== "code")
      throw new Error("Unsupported token dependency group.");
    const cell = await client.getCellLive(cellDep.outPoint, true);
    if (!cell) throw new Error("Token dependency is no longer live.");
    if (
      (info.hashType === "type"
        ? cell.cellOutput.type?.hash()
        : ccc.hashCkb(cell.outputData)) === info.codeHash
    )
      matched = true;
  }
  if (!matched)
    throw new Error("Token code hash does not match the live dependency.");
}
export function assertTokenAccounting(
  action: TokenAction,
  input: bigint,
  output: bigint,
  amount: bigint,
) {
  const expected =
    action === "MINT"
      ? input + amount
      : action === "BURN"
        ? input - amount
        : input;
  if (input < 0n || output < 0n || output !== expected)
    throw new Error("Token accounting mismatch. No implicit burn is allowed.");
  encodeAmount(input);
  encodeAmount(output);
}
export async function ownedTokenCells(signer: ccc.Signer, type: ccc.Script) {
  const cells: ccc.Cell[] = [];
  for await (const cell of signer.findCells({ script: type }, true)) {
    if (!cell.cellOutput.type?.eq(type)) continue;
    if (ccc.bytesFrom(cell.outputData).length !== 16)
      throw new Error(
        "Extended token data is unsupported by this lab; refusing to discard it.",
      );
    decodeAmount(cell.outputData);
    cells.push(cell);
  }
  sumAmounts(cells.map((c) => decodeAmount(c.outputData)));
  return cells;
}
export type TokenReview = {
  tx: ccc.Transaction;
  signer: ccc.Signer;
  sender: string;
  standard: TokenStandard;
  action: TokenAction;
  amount: bigint;
  type: ccc.Script;
  deployment: TokenDeployment;
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  fingerprint: string;
};
export async function prepareToken(
  signer: ccc.Signer,
  deployment: TokenDeployment,
  standard: TokenStandard,
  action: TokenAction,
  args: string,
  amount: bigint,
  recipient: string,
): Promise<TokenReview> {
  encodeAmount(amount);
  if (amount === 0n) throw new Error("Amount must be positive.");
  await verifyTokenDeployment(signer.client, deployment);
  const type = tokenType(standard, args, deployment);
  const owner = await signer.getRecommendedAddressObj();
  const sender = await signer.getRecommendedAddress();
  const to =
    action === "BURN"
      ? owner.script
      : (await ccc.Address.fromString(recipient || sender, signer.client))
          .script;
  const tx = ccc.Transaction.default();
  let inputAmount = 0n;
  if (action === "MINT") {
    if (args.slice(0, 66).toLowerCase() !== owner.script.hash())
      throw new Error("Mint requires the issuer wallet.");
    for await (const cell of signer.findCells(
      { scriptLenRange: [0, 1], outputDataLenRange: [0, 1] },
      true,
    )) {
      if (
        !cell.cellOutput.type &&
        cell.outputData === "0x" &&
        cell.cellOutput.lock.eq(owner.script)
      ) {
        tx.addInput(cell);
        break;
      }
    }
    if (!tx.inputs.length)
      throw new Error("Mint requires a live plain-capacity owner input.");
    tx.addOutput({ lock: to, type }, encodeAmount(amount));
  } else {
    const cells = await ownedTokenCells(signer, type);
    for (const cell of cells) {
      tx.addInput(cell);
      inputAmount = sumAmounts([inputAmount, decodeAmount(cell.outputData)]);
      if (inputAmount >= amount) break;
    }
    if (inputAmount < amount) throw new Error("Insufficient token balance.");
    if (action === "TRANSFER")
      tx.addOutput({ lock: to, type }, encodeAmount(amount));
    if (inputAmount > amount)
      tx.addOutput(
        { lock: owner.script, type },
        encodeAmount(inputAmount - amount),
      );
  }
  tx.cellDeps.push(
    ...ccc.ScriptInfo.from(deployment.script).cellDeps.map((d) => d.cellDep),
  );
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 2000);
  const inputs = await Promise.all(
    tx.inputs.map((i) => i.getCell(signer.client)),
  );
  // Generic capacity completion must never consume typed cells from another asset.
  if (inputs.some((c) => c.cellOutput.type && !c.cellOutput.type.eq(type)))
    throw new Error("Unexpected typed capacity input.");
  inputAmount = sumAmounts(
    inputs
      .filter((c) => c.cellOutput.type?.eq(type))
      .map((c) => decodeAmount(c.outputData)),
  );
  const outputAmount = sumAmounts(
    tx.outputs.flatMap((o, i) =>
      o.type?.eq(type) ? [decodeAmount(tx.outputsData[i])] : [],
    ),
  );
  assertTokenAccounting(action, inputAmount, outputAmount, amount);
  const fee = await tx.getFee(signer.client);
  if (fee < 0n) throw new Error("Invalid transaction fee.");
  return {
    tx,
    signer,
    sender,
    standard,
    action,
    amount,
    type,
    deployment,
    inputAmount,
    outputAmount,
    fee,
    fingerprint: ccc.hexFrom(tx.toBytes()),
  };
}
export async function submitToken(review: TokenReview, signer: ccc.Signer) {
  if (
    review.signer !== signer ||
    review.sender !== (await signer.getRecommendedAddress())
  )
    throw new Error("Wallet changed. Prepare a new preview.");
  if (ccc.hexFrom(review.tx.toBytes()) !== review.fingerprint)
    throw new Error("Transaction changed after preview.");
  await verifyTokenDeployment(signer.client, review.deployment);
  for (const input of review.tx.inputs)
    if (!(await signer.client.getCellLive(input.previousOutput, true)))
      throw new Error("Input already spent. Prepare again.");
  return signer.sendTransaction(review.tx.clone());
}
export function moleculeExample(script: ccc.Script) {
  const witness = ccc.WitnessArgs.from({ lock: "0x1234", inputType: "0xab" });
  return {
    script: ccc.hexFrom(script.toBytes()),
    witness: ccc.hexFrom(witness.toBytes()),
    decodedScript: ccc.Script.fromBytes(script.toBytes()),
    decodedWitness: ccc.WitnessArgs.fromBytes(witness.toBytes()),
  };
}
