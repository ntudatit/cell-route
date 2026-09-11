import { currentScope, type LogScope } from './features';
export type LogLevel = 'info' | 'success' | 'error';
export type LogSource = 'feature' | 'api' | 'wallet' | 'ckb' | 'fiber' | 'action';
export type LogEntry = Readonly<{ id: number; time: string; operationId: number; source: LogSource; operation: string; level: LogLevel; phase: 'start' | 'complete' | 'error' | 'cancelled'; durationMs?: number; details: Readonly<Record<string, string | number>> }>;
export const LOG_LIMIT = 250;
export const SCOPE_LIMIT = 80;
const EMPTY: readonly LogEntry[] = Object.freeze([]);
const buffers = new Map<string, readonly LogEntry[]>();
const generations = new Map<string, object>();
const listeners = new Map<string, Set<() => void>>();
let sequence = 0;
export const snapshot = (key: string) => buffers.get(key) ?? EMPTY;
export function subscribe(key: string, listener: () => void) {
 const group = listeners.get(key) ?? new Set(); group.add(listener); listeners.set(key, group);
 return () => { group.delete(listener); if (!group.size) listeners.delete(key); };
}
function trimScopes() {
 while (buffers.size > SCOPE_LIMIT) { const oldest = buffers.keys().next().value!; buffers.delete(oldest); generations.delete(oldest); listeners.get(oldest)?.forEach(fn => fn()); }
}
function publish(key: string, entry: LogEntry) {
 const entries = [...snapshot(key), Object.freeze(entry)].slice(-LOG_LIMIT);
 buffers.delete(key); buffers.set(key, entries);
 trimScopes();
 listeners.get(key)?.forEach(fn => fn());
}
export function clearLogs(key: string) {
 generations.set(key, {});
 buffers.delete(key); buffers.set(key, EMPTY); trimScopes(); listeners.get(key)?.forEach(fn => fn());
}
function errorDetails(error: unknown): Record<string, string | number> {
 const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
 const message = error instanceof Error ? error.message : '';
 const details: Record<string, string | number> = { error: error instanceof TypeError ? 'TypeError' : error instanceof RangeError ? 'RangeError' : 'OperationError' };
 for (const key of ['code', 'statusCode', 'errorCode']) if (typeof value[key] === 'number' && Number.isFinite(value[key])) details[key] = value[key] as number;
 if (/reject|denied|cancel/i.test(message)) details.hint = 'Request rejected or cancelled; check the feature status and wallet.';
 else if (/network|genesis/i.test(message)) details.hint = 'Check the selected network and configured service.';
 else if (/timeout|fetch|connect|offline/i.test(message)) details.hint = 'Check service connectivity and retry.';
 else if (/preimage/i.test(message)) details.hint = 'Check the preimage requirements in the lab.';
 else details.hint = 'See the feature status for the error. Raw error payloads are excluded from logs.';
 return details;
}
function resultDetails(operation: string, result: unknown): Record<string, string | number> {
 const details: Record<string, string | number> = {};
 if (/sendTransaction$/.test(operation) && typeof result === 'string' && /^0x[0-9a-f]{64}$/i.test(result)) details.txHash = result;
 if (Array.isArray(result)) details.items = result.length;
 if (/getTransaction$|getTransactionStatus$/.test(operation) && result && typeof result === 'object') {
  const status = (result as { status?: unknown }).status;
  if (typeof status === 'string' && ['sent','pending','proposed','committed','rejected','unknown','not_found'].includes(status)) details.status = status;
 }
 return details;
}
export function beginOperation(scope: LogScope, source: LogSource, operation: string) {
 const operationId = ++sequence; const started = performance.now(); const generation = generations.get(scope.key) ?? {}; generations.set(scope.key, generation);
 // Labels come from source-code method names, never from request/user input.
 const label = operation.replace(/[^a-zA-Z0-9_. -]/g, '').slice(0, 90);
 const write = (phase: LogEntry['phase'], details: Record<string, string | number> = {}) => {
  if (generations.get(scope.key) !== generation) return;
  publish(scope.key, { id: ++sequence, operationId, time: new Date().toISOString(), source, operation: label, phase, level: phase === 'error' ? 'error' : phase === 'complete' ? 'success' : 'info', ...(phase !== 'start' ? { durationMs: Math.round(performance.now() - started) } : {}), details: Object.freeze(details) });
 };
 write('start'); let ended = false;
 return {
  complete(result?: unknown) { if (!ended) { ended = true; write('complete', resultDetails(label, result)); } },
  fail(error: unknown) { if (!ended) { ended = true; write('error', errorDetails(error)); } },
  cancel() { if (!ended) { ended = true; write('cancelled'); } },
 };
}
export function traceCall<T>(scope: LogScope, source: LogSource, operation: string, action: () => T): T {
 const log = beginOperation(scope, source, operation);
 try {
  const result = action();
  if (result && typeof (result as { then?: unknown }).then === 'function') {
   return Promise.resolve(result).then(value => { log.complete(value); return value; }, error => { log.fail(error); throw error; }) as T;
  }
  if (result && typeof (result as unknown as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
   const iterable = result as unknown as AsyncIterable<unknown>;
   return (async function* () { let complete = false; try { for await (const item of iterable) yield item; complete = true; log.complete(); } catch (error) { complete = true; log.fail(error); throw error; } finally { if (!complete) log.cancel(); } })() as T;
  }
  log.complete(result); return result;
 } catch (error) { log.fail(error); throw error; }
}
// No arguments, response bodies, signatures, headers, raw errors or arbitrary console output are copied.
export function instrument<T extends object>(target: T, source: LogSource, label: string, scope?: LogScope, methods?: ReadonlySet<string>): T {
 const cache = new Map<PropertyKey, { original: unknown; wrapped: unknown }>();
 return new Proxy(target, { get(object, property) {
  const value = Reflect.get(object, property, object);
  if (property === 'client' && value && typeof value === 'object' && source === 'wallet') {
   if (cache.get(property)?.original !== value) cache.set(property, { original: value, wrapped: instrument(value, 'ckb', 'CKB', scope, CLIENT_METHODS) });
   return cache.get(property)!.wrapped;
  }
  if (typeof value !== 'function') return value;
  if (cache.get(property)?.original !== value) cache.set(property, { original: value, wrapped: typeof property === 'string' && (!methods || methods.has(property))
   ? (...args: unknown[]) => traceCall(scope ?? currentScope(), source, `${label}.${String(property)}`, () => Reflect.apply(value, object, args))
   : value.bind(object) });
  return cache.get(property)!.wrapped;
 } });
}
export const CLIENT_METHODS = new Set(['getTipHeader','getTransaction','getCellLive','findCells','findCellsByLock','sendTransaction','waitTransaction','getBalance','getBlockByNumber','getKnownScript']);
export const SIGNER_METHODS = new Set(['getBalance','findCells','signMessage','signTransaction','sendTransaction','connect','disconnect']);
export function exportLogs(scope: LogScope, entries = snapshot(scope.key)) {
 return entries.map(entry => JSON.stringify({ feature: scope.title, network: scope.network, ...entry })).join('\n');
}
