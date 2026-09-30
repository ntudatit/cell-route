import { decodeReference, DecodeError } from "./reference";
self.onmessage = ({
  data,
}: MessageEvent<{ dna: string; pattern: unknown }>) => {
  try {
    self.postMessage({
      result: JSON.stringify(decodeReference(data.dna, data.pattern)),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof DecodeError ? error.code : "SCHEMA",
    });
  }
};
