/** Shop timezone for cash-flow buckets: Vietnam +07. */
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export type CashFlowPeriod = 'day' | 'week' | 'month';

export function shopYmd(d: Date = new Date()): string {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function parseTransferDate(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+07:00`);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error('INVALID_DATE');
  }
  return d;
}

/** Inclusive window start (UTC Date) for the series: 7 days / 4 weeks / 6 months. */
export function periodWindowStart(period: CashFlowPeriod, now = new Date()): Date {
  const shopNow = new Date(now.getTime() + TZ_OFFSET_MS);
  const y = shopNow.getUTCFullYear();
  const m = shopNow.getUTCMonth();
  const day = shopNow.getUTCDate();

  if (period === 'day') {
    const start = new Date(Date.UTC(y, m, day - 6, 0, 0, 0) - TZ_OFFSET_MS);
    return start;
  }
  if (period === 'week') {
    // Align to Monday of current shop week, then go back 3 more weeks (4 weeks total).
    const dow = (shopNow.getUTCDay() + 6) % 7; // Mon=0
    const monday = new Date(Date.UTC(y, m, day - dow - 21, 0, 0, 0) - TZ_OFFSET_MS);
    return monday;
  }
  // month: first day of month 5 months ago
  return new Date(Date.UTC(y, m - 5, 1, 0, 0, 0) - TZ_OFFSET_MS);
}

export function bucketKey(period: CashFlowPeriod, at: Date): { key: string; label: string; period_start: string } {
  const shop = new Date(at.getTime() + TZ_OFFSET_MS);
  const y = shop.getUTCFullYear();
  const m = shop.getUTCMonth();
  const d = shop.getUTCDate();

  if (period === 'day') {
    const period_start = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { key: period_start, label: period_start.split('-').reverse().join('/'), period_start };
  }
  if (period === 'week') {
    const dow = (shop.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(y, m, d - dow));
    const period_start = monday.toISOString().slice(0, 10);
    // ISO week number
    const tmp = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { key: period_start, label: `Tuần ${weekNo}`, period_start };
  }
  const period_start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { key: period_start, label: `Tháng ${m + 1}/${y}`, period_start };
}

export function buildEmptySeries(period: CashFlowPeriod, now = new Date()) {
  const start = periodWindowStart(period, now);
  const end = now;
  const points: { key: string; label: string; period_start: string; cash_in: number; cash_out: number; net: number }[] = [];
  const seen = new Set<string>();

  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime() + 86400000) {
    const b = bucketKey(period, cursor);
    if (!seen.has(b.key)) {
      seen.add(b.key);
      points.push({ ...b, cash_in: 0, cash_out: 0, net: 0 });
    }
    if (period === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (period === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (points.length > 40) break;
  }
  return points;
}
