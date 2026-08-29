const fiberRoutePrefixes = ["/fiber-node", "/fiber-ops", "/fiber-ai", "/fiber-merchant", "/fiber-transfers", "/fiber-lab"];

export function isFiberRoute(pathname = window.location.pathname) {
  return fiberRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
