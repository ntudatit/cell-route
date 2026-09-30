import {
  Attribute,
  DecodeError,
  validateInput,
  validateResponse,
} from "./reference";
export interface DecoderWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}
export function decode(
  dna: string,
  pattern: unknown,
  options: {
    enabled?: boolean;
    timeoutMs?: number;
    maxBytes?: number;
    worker?: () => DecoderWorker;
  } = {},
): Promise<Attribute[]> {
  return new Promise((resolve, reject) => {
    if (options.enabled === false) {
      reject(new DecodeError("UNAVAILABLE"));
      return;
    }
    try {
      validateInput(dna, pattern);
    } catch (error) {
      reject(error);
      return;
    }
    let worker: DecoderWorker;
    try {
      worker = options.worker
        ? options.worker()
        : (new Worker(new URL("./worker.ts", import.meta.url), {
            type: "module",
          }) as unknown as DecoderWorker);
    } catch {
      reject(new DecodeError("UNAVAILABLE"));
      return;
    }
    const finish = (error?: unknown, result?: Attribute[]) => {
      clearTimeout(timer);
      worker.terminate();
      error ? reject(error) : resolve(result!);
    };
    const timer = setTimeout(
      () => finish(new DecodeError("TIMEOUT")),
      options.timeoutMs ?? 2000,
    );
    worker.onmessage = ({ data }) => {
      try {
        if (data?.error)
          throw new DecodeError(
            data.error === "DNA" || data.error === "PATTERN"
              ? data.error
              : "SCHEMA",
          );
        if (typeof data?.result !== "string") throw new DecodeError("SCHEMA");
        finish(undefined, validateResponse(data.result, options.maxBytes));
      } catch (error) {
        finish(error);
      }
    };
    worker.onerror = () => finish(new DecodeError("UNAVAILABLE"));
    try {
      worker.postMessage({ dna, pattern });
    } catch {
      finish(new DecodeError("UNAVAILABLE"));
    }
  });
}
