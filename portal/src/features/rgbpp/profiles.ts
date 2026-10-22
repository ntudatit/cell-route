import pins from "./pins.json";
const env =
  import.meta.env ?? (typeof process !== "undefined" ? process.env : {});
function endpoint(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error(
      "RGB++ API/RPC endpoints must be public HTTP URLs without credentials.",
    );
  return url.href.replace(/\/$/, "");
}
export const profiles = {
  testnet3: {
    ...pins.network,
    name: "Bitcoin Testnet3 / CKB Testnet",
    bitcoinApi: endpoint(
      env.VITE_RGBPP_TESTNET_BTC_API,
      pins.network.bitcoinApi,
    ),
    ckbRpc: endpoint(env.VITE_RGBPP_TESTNET_CKB_RPC, pins.network.ckbRpc),
  },
  mainnet: {
    ...pins.network,
    name: "Bitcoin / CKB Mainnet",
    bitcoin: "mainnet",
    ckb: "mainnet",
    bitcoinApi: endpoint(
      env.VITE_RGBPP_MAINNET_BTC_API,
      "https://mempool.space/api",
    ),
    ckbRpc: endpoint(env.VITE_RGBPP_MAINNET_CKB_RPC, "https://mainnet.ckb.dev"),
    bitcoinGenesis:
      "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
    ckbGenesis:
      "0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5",
    rgbppLock: {
      codeHash:
        "0xbc6c568a1a0d0a09f6844dc9d74ddb4343c32143ff25f727c59edf4fb72d6936",
      hashType: "type",
      deployment: {
        txHash:
          "0x04c5c3e69f1aa6ee27fb9de3d15a81704e387ab3b453965adbe0b6ca343c6f41",
        index: 0,
      },
    },
  },
} as const;
export type ProfileName = keyof typeof profiles;
