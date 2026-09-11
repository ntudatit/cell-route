import { ccc } from '@ckb-ccc/connector-react';
export type ReviewedTransaction = { tx: ccc.Transaction; signer: ccc.Signer; sender: string };
export async function sendReviewedTransaction(review: ReviewedTransaction, signer: ccc.Signer) {
 if (review.signer !== signer || review.sender !== await signer.getRecommendedAddress()) throw new Error('Wallet changed. Create a new preview.');
 return signer.sendTransaction(review.tx.clone());
}
