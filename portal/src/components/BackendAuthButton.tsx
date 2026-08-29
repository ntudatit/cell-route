import { ShieldCheck, ShieldOff } from "lucide-react";
import { useBackendAuth } from "../auth/AuthProvider";

export function BackendAuthButton() {
 const auth = useBackendAuth();
 if (auth.authenticated) {
  return <button className="btn auth-button authenticated" onClick={auth.logout} title="JWT-authenticated backend session">
   <ShieldCheck size={15}/> API Authenticated
  </button>;
 }
 return <button className="btn auth-button" disabled={auth.authenticating} onClick={() => void auth.login().catch(() => undefined)} title={auth.error || "Sign a wallet challenge to authenticate protected API writes"}>
  <ShieldOff size={15}/> {auth.authenticating ? "Signing..." : "Authenticate API"}
 </button>;
}
