/**
 * Runnable check for auth-session (ADR 006 + OpenAPI paths).
 * Requires: server on PORT (default 5000), seeded customer khachhang@2handshop.vn / 123456
 * Usage: pnpm exec tsx scripts/check-auth-session.ts
 */
import 'dotenv/config';

const base = `http://localhost:${process.env.PORT || 5000}/api`;
const email = 'khachhang@2handshop.vn';
const password = process.env.SEED_CUSTOMER_PASSWORD || '123456';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function cookieHeader(setCookie: string | null): string | undefined {
  if (!setCookie) return undefined;
  // Node fetch may join multiple Set-Cookie with ", " — take first pair name=value
  const first = setCookie.split(/,(?=\s*[^;]+=)/)[0] ?? setCookie;
  return first.split(';')[0];
}

async function main() {
  // Guest session
  const guest = await fetch(`${base}/auth/session`);
  assert(guest.status === 200, `session guest status ${guest.status}`);
  const guestBody = (await guest.json()) as { customer: unknown };
  assert(guestBody.customer === null, 'guest session should be null');

  // Login
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  assert(loginRes.status === 200, `login status ${loginRes.status}: ${await loginRes.clone().text()}`);
  const setCookie = loginRes.headers.get('set-cookie');
  assert(setCookie && setCookie.includes('2hand_customer_session='), 'missing session Set-Cookie');
  assert(/Max-Age=34560000/i.test(setCookie), `expected Max-Age=34560000, got: ${setCookie}`);
  assert(!/Expires=/i.test(setCookie), `cookie must not use Expires: ${setCookie}`);
  const cookie = cookieHeader(setCookie);
  assert(cookie, 'cookie pair');

  const loginBody = (await loginRes.json()) as {
    token: string;
    customer: { email: string; is_verified: boolean };
  };
  assert(loginBody.token && loginBody.customer?.email === email, 'login body shape');
  assert(loginBody.customer.is_verified === true, 'seed customer verified');

  // Session with cookie
  const sess = await fetch(`${base}/auth/session`, { headers: { Cookie: cookie! } });
  assert(sess.status === 200, `session auth status ${sess.status}`);
  const sessBody = (await sess.json()) as { customer: { email: string } | null };
  assert(sessBody.customer?.email === email, 'session customer');

  // Me
  const me = await fetch(`${base}/auth/me`, { headers: { Cookie: cookie! } });
  assert(me.status === 200, `me status ${me.status}`);
  const meBody = (await me.json()) as { email: string; has_completed_order: boolean };
  assert(meBody.email === email && typeof meBody.has_completed_order === 'boolean', 'me profile');

  // Admin login
  const admin = await fetch(`${base}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'admin123' }),
  });
  assert(admin.status === 200, `admin login ${admin.status}: ${await admin.clone().text()}`);
  const adminBody = (await admin.json()) as { token: string; user: { role: string } };
  assert(adminBody.token && adminBody.user?.role === 'admin', 'admin body');

  // Logout
  const logout = await fetch(`${base}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie! },
  });
  assert(logout.status === 200, `logout ${logout.status}`);
  const logoutCookie = logout.headers.get('set-cookie') || '';
  assert(/Max-Age=0/i.test(logoutCookie), `logout should clear cookie: ${logoutCookie}`);

  const after = await fetch(`${base}/auth/session`, { headers: { Cookie: cookie! } });
  const afterBody = (await after.json()) as { customer: unknown };
  assert(afterBody.customer === null, 'session after logout should be null');

  console.log('check-auth-session: ok');
}

main().catch((err) => {
  console.error('check-auth-session: failed', err.message || err);
  process.exitCode = 1;
});
