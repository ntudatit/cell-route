import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Connect } from "vite";
export const FIBER_ROUTE_PREFIXES = [
  "/checkout",
  "/merchant",
  "/fiber-node",
  "/fiber-ops",
  "/fiber-ai",
  "/fiber-merchant",
  "/fiber-transfers",
  "/fiber-lab",
];
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export function isFiberRoute(url?: string) {
  const pathname = url?.split("?", 1)[0] ?? "/";
  return FIBER_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function fiberRouteIsolation() {
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    if (isFiberRoute(request.url)) {
      for (const [name, value] of Object.entries(isolationHeaders)) {
        response.setHeader(name, value);
      }
    }
    next();
  };

  return {
    name: "fiber-route-cross-origin-isolation",
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [fiberRouteIsolation(), react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  worker: {
    format: "es",
  },
});
