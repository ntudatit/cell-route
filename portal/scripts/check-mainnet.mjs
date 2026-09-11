import { ccc } from '@ckb-ccc/core';
const url = process.env.CKB_MAINNET_RPC_URL ?? "https://mainnet.ckb.dev";
const client = new ccc.ClientPublicMainnet({ url, fallbacks: [], timeout: 15000 });
const [genesis, tip] = await Promise.all([client.getBlockByNumber(0), client.getTipHeader()]);
if (genesis?.header.hash !== '0x92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5' || tip.number <= 0n) throw new Error('Mainnet RPC is unavailable');
console.log(JSON.stringify({ network: 'mainnet', rpcUrl: client.url, genesisHash: genesis.header.hash, tip: tip.number.toString(), checkedAt: new Date().toISOString(), mode: 'read-only' }, null, 2));

