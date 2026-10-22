import { expect, it } from "vitest";
import { ccc } from "@ckb-ccc/core";
import { clusterDescription, validateCluster } from "./clusterProfile";
const client = new ccc.ClientPublicTestnet();
const pattern = [["Level", "Number", 0, 1, "range", [1, 20]]];
it("encodes user-defined DOB traits instead of a bundled loot pattern", () => {
  const description = clusterDescription(
    client,
    "My collection",
    JSON.stringify(pattern),
  );
  const metadata = JSON.parse(description);
  expect(metadata.description).toBe("My collection");
  expect(metadata.dob.pattern).toEqual(pattern);
  expect(() =>
    validateCluster(
      client,
      description,
      new TextEncoder().encode(JSON.stringify({ dna: "0102030405060708" })),
    ),
  ).not.toThrow();
});
it("rejects unsupported patterns and decoder identities", () => {
  expect(() =>
    clusterDescription(
      client,
      "",
      JSON.stringify([["X", "Number", 0, 1, "unknown"]]),
    ),
  ).toThrow();
  const value = JSON.parse(
    clusterDescription(client, "", JSON.stringify(pattern)),
  );
  value.dob.decoder.hash = "00".repeat(32);
  expect(() =>
    validateCluster(
      client,
      JSON.stringify(value),
      new TextEncoder().encode('{"dna":"0102030405060708"}'),
    ),
  ).toThrow("decoder identity");
});
it("bounds custom pattern input", () => {
  expect(() => clusterDescription(client, "", " ".repeat(16385))).toThrow(
    "16 KiB",
  );
});
