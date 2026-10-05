/**
 * Lean OpenAPI contract smoke — required fields on core responses.
 * Needs running server + seed. Usage: pnpm exec tsx scripts/check-openapi-contract.ts
 */
import 'dotenv/config';

const base = `http://localhost:${process.env.PORT || 5000}/api`;
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function requireKeys(obj: Record<string, unknown>, keys: string[], label: string) {
  for (const key of keys) {
    assert(key in obj, `${label} missing ${key}`);
  }
}

async function main() {
  const settingsRes = await fetch(`${base}/settings`);
  assert(settingsRes.status === 200, `settings ${settingsRes.status}`);
  const settings = (await settingsRes.json()) as Record<string, unknown>;
  requireKeys(
    settings,
    [
      'deposit_amount',
      'return_fee',
      'return_window_days',
      'order_hold_minutes',
      'policy_version',
      'default_shipping_fee',
      'freeship_min_items',
      'shipping_fee_presets',
    ],
    'PublicShopSettings'
  );

  const itemsRes = await fetch(`${base}/items`);
  assert(itemsRes.status === 200, `items ${itemsRes.status}`);
  const itemsBody = (await itemsRes.json()) as { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
  assert(Array.isArray(itemsBody.items), 'items array');
  requireKeys(itemsBody.pagination, ['total', 'page', 'limit', 'total_pages'], 'Pagination');
  if (itemsBody.items[0]) {
    requireKeys(itemsBody.items[0], ['id', 'name', 'category', 'condition', 'price', 'size', 'main_image', 'status'], 'ItemPublicSummary');
  }

  const dep = await fetch(`${base}/orders/deposit-check?phone=0999888777`);
  assert(dep.status === 200, `deposit-check ${dep.status}`);
  requireKeys(
    (await dep.json()) as Record<string, unknown>,
    ['deposit_required', 'deposit_amount', 'return_fee'],
    'DepositCheckResponse'
  );

  const login = await fetch(`${base}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(login.status === 200, `login ${login.status}`);
  const { token } = (await login.json()) as { token: string };

  const auth = { Authorization: `Bearer ${token}` };

  const batches = await fetch(`${base}/admin/batches`, { headers: auth });
  assert(batches.status === 200, `batches ${batches.status}`);
  const batchesBody = (await batches.json()) as {
    batches: Record<string, unknown>[];
    totals: Record<string, unknown>;
  };
  requireKeys(batchesBody.totals, ['total_batches', 'total_capital_invested', 'total_revenue_generated', 'total_items_cataloged'], 'BatchTotals');
  if (batchesBody.batches[0]) {
    requireKeys(
      batchesBody.batches[0],
      [
        'id',
        'code',
        'name',
        'import_date',
        'initial_capital',
        'processing_cost',
        'total_investment',
        'total_items_count',
        'sold_items_count',
        'total_revenue',
        'catalog_list_total',
        'catalog_cost_total',
        'list_vs_investment',
        'break_even_target',
        'remaining_to_break_even',
        'is_broken_even',
        'status',
        'categories',
        'item_status_counts',
      ],
      'BatchSummary'
    );
  }

  const orders = await fetch(`${base}/admin/orders?limit=5`, { headers: auth });
  assert(orders.status === 200, `orders ${orders.status}`);
  const ordersBody = (await orders.json()) as {
    orders: Record<string, unknown>[];
    pagination: Record<string, unknown>;
    counts: Record<string, unknown>;
  };
  requireKeys(ordersBody.pagination, ['total', 'page', 'limit', 'total_pages'], 'OrderPagination');
  requireKeys(ordersBody.counts, ['all', 'new', 'confirmed', 'shipping', 'completed', 'returned', 'cancelled'], 'OrderCounts');

  const cash = await fetch(`${base}/admin/cash-flow/summary?period=week`, { headers: auth });
  assert(cash.status === 200, `cash-flow ${cash.status}`);
  const cashBody = (await cash.json()) as Record<string, unknown>;
  requireKeys(
    cashBody,
    [
      'period',
      'total_revenue',
      'cod_pending_balance',
      'bank_balance_received',
      'shipping_fee_collected',
      'shipping_cost_paid',
      'net_shipping_margin',
      'refunds_paid',
      'batch_capital_spent',
      'net_cash_flow',
      'deposits_received',
      'return_charges',
      'series',
    ],
    'CashFlowSummary'
  );
  assert(Array.isArray(cashBody.series), 'series array');

  console.log('openapi-contract check OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
