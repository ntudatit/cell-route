import { ccc } from "@ckb-ccc/connector-react";
import { dob } from "@ckb-ccc/spore";
import { decodePattern } from "./pattern";
export function clusterDescription(
  client: ccc.Client,
  description: string,
  patternText: string,
) {
  if (patternText.length > 16384) throw Error("DOB pattern exceeds 16 KiB.");
  const rows = JSON.parse(patternText);
  decodePattern("0000000000000000", rows);
  const pattern = rows.map((row: any[]) => ({
    traitName: row[0],
    dobType: row[1],
    dnaOffset: row[2],
    dnaLength: row[3],
    patternType: row[4],
    traitArgs: row[5],
  }));
  return dob.encodeClusterDescriptionForDob0({
    description,
    dob: { ver: 0, decoder: dob.getDecoder(client, "dob0"), pattern },
  });
}
export function validateCluster(
  client: ccc.Client,
  description: string,
  content: Uint8Array,
) {
  if (description.length > 16384)
    throw Error("Cluster description exceeds 16 KiB.");
  const metadata = JSON.parse(description),
    value = JSON.parse(new TextDecoder().decode(content));
  const expected = dob.getDecoder(client, "dob0");
  if (
    metadata.dob?.ver !== 0 ||
    metadata.dob.decoder?.type !== expected.type ||
    metadata.dob.decoder?.hash !== expected.hash ||
    JSON.stringify(metadata.dob.decoder?.script) !==
      JSON.stringify(expected.script)
  )
    throw Error("Unsupported DOB/0 decoder identity.");
  decodePattern(value.dna, metadata.dob.pattern);
}
