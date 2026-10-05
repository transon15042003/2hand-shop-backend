import type { batches } from '../db/schema.js';

type BatchRow = typeof batches.$inferSelect;

export type BatchStats = {
  totalItemsCount: number;
  soldItemsCount: number;
  totalRevenue: number;
};

export function toBatchSummary(row: BatchRow, stats: BatchStats) {
  const totalInvestment = row.initialCapital + row.processingCost;
  const breakEvenTarget = Math.round(totalInvestment * (100 + row.targetMarginPercent) / 100);
  const isBrokenEven = stats.totalRevenue >= breakEvenTarget;
  let status = row.status;
  if (isBrokenEven && (status === 'active' || status === 'processing')) {
    status = 'break_even';
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    import_date: String(row.importDate),
    initial_capital: row.initialCapital,
    processing_cost: row.processingCost,
    total_investment: totalInvestment,
    total_items_count: stats.totalItemsCount,
    sold_items_count: stats.soldItemsCount,
    total_revenue: stats.totalRevenue,
    break_even_target: breakEvenTarget,
    is_broken_even: isBrokenEven,
    status,
  };
}
