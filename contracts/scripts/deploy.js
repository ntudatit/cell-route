import { execSync } from 'node:child_process';
// Local development funds only; OffCKB resolves its own built-in account.
execSync('offckb deploy --network devnet --target dist/simple-lock.bc --output deployment --yes', { stdio: 'inherit' });
