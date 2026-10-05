/**
 * Smoke for order-concurrency. Needs server + seed shelf item.
 * Usage: pnpm exec tsx scripts/check-order-concurrency.ts
 */
import 'dotenv/config';
import { Client } from 'pg';

const base = `http://localhost:${process.env.PORT || 5000}/api`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const settingsRes = await fetch(`${base}/settings`);
  assert(settingsRes.status === 200, `settings ${settingsRes.status}`);
  const settings = (await settingsRes.json()) as { policy_version: number; deposit_amount: number; return_fee: number };

  const dep = await fetch(`${base}/orders/deposit-check?phone=0911222333`);
  assert(dep.status === 200, `deposit-check ${dep.status}`);
  const depBody = (await dep.json()) as {
    deposit_required: boolean;
    deposit_amount: number;
    return_fee: number;
  };
  assert(typeof depBody.deposit_required === 'boolean', 'deposit_required');
  assert(typeof depBody.return_fee === 'number', 'return_fee');
  assert(depBody.deposit_required === true, 'new phone needs deposit');
  assert(depBody.deposit_amount === settings.deposit_amount, 'deposit amount');

  const createBody = {
    customer_name: 'Khách test concurrency',
    customer_phone: '0911222333',
    shipping_address: 'Số 1 Test, Hà Nội',
    item_ids: ['item-seed-shelf-001'],
    payment_method: 'cod',
    policy_accepted: true,
    policy_version: settings.policy_version,
  };

  const created = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody),
  });
  assert(created.status === 201, `create ${created.status}: ${await created.clone().text()}`);
  const order = (await created.json()) as {
    order_code: string;
    deposit_status: string;
    deposit_amount: number;
    amount_due: number;
    total: number;
    items: { id: string; status: string }[];
    hold_expires_at: string;
    freeship_applied: boolean;
    default_shipping_fee: number;
  };
  assert(order.order_code && order.deposit_status === 'pending', 'pending deposit');
  assert(order.deposit_amount === settings.deposit_amount, 'order deposit');
  assert(order.amount_due === order.total - order.deposit_amount, 'amount_due');
  assert(order.items?.[0]?.id === 'item-seed-shelf-001', 'items in confirmation');
  assert(typeof order.hold_expires_at === 'string', 'hold_expires_at');

  const conflict = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody),
  });
  assert(conflict.status === 409, `conflict expected 409 got ${conflict.status}`);
  const conflictBody = (await conflict.json()) as {
    error: string;
    unavailable_item_ids: string[];
  };
  assert(conflictBody.error === 'ITEMS_ALREADY_RESERVED_OR_SOLD', `error ${conflictBody.error}`);
  assert(conflictBody.unavailable_item_ids?.includes('item-seed-shelf-001'), 'unavailable ids');

  // Force hold expiry via SQL then track → pending cancel + item shelf
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`UPDATE orders SET hold_expires_at = NOW() - INTERVAL '1 minute' WHERE order_code = $1`, [
    order.order_code,
  ]);
  await client.end();

  const track = await fetch(
    `${base}/orders/track?order_code=${encodeURIComponent(order.order_code)}&phone=0911222333`
  );
  assert(track.status === 200, `track ${track.status}`);
  const tracked = (await track.json()) as { order_status: string; deposit_status: string };
  assert(tracked.order_status === 'cancelled', `expected cancelled got ${tracked.order_status}`);
  assert(tracked.deposit_status === 'voided', `deposit voided got ${tracked.deposit_status}`);

  const item = await fetch(`${base}/items/item-seed-shelf-001`);
  assert(item.status === 200, `item back on shelf detail ${item.status}`);
  const itemBody = (await item.json()) as { status: string };
  assert(itemBody.status === 'shelf', `item status ${itemBody.status}`);

  console.log('check-order-concurrency: ok');
}

main().catch((err) => {
  console.error('check-order-concurrency: failed', err.message || err);
  process.exitCode = 1;
});
