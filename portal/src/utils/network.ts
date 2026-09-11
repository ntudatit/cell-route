import { ccc } from '@ckb-ccc/connector-react';
import devnet from '../../public/simple-lock.devnet.json';
export type CkbNetwork = 'mainnet' | 'testnet' | 'devnet';
export function parseNetwork(value = 'testnet'): CkbNetwork {
  const network = value.trim().toLowerCase();
  if (network !== 'mainnet' && network !== 'testnet' && network !== 'devnet') throw new Error(`Unsupported CKB network: ${value}`);
  return network;
}
export const configuredNetwork = parseNetwork(import.meta.env.VITE_CKB_NETWORK);
export function clientNetwork(client: Pick<ccc.Client, 'url' | 'addressPrefix'>): CkbNetwork {
  return client.url.replace(/\/$/, '') === devnet.rpcUrl.replace(/\/$/, '') ? 'devnet' : client.addressPrefix === 'ckb' ? 'mainnet' : 'testnet';
}
export function explorerUrl(network: CkbNetwork, txHash?: string) {
  if (network === 'devnet') return undefined;
  const base = network === 'mainnet' ? 'https://explorer.nervos.org' : 'https://pudge.explorer.nervos.org';
  return txHash ? `${base}/transaction/${encodeURIComponent(txHash)}` : base;
}
export const MAINNET_GENESIS = '0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5';
export async function assertMainnet(client: Pick<ccc.Client, 'getBlockByNumber'>) {
  if ((await client.getBlockByNumber(0))?.header.hash !== MAINNET_GENESIS) throw new Error('The configured RPC is not CKB Mainnet. Transaction was not broadcast.');
}
class MainnetClient extends ccc.ClientPublicMainnet {
  override async sendTransaction(...args: Parameters<ccc.Client['sendTransaction']>) {
    await assertMainnet(this);
    return super.sendTransaction(...args);
  }
}
export function createClient(network: CkbNetwork) {
  if (network === 'devnet') return new ccc.ClientPublicTestnet({ url: devnet.rpcUrl, fallbacks: [], scripts: devnet.knownScripts as unknown as Record<ccc.KnownScript, ccc.ScriptInfoLike | undefined> });
  const url = (network === 'mainnet' ? import.meta.env.VITE_CKB_MAINNET_RPC_URL : import.meta.env.VITE_CKB_TESTNET_RPC_URL)?.trim();
  // Custom endpoints must not silently fail over to another configured service.
  const options = url ? { url, fallbacks: [], timeout: 15000 } : { timeout: 15000 };
  return network === 'mainnet' ? new MainnetClient(options) : new ccc.ClientPublicTestnet(options);
}
export function parseCapacity(value: string) {
  if (!/^\d+(\.\d{1,8})?$/.test(value.trim())) throw new Error('Enter CKB with at most 8 decimal places.');
  const capacity = ccc.fixedPointFrom(value.trim());
  if (capacity <= 0n) throw new Error('Amount must be positive.');
  return capacity;
}
export function parseFeeRate(value: string) {
  if (!/^\d+$/.test(value)) throw new Error('Fee rate must be a positive whole number.');
  const feeRate = Number(value);
  if (!Number.isSafeInteger(feeRate) || feeRate < 1000 || feeRate > 100000) throw new Error('Use a fee rate from 1000 to 100000 shannons/KB.');
  return feeRate;
}

