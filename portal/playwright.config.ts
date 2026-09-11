import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir: "./e2e",
 testIgnore: "**/mainnet.spec.ts",
 retries: process.env.CI ? 2 : 0,
 reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
 use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173", trace: "on-first-retry" },
 webServer: { command: "npm run preview -- --host 127.0.0.1", port: 4173, reuseExistingServer: !process.env.CI },
 projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
