import { ccc } from "@ckb-ccc/connector-react";
import {
  findCluster,
  getClusterScriptInfo,
  SporeVersion,
  dob,
} from "@ckb-ccc/spore";
import { readSpore } from "../lifecycle";
export function decodePattern(dna: string, pattern: unknown) {
  if (
    !/^(?:[0-9a-f]{2}){1,256}$/i.test(dna) ||
    !Array.isArray(pattern) ||
    !pattern.length ||
    pattern.length > 32 ||
    JSON.stringify(pattern).length > 16384
  )
    throw Error("Unsupported or oversized DOB/0 DNA/pattern.");
  const bytes = Uint8Array.from(dna.match(/../g)!, (b) => parseInt(b, 16));
  const names = new Set<string>();
  return pattern.map((row: unknown) => {
    if (!Array.isArray(row)) throw Error("Invalid DOB pattern row.");
    const [name, type, start, length, mode, args] = row;
    if (
      typeof name !== "string" ||
      !name ||
      name.length > 128 ||
      names.has(name) ||
      !Number.isInteger(start) ||
      !Number.isInteger(length) ||
      start < 0 ||
      length < 1 ||
      length > 6 ||
      start + length > bytes.length
    )
      throw Error("Invalid trait name/DNA segment.");
    names.add(name);
    let number = 0;
    for (let i = length - 1; i >= 0; i--)
      number = number * 256 + bytes[start + i];
    let value: string | number;
    if (
      mode === "options" &&
      Array.isArray(args) &&
      args.length > 0 &&
      args.length <= 256
    ) {
      value = args[number % args.length];
      if (
        type === "String"
          ? typeof value !== "string" || value.length > 256
          : type !== "Number" ||
            !Number.isSafeInteger(value) ||
            Number(value) < 0
      )
        throw Error("Invalid options trait.");
    } else if (
      mode === "range" &&
      type === "Number" &&
      Array.isArray(args) &&
      args.length === 2 &&
      args.every((n) => Number.isSafeInteger(n) && n >= 0) &&
      args[1] > args[0]
    )
      value = args[0] + (number % (args[1] - args[0]));
    else if (mode === "rawNumber" && type === "Number") value = number;
    else
      throw Error(
        "Unsupported DOB trait mode; original metadata remains available.",
      );
    return { name, value };
  });
}
export async function readDob(client: ccc.Client, id: string) {
  const spore = await readSpore(client, id);
  if (spore.contentType !== "dob/0" || !spore.clusterId)
    throw Error("Selected Spore is not a clustered DOB/0.");
  if (spore.content.length > 16384)
    throw Error("DOB content exceeds preview limit.");
  const content = JSON.parse(spore.text);
  const cluster = await findCluster(client, spore.clusterId, [
    getClusterScriptInfo(client, SporeVersion.V2),
  ]);
  if (!cluster) throw Error("Cluster not available.");
  const live = await client.getCellLiveNoCache(cluster.cell.outPoint, true);
  if (!live || live.outputData !== cluster.cell.outputData)
    throw Error("Cluster indexer/node disagreement.");
  if (cluster.clusterData.description.length > 16384)
    throw Error("Cluster description exceeds preview limit.");
  const metadata = JSON.parse(cluster.clusterData.description);
  const expected = dob.getDecoder(client, "dob0");
  if (
    metadata.dob?.ver !== 0 ||
    metadata.dob.decoder?.type !== expected.type ||
    metadata.dob.decoder?.hash !== expected.hash ||
    JSON.stringify(metadata.dob.decoder?.script) !==
      JSON.stringify(expected.script)
  )
    throw Error(
      "Decoder identity is unsupported; no substitute traits were generated.",
    );
  const attributes = decodePattern(content.dna, metadata.dob.pattern);
  return {
    id: spore.id,
    sporeOutPoint: spore.cell.outPoint,
    clusterOutPoint: live.outPoint,
    dna: content.dna,
    pattern: metadata.dob.pattern,
    decoder: metadata.dob.decoder,
    attributes,
    contentHash: spore.contentHash,
    scope:
      "Bounded local reference of supported DOB/0 traits from node-checked content; deployed decoder VM not executed",
  };
}
