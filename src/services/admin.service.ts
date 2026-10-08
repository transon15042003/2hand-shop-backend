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
import { emailService } from './email.service.js';
import { uploadService } from './upload.service.js';

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

    const oldImages = [
      ...(Array.isArray(existing.images) ? existing.images : []),
      ...(Array.isArray(existing.defectImages) ? existing.defectImages : []),
    ];
    const newImages = [
      ...(Array.isArray(body.images) ? body.images : []),
      ...(Array.isArray(body.defect_images) ? body.defect_images : []),
    ];
    await uploadService.cleanupOrphanedBlobs(oldImages, newImages);

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

  async applyItemDiscount(
    id: string,
    body: { discount_percent?: number; sale_price?: number; allow_below_cost?: boolean }
  ) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    if (existing.status === 'reserved' || existing.status === 'sold') {
      throw new AppError(
        'Món đang giữ chỗ hoặc đã bán không đổi giá / sale được',
        HttpStatus.CONFLICT,
        ErrorCode.PRICE_LOCKED
      );
    }
    if (existing.status === 'discarded') {
      throw new AppError('Món đã hủy / loại bỏ không thể giảm giá', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TRANSITION);
    }

    const originalBase = existing.originalPrice ?? existing.price;
    let salePrice: number;

    if (body.discount_percent !== undefined) {
      salePrice = Math.round((originalBase * (100 - body.discount_percent)) / 100 / 1000) * 1000;
    } else if (body.sale_price !== undefined) {
      salePrice = body.sale_price;
    } else {
      throw new AppError('Vui lòng nhập discount_percent hoặc sale_price', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
    }

    if (salePrice >= originalBase) {
      throw new AppError(
        `Giá sale (${salePrice.toLocaleString()}đ) phải thấp hơn giá gốc (${originalBase.toLocaleString()}đ)`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED
      );
    }

    if (existing.costPrice && salePrice < existing.costPrice && !body.allow_below_cost) {
      throw new AppError(
        `Giá sale (${salePrice.toLocaleString()}đ) thấp hơn giá vốn (${existing.costPrice.toLocaleString()}đ). Vui lòng xác nhận nếu muốn xả lỗ.`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.SALE_BELOW_COST,
        {
          cost_price: existing.costPrice,
          sale_price: salePrice,
        }
      );
    }

    const updated = await itemRepository.update(id, {
      originalPrice: originalBase,
      price: salePrice,
    });
    return toAdminDetail(updated!);
  }

  async removeItemDiscount(id: string) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    if (existing.status === 'reserved' || existing.status === 'sold') {
      throw new AppError(
        'Món đang giữ chỗ hoặc đã bán không khôi phục giá được',
        HttpStatus.CONFLICT,
        ErrorCode.PRICE_LOCKED
      );
    }

    if (!existing.originalPrice) {
      return toAdminDetail(existing);
    }

    const updated = await itemRepository.update(id, {
      price: existing.originalPrice,
      originalPrice: null,
    });
    return toAdminDetail(updated!);
  }

  async bulkDiscount(body: {
    item_ids?: string[];
    batch_id?: string;
    category?: string;
    discount_percent: number;
    allow_below_cost?: boolean;
  }) {
    let batchId = body.batch_id;
    if (batchId) {
      batchId = await resolveBatchId(batchId);
    }

    const targetItems = await itemRepository.findItemsForDiscount({
      itemIds: body.item_ids,
      batchId,
      category: body.category,
    });

    const eligibleItems = targetItems.filter(
      (item: any) => item.status === 'draft' || item.status === 'shelf'
    );

    let updatedCount = 0;
    let skippedCount = 0;
    const updatedIds: string[] = [];

    await db.transaction(async (tx) => {
      for (const item of eligibleItems) {
        const originalBase = item.originalPrice ?? item.price;
        const salePrice = Math.round((originalBase * (100 - body.discount_percent)) / 100 / 1000) * 1000;

        if (salePrice >= originalBase) {
          skippedCount++;
          continue;
        }

        if (item.costPrice && salePrice < item.costPrice && !body.allow_below_cost) {
          skippedCount++;
          continue;
        }

        await itemRepository.update(
          item.id,
          {
            originalPrice: originalBase,
            price: salePrice,
          },
          tx
        );
        updatedCount++;
        updatedIds.push(item.id);
      }
    });

    return {
      total_found: targetItems.length,
      eligible_count: eligibleItems.length,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      updated_item_ids: updatedIds,
    };
  }

  async bulkRemoveDiscount(body: {
    item_ids?: string[];
    batch_id?: string;
    category?: string;
  }) {
    let batchId = body.batch_id;
    if (batchId) {
      batchId = await resolveBatchId(batchId);
    }

    const targetItems = await itemRepository.findItemsForDiscount({
      itemIds: body.item_ids,
      batchId,
      category: body.category,
    });

    const onSaleItems = targetItems.filter(
      (item: any) => (item.status === 'draft' || item.status === 'shelf') && item.originalPrice !== null
    );

    let restoredCount = 0;
    await db.transaction(async (tx) => {
      for (const item of onSaleItems) {
        await itemRepository.update(
          item.id,
          {
            price: item.originalPrice!,
            originalPrice: null,
          },
          tx
        );
        restoredCount++;
      }
    });

    return {
      total_found: targetItems.length,
      restored_count: restoredCount,
    };
  }

  async deleteItem(
    id: string,
    options?: { refund_capital?: boolean; refund_amount?: number }
  ) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    if (existing.status === 'reserved') {
      throw new AppError(
        'Món đang được giữ chỗ trong đơn hàng, không thể xóa.',
        HttpStatus.CONFLICT,
        ErrorCode.ITEM_IN_ACTIVE_ORDER
      );
    }

    const orderCount = await itemRepository.countOrderItems(id);
    if (orderCount > 0) {
      throw new AppError(
        'Món đã từng phát sinh đơn hàng, không thể xóa để bảo toàn lịch sử giao dịch. Hãy chọn chức năng Hủy / Hao hụt nếu sản phẩm bị hỏng.',
        HttpStatus.CONFLICT,
        ErrorCode.ITEM_IN_ORDER
      );
    }

    const result = await db.transaction(async (tx) => {
      await itemRepository.delete(id, tx);

      if (options?.refund_capital && options.refund_amount && options.refund_amount > 0) {
        await tx.insert(cashFlowEntries).values({
          batchId: existing.batchId ?? undefined,
          type: 'income',
          amount: options.refund_amount,
          category: 'batch_capital_refund',
          description: `Thu hồi vốn khi xóa/trả món ${existing.id}`,
        });
      }

      return {
        success: true,
        deleted_id: id,
        batch_id: existing.batchId,
      };
    });

    const existingImages = [
      ...(Array.isArray(existing.images) ? existing.images : []),
      ...(Array.isArray(existing.defectImages) ? existing.defectImages : []),
    ];
    await uploadService.cleanupOrphanedBlobs(existingImages, []);

    return result;
  }

  async discardItem(id: string, body: { reason: string; write_off_loss?: boolean }) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    if (existing.status === 'reserved' || existing.status === 'sold') {
      throw new AppError(
        'Món đang nằm trong đơn hàng, không thể đánh dấu tiêu hủy',
        HttpStatus.CONFLICT,
        ErrorCode.ITEM_IN_ACTIVE_ORDER
      );
    }

    return await db.transaction(async (tx) => {
      const updated = await itemRepository.update(
        id,
        {
          status: 'discarded',
          discardReason: body.reason.trim(),
          discardedAt: new Date(),
        },
        tx
      );

      if (body.write_off_loss && existing.costPrice && existing.costPrice > 0) {
        await tx.insert(cashFlowEntries).values({
          batchId: existing.batchId ?? undefined,
          type: 'expense',
          amount: existing.costPrice,
          category: 'inventory_loss',
          description: `Tổn thất hao hụt món ${id}: ${body.reason.trim()}`,
        });
      }

      return toAdminDetail(updated!);
    });
  }

  async reassignItemBatch(id: string, targetBatchId: string | null) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    if (existing.status === 'reserved' || existing.status === 'sold') {
      throw new AppError(
        'Món đang trong đơn hàng, không thể chuyển hoặc gỡ kiện',
        HttpStatus.CONFLICT,
        ErrorCode.ITEM_IN_ACTIVE_ORDER
      );
    }

    let finalBatchId: string | null = null;
    if (targetBatchId) {
      finalBatchId = await resolveBatchId(targetBatchId);
    }

    const updated = await itemRepository.update(id, {
      batchId: finalBatchId,
    });
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
    const result = await db.transaction(async (tx) => {
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

    void emailService.maybeSendOrderNotification(orderCode, 'confirmed');
    return result;
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
    const result = await db.transaction(async (tx) => {
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

    void emailService.maybeSendOrderNotification(orderCode, 'completed');
    return result;
  }

  async processReturn(orderCode: string, reason?: string, returnShippingFee?: number) {
    const result = await db.transaction(async (tx) => {
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

    void emailService.maybeSendOrderNotification(orderCode, 'returned', { reason });
    return result;
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
    shipping_cost?: number;
    processing_cost?: number;
    other_cost?: number;
    target_margin_percent?: number;
    notes?: string;
  }) {
    const code = data.code.trim().toUpperCase();
    const dup = await batchRepository.findByCode(code);
    if (dup) {
      throw new AppError('Mã kiện đã tồn tại', HttpStatus.BAD_REQUEST, ErrorCode.BATCH_CODE_EXISTS, {
        code: 'Mã kiện đã được dùng.',
      });
    }

    const initialCapital = data.initial_capital;
    const shippingCost = data.shipping_cost ?? 0;
    const processingCost = data.processing_cost ?? 0;
    const otherCost = data.other_cost ?? 0;

    const created = await batchRepository.create({
      id: code,
      code,
      name: data.name.trim(),
      importDate: data.import_date,
      initialCapital,
      shippingCost,
      processingCost,
      otherCost,
      targetMarginPercent: data.target_margin_percent ?? 30,
      status: 'active',
      notes: data.notes?.trim() || null,
    });

    if (initialCapital > 0) {
      await db.insert(cashFlowEntries).values({
        batchId: created.id,
        type: 'expense',
        amount: initialCapital,
        category: 'batch_capital',
        description: `Vốn mua kiện ${created.code}`,
      });
    }
    if (shippingCost > 0) {
      await db.insert(cashFlowEntries).values({
        batchId: created.id,
        type: 'expense',
        amount: shippingCost,
        category: 'batch_shipping',
        description: `Phí vận chuyển kiện ${created.code}`,
      });
    }
    if (processingCost > 0) {
      await db.insert(cashFlowEntries).values({
        batchId: created.id,
        type: 'expense',
        amount: processingCost,
        category: 'batch_processing',
        description: `Chi phí giặt là / xử lý kiện ${created.code}`,
      });
    }
    if (otherCost > 0) {
      await db.insert(cashFlowEntries).values({
        batchId: created.id,
        type: 'expense',
        amount: otherCost,
        category: 'batch_other',
        description: `Chi phí khác kiện ${created.code}`,
      });
    }

    return toBatchSummary(created, emptyBatchStats());
  }

  async updateBatchCosts(
    idOrCode: string,
    data: {
      name?: string;
      initial_capital?: number;
      shipping_cost?: number;
      processing_cost?: number;
      other_cost?: number;
      target_margin_percent?: number;
      notes?: string;
    }
  ) {
    const existing = await batchRepository.findByIdOrCode(idOrCode);
    if (!existing) {
      throw new AppError('Không tìm thấy kiện hàng', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    const oldTotal =
      existing.initialCapital +
      (existing.shippingCost ?? 0) +
      existing.processingCost +
      (existing.otherCost ?? 0);

    const newInitialCapital = data.initial_capital ?? existing.initialCapital;
    const newShippingCost = data.shipping_cost ?? existing.shippingCost ?? 0;
    const newProcessingCost = data.processing_cost ?? existing.processingCost;
    const newOtherCost = data.other_cost ?? existing.otherCost ?? 0;
    const newTotal = newInitialCapital + newShippingCost + newProcessingCost + newOtherCost;
    const diff = newTotal - oldTotal;

    const { batches } = await import('../db/schema.js');
    const updatePayload: Partial<typeof batches.$inferInsert> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.initial_capital !== undefined) updatePayload.initialCapital = data.initial_capital;
    if (data.shipping_cost !== undefined) updatePayload.shippingCost = data.shipping_cost;
    if (data.processing_cost !== undefined) updatePayload.processingCost = data.processing_cost;
    if (data.other_cost !== undefined) updatePayload.otherCost = data.other_cost;
    if (data.target_margin_percent !== undefined) updatePayload.targetMarginPercent = data.target_margin_percent;
    if (data.notes !== undefined) updatePayload.notes = data.notes.trim() || null;

    return await db.transaction(async (tx) => {
      const updated = await tx
        .update(batches)
        .set({ ...updatePayload, updatedAt: new Date() })
        .where(eq(batches.id, existing.id))
        .returning();

      if (diff > 0) {
        await tx.insert(cashFlowEntries).values({
          batchId: existing.id,
          type: 'expense',
          amount: diff,
          category: 'batch_adjustment',
          description: `Điều chỉnh tăng chi phí kiện ${existing.code} (+${diff.toLocaleString()}đ)`,
        });
      } else if (diff < 0) {
        await tx.insert(cashFlowEntries).values({
          batchId: existing.id,
          type: 'income',
          amount: Math.abs(diff),
          category: 'batch_adjustment',
          description: `Điều chỉnh giảm chi phí kiện ${existing.code} (-${Math.abs(diff).toLocaleString()}đ)`,
        });
      }

      const stats = await batchRepository.statsForBatches([existing.id]);
      return toBatchSummary(updated[0], stats.get(existing.id) ?? emptyBatchStats());
    });
  }

  async getSettings() {
    return await settingRepository.getSettings();
  }

  async updateSettings(data: any) {
    return await settingRepository.updateSettings(data);
  }
}

export const adminService = new AdminService();
