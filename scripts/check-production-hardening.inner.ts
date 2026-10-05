/**
 * Inner smoke — run via check-production-hardening.ts (env already set).
 */
import 'dotenv/config';
import { createApp } from '../src/app.js';
import { pool } from '../src/configs/database.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(process.env.RATE_LIMIT_AUTH_MAX === '2', 'RATE_LIMIT_AUTH_MAX must be 2');

  await pool.query('SELECT 1');
  const app = createApp();
  const server = app.listen(0);
  const addr = server.address();
  assert(addr && typeof addr === 'object', 'server address');
  const base = `http://127.0.0.1:${addr.port}/api`;

  try {
    const health = await fetch(`${base}/health`);
    assert(health.status === 200, `health ${health.status}`);
    assert(health.headers.get('x-content-type-options') === 'nosniff', 'helmet nosniff');
    assert(
      Boolean(
        health.headers.get('x-dns-prefetch-control') ||
          health.headers.get('referrer-policy') ||
          health.headers.get('x-frame-options')
      ),
      'helmet header present'
    );

    const body = JSON.stringify({ email: 'rate@test.local', password: 'wrong-password-xx' });
    const headers = { 'Content-Type': 'application/json' };

    const r1 = await fetch(`${base}/auth/login`, { method: 'POST', headers, body });
    assert(r1.status === 401 || r1.status === 400 || r1.status === 404, `login1 ${r1.status}`);

    const r2 = await fetch(`${base}/auth/login`, { method: 'POST', headers, body });
    assert(r2.status === 401 || r2.status === 400 || r2.status === 404, `login2 ${r2.status}`);

    const r3 = await fetch(`${base}/auth/login`, { method: 'POST', headers, body });
    assert(r3.status === 429, `expected 429 got ${r3.status}`);
    const limited = (await r3.json()) as { error: string };
    assert(limited.error === 'RATE_LIMITED', `error ${limited.error}`);

    console.log('production-hardening check OK');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
