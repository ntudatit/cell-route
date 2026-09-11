import { useMemo } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { currentScope } from './features';
import { CLIENT_METHODS, SIGNER_METHODS, instrument, traceCall } from './store';
export function useFeatureSigner() {
 const signer = ccc.useSigner(); const scope = currentScope();
 return useMemo(() => signer ? instrument(signer, 'wallet', 'Wallet', scope, SIGNER_METHODS) : undefined, [signer, scope.key]);
}
export function useFeatureCcc() {
 const context = ccc.useCcc(); const scope = currentScope();
 const client = useMemo(() => instrument(context.client, 'ckb', 'CKB', scope, CLIENT_METHODS), [context.client, scope.key]);
 const open = useMemo(() => (...args: Parameters<typeof context.open>) => traceCall(scope, 'wallet', 'Wallet.openConnector', () => context.open(...args)), [context.open, scope.key]);
 return { ...context, client, open };
}
export function useFeatureObject<T extends object>(object: T, source: 'ckb' | 'fiber') {
 const scope = currentScope();
 return useMemo(() => instrument(object, source, source === 'ckb' ? 'CKB' : 'Fiber', scope, source === 'ckb' ? CLIENT_METHODS : undefined), [object, source, scope.key]);
}
