import * as bindings from '@ckb-js-std/bindings';
import { HighLevel, hashCkb } from '@ckb-js-std/core';

// Loader prefix: flags(2), bytecode hash(32), hash type(1).
// Application args: 32-byte CKB-personalized BLAKE2b digest.
function main(): number {
  const args = new Uint8Array(HighLevel.loadScript().args);
  if (args.length !== 67) return 5;
  let witness: ArrayBuffer;
  try { witness = bindings.loadWitness(0, bindings.SOURCE_GROUP_INPUT); }
  catch { return 6; }
  if (witness.byteLength === 0) return 6;
  if (witness.byteLength > 1024) return 8;
  const digest = new Uint8Array(hashCkb(witness));
  return digest.every((byte, i) => byte === args[35 + i]) ? 0 : 7;
}
bindings.exit(main());
