import { db } from '../configs/database.js';
import { batches, cashFlowEntries, orders, reconciliationSessions } from '../db/schema.js';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { AppError } from '../middlewares/error.middleware.js';
import { ErrorCode, HttpStatus } from '../constants/http-status.js';
import {
  buildEmptySeries,
  bucketKey,
  parseTransferDate,
  periodWindowStart,
  type CashFlowPeriod,
} from '../utils/cash-flow.util.js';
import { depositWasReceived } from '../utils/deposit-status.util.js';

function carrierKey(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  return (raw.match(/\(([^)]+)\)/)?.[1] ?? raw)
    .normalize('NFD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function mapSession(row: typeof reconciliationSessions.$inferSelect) {
  const rec = (row.records ?? {}) as {
    order_codes?: string[];
    total_cod_amount?: number;
    carrier_fee?: number;
    net_received_amount?: number;
    reconciled_date?: string;
  };
  const orderCodes = rec.order_codes ?? [];
  return {
    id: row.id,
    session_code: row.title,
    carrier_name: row.carrier,
    total_cod_amount: rec.total_cod_amount ?? 0,
    carrier_fee: rec.carrier_fee ?? 0,
    net_received_amount: rec.net_received_amount ?? 0,
    status: row.status === 'completed' ? 'completed' : 'pending',
    order_count: orderCodes.length,
    order_codes: orderCodes,
    reconciled_date: rec.reconciled_date ?? row.updatedAt?.toISOString() ?? row.createdAt?.toISOString(),
  };
}

export class CashFlowService {
  async getSummary(period: CashFlowPeriod) {
    const now = new Date();
    const windowStart = periodWindowStart(period, now);

    const [orderRows, entryRows, batchRows] = await Promise.all([
      db.select().from(orders).where(gte(orders.createdAt, windowStart)),
      db.select().from(cashFlowEntries).where(gte(cashFlowEntries.createdAt, windowStart)),
      db.select().from(batches).where(gte(batches.createdAt, windowStart)),
    ]);

    // COD pending is a current snapshot (all unpaid COD at carrier), not window-scoped.
    const pendingCod = await db
      .select()
      .from(orders)
      .where(and(eq(orders.paymentMethod, 'cod'), eq(orders.paymentStatus, 'pending_cod')));

    let totalRevenue = 0;
    let bankBalanceReceived = 0;
    let shippingFeeCollected = 0;
    let shippingCostPaid = 0;
    let refundsPaid = 0;
    let depositsReceived = 0;
    let returnCharges = 0;

    const series = buildEmptySeries(period, now);
    const seriesMap = new Map(series.map((p) => [p.key, p]));

    const bump = (at: Date | null | undefined, cashIn: number, cashOut: number) => {
      if (!at || at.getTime() < windowStart.getTime()) return;
      const b = bucketKey(period, at);
      let point = seriesMap.get(b.key);
      if (!point) {
        point = { ...b, cash_in: 0, cash_out: 0, net: 0 };
        seriesMap.set(b.key, point);
        series.push(point);
      }
      point.cash_in += cashIn;
      point.cash_out += cashOut;
      point.net = point.cash_in - point.cash_out;
    };

    for (const e of entryRows) {
      if (e.type === 'income' && e.category === 'deposit') {
        depositsReceived += e.amount;
        bankBalanceReceived += e.amount;
        bump(e.createdAt, e.amount, 0);
      } else if (e.type === 'income' && (e.category === 'order_cod' || e.category === 'order_payment')) {
        bankBalanceReceived += e.amount;
        bump(e.createdAt, e.amount, 0);
      } else if (e.type === 'refund') {
        refundsPaid += e.amount;
        bump(e.createdAt, 0, e.amount);
      } else if (e.type === 'expense' && e.category === 'batch_capital') {
        bump(e.createdAt, 0, e.amount);
      } else if (e.type === 'expense' && e.category === 'shipping_cost') {
        shippingCostPaid += e.amount;
        bump(e.createdAt, 0, e.amount);
      }
    }

    for (const o of orderRows) {
      if (o.orderStatus === 'completed' || o.orderStatus === 'returned') {
        totalRevenue += o.subtotal;
      }
      if (o.paymentStatus === 'paid') {
        shippingFeeCollected += o.shippingFee ?? 0;
      }
      if (o.actualShippingCost && o.shippedAt && o.shippedAt.getTime() >= windowStart.getTime()) {
        // Prefer order actual cost if not already in cash_flow expense
        if (!entryRows.some((e) => e.orderCode === o.orderCode && e.category === 'shipping_cost')) {
          shippingCostPaid += o.actualShippingCost;
          bump(o.shippedAt, 0, o.actualShippingCost);
        }
      }
      if (o.orderStatus === 'returned' && o.returnedAt) {
        if (depositWasReceived(o.depositStatus) || o.depositStatus === 'forfeited') {
          returnCharges += o.depositAmount || 0;
        } else if (o.returnFee) {
          returnCharges += o.returnFee;
        }
      }
      if (o.depositStatus === 'forfeited' && o.orderStatus === 'cancelled') {
        returnCharges += o.depositAmount || 0;
      }
    }

    let batchCapitalSpent = 0;
    const expenseCapital = entryRows
      .filter((e) => e.type === 'expense' && e.category === 'batch_capital')
      .reduce((s, e) => s + e.amount, 0);
    if (expenseCapital > 0) {
      batchCapitalSpent = expenseCapital;
    } else {
      for (const b of batchRows) {
        const capital = b.initialCapital + b.processingCost;
        batchCapitalSpent += capital;
        bump(b.createdAt, 0, capital);
      }
    }

    const codPendingBalance = pendingCod.reduce((s, o) => s + o.amountDue, 0);
    const netShippingMargin = shippingFeeCollected - shippingCostPaid;

    // Recompute net_cash_flow from series for consistency with OpenAPI
    const sortedSeries = [...seriesMap.values()].sort((a, b) => a.period_start.localeCompare(b.period_start));
    for (const p of sortedSeries) p.net = p.cash_in - p.cash_out;
    const netCashFlow = sortedSeries.reduce((s, p) => s + p.net, 0);

    return {
      period,
      total_revenue: totalRevenue,
      cod_pending_balance: codPendingBalance,
      bank_balance_received: bankBalanceReceived,
      shipping_fee_collected: shippingFeeCollected,
      shipping_cost_paid: shippingCostPaid,
      net_shipping_margin: netShippingMargin,
      refunds_paid: refundsPaid,
      batch_capital_spent: batchCapitalSpent,
      deposits_received: depositsReceived,
      return_charges: returnCharges,
      net_cash_flow: netCashFlow,
      series: sortedSeries.map(({ label, period_start, cash_in, cash_out, net }) => ({
        label,
        period_start,
        cash_in,
        cash_out,
        net,
      })),
    };
  }

