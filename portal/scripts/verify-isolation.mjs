const baseUrl = (process.env.FIBERPAY_URL || "http://localhost:4173").replace(/\/$/, "");
const routes = ["/checkout", "/merchant", "/fiber-node", "/fiber-ops", "/fiber-ai", "/fiber-transfers", "/fiber-lab"];
const expected = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-resource-policy": "cross-origin",
};

let failed = false;
for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    const missing = Object.entries(expected).filter(([name, value]) => response.headers.get(name) !== value);
    if (!response.ok || missing.length) {
      failed = true;
      console.error(`FAIL ${route} (${response.status}): ${missing.map(([name, value]) => `${name}=${value}`).join(", ") || "unexpected status"}`);
    } else {
      console.log(`PASS ${route}`);
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${route}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
console.log(`All FiberPay WASM routes are isolated at ${baseUrl}.`);
