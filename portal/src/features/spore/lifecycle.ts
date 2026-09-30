import { ccc } from "@ckb-ccc/connector-react";
import {
  createSpore,
  createSporeCluster,
  findCluster,
  findSpore,
  getClusterScriptInfo,
  getSporeScriptInfo,
  meltSpore,
  SporeVersion,
  transferSpore,
  transferSporeCluster,
} from "@ckb-ccc/spore";
import {
  clientNetwork,
  configuredNetwork,
  MAINNET_GENESIS,
} from "../../utils/network";
import { clusterDescription } from "./dob/fixture";

export const CONTENT_LIMIT = 16 * 1024;
export const TESTNET_GENESIS =
  "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
export const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? `0x${v.toString(16)}` : v),
    2,
  );
export function checkedId(id: string) {
  if (!/^0x[0-9a-f]{64}$/i.test(id.trim()))
    throw Error("ID must be exactly 32 bytes with a 0x prefix.");
  return id.trim().toLowerCase();
}
export function contentInfo(content: Uint8Array) {
  if (!content.length || content.length > CONTENT_LIMIT)
    throw Error("Use 1–16,384 bytes (the Studio product limit).");
  return { bytes: content.length, hash: ccc.hashCkb(content) };
}
export function assertGenesis(network: string, genesis?: string) {
  if (network === "devnet")
    throw Error(
      "Devnet Spore deployment is not configured and verified. Select Testnet.",
    );
  if (genesis !== (network === "mainnet" ? MAINNET_GENESIS : TESTNET_GENESIS))
    throw Error("Network/genesis mismatch.");
}
export async function verifyNetwork(client: ccc.Client, signer: ccc.Signer) {
  const network = clientNetwork(client);
  if (configuredNetwork === "mainnet" && network !== "mainnet")
    throw Error("Configured Mainnet does not match selected network.");
  if (clientNetwork(signer.client) !== network)
    throw Error("Wallet network does not match selected network.");
  const [selected, wallet] = await Promise.all([
    client.getBlockByNumber(0),
    signer.client.getBlockByNumber(0),
  ]);
  assertGenesis(network, selected?.header.hash);
  assertGenesis(network, wallet?.header.hash);
  const scripts = {
    spore: getSporeScriptInfo(client, SporeVersion.V2),
    cluster: getClusterScriptInfo(client, SporeVersion.V2),
  };
  for (const info of Object.values(scripts)) {
    for (const dep of info.cellDeps) {
      const cell = await client.getCellLiveNoCache(dep.cellDep.outPoint, true);
      if (
        !cell ||
        dep.cellDep.depType !== "code" ||
        info.hashType !== "data1" ||
        ccc.hashCkb(cell.outputData) !== info.codeHash
      )
        throw Error(
          "Spore/Cluster code dependency missing or code hash mismatch.",
        );
    }
  }
  // Endpoints may contain credentials in paths as well as query strings. Export origin only.
  return {
    network,
    configuredNetwork,
    genesisHash: selected!.header.hash,
    rpcOrigin: new URL(client.url).origin,
    sdkVersion: "1.6.9",
    cccVersion: "1.19.1",
    contractVersion: "V2 (SDK pinned deployment)",
    scripts,
  };
}
export type Operation =
  "create" | "transfer" | "melt" | "cluster-create" | "cluster-transfer";
