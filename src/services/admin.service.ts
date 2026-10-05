import { db } from '../configs/database.js';
import { items, orders, orderItems, cashFlowEntries } from '../db/schema.js';
import { eq, desc, asc, sql, and, or, ilike, inArray } from 'drizzle-orm';
import { itemRepository } from '../repositories/item.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { batchRepository } from '../repositories/batch.repository.js';
import { settingRepository } from '../repositories/setting.repository.js';
import { orderService } from './order.service.js';
import { cashFlowService } from './cash-flow.service.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { canChangeItemStatus, draftProblems, publishProblems } from '../utils/item-publish.util.js';
import { toAdminDetail, toAdminSummary, upsertBodyToRow } from '../utils/item-mapper.util.js';
import { appendTimeline, toAdminOrderDetail, toAdminOrderSummary } from '../utils/order-mapper.util.js';
import { depositWasReceived } from '../utils/deposit-status.util.js';
import { emptyBatchStats, toBatchSummary } from '../utils/batch-mapper.util.js';
import type { CashFlowPeriod } from '../utils/cash-flow.util.js';

async function nextItemId(batchCode: string) {
  const seq = await batchRepository.nextItemSeq(batchCode);
  return `${batchCode}-${String(seq).padStart(3, '0')}`;
}

async function resolveBatchId(ref: string): Promise<string> {
  const batch = await batchRepository.findByIdOrCode(ref);
  if (!batch) {
    throw new AppError('Không tìm thấy kiện hàng', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
      batch_id: 'Mã kiện không tồn tại.',
    });
  }
  return batch.id;
}

async function loadOrderItemsMapped(orderCode: string, tx: typeof db | any = db) {
  return await tx
    .select({
      item: items,
      priceSnapshot: orderItems.priceSnapshot,
    })
    .from(orderItems)
    .innerJoin(items, eq(orderItems.itemId, items.id))
    .where(eq(orderItems.orderCode, orderCode));
}

async function releaseItemsToShelf(tx: any, orderCode: string) {
  const oItems = await tx.query.orderItems.findMany({
    where: eq(orderItems.orderCode, orderCode),
  });
  for (const oi of oItems) {
    await tx
      .update(items)
      .set({
        status: 'shelf',
        reservedUntil: null,
        reservedByCustomerPhone: null,
        updatedAt: new Date(),
      })
      .where(eq(items.id, oi.itemId));
  }
}

async function markItemsSold(tx: any, orderCode: string) {
  const oItems = await tx.query.orderItems.findMany({
    where: eq(orderItems.orderCode, orderCode),
  });
  for (const oi of oItems) {
    await tx.update(items).set({ status: 'sold', updatedAt: new Date() }).where(eq(items.id, oi.itemId));
  }
}

export class AdminService {
  async getAdminItems(filters?: {
    status?: string;
    category?: string;
    condition?: string;
    batch_id?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = (page - 1) * limit;

    const [{ items: itemList, total }, stats] = await Promise.all([
      itemRepository.findAdminItems({
        status: filters?.status,
        category: filters?.category,
        condition: filters?.condition,
        batchId: filters?.batch_id,
        search: filters?.search,
        sort: filters?.sort,
        limit,
        offset,
      }),
      itemRepository.statusStats(),
    ]);

    return {
      items: itemList.map(toAdminSummary),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
      stats,
    };
  }

  async getAdminItem(id: string) {
    const row = await itemRepository.findById(id);
    if (!row) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }
    return toAdminDetail(row);
  }