  async listReconciliations() {
    const rows = await db.query.reconciliationSessions.findMany({
      orderBy: [desc(reconciliationSessions.createdAt)],
    });
    return rows.map(mapSession);
  }

  async createReconciliation(body: {
    session_code: string;
    carrier_name: string;
    order_ids: string[];
    total_cod_collected: number;
    carrier_shipping_fee: number;
    net_amount_transferred: number;
    transfer_date: string;
  }) {
    const code = body.session_code.trim();
    const existing = await db.query.reconciliationSessions.findFirst({
      where: eq(reconciliationSessions.title, code),
    });
    if (existing) {
      throw new AppError('Mã phiên đối soát đã tồn tại', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
        session_code: 'Mã phiên đã dùng.',
      });
    }

    // Dedupe order ids (case-insensitive)
    const seen = new Set<string>();
    const orderIds: string[] = [];
    for (const raw of body.order_ids) {
      const key = raw.trim().toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      orderIds.push(raw.trim());
    }
    if (!orderIds.length) {
      throw new AppError('Chọn ít nhất một đơn', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
        order_ids: 'Thiếu mã đơn.',
      });
    }

    let transferAt: Date;
    try {
      transferAt = parseTransferDate(body.transfer_date);
    } catch {
      throw new AppError('Ngày tiền về không hợp lệ', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
        transfer_date: 'Dùng YYYY-MM-DD hoặc date-time.',
      });
    }

    const expectedNet = body.total_cod_collected - body.carrier_shipping_fee;
    if (body.net_amount_transferred !== expectedNet) {
      throw new AppError('Số tiền thực nhận không khớp', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
        net_amount_transferred: `Phải bằng ${expectedNet} (COD − cước hãng).`,
      });
    }

    return await db.transaction(async (tx) => {
      const found = await tx.select().from(orders).where(inArray(orders.orderCode, orderIds));
      if (found.length !== orderIds.length) {
        throw new AppError('Một số mã đơn không tồn tại', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
          order_ids: 'Có mã đơn không tìm thấy.',
        });
      }

      const carrier = carrierKey(body.carrier_name);
      let sumDue = 0;
      for (const o of found) {
        if (o.paymentMethod !== 'cod' || o.paymentStatus !== 'pending_cod') {
          throw new AppError(
            `Đơn ${o.orderCode} không ở trạng thái COD chờ đối soát`,
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_TRANSITION
          );
        }
        if (o.orderStatus !== 'completed' && o.orderStatus !== 'returned') {
          throw new AppError(
            `Đơn ${o.orderCode} chưa giao xong`,
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_TRANSITION
          );
        }
        if (carrierKey(o.carrierName) !== carrier) {
          throw new AppError('Các đơn phải cùng một hãng vận chuyển', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
            order_ids: 'Lệch hãng vận chuyển.',
          });
        }
        sumDue += o.amountDue;
      }

      // FE gửi tổng amount_due (tiền thu hộ); chấp nhận khớp amount_due
      if (body.total_cod_collected !== sumDue) {
        throw new AppError('Tổng COD không khớp các đơn', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
          total_cod_collected: `Phải bằng ${sumDue}.`,
        });
      }

      for (const o of found) {
        await tx
          .update(orders)
          .set({
            paymentStatus: 'paid',
            paidAt: transferAt,
            updatedAt: new Date(),
          })
          .where(eq(orders.orderCode, o.orderCode));

        if (o.amountDue > 0) {
          await tx.insert(cashFlowEntries).values({
            orderCode: o.orderCode,
            type: 'income',
            amount: o.amountDue,
            category: 'order_cod',
            description: `Đối soát COD phiên ${code}`,
          });
        }
      }

      if (body.carrier_shipping_fee > 0) {
        await tx.insert(cashFlowEntries).values({
          type: 'expense',
          amount: body.carrier_shipping_fee,
          category: 'shipping_cost',
          description: `Cước đối soát ${code} · ${body.carrier_name}`,
        });
      }

      const id = `rec_${Date.now().toString(36)}`;
      const [created] = await tx
        .insert(reconciliationSessions)
        .values({
          id,
          title: code,
          carrier: body.carrier_name.trim(),
          status: 'completed',
          totalDiscrepancy: 0,
          records: {
            order_codes: found.map((o) => o.orderCode),
            total_cod_amount: body.total_cod_collected,
            carrier_fee: body.carrier_shipping_fee,
            net_received_amount: body.net_amount_transferred,
            reconciled_date: transferAt.toISOString(),
          } as any,
        })
        .returning();

      return mapSession(created);
    });
  }
}

export const cashFlowService = new CashFlowService();