export interface Request {
  operation: Operation;
  id?: string;
  clusterId?: string;
  content?: Uint8Array;
  contentType?: string;
  recipient?: string;
  name?: string;
  description?: string;
  pinnedDob?: boolean;
}
export async function ownedCell(signer: ccc.Signer, cell: ccc.Cell) {
  const addresses = await signer.getAddresses();
  const locks = await Promise.all(
    addresses.map((a) => ccc.Address.fromString(a, signer.client)),
  );
  if (!locks.some((a) => a.script.eq(cell.cellOutput.lock)))
    throw Error(
      "Authorization failed: this wallet does not own the live Cell.",
    );
  if (!(await signer.client.getCellLiveNoCache(cell.outPoint, true)))
    throw Error("Asset Cell is no longer live. Refresh and prepare again.");
}
export async function readSpore(client: ccc.Client, id: string) {
  const found = await findSpore(client, checkedId(id), [
    getSporeScriptInfo(client, SporeVersion.V2),
  ]);
  if (!found)
    throw Error(
      "No indexed live V2 Spore found. Indexer absence alone does not prove melt.",
    );
  const live = await client.getCellLiveNoCache(found.cell.outPoint, true);
  if (!live || live.outputData !== found.cell.outputData)
    throw Error("Indexer/node disagreement; retry after synchronization.");
  const bytes = ccc.bytesFrom(found.sporeData.content);
  return {
    id: checkedId(id),
    cell: live,
    contentType: found.sporeData.contentType,
    content: bytes,
    contentHash: ccc.hashCkb(bytes),
    bytes: bytes.length,
    clusterId: found.sporeData.clusterId,
    text: new TextDecoder().decode(bytes),
  };
}
export type Prepared = Awaited<ReturnType<typeof prepare>>;
export async function prepare(
  client: ccc.Client,
  signer: ccc.Signer,
  request: Request,
) {
  const environment = await verifyNetwork(client, signer);
  const sender = await signer.getRecommendedAddress();
  const owner = (await signer.getRecommendedAddressObj()).script;
  const to = request.recipient
    ? (await ccc.Address.fromString(request.recipient.trim(), client)).script
    : owner;
  const isCluster = request.operation.startsWith("cluster");
  let before: ccc.Cell | undefined;
  let clusterBefore: ccc.Cell | undefined;
  let content = request.content;
  let contentType = request.contentType;
  let clusterId = request.clusterId?.trim()
    ? checkedId(request.clusterId)
    : undefined;
  let built: { tx: ccc.Transaction; id?: string };
  if (request.operation === "create") {
    contentInfo(content ?? new Uint8Array());
    if (!contentType || contentType.length > 128)
      throw Error("Missing or oversized content type.");
    if (clusterId) {
      const cluster = await findCluster(client, clusterId, [
        environment.scripts.cluster,
      ]);
      if (!cluster)
        throw Error(
          "Unknown Cluster ID. The requested link will not be dropped.",
        );
      if (
        request.pinnedDob &&
        cluster.clusterData.description !== clusterDescription(client)
      )
        throw Error(
          "Selected Cluster does not contain the pinned DOB/0 pattern and decoder.",
        );
      await ownedCell(signer, cluster.cell);
      clusterBefore = cluster.cell;
    }
    if (request.pinnedDob && !clusterId)
      throw Error("Pinned DOB requires a Cluster.");
    built = await createSpore({
      signer,
      data: { contentType, content: content!, clusterId },
      ...(clusterId ? { clusterMode: "clusterCell" as const } : {}),
      scriptInfo: environment.scripts.spore,
    });
  } else if (request.operation === "cluster-create") {
    if (!request.name?.trim()) throw Error("Cluster name is required.");
    contentInfo(
      new TextEncoder().encode(
        (request.name ?? "") + (request.description ?? ""),
      ),
    );
    built = await createSporeCluster({
      signer,
      data: {
        name: request.name.trim(),
        description: request.description ?? "",
      },
      scriptInfo: environment.scripts.cluster,
    });
  } else {
    const id = checkedId(request.id ?? "");
    if (isCluster) {
      const found = await findCluster(client, id, [
        environment.scripts.cluster,
      ]);
      if (!found) throw Error("Unknown live Cluster.");
      before = found.cell;
    } else {
      const found = await readSpore(client, id);
      before = found.cell;
      content = found.content;
      contentType = found.contentType;
      clusterId = found.clusterId ? ccc.hexFrom(found.clusterId) : undefined;
      if (
        request.operation === "melt" &&
        /(?:^|;)\s*immortal(?:=|;|$)/i.test(contentType)
      )
        throw Error("Immortal Spore cannot be melted.");
    }
    await ownedCell(signer, before);
    if (request.operation !== "melt" && !request.recipient?.trim())
      throw Error("Recipient is required.");
    built = isCluster
      ? await transferSporeCluster({
          signer,
          id,
          to,
          scripts: [environment.scripts.cluster],
        })
      : request.operation === "melt"
        ? await meltSpore({ signer, id, scripts: [environment.scripts.spore] })
        : await transferSpore({
            signer,
            id,
            to,
            scripts: [environment.scripts.spore],
          });
  }
  await built.tx.completeInputsByCapacity(signer);
  await built.tx.completeFeeBy(signer, 2000);
  const tx = await signer.prepareTransaction(built.tx);
  const inputs = await Promise.all(
    tx.inputs.map((i) => client.getCellLiveNoCache(i.previousOutput, true)),
  );
  if (inputs.some((i) => !i)) throw Error("Input is no longer live.");
  const inputCapacity = inputs.reduce(
    (sum, cell) => sum + cell!.cellOutput.capacity,
    0n,
  );
  const outputCapacity = tx.getOutputsCapacity();
  const fee = inputCapacity - outputCapacity;
  if (fee < BigInt(tx.toBytes().length + 4) * 2n)
    throw Error(
      "Prepared fee is below 2000 shannons/KB; prepare again with this wallet.",
    );
  const id = built.id ?? checkedId(request.id!);
  const assetIndex = tx.outputs.findIndex((o) => o.type?.args === id);
  if (before && request.operation !== "melt")
    assertPreserved(before, tx, assetIndex, to);
  if (clusterBefore) {
    const index = tx.outputs.findIndex((o) =>
      o.type?.eq(clusterBefore!.cellOutput.type!),
    );
    assertPreserved(clusterBefore, tx, index, clusterBefore.cellOutput.lock);
    if (
      tx.outputs[index].capacity !== clusterBefore.cellOutput.capacity ||
      !tx.inputs.some((i) => i.previousOutput.eq(clusterBefore!.outPoint)) ||
      !tx.cellDeps.some((d) => d.outPoint.eq(clusterBefore!.outPoint))
    )
      throw Error("Required Cluster input/dependency or capacity missing.");
  }
  return {
    tx,
    rawHash: tx.hash(),
    createdAt: Date.now(),
    environment,
    operation: request.operation,
    id,
    clusterId,
    sender,
    owner,
    recipientLock: to,
    before,
    clusterBefore,
    contentHex: content ? ccc.hexFrom(content) : undefined,
    review: {
      operation: request.operation,
      network: environment.network,
      genesisHash: environment.genesisHash,
      sender,
      recipientLock: to,
      sporeId: isCluster ? undefined : id,
      clusterId: isCluster ? id : clusterId,
      contentType,
      contentBytes: content?.length,
      contentHash: content ? ccc.hashCkb(content) : undefined,
      inputs: inputs.map((c) => ({ outPoint: c!.outPoint, ...c!.cellOutput })),
      outputs: tx.outputs,
      inputCapacity: inputCapacity.toString(),
      outputCapacity: outputCapacity.toString(),
      feeShannons: fee.toString(),
      assetCapacity:
        assetIndex < 0 ? "0" : tx.outputs[assetIndex].capacity.toString(),
      untypedChangeToSender: tx.outputs
        .filter((o) => !o.type && o.lock.eq(owner))
        .reduce((n, o) => n + o.capacity, 0n)
        .toString(),
      serializedBytes: tx.toBytes().length,
      warning:
        request.operation === "melt"
          ? "IRREVERSIBLE: consumes the live Spore Cell. Blockchain history remains."
          : "Public on-chain content; capacity is locked separately from the fee.",
    },
  };
}
export function assertPreserved(
  before: ccc.Cell,
  tx: ccc.Transaction,
  index: number,
  lock: ccc.Script,
) {
  const output = tx.outputs[index];
  if (
    !output ||
    !output.type?.eq(before.cellOutput.type!) ||
    !output.lock.eq(lock) ||
    tx.outputsData[index] !== before.outputData
  )
    throw Error("Asset identity, content or recipient was not preserved.");
}
export function requireMeltConfirmation(
  operation: Operation,
  confirmed: boolean,
) {
  if (operation === "melt" && !confirmed)
    throw Error("Explicit irreversible melt confirmation is required.");
}
export async function signPrepared(
  client: ccc.Client,
  signer: ccc.Signer,
  prepared: Prepared,
  confirmed: boolean,
) {
  requireMeltConfirmation(prepared.operation, confirmed);
  if (Date.now() - prepared.createdAt > 300000)
    throw Error("Review expired. Prepare again.");
  const network = await verifyNetwork(client, signer);
  if (
    network.genesisHash !== prepared.environment.genesisHash ||
    (await signer.getRecommendedAddress()) !== prepared.sender
  )
    throw Error("Wallet/network changed; prepare again.");
  for (const input of prepared.tx.inputs)
    if (!(await client.getCellLiveNoCache(input.previousOutput, true, true)))
      throw Error("Reviewed input is spent or unavailable.");
  if (prepared.tx.hash() !== prepared.rawHash)
    throw Error("Reviewed transaction changed.");
  const signed = await signer.signOnlyTransaction(prepared.tx.clone());
  if (signed.hash() !== prepared.rawHash)
    throw Error("Wallet changed reviewed transaction. Nothing broadcast.");
  if (
    BigInt(prepared.review.feeShannons) <
    BigInt(signed.toBytes().length + 4) * 2n
  )
    throw Error("Signed size exceeds reviewed fee budget. Prepare again.");
  return signed;
}
export type ObservedStatus =
  "pending" | "proposed" | "committed" | "rejected" | "timeout";
