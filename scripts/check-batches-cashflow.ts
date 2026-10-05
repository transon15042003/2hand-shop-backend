/**
 * Smoke for batches-cashflow. Needs server + seed.
 * Usage: pnpm exec tsx scripts/check-batches-cashflow.ts
 */
import 'dotenv/config';

const base = `http://localhost:${process.env.PORT || 5000}/api`;
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function adminFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

async function main() {
  const login = await fetch(`${base}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(login.status === 200, `login ${login.status}`);
  const { token } = (await login.json()) as { token: string };

  const list = await adminFetch('/admin/batches', token);
  assert(list.status === 200, `batches list ${list.status}`);
  const listBody = (await list.json()) as {
    batches: { code: string; total_investment: number }[];
    totals: { total_batches: number; total_capital_invested: number };
  };
  assert(Array.isArray(listBody.batches) && listBody.totals, 'list shape');
  assert(typeof listBody.totals.total_batches === 'number', 'totals');

  const seed = listBody.batches.find((b) => b.code === 'SEED-001' || b.code === 'batch-seed-001');
  const detailRef = seed?.code ?? listBody.batches[0]?.code;
  assert(detailRef, 'need at least one batch');

  const detail = await adminFetch(`/admin/batches/${encodeURIComponent(detailRef)}`, token);
  assert(detail.status === 200, `detail ${detail.status}: ${await detail.clone().text()}`);
  const detailBody = (await detail.json()) as { code: string; items: unknown[]; break_even_target: number };
  assert(detailBody.code && Array.isArray(detailBody.items), 'detail shape');
  assert(typeof detailBody.break_even_target === 'number', 'break_even_target');

  const code = `KN-TEST-${Date.now().toString(36).toUpperCase()}`;
  const created = await adminFetch('/admin/batches', token, {
    method: 'POST',
    body: JSON.stringify({
      code,
      name: 'Kiện test cashflow',
      import_date: new Date().toISOString().slice(0, 10),
      initial_capital: 1000000,
      processing_cost: 50000,
    }),
  });
  assert(created.status === 201, `create ${created.status}: ${await created.clone().text()}`);
  const batch = (await created.json()) as {
    code: string;
    total_investment: number;
    is_broken_even: boolean;
  };
  assert(batch.code === code, 'code');
  assert(batch.total_investment === 1050000, 'investment');

  const dup = await adminFetch('/admin/batches', token, {
    method: 'POST',
    body: JSON.stringify({
      code,
      name: 'Dup',
      import_date: '2026-10-01',
      initial_capital: 1,
      processing_cost: 0,
    }),
  });
  assert(dup.status === 400, `dup ${dup.status}`);
  const dupBody = (await dup.json()) as { error: string };
  assert(dupBody.error === 'BATCH_CODE_EXISTS', `error ${dupBody.error}`);

  const summary = await adminFetch('/admin/cash-flow/summary?period=week', token);
  assert(summary.status === 200, `summary ${summary.status}: ${await summary.clone().text()}`);
  const s = (await summary.json()) as {
    period: string;
    net_cash_flow: number;
    series: { net: number }[];
    batch_capital_spent: number;
    cod_pending_balance: number;
  };
  assert(s.period === 'week', 'period');
  assert(Array.isArray(s.series), 'series');
  const seriesNet = s.series.reduce((n, p) => n + p.net, 0);
  assert(s.net_cash_flow === seriesNet, `net ${s.net_cash_flow} vs series ${seriesNet}`);
  assert(typeof s.batch_capital_spent === 'number', 'batch_capital');
  assert(typeof s.cod_pending_balance === 'number', 'cod pending');

  const sessions = await adminFetch('/admin/cash-flow/reconciliations', token);
  assert(sessions.status === 200, `reconciliations ${sessions.status}`);
  assert(Array.isArray(await sessions.json()), 'sessions array');

  console.log('batches-cashflow check OK', code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
