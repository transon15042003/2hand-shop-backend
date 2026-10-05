/**
 * Self-contained production-hardening smoke (spins a temp server).
 * Wrapper sets RATE_LIMIT_* before loading the app (limiters read env at import).
 * Usage: pnpm run check:production-hardening
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const INNER = 'PRODUCTION_HARDENING_INNER';

if (!process.env[INNER]) {
  const script = path.resolve('scripts/check-production-hardening.inner.ts');
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', script],
    {
      env: {
        ...process.env,
        [INNER]: '1',
        RATE_LIMIT_AUTH_MAX: '2',
        RATE_LIMIT_AUTH_WINDOW_MS: '60000',
      },
      stdio: 'inherit',
    }
  );
  process.exit(result.status ?? 1);
}
