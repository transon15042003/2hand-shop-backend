import type { batches } from '../db/schema.js';

type BatchRow = typeof batches.$inferSelect;

export type BatchItemStatusCounts = {
  draft: number;
  shelf: number;
  reserved: number;
  sold: number;
};

export type BatchStats = {
  totalItemsCount: number;
  soldItemsCount: number;
  totalRevenue: number;
  categories: string[];
  itemStatusCounts: BatchItemStatusCounts;
};

export const emptyItemStatusCounts = (): BatchItemStatusCounts => ({
  draft: 0,
  shelf: 0,
  reserved: 0,
  sold: 0,
});

export function emptyBatchStats(): BatchStats {
  return {
    totalItemsCount: 0,
    soldItemsCount: 0,
    totalRevenue: 0,
    categories: [],
    itemStatusCounts: emptyItemStatusCounts(),
  };
}

export function toBatchSummary(row: BatchRow, stats: BatchStats) {
  const totalInvestment = row.initialCapital + row.processingCost;
  const breakEvenTarget = Math.round((totalInvestment * (100 + row.targetMarginPercent)) / 100);
  const isBrokenEven = stats.totalRevenue >= breakEvenTarget;
  let status = row.status;
  if (isBrokenEven && (status === 'active' || status === 'processing')) {
    status = 'break_even';
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    import_date: String(row.importDate),
    initial_capital: row.initialCapital,
    processing_cost: row.processingCost,
    total_investment: totalInvestment,
    total_items_count: stats.totalItemsCount,
    sold_items_count: stats.soldItemsCount,
    total_revenue: stats.totalRevenue,
    break_even_target: breakEvenTarget,
    remaining_to_break_even: Math.max(0, breakEvenTarget - stats.totalRevenue),
    is_broken_even: isBrokenEven,
    status,
    categories: stats.categories,
    item_status_counts: stats.itemStatusCounts,
  };
}
