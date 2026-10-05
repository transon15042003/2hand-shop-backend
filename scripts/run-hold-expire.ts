/**
 * One-shot hold expiry for PaaS cron / manual.
 * Usage: pnpm run job:expire-holds
 */
import 'dotenv/config';
import { pool } from '../src/configs/database.js';
import { runHoldExpireJob } from '../src/jobs/hold-expire.job.js';

async function main() {
  await pool.query('SELECT 1');
  const result = await runHoldExpireJob();
  console.log(JSON.stringify(result));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
