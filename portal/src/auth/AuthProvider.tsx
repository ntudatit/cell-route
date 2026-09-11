import { useFeatureSigner } from '../dev-console/hooks';
import { clientNetwork } from "../utils/network";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { authTokenStore, backendApi } from "../api/backend";

type AuthState = {
 authenticated: boolean;
 authenticating: boolean;
 walletAddress: string;
 error: string;
 login: () => Promise<void>;
 logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
 const signer = useFeatureSigner();
 const [authenticated, setAuthenticated] = useState(false);
 const [walletAddress, setWalletAddress] = useState("");
 const [authenticating, setAuthenticating] = useState(false);
 const [error, setError] = useState("");

 const logout = useCallback(() => {
  authTokenStore.clear();
  setAuthenticated(false);
  setWalletAddress("");
  setError("");
 }, []);

 const login = useCallback(async () => {
  if (!signer) throw new Error("Connect a wallet first.");
  setAuthenticating(true);
  setError("");
  try {
   const address = await signer.getRecommendedAddress();
   const backend = await backendApi.getNetwork();
   if (backend.network.toLowerCase() !== clientNetwork(signer.client)) throw new Error("Backend authentication network does not match the wallet.");
   const challenge = await backendApi.createAuthChallenge(address);
   const signed = await signer.signMessage(challenge.message);
   const signType = String(signed.signType);
   if (signType !== "CkbSecp256k1") {
    throw new Error(
     `Backend authentication currently supports native CKB CkbSecp256k1 signatures. Connected signer returned ${signType}.`,
    );
   }
   const token = await backendApi.verifyAuth({
    walletAddress: address,
    nonce: challenge.nonce,
    signature: signed.signature,
    signType,
   });
   authTokenStore.set(token.accessToken);
   setWalletAddress(token.walletAddress);
   setAuthenticated(true);
  } catch (e) {
   authTokenStore.clear();
   setAuthenticated(false);
   setError(e instanceof Error ? e.message : String(e));
   throw e;
  } finally {
   setAuthenticating(false);
  }
 }, [signer]);

 useEffect(() => {
  let active = true;
  (async () => {
   if (!signer || !authTokenStore.get()) {
    if (active) {
     setAuthenticated(false);
     setWalletAddress("");
    }
    return;
   }
   try {
    const [address, me] = await Promise.all([signer.getRecommendedAddress(), backendApi.authMe()]);
    if (!active) return;
    if (address !== me.walletAddress || me.network.toLowerCase() !== clientNetwork(signer.client)) {
     logout();
     return;
    }
    setAuthenticated(true);
    setWalletAddress(me.walletAddress);
   } catch {
    if (active) logout();
   }
  })();
  return () => { active = false; };
 }, [signer, logout]);

 const value = useMemo<AuthState>(() => ({
  authenticated, authenticating, walletAddress, error, login, logout,
 }), [authenticated, authenticating, walletAddress, error, login, logout]);

 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useBackendAuth() {
 const value = useContext(AuthContext);
 if (!value) throw new Error("useBackendAuth must be used inside AuthProvider");
 return value;
}
