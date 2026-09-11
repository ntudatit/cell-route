import { useFeatureSigner } from "../dev-console/hooks";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useBackendAuth } from "../auth/AuthProvider";

export function BackendAuthButton() {
 const auth = useBackendAuth();
 const signer = useFeatureSigner();
 if (auth.authenticated) {
  return <button className="btn auth-button authenticated" onClick={auth.logout} aria-label="Sign out of API session" title="API authenticated — click to sign out">
   <ShieldCheck size={15}/> API Authenticated
  </button>;
 }
 return <button className="btn auth-button" disabled={!signer || auth.authenticating} onClick={() => void auth.login().catch(() => undefined)} title={!signer ? "Connect a wallet before authenticating the API" : auth.error || "Sign a wallet challenge to authenticate protected API writes"}>
  <ShieldOff size={15}/> {auth.authenticating ? "Signing..." : "Authenticate API"}
 </button>;
}
