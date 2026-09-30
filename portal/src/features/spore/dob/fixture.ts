import { ccc } from "@ckb-ccc/connector-react";
import { dob } from "@ckb-ccc/spore";
export const PIN = {
  cookbook:
    "https://github.com/sporeprotocol/dob-cookbook/blob/969db44523c7bad75ebc126a513353163843c3df/examples/dob0/0.basic-loot.ts",
  decoderSource:
    "https://github.com/sporeprotocol/spore-dob-0/blob/a592680c9a507a014ebf505075cbef0b21382799/src/decoder/mod.rs",
  decoderHash:
    "0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c",
  fixtureVersion: "basic-loot-fixed-dna-v1",
  preview:
    "CellRoute bounded TypeScript reference port v1; pinned basic-loot pattern only, executed in a Web Worker",
};
// The Cookbook generates random DNA. Fix it for deterministic regression evidence.
export const DNA = "0102030405060708";
export const PATTERN = [
  [
    "BackgroundColor",
    "String",
    0,
    1,
    "options",
    ["red", "blue", "green", "black", "white"],
  ],
  ["Type", "Number", 1, 1, "range", [10, 50]],
  ["Timestamp", "Number", 2, 4, "rawNumber"],
];
export function clusterDescription(client: ccc.Client) {
  const pattern: dob.PatternElementDob0[] = [
    {
      traitName: "BackgroundColor",
      dobType: "String",
      dnaOffset: 0,
      dnaLength: 1,
      patternType: "options",
      traitArgs: ["red", "blue", "green", "black", "white"],
    },
    {
      traitName: "Type",
      dobType: "Number",
      dnaOffset: 1,
      dnaLength: 1,
      patternType: "range",
      traitArgs: [10, 50],
    },
    {
      traitName: "Timestamp",
      dobType: "Number",
      dnaOffset: 2,
      dnaLength: 4,
      patternType: "rawNumber",
    },
  ];
  return dob.encodeClusterDescriptionForDob0({
    description: "A simple loot cluster",
    dob: { ver: 0, decoder: dob.getDecoder(client, "dob0"), pattern },
  });
}
