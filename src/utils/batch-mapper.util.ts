import type { batches } from '../db/schema.js';

type BatchRow = typeof batches.$inferSelect;

export type BatchItemStatusCounts = {
  draft: number;
  shelf: number;
  reserved: number;
  sold: number;
  discarded: number;
};

export type BatchStats = {
  totalItemsCount: number;
  soldItemsCount: number;
  totalRevenue: number;
  catalogListTotal: number;
  catalogCostTotal: number;
  categories: string[];
  itemStatusCounts: BatchItemStatusCounts;
};

export const emptyItemStatusCounts = (): BatchItemStatusCounts => ({
  draft: 0,
  shelf: 0,
  reserved: 0,
  sold: 0,
  discarded: 0,
});

export function emptyBatchStats(): BatchStats {
  return {
    totalItemsCount: 0,
    soldItemsCount: 0,
    totalRevenue: 0,
    catalogListTotal: 0,
    catalogCostTotal: 0,
    categories: [],
    itemStatusCounts: emptyItemStatusCounts(),
  };
}

export function toBatchSummary(row: BatchRow, stats: BatchStats) {
  const shippingCost = row.shippingCost ?? 0;
  const processingCost = row.processingCost ?? 0;
  const otherCost = row.otherCost ?? 0;
  const totalInvestment = row.initialCapital + shippingCost + processingCost + otherCost;
  const targetMargin = row.targetMarginPercent ?? 30;
  const breakEvenTarget = Math.round((totalInvestment * (100 + targetMargin)) / 100);
  const isBrokenEven = stats.totalRevenue >= breakEvenTarget;
  let status = row.status;
  if (isBrokenEven && (status === 'active' || status === 'processing')) {
    status = 'break_even';
  }

  const estimatedCostPerItem =
    stats.totalItemsCount > 0 ? Math.round(totalInvestment / stats.totalItemsCount) : 0;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    import_date: String(row.importDate),
    initial_capital: row.initialCapital,
    shipping_cost: shippingCost,
    processing_cost: processingCost,
    other_cost: otherCost,
    total_investment: totalInvestment,
    target_margin_percent: targetMargin,
    total_items_count: stats.totalItemsCount,
    sold_items_count: stats.soldItemsCount,
    total_revenue: stats.totalRevenue,
    catalog_list_total: stats.catalogListTotal,
    catalog_cost_total: stats.catalogCostTotal,
    list_vs_investment: stats.catalogListTotal - totalInvestment,
    break_even_target: breakEvenTarget,
    remaining_to_break_even: Math.max(0, breakEvenTarget - stats.totalRevenue),
    is_broken_even: isBrokenEven,
    estimated_cost_per_item: estimatedCostPerItem,
    status,
    notes: row.notes ?? null,
    categories: stats.categories,
    item_status_counts: stats.itemStatusCounts,
  };
}
