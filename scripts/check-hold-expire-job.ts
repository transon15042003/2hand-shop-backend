/**
 * Smoke for hold-expire job. Needs DB + seed shelf item; does not require HTTP server.
 * Usage: pnpm exec tsx scripts/check-hold-expire-job.ts
 */
import 'dotenv/config';
import { Client } from 'pg';
import { pool } from '../src/configs/database.js';
import { runHoldExpireJob } from '../src/jobs/hold-expire.job.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Ensure a shelf item for create via SQL-less path: reuse seed or skip create if reserved
  await client.query(
    `UPDATE items SET status = 'shelf', reserved_until = NULL, reserved_by_customer_phone = NULL WHERE id = 'item-seed-shelf-001'`
  );

  const settings = await (
    await fetch(`http://localhost:${process.env.PORT || 5000}/api/settings`)
  ).json() as { policy_version: number; deposit_amount: number };

  const phone = `09${String(Date.now()).slice(-8)}`;
  const create = await fetch(`http://localhost:${process.env.PORT || 5000}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Hold expire test',
      customer_phone: phone,
      shipping_address: 'Số 1 Hold Expire, Hà Nội',
      item_ids: ['item-seed-shelf-001'],
      payment_method: 'cod',
      policy_accepted: true,
      policy_version: settings.policy_version,
    }),
  });
  assert(create.status === 201, `create ${create.status}: ${await create.clone().text()}`);
  const order = (await create.json()) as { order_code: string; deposit_status: string };
  assert(order.deposit_status === 'pending', 'pending deposit');

  await client.query(
    `UPDATE orders SET hold_expires_at = NOW() - INTERVAL '1 minute' WHERE order_code = $1`,
    [order.order_code]
  );

  const result = await runHoldExpireJob();
  assert(result.scanned >= 1, `scanned ${result.scanned}`);
  assert(result.cancelled >= 1, `cancelled ${result.cancelled}`);

  const row = await client.query(
    `SELECT order_status, deposit_status, cancelled_by FROM orders WHERE order_code = $1`,
    [order.order_code]
  );
  assert(row.rows[0]?.order_status === 'cancelled', 'order cancelled');
  assert(row.rows[0]?.deposit_status === 'voided', 'deposit voided');
  assert(row.rows[0]?.cancelled_by === 'system', 'cancelled_by system');

  const item = await client.query(`SELECT status FROM items WHERE id = 'item-seed-shelf-001'`);
  assert(item.rows[0]?.status === 'shelf', 'item back on shelf');

  // Second path: not_required → auto confirm
  await client.query(
    `UPDATE items SET status = 'shelf', reserved_until = NULL, reserved_by_customer_phone = NULL WHERE id = 'item-seed-shelf-001'`
  );
  // Mark phone as trusted by inserting a fake completed order? Simpler: force deposit_status after create via SQL
  const phone2 = `08${String(Date.now()).slice(-8)}`;
  const create2 = await fetch(`http://localhost:${process.env.PORT || 5000}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Hold confirm test',
      customer_phone: phone2,
      shipping_address: 'Số 2 Hold Expire, Hà Nội',
      item_ids: ['item-seed-shelf-001'],
      payment_method: 'cod',
      policy_accepted: true,
      policy_version: settings.policy_version,
    }),
  });
  assert(create2.status === 201, `create2 ${create2.status}`);
  const order2 = (await create2.json()) as { order_code: string };
  await client.query(
    `UPDATE orders SET deposit_status = 'not_required', deposit_amount = 0, amount_due = total,
       hold_expires_at = NOW() - INTERVAL '1 minute' WHERE order_code = $1`,
    [order2.order_code]
  );

  const result2 = await runHoldExpireJob();
  assert(result2.confirmed >= 1, `confirmed ${result2.confirmed}`);
  const row2 = await client.query(
    `SELECT order_status, confirmed_by FROM orders WHERE order_code = $1`,
    [order2.order_code]
  );
  assert(row2.rows[0]?.order_status === 'confirmed', 'auto confirmed');
  assert(row2.rows[0]?.confirmed_by === 'system', 'confirmed_by system');

  // cleanup reservation so other smokes work
  await client.query(
    `UPDATE items SET status = 'shelf', reserved_until = NULL, reserved_by_customer_phone = NULL WHERE id = 'item-seed-shelf-001'`
  );
  await client.query(`UPDATE orders SET order_status = 'cancelled', cancelled_by = 'shop' WHERE order_code = $1`, [
    order2.order_code,
  ]);

  await client.end();
  await pool.end();
  console.log('hold-expire-job check OK', order.order_code, order2.order_code);
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
