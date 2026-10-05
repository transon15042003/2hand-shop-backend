/**
 * Smoke for order-fulfillment. Needs server + seed shelf item.
 * Usage: pnpm exec tsx scripts/check-order-fulfillment.ts
 */
import 'dotenv/config';
import { Client } from 'pg';

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

async function ensureShelfItem(client: Client, id: string) {
  await client.query(
    `UPDATE items SET status = 'shelf', reserved_until = NULL, reserved_by_customer_phone = NULL WHERE id = $1`,
    [id]
  );
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await ensureShelfItem(client, 'item-seed-shelf-001');

  const settingsRes = await fetch(`${base}/settings`);
  assert(settingsRes.status === 200, `settings ${settingsRes.status}`);
  const settings = (await settingsRes.json()) as { policy_version: number; deposit_amount: number };

  const login = await fetch(`${base}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(login.status === 200, `login ${login.status}`);
  const { token } = (await login.json()) as { token: string };

  const phone = `09${String(Date.now()).slice(-8)}`;
  const create = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Khách test fulfillment',
      customer_phone: phone,
      shipping_address: 'Số 1 Test Fulfillment, Hà Nội',
      item_ids: ['item-seed-shelf-001'],
      payment_method: 'cod',
      policy_accepted: true,
      policy_version: settings.policy_version,
    }),
  });
  assert(create.status === 201, `create ${create.status}: ${await create.clone().text()}`);
  const order = (await create.json()) as { order_code: string; deposit_status: string };
  assert(order.deposit_status === 'pending', 'needs deposit');
  const code = order.order_code;

  const earlyConfirm = await adminFetch(`/admin/orders/${encodeURIComponent(code)}/confirm`, token, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  assert(earlyConfirm.status === 409, `confirm before deposit ${earlyConfirm.status}`);
  const earlyBody = (await earlyConfirm.json()) as { error: string };
  assert(earlyBody.error === 'DEPOSIT_REQUIRED', `error ${earlyBody.error}`);

  const deposit = await adminFetch(`/admin/orders/${encodeURIComponent(code)}/deposit`, token, {
    method: 'PATCH',
    body: JSON.stringify({ note: 'CK test' }),
  });
  assert(deposit.status === 200, `deposit ${deposit.status}: ${await deposit.clone().text()}`);
  const afterDeposit = (await deposit.json()) as {
    deposit_status: string;
    order_status: string;
    order_code: string;
  };
  assert(afterDeposit.deposit_status === 'paid', `api paid got ${afterDeposit.deposit_status}`);
  assert(afterDeposit.order_status === 'new', 'deposit must not auto-confirm');

  const confirm = await adminFetch(`/admin/orders/${encodeURIComponent(code)}/confirm`, token, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  assert(confirm.status === 200, `confirm ${confirm.status}: ${await confirm.clone().text()}`);
  const confirmed = (await confirm.json()) as { order_status: string; confirmed_by: string };
  assert(confirmed.order_status === 'confirmed', 'confirmed');
  assert(confirmed.confirmed_by === 'shop', 'confirmed_by shop');

  const fulfill = await adminFetch(`/admin/orders/${encodeURIComponent(code)}/fulfill`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      carrier_name: 'GHN',
      tracking_code: 'TEST-TRACK-001',
      actual_shipping_cost: 25000,
    }),
  });
  assert(fulfill.status === 200, `fulfill ${fulfill.status}: ${await fulfill.clone().text()}`);
  const shipping = (await fulfill.json()) as {
    order_status: string;
    payment_status: string;
    tracking_code: string;
  };
  assert(shipping.order_status === 'shipping', 'shipping');
  assert(shipping.payment_status === 'pending_cod', 'pending_cod');
  assert(shipping.tracking_code === 'TEST-TRACK-001', 'tracking');

  const complete = await adminFetch(`/admin/orders/${encodeURIComponent(code)}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
  assert(complete.status === 200, `complete ${complete.status}: ${await complete.clone().text()}`);
  const done = (await complete.json()) as {
    order_status: string;
    payment_status: string;
    completed_at: string;
    items: { status: string }[];
  };
  assert(done.order_status === 'completed', 'completed');
  assert(done.payment_status === 'pending_cod', 'COD stays pending_cod');
  assert(done.completed_at, 'completed_at');
  assert(done.items?.[0]?.status === 'sold', 'item sold');

  const ret = await adminFetch(`/admin/orders/${encodeURIComponent(code)}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'returned', reason: 'Khách thử không vừa' }),
  });
  assert(ret.status === 200, `return ${ret.status}: ${await ret.clone().text()}`);
  const returned = (await ret.json()) as {
    order_status: string;
    deposit_status: string;
    refund_amount: number;
    items: { status: string }[];
  };
  assert(returned.order_status === 'returned', 'returned');
  assert(returned.deposit_status === 'forfeited', 'forfeited');
  assert(typeof returned.refund_amount === 'number', 'refund');
  assert(returned.items?.[0]?.status === 'shelf', 'item back shelf');

  const list = await adminFetch('/admin/orders?limit=5', token);
  assert(list.status === 200, `list ${list.status}`);
  const listBody = (await list.json()) as {
    orders: unknown[];
    pagination: { total: number };
    counts: { all: number };
  };
  assert(Array.isArray(listBody.orders) && listBody.pagination && listBody.counts, 'list shape');

  await ensureShelfItem(client, 'item-seed-shelf-001');
  await client.end();
  console.log('order-fulfillment check OK', code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
