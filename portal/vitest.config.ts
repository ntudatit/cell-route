import { defineConfig } from "vitest/config";
export default defineConfig({
 test: {
  environment: "node",
  exclude: ["e2e/**", "node_modules/**", "dist/**"],
  coverage: { provider: "v8", include: ["src/**/*.{ts,tsx}"], reporter: ["text", "html", "lcov"] },
 },
});
