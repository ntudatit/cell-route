import { it, expect, vi } from 'vitest';
import { ccc } from '@ckb-ccc/connector-react';
import { sendReviewedTransaction } from './reviewedTransaction';
it('sends a clone of the reviewed transaction without rebuilding', async () => {
 const tx = ccc.Transaction.from({ outputs: [{ capacity: 6200000000n, lock: { codeHash: '0x' + '11'.repeat(32), hashType: 'type', args: '0x' + '22'.repeat(20) } }] });
 const send = vi.fn().mockResolvedValue('0x' + '33'.repeat(32));
 const signer = { getRecommendedAddress: async () => 'ckb1sender', sendTransaction: send } as unknown as ccc.Signer;
 await sendReviewedTransaction({ tx, sender: 'ckb1sender', signer }, signer);
 const sent = send.mock.calls[0][0];
 expect(sent).not.toBe(tx);
 expect(sent.hash()).toBe(tx.hash());
});
it('rejects a changed wallet identity before signing', async () => {
 const send = vi.fn();
 const signer = { getRecommendedAddress: async () => 'ckb1different', sendTransaction: send } as unknown as ccc.Signer;
 await expect(sendReviewedTransaction({ tx: ccc.Transaction.default(), sender: 'ckb1original', signer }, signer)).rejects.toThrow('Wallet changed');
 expect(send).not.toHaveBeenCalled();
});
