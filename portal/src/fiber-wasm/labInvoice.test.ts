import { expect,it } from 'vitest';
import { parseSharedInvoice } from './labInvoice';
it('rejects corrupted storage and unvalidated/mismatched invoice metadata',()=>{expect(parseSharedInvoice('{')).toBeNull();expect(parseSharedInvoice(JSON.stringify({invoice:'fibt',paymentHash:'old-hash',createdAt:'today',nodePubkey:''}))).toBeNull();});
it('keeps only validated public invoice fields',()=>{const value={invoice:'fibt1public',paymentHash:'0x'+'11'.repeat(32),createdAt:new Date().toISOString(),nodePubkey:'node',extra:'ignored'};expect(parseSharedInvoice(JSON.stringify(value))).toEqual({invoice:value.invoice,paymentHash:value.paymentHash,createdAt:value.createdAt,nodePubkey:'node'});});
