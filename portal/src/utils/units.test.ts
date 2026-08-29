import { describe, expect, it } from "vitest";
import { parseUnits } from "./units";

describe("parseUnits", () => {
 it("converts decimal amounts to exact integer units", () => {
  expect(parseUnits("1.25", 8)).toBe(125000000n);
 });
 it("rejects too many decimal places", () => {
  expect(() => parseUnits("1.001", 2)).toThrow(/more than 2/);
 });
});
