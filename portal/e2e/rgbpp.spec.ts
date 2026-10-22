import { expect, test } from "@playwright/test";
test("RGB++ reports provider failures without falling back to sample data", async ({
  page,
}) => {
  await page.route("https://testnet.ckb.dev/**", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.route("https://mempool.space/testnet/api/**", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/rgbpp");
  await expect(
    page.getByText("Advanced / regression tools", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Network pair").selectOption("testnet3");
  await page.getByLabel("CKB transaction hash").fill("11".repeat(32));
  await page
    .getByRole("button", { name: "Inspect asset", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Cannot establish both network identities");
  await expect(
    page.getByRole("heading", { name: "Live asset results", exact: true }),
  ).toHaveCount(0);
});
test("RGB++ live form remains usable on mobile without example controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/rgbpp");
  await expect(
    page.getByRole("heading", { name: "RGB++ Inspector", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect asset", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
