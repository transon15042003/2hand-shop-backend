import { orderService } from '../services/order.service.js';
import { Logger } from '../utils/logger.util.js';

export type HoldExpireResult = { scanned: number; cancelled: number; confirmed: number };

export async function runHoldExpireJob(): Promise<HoldExpireResult> {
  const result = await orderService.expireAllDueHolds();
  if (result.scanned > 0) {
    Logger.info(
      `[hold-expire] scanned=${result.scanned} cancelled=${result.cancelled} confirmed=${result.confirmed}`
    );
  }
  return result;
}

/** In-process scheduler. Pass 0 (or negative) to disable. */
export function startHoldExpireScheduler(intervalMs: number): NodeJS.Timeout | null {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    Logger.info('[hold-expire] scheduler disabled (HOLD_EXPIRE_INTERVAL_MS<=0)');
    return null;
  }

  Logger.info(`[hold-expire] scheduler every ${intervalMs}ms`);
  // Run once shortly after boot, then on interval.
  const kick = () => {
    void runHoldExpireJob().catch((err) => Logger.error('[hold-expire] job failed', err));
  };
  setTimeout(kick, Math.min(5_000, intervalMs));
  return setInterval(kick, intervalMs);
}
