import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ccc } from "@ckb-ccc/connector-react";

export function WalletRouteGuard({ children }: { children: ReactNode }) {
  const signer = ccc.useSigner();
  const location = useLocation();

  if (!signer) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/?connect=1&next=${next}`} replace />;
  }

  return <>{children}</>;
}
