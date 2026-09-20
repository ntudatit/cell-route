export const FEATURES: Record<string, string> = {
 '/': 'Home', '/platform': 'Platform Overview', '/checkout': 'Checkout', '/merchant': 'Merchant Console',
 '/dashboard': 'Dashboard', '/wallet': 'Wallet', '/cells': 'Live Cells', '/transfer-ckb': 'Transfer CKB',
 '/simple-lock': 'Simple Lock Lab', '/store-data': 'Store Data', '/fungible-token': 'Fungible Token',
 '/dob-spore': 'DOB / Spore', '/spore-clusters': 'Spore Clusters', '/sign-message': 'Sign Message',
 '/activity-log': 'Activity Log', '/assets': 'Asset Portfolio', '/explorer': 'Explorer', '/faucet': 'Faucet',
 '/docs': 'API Documentation', '/playground': 'Playground', '/connect-wallets': 'Connect Wallets Guide',
 '/compose-transactions': 'Compose Transactions Guide', '/sign-messages': 'Sign Messages Guide',
 '/udt-tokens': 'UDT Guide', '/spore-protocol': 'Spore Guide', '/node-backend': 'Backend Guide',
 '/fiber-funding': 'Fiber Funding', '/fiber-node': 'Browser Fiber Node', '/fiber-ai': 'AI Copilot',
 '/fiber-merchant': 'Fiber Merchant', '/fiber-transfers': 'Fiber Transfers', '/fiber-lab': 'Two Node Lab',
 '/fiber-ops': 'FiberOps Overview',
 '/fiber-ops#readiness': 'Payment Readiness', '/fiber-ops#channels': 'Channel Health',
 '/fiber-ops#reconciliation': 'Reconciliation', '/fiber-ops#incidents': 'Incident Center',
};
export type LogScope = Readonly<{ key: string; feature: string; title: string; network: string }>;
let network = 'unknown';
export function setLogNetwork(value: string) { network = value; }
export function currentScope(): LogScope {
 return scopeFor(globalThis.location?.pathname ?? '/', globalThis.location?.hash ?? '', network);
}
export function scopeFor(path: string, hash: string, chain: string): LogScope {
 const aliases: Record<string, string> = { '/transactions': '/activity-log', '/merchant': '/fiber-merchant' };
 path = aliases[path] ?? path;
 const feature = FEATURES[path + hash] ? path + hash : FEATURES[path] ? path : '/';
 const safeNetwork = ['mainnet', 'testnet', 'devnet'].includes(chain) ? chain : 'unknown';
 return { key: `${safeNetwork}:${feature}`, feature, title: FEATURES[feature], network: safeNetwork };
}
