import { ccc } from '@ckb-ccc/connector-react';
import { assetApi, backendApi, type CreateAssetEventRequest, type TrackTransactionRequest } from '../api/backend';
import { clientNetwork } from './network';
// Broadcasting and optional audit recording are separate outcomes.
export async function recordSubmittedTransaction(client: ccc.Client, body: TrackTransactionRequest): Promise<string> {
 try {
  const backend = await backendApi.getNetwork();
  if (backend.network.toLowerCase() !== clientNetwork(client)) return 'Submitted on-chain; activity recording skipped because the backend uses another network.';
  await backendApi.trackTransaction(body);
  return 'Transaction submitted and recorded.';
 } catch { return 'Submitted on-chain; activity service is unavailable. Keep the transaction hash and check its on-chain status.'; }
}

export async function requireBackendNetwork(client: ccc.Client): Promise<void> {
 const backend = await backendApi.getNetwork();
 if (backend.network.trim().toLowerCase() !== clientNetwork(client)) throw new Error('Asset service uses another network. Connect a backend matching the selected wallet network.');
}

export async function recordSubmittedAsset(client: ccc.Client, body: CreateAssetEventRequest): Promise<string> {
 try {
  await requireBackendNetwork(client);
 } catch (error) {
  return `Transaction submitted. Asset audit not recorded: ${error instanceof Error ? error.message : String(error)} Check the on-chain status below.`;
 }
 try {
  await assetApi.record(body);
  return 'Transaction submitted and asset audit recorded. Check the on-chain status below for commitment.';
 } catch {
  return 'Transaction submitted. Asset audit recording failed; keep the transaction hash and check the on-chain status below.';
 }
}