  async createItem(body: any) {
    const candidate = {
      name: body.name,
      price: body.price,
      category: body.category,
      condition: body.condition,
      size: body.size,
      material: body.material,
      measurements: body.measurements,
      images: body.images,
      defect_description: body.defect_description,
      defect_images: body.defect_images,
    };
    const problems = body.status === 'shelf' ? publishProblems(candidate) : draftProblems(candidate);
    if (Object.keys(problems).length) {
      throw new AppError(
        'Chưa đủ điều kiện lưu món',
        HttpStatus.BAD_REQUEST,
        body.status === 'shelf' ? ErrorCode.PUBLISH_REQUIREMENTS_NOT_MET : ErrorCode.VALIDATION_FAILED,
        problems
      );
    }

    const row = upsertBodyToRow(body);
    row.batchId = await resolveBatchId(row.batchId);
    const batch = await batchRepository.findById(row.batchId);
    if (!batch) {
      throw new AppError('Không tìm thấy kiện hàng', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
        batch_id: 'Mã kiện không tồn tại.',
      });
    }
    const created = await itemRepository.create({
      id: await nextItemId(batch.code),
      ...row,
    });
    return toAdminDetail(created);
  }

  async updateItem(id: string, body: any) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    if (
      (existing.status === 'reserved' || existing.status === 'sold') &&
      typeof body.price === 'number' &&
      body.price !== existing.price
    ) {
      throw new AppError('Món đang giữ chỗ hoặc đã bán không đổi giá được', HttpStatus.CONFLICT, ErrorCode.PRICE_LOCKED);
    }

    const targetStatus = body.status ?? (existing.status === 'shelf' || existing.status === 'draft' ? existing.status : 'draft');
    if (targetStatus !== 'draft' && targetStatus !== 'shelf') {
      throw new AppError('Chỉ lưu trạng thái nháp hoặc trên kệ', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TRANSITION);
    }

    const candidate = {
      name: body.name,
      price: body.price,
      category: body.category,
      condition: body.condition,
      size: body.size,
      material: body.material,
      measurements: body.measurements,
      images: body.images,
      defect_description: body.defect_description,
      defect_images: body.defect_images,
    };
    const problems = targetStatus === 'shelf' ? publishProblems(candidate) : draftProblems(candidate);
    if (Object.keys(problems).length) {
      throw new AppError(
        'Chưa đủ điều kiện lưu món',
        HttpStatus.BAD_REQUEST,
        targetStatus === 'shelf' ? ErrorCode.PUBLISH_REQUIREMENTS_NOT_MET : ErrorCode.VALIDATION_FAILED,
        problems
      );
    }

    // reserved/sold: allow metadata updates but keep status
    const row = upsertBodyToRow({ ...body, status: targetStatus });
    row.batchId = await resolveBatchId(row.batchId);
    if (existing.status === 'reserved' || existing.status === 'sold') {
      delete (row as any).status;
      delete (row as any).price;
    }

    const updated = await itemRepository.update(id, row);
    return toAdminDetail(updated!);
  }

  async updateItemStatus(id: string, status: 'draft' | 'shelf') {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    const gate = canChangeItemStatus(existing.status, status);
    if (!gate.allowed) {
      throw new AppError(gate.reason || 'Không đổi được trạng thái', HttpStatus.CONFLICT, gate.code || ErrorCode.INVALID_TRANSITION);
    }

    if (status === 'shelf') {
      const problems = publishProblems({
        name: existing.name,
        price: existing.price,
        category: existing.category,
        condition: existing.condition,
        size: existing.size,
        material: existing.material,
        measurements: existing.measurements,
        images: existing.images as any,
        defect_description: existing.defectDescription,
        defect_images: existing.defectImages as any,
      });
      if (Object.keys(problems).length) {
        throw new AppError(
          'Chưa đủ điều kiện lên kệ',
          HttpStatus.BAD_REQUEST,
          ErrorCode.PUBLISH_REQUIREMENTS_NOT_MET,
          problems
        );
      }
    }

    const updated = await itemRepository.update(id, { status });
    return toAdminDetail(updated!);
  }

  async getAdminOrders(filters?: {
    order_status?: string;
    payment_status?: string;
    carrier_name?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 15;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (filters?.order_status) conditions.push(eq(orders.orderStatus, filters.order_status as any));
    if (filters?.payment_status) conditions.push(eq(orders.paymentStatus, filters.payment_status as any));
    if (filters?.carrier_name) conditions.push(ilike(orders.carrierName, `%${filters.carrier_name}%`));
    if (filters?.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(ilike(orders.orderCode, q), ilike(orders.customerPhone, q), ilike(orders.customerName, q))!
      );
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const sort = filters?.sort ?? 'newest';
    const orderBy =
      sort === 'oldest'
        ? asc(orders.createdAt)
        : sort === 'total_desc'
          ? desc(orders.total)
          : sort === 'total_asc'
            ? asc(orders.total)
            : desc(orders.createdAt);

    const [orderList, countRes, statusCounts] = await Promise.all([
      db.select().from(orders).where(whereClause).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(whereClause),
      db
        .select({ status: orders.orderStatus, count: sql<number>`count(*)` })
        .from(orders)
        .groupBy(orders.orderStatus),
    ]);

    const itemCounts = orderList.length
      ? await db
          .select({
            orderCode: orderItems.orderCode,
            count: sql<number>`count(*)`,
          })
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderCode,
              orderList.map((o) => o.orderCode)
            )
          )
          .groupBy(orderItems.orderCode)
      : [];
    const countMap = new Map(itemCounts.map((r) => [r.orderCode, Number(r.count)]));

    const counts = {
      all: 0,
      new: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      returned: 0,
      cancelled: 0,
    };
    for (const row of statusCounts) {
      const n = Number(row.count);
      counts.all += n;
      if (row.status in counts) (counts as any)[row.status] = n;
    }

    const total = Number(countRes[0]?.count ?? 0);
    return {
      orders: orderList.map((o) => toAdminOrderSummary(o, countMap.get(o.orderCode) ?? 0)),
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.max(1, Math.ceil(total / limit) || 1),
      },
      counts,
    };
  }

  async getOrderDetail(orderCode: string) {
    await orderService.applyHoldExpiry(orderCode);
    const ord = await orderRepository.findByCode(orderCode);
    if (!ord) {
      throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
    }
    const mapped = await loadOrderItemsMapped(orderCode);
    return toAdminOrderDetail(ord, mapped);
  }

  private async detailAfter(orderCode: string, tx?: any) {
    const ord = tx
      ? await tx.query.orders.findFirst({ where: eq(orders.orderCode, orderCode) })
      : await orderRepository.findByCode(orderCode);
    if (!ord) {
      throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
    }
    const mapped = await loadOrderItemsMapped(orderCode, tx ?? db);
    return toAdminOrderDetail(ord, mapped);
  }

  async confirmOrder(orderCode: string, shippingFee?: number, note?: string) {
    return await db.transaction(async (tx) => {
      await orderService.applyHoldExpiry(orderCode, tx as any);

      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'new') {
        throw new AppError('Chỉ xác nhận đơn đang ở trạng thái mới', HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }
      if (ord.depositStatus === 'pending') {
        throw new AppError(
          'Đơn cần nhận cọc trước khi xác nhận.',
          HttpStatus.CONFLICT,
          ErrorCode.DEPOSIT_REQUIRED
        );
      }

      const feeProvided = shippingFee !== undefined;
      const newShippingFee = feeProvided ? shippingFee : ord.shippingFee;
      if (newShippingFee === null || newShippingFee === undefined) {
        throw new AppError(
          'Đơn chưa có phí ship; gửi shipping_fee khi xác nhận.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.SHIPPING_FEE_REQUIRED
        );
      }

      const total = ord.subtotal + newShippingFee;
      const credited = depositWasReceived(ord.depositStatus) ? ord.depositAmount : 0;
      const amountDue = Math.max(0, total - credited);

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'confirmed',
          confirmedBy: 'shop',
          confirmedAt: new Date(),
          shippingFee: newShippingFee,
          total,
          amountDue,
          adminNote: note?.trim() || ord.adminNote,
          timeline: appendTimeline(ord.timeline as any, 'Shop xác nhận đơn', note?.trim() || undefined),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      void updated;
      return this.detailAfter(orderCode, tx);
    });
  }

  async markDepositPaid(orderCode: string, note?: string) {
    return await db.transaction(async (tx) => {
      await orderService.applyHoldExpiry(orderCode, tx as any);

      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);

      if (ord.depositStatus !== 'pending') {
        throw new AppError(
          'Chỉ ghi nhận cọc khi deposit_status = pending',
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }
      if (ord.orderStatus !== 'new' && ord.orderStatus !== 'confirmed') {
        throw new AppError(
          'Không ghi nhận cọc ở trạng thái đơn hiện tại',
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }

      const amountDue = Math.max(0, ord.total - ord.depositAmount);

      await tx
        .update(orders)
        .set({
          depositStatus: 'received',
          depositPaidAt: new Date(),
          amountDue,
          adminNote: note?.trim() || ord.adminNote,
          timeline: appendTimeline(ord.timeline as any, 'Đã nhận cọc', note?.trim() || undefined),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      if (ord.depositAmount > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'income',
          amount: ord.depositAmount,
          category: 'deposit',
          description: `Thu tiền cọc đơn hàng ${ord.orderCode}${note ? `: ${note}` : ''}`,
        });
      }

      return this.detailAfter(orderCode, tx);
    });
  }

  async fulfillOrder(
    orderCode: string,
    carrierName: string,
    trackingCode: string,
    actualShippingCost: number,
    note?: string
  ) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'confirmed') {
        throw new AppError(
          `Đơn phải ở trạng thái confirmed để giao bưu cục. Hiện tại: ${ord.orderStatus}`,
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }
      if (ord.depositStatus === 'pending') {
        throw new AppError(
          'Chưa nhận cọc — không giao bưu cục.',
          HttpStatus.CONFLICT,
          ErrorCode.DEPOSIT_REQUIRED
        );
      }

      const shippingMargin = (ord.shippingFee ?? 0) - actualShippingCost;
      const paymentStatus = ord.paymentMethod === 'cod' ? 'pending_cod' : ord.paymentStatus;

      await tx
        .update(orders)
        .set({
          orderStatus: 'shipping',
          paymentStatus: paymentStatus as any,
          carrierName,
          trackingCode,
          actualShippingCost,
          shippingMargin,
          shippedAt: new Date(),
          adminNote: note?.trim() || ord.adminNote,
          timeline: appendTimeline(
            ord.timeline as any,
            'Đã bàn giao bưu cục',
            `${carrierName} · ${trackingCode}`
          ),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      return this.detailAfter(orderCode, tx);
    });
  }

  async completeOrder(orderCode: string) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'shipping') {
        throw new AppError(
          `Hoàn tất chỉ từ shipping. Hiện tại: ${ord.orderStatus}`,
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }

      await tx
        .update(orders)
        .set({
          orderStatus: 'completed',
          completedAt: new Date(),
          timeline: appendTimeline(ord.timeline as any, 'Đã giao thành công'),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      await markItemsSold(tx, orderCode);
      return this.detailAfter(orderCode, tx);
    });
  }

  async processReturn(orderCode: string, reason?: string, returnShippingFee?: number) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'completed') {
        throw new AppError(
          'Chỉ nhận trả từ đơn đã hoàn tất',
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }
      if (!ord.completedAt) {
        throw new AppError('Thiếu completed_at', HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }

      const windowMs = (ord.returnWindowDays ?? 2) * 24 * 60 * 60 * 1000;
      if (Date.now() - ord.completedAt.getTime() > windowMs) {
        throw new AppError(
          'Đã quá hạn trả hàng của đơn này.',
          HttpStatus.CONFLICT,
          ErrorCode.RETURN_WINDOW_EXPIRED
        );
      }

      const hadDeposit = depositWasReceived(ord.depositStatus) && ord.depositAmount > 0;
      const charge = hadDeposit ? ord.depositAmount : ord.agreedReturnFee;
      const refundAmount = Math.max(0, ord.subtotal - charge);
      const returnFee = hadDeposit ? null : ord.agreedReturnFee;

      await tx
        .update(orders)
        .set({
          orderStatus: 'returned',
          depositStatus: hadDeposit ? 'forfeited' : ord.depositStatus,
          refundAmount,
          returnFee,
          returnedAt: new Date(),
          adminNote: reason?.trim() || ord.adminNote,
          timeline: appendTimeline(
            ord.timeline as any,
            'Nhận trả hàng',
            reason?.trim() ||
              (returnShippingFee !== undefined ? `Cước chiều về ${returnShippingFee}₫` : undefined)
          ),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      await releaseItemsToShelf(tx, orderCode);

      if (refundAmount > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'refund',
          amount: refundAmount,
          category: 'refund',
          description: `Hoàn tiền trả hàng ${ord.orderCode}${reason ? `: ${reason}` : ''}`,
        });
      }

      return this.detailAfter(orderCode, tx);
    });
  }

  async cancelOrder(orderCode: string, reason: string) {
    return await db.transaction(async (tx) => {
      await orderService.applyHoldExpiry(orderCode, tx as any);

      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);

      if (!['new', 'confirmed', 'shipping'].includes(ord.orderStatus)) {
        throw new AppError(
          `Không hủy đơn ở trạng thái ${ord.orderStatus}`,
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }

      let depositStatus = ord.depositStatus;
      let refundAmount: number | null = null;
      if (ord.depositStatus === 'pending') depositStatus = 'voided';
      else if (ord.depositStatus === 'received') {
        depositStatus = 'refunded';
        refundAmount = ord.depositAmount;
      }
      if (ord.paymentStatus === 'paid') {
        refundAmount = Math.max(0, ord.subtotal);
      }

      await tx
        .update(orders)
        .set({
          orderStatus: 'cancelled',
          cancelReason: reason,
          cancelledBy: 'shop',
          cancelledAt: new Date(),
          depositStatus,
          refundAmount,
          timeline: appendTimeline(ord.timeline as any, 'Shop hủy đơn', reason),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      await releaseItemsToShelf(tx, orderCode);

      if (refundAmount && refundAmount > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'refund',
          amount: refundAmount,
          category: 'refund',
          description: `Hoàn khi shop hủy ${ord.orderCode}: ${reason}`,
        });
      }

      return this.detailAfter(orderCode, tx);
    });
  }

  async updateOrderStatus(
    orderCode: string,
    status: 'completed' | 'returned' | 'cancelled',
    reason?: string,
    returnShippingFee?: number
  ) {
    if (status === 'completed') return this.completeOrder(orderCode);
    if (status === 'returned') return this.processReturn(orderCode, reason, returnShippingFee);
    return this.cancelOrder(orderCode, reason!.trim());
  }

  async extendHold(orderCode: string, minutes: number) {
    return await db.transaction(async (tx) => {
      await orderService.applyHoldExpiry(orderCode, tx as any);

      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'new') {
        throw new AppError(
          'Chỉ gia hạn khi đơn còn new',
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }
      if (ord.holdExtendedAt) {
        throw new AppError(
          'Đơn đã gia hạn giữ chỗ một lần',
          HttpStatus.CONFLICT,
          ErrorCode.HOLD_ALREADY_EXTENDED
        );
      }
      if (minutes >= ord.holdMinutes) {
        throw new AppError(
          `Số phút gia hạn phải nhỏ hơn hold_minutes (${ord.holdMinutes})`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_FAILED,
          { minutes: `Phải từ 1 đến ${ord.holdMinutes - 1}` }
        );
      }

      const currentExpires = ord.holdExpiresAt ? new Date(ord.holdExpiresAt) : new Date();
      const newExpiresAt = new Date(currentExpires.getTime() + minutes * 60 * 1000);

      await tx
        .update(orders)
        .set({
          holdExpiresAt: newExpiresAt,
          holdExtendedAt: new Date(),
          holdExtensionMinutes: minutes,
          timeline: appendTimeline(ord.timeline as any, 'Gia hạn giữ đơn', `+${minutes} phút`),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      const oItems = await tx.query.orderItems.findMany({ where: eq(orderItems.orderCode, orderCode) });
      for (const oi of oItems) {
        await tx.update(items).set({ reservedUntil: newExpiresAt, updatedAt: new Date() }).where(eq(items.id, oi.itemId));
      }

      return this.detailAfter(orderCode, tx);
    });
  }

  async updatePaymentStatus(orderCode: string, paymentStatus: 'paid', note?: string) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);

      const from = ord.paymentStatus;
      const allowed =
        (from === 'pending_cod' && ['completed', 'returned'].includes(ord.orderStatus)) ||
        (from === 'unpaid' &&
          ord.paymentMethod === 'bank_transfer' &&
          ['confirmed', 'shipping', 'completed'].includes(ord.orderStatus));

      if (!allowed || paymentStatus !== 'paid') {
        throw new AppError(
          `Không chuyển payment_status từ ${from} sang ${paymentStatus}`,
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }

      await tx
        .update(orders)
        .set({
          paymentStatus: 'paid',
          paidAt: new Date(),
          adminNote: note?.trim() || ord.adminNote,
          timeline: appendTimeline(ord.timeline as any, 'Đã thu đủ tiền', note?.trim() || undefined),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode));

      if (ord.amountDue > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'income',
          amount: ord.amountDue,
          category: ord.paymentMethod === 'cod' ? 'order_cod' : 'order_payment',
          description: `Thu tiền đơn ${ord.orderCode}`,
        });
      }

      return this.detailAfter(orderCode, tx);
    });
  }

  async getCashFlowSummary(period: CashFlowPeriod = 'week') {
    return cashFlowService.getSummary(period);
  }

  async listReconciliations() {
    return cashFlowService.listReconciliations();
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
    return cashFlowService.createReconciliation(body);
  }

  async getBatches() {
    const rows = await batchRepository.findAll();
    const stats = await batchRepository.statsForBatches(rows.map((r) => r.id));
    const summaries = rows.map((r) => {
      const s = toBatchSummary(r, stats.get(r.id) ?? emptyBatchStats());
      if (s.status !== r.status && s.is_broken_even) {
        void batchRepository.update(r.id, { status: 'break_even' });
      }
      return s;
    });

    return {
      batches: summaries,
      totals: {
        total_batches: summaries.length,
        total_capital_invested: summaries.reduce((n, b) => n + b.total_investment, 0),
        total_revenue_generated: summaries.reduce((n, b) => n + b.total_revenue, 0),
        total_items_cataloged: summaries.reduce((n, b) => n + b.total_items_count, 0),
      },
    };
  }

  async getBatchDetail(idOrCode: string) {
    const row = await batchRepository.findByIdOrCode(idOrCode);
    if (!row) {
      throw new AppError('Không tìm thấy kiện hàng', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }
    const stats = await batchRepository.statsForBatches([row.id]);
    const summary = toBatchSummary(row, stats.get(row.id) ?? emptyBatchStats());
    if (summary.status !== row.status && summary.is_broken_even) {
      await batchRepository.update(row.id, { status: 'break_even' });
    }
    const itemRows = await batchRepository.itemsForBatch(row.id);
    return {
      ...summary,
      items: itemRows.map((i) => toAdminSummary(i as any)),
    };
  }

  async createBatch(data: {
    code: string;
    name: string;
    import_date: string;
    initial_capital: number;
    processing_cost: number;
  }) {
    const code = data.code.trim().toUpperCase();
    const dup = await batchRepository.findByCode(code);
    if (dup) {
      throw new AppError('Mã kiện đã tồn tại', HttpStatus.BAD_REQUEST, ErrorCode.BATCH_CODE_EXISTS, {
        code: 'Mã kiện đã được dùng.',
      });
    }

    const created = await batchRepository.create({
      id: code,
      code,
      name: data.name.trim(),
      importDate: data.import_date,
      initialCapital: data.initial_capital,
      processingCost: data.processing_cost ?? 0,
      status: 'active',
    });

    const capital = created.initialCapital + created.processingCost;
    if (capital > 0) {
      await db.insert(cashFlowEntries).values({
        batchId: created.id,
        type: 'expense',
        amount: capital,
        category: 'batch_capital',
        description: `Vốn kiện ${created.code}`,
      });
    }

    return toBatchSummary(created, emptyBatchStats());
  }

  async getSettings() {
    return await settingRepository.getSettings();
  }

  async updateSettings(data: any) {
    return await settingRepository.updateSettings(data);
  }
}

export const adminService = new AdminService();
