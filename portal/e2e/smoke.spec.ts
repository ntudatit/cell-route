import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
 await page.goto("/");
 await expect(page.locator("body")).toContainText(/CKB|Nervos|Asset/i);
});

test("wallet-enabled portal does not isolate cross-origin popups", async ({ page }) => {
 const response = await page.goto("/");

 expect(response).not.toBeNull();
 expect(response!.headers()["cross-origin-opener-policy"]).toBeUndefined();
 expect(response!.headers()["cross-origin-embedder-policy"]).toBeUndefined();
 await expect
  .poll(() => page.evaluate(() => window.crossOriginIsolated))
  .toBe(false);
});

test("Fiber node route is cross-origin isolated", async ({ page }) => {
 const response = await page.goto("/fiber-node");

 expect(response).not.toBeNull();
 expect(response!.headers()["cross-origin-opener-policy"]).toBe("same-origin");
 expect(response!.headers()["cross-origin-embedder-policy"]).toBe("require-corp");
 await expect
  .poll(() => page.evaluate(() => window.crossOriginIsolated))
  .toBe(true);
 await expect(page.getByText("Cross-Origin Isolated")).toBeVisible();
 await expect(page.getByText("YES", { exact: true })).toBeVisible();
});

test("Network Operations Overview runs on its isolated portal route", async ({ page }) => {
 const response = await page.goto("/fiber-ops");

 expect(response).not.toBeNull();
 expect(response!.headers()["cross-origin-opener-policy"]).toBe("same-origin");
 expect(response!.headers()["cross-origin-embedder-policy"]).toBe("require-corp");
 await expect(page.getByRole("heading", { name: "Network Operations Overview" })).toBeVisible();
 await expect(page.getByText(/Fiber WASM requires a cross-origin isolated page/)).toHaveCount(0);
 await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);
});

test("external funding signing route remains wallet-popup compatible", async ({ page }) => {
 const response = await page.goto("/fiber-funding");

 expect(response).not.toBeNull();
 expect(response!.headers()["cross-origin-opener-policy"]).toBeUndefined();
 expect(response!.headers()["cross-origin-embedder-policy"]).toBeUndefined();
 await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(false);
});

test("connect wallet opens the CCC selector", async ({ page }) => {
 await page.goto("/");
 await page.getByRole("button", { name: "Connect wallet", exact: true }).first().click();

 await expect(page.getByText("Connect Wallet", { exact: true })).toBeVisible();
 await expect(page.getByRole("button", { name: /JoyID Passkey/ })).toBeVisible();
});

test("JoyID popup retains the live FiberOps opener", async ({ page }) => {
 await page.context().route("https://testnet.joyid.dev/**", route => route.abort());
 await page.goto("/");
 await page.getByRole("button", { name: "Connect wallet", exact: true }).first().click();
 await page.getByRole("button", { name: /JoyID Passkey/ }).click();
 await expect(page.getByText("Select a Chain", { exact: true })).toBeVisible();

 const popupPromise = page.waitForEvent("popup");
 await page.getByText("CKB", { exact: true }).last().click();
 const popup = await popupPromise;

 await expect.poll(() => popup.evaluate(() => window.opener !== null)).toBe(true);
 await popup.close();
});
