import { ccc } from "@ckb-ccc/core";
import { clientNetwork, MAINNET_GENESIS } from "./network";
import devnet from "../../public/token.devnet.json";
import type { TokenStandard, TokenDeployment } from "./token";
export async function getTokenDeployment(
  client: ccc.Client,
  standard: TokenStandard,
): Promise<TokenDeployment> {
  const network = clientNetwork(client);
  const script =
    network === "devnet"
      ? devnet.knownScripts[standard === "SUDT" ? "SUdt" : "XUdt"]
      : await client.getKnownScript(
          standard === "SUDT" ? ccc.KnownScript.SUdt : ccc.KnownScript.XUdt,
        );
  return {
    network,
    genesisHash:
      network === "devnet"
        ? devnet.genesisHash
        : network === "mainnet"
          ? MAINNET_GENESIS
          : "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
    script: script as ccc.ScriptInfoLike,
  };
}
