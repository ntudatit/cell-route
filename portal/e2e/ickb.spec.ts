import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../docs/evidence/week-12/snapshot-testnet.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
test("iCKB reads public identities and clears stale conversion reviews", async ({
  page,
}) => {
  await page.clock.setFixedTime(
    new Date(Date.parse(snapshot.observedAt) + 1000),
  );
  await page.route("https://testnet.ckb.dev/**", async (route) => {
    const q = route.request().postDataJSON();
    const stored = snapshot.raw.find(
      (r: any) =>
        r.request.method === q.method &&
        JSON.stringify(r.request.params) === JSON.stringify(q.params),
    );
    return route.fulfill(
      stored
        ? { json: { ...stored.response, id: q.id } }
        : { status: 503, body: "No recorded response" },
    );
  });
  await page.goto("/ickb");
  await expect(
    page.locator("section.product-form").getByRole("button", { name: /sign|submit|redeem/i }),
  ).toHaveCount(0);
  await page.getByLabel("iCKB network").selectOption("testnet");
  await page
    .getByRole("button", { name: "Read chain snapshot", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Snapshot identity", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Free CKB amount", { exact: true }).fill("1000");
  await page
    .getByRole("button", { name: "Review conversion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conversion review", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "iCKB review" })).toContainText(
    '"committed": false',
  );
  await page.getByLabel("Free CKB amount", { exact: true }).fill("1001");
  await expect(
    page.getByRole("heading", { name: "Conversion review", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Free CKB amount", { exact: true }).fill("1000");
  await page
    .getByRole("button", { name: "Review conversion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conversion review", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".project-loading")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".project-loading")).toHaveCSS("opacity", "0");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/evidence/week-12/inspector.png",
    fullPage: true,
  });
  await page.getByLabel("iCKB network").selectOption("mainnet");
  await expect(
    page.getByRole("heading", { name: "Snapshot identity", exact: true }),
  ).toHaveCount(0);
});
test("iCKB handles API failure without a synthetic snapshot", async ({
  page,
}) => {
  await page.route("https://testnet.ckb.dev/**", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ickb");
  await page.getByLabel("iCKB network").selectOption("testnet");
  await page
    .getByRole("button", { name: "Read chain snapshot", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("503");
  await expect(
    page.getByRole("heading", { name: "Snapshot identity", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
