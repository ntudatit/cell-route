import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("DOB Worker preview is deterministic, errors preserve raw data, console exports scoped events", async ({
  page,
}) => {
  await page.goto("/dob-spore");
  await expect(page.locator(".project-loading")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await page.getByRole("button", { name: "Decode fixture" }).click();
  await expect(page.locator("dd")).toHaveText(["blue", "12", "100992003"]);
  await page.getByRole("button", { name: "Decode fixture" }).click();
  await expect(page.locator("dd")).toHaveText(["blue", "12", "100992003"]);
  await page.getByLabel("DNA (8 bytes)").fill("invalid");
  await page.getByRole("button", { name: "Decode fixture" }).click();
  await expect(page.getByRole("alert")).toContainText("DNA");
  await expect(page.getByText("Raw / on-chain model")).toBeVisible();
  await expect(page.locator("pre").last()).toContainText("invalid");
  await page.getByLabel("DNA (8 bytes)").fill("0102030405060708");
  await page.getByLabel("Enable trusted reference decoder").uncheck();
  await page.getByRole("button", { name: "Decode fixture" }).click();
  await expect(page.getByRole("alert")).toContainText("UNAVAILABLE");
  await page
    .getByRole("button", { name: /Dev Console · DOB \/ Spore/ })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSONL" }).click();
  const download = await pending;
  const output = await readFile((await download.path())!, "utf8");
  expect(output).toContain("Spore.dob-decode");
  expect(output).toContain("DOB / Spore");
  expect(output).not.toContain("0102030405060708");
  await writeFile("../docs/evidence/week-8/dev-console.jsonl", output + "\n");
  await page
    .getByRole("button", { name: "Collapse developer console" })
    .click();
  await page.screenshot({
    path: "test-results/week8-dob-desktop.png",
    fullPage: true,
  });
});
test("Studio cannot sign before review and fits mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dob-spore");
  await expect(page.locator(".project-loading")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Confirm and sign" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Prepare Spore", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Connect a wallet");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/week8-dob-mobile.png",
    fullPage: true,
  });
});