export async function observe(
  client: ccc.Client,
  hash: string,
  update: (state: ObservedStatus) => void,
  signal: AbortSignal,
  timeout = 180000,
  interval = 3000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const result = await client.getTransactionNoCache(hash);
    const status = result?.status;
    if (status === "committed" || status === "rejected") {
      update(status);
      return result!;
    }
    update(status === "proposed" ? "proposed" : "pending");
    await new Promise<void>((resolve) => setTimeout(resolve, interval));
  }
  update("timeout");
  return undefined;
}
export async function verifyCommitted(
  client: ccc.Client,
  p: Prepared,
  hash: string,
) {
  const node = await client.getTransactionNoCache(hash);
  if (node?.status !== "committed" || node.transaction.hash() !== p.rawHash)
    throw Error("Node commitment is not verified.");
  for (const input of p.tx.inputs)
    if (await client.getCellLiveNoCache(input.previousOutput, false))
      throw Error("Committed input still live; verification incomplete.");
  const outputCapacity = node.transaction.getOutputsCapacity();
  if (
    BigInt(p.review.inputCapacity) - outputCapacity !==
    BigInt(p.review.feeShannons)
  )
    throw Error("Capacity reconciliation failed.");
  const cluster = p.operation.startsWith("cluster");
  const found = cluster
    ? await findCluster(client, p.id, [p.environment.scripts.cluster])
    : await findSpore(client, p.id, [p.environment.scripts.spore]);
  if (p.operation === "melt") {
    if (found)
      throw Error(
        "Node committed; indexer still returns Spore. Retry verification after indexer synchronization.",
      );
    if (
      node.transaction.outputs.some((o) =>
        o.type?.eq(p.before!.cellOutput.type!),
      )
    )
      throw Error("Melt unexpectedly recreated the Spore.");
  } else {
    if (!found || found.cell.outPoint.txHash !== hash)
      throw Error(
        "Node committed; indexer verification pending (or object moved again). Retry verification.",
      );
    const index = Number(found.cell.outPoint.index);
    if (
      found.cell.outputData !== p.tx.outputsData[index] ||
      !found.cell.cellOutput.lock.eq(p.recipientLock)
    )
      throw Error("Live asset does not match reviewed output.");
    if (!(await client.getCellLiveNoCache(found.cell.outPoint, true)))
      throw Error("Indexed output is no longer live.");
  }
  return {
    status: "committed",
    verification: "node + consumed inputs + indexer + capacity",
    transactionHash: hash,
    id: p.id,
    outPoint: found?.cell.outPoint,
    timestamp: new Date().toISOString(),
    environment: p.environment,
    review: p.review,
    outputs: node.transaction.outputs,
  };
}
