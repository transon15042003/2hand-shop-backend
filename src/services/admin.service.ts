import { db } from '../configs/database.js';
import { items, orders, orderItems, batches, cashFlowEntries } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { itemRepository } from '../repositories/item.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { batchRepository } from '../repositories/batch.repository.js';
import { settingRepository } from '../repositories/setting.repository.js';
import { cashFlowRepository } from '../repositories/cash-flow.repository.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { canChangeItemStatus, draftProblems, publishProblems } from '../utils/item-publish.util.js';
import { toAdminDetail, toAdminSummary, upsertBodyToRow } from '../utils/item-mapper.util.js';

function newItemId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `KN${stamp}-${rand}`;
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
    const created = await itemRepository.create({
      id: newItemId(),
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

  async getAdminOrders(filters?: { status?: string; limit?: number; offset?: number }) {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const condition = filters?.status ? eq(orders.orderStatus, filters.status as any) : undefined;

    const [orderList, countRes] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(condition)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(condition),
    ]);

    return {
      orders: orderList,
      total: Number(countRes[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async getOrderDetail(orderCode: string) {
    const ord = await orderRepository.findByCode(orderCode);
    if (!ord) {
      throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
    }
    const orderItemsList = await orderRepository.findOrderItems(orderCode);
    return { ...ord, items: orderItemsList };
  }

  async confirmOrder(orderCode: string, shippingFee?: number) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'new') {
        throw new AppError('Đơn hàng đã được xử lý trước đó', HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }

      const newShippingFee = shippingFee !== undefined ? shippingFee : ord.shippingFee;
      const total = ord.subtotal + (newShippingFee ?? 0);
      const amountDue = total - (ord.depositStatus === 'received' ? ord.depositAmount : 0);

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'confirmed',
          confirmedBy: 'shop',
          confirmedAt: new Date(),
          shippingFee: newShippingFee,
          total,
          amountDue,
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      return updated;
    });
  }

  async confirmDeposit(orderCode: string, transactionId?: string) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);

      const [updated] = await tx
        .update(orders)
        .set({
          depositStatus: 'received',
          depositPaidAt: new Date(),
          orderStatus: ord.orderStatus === 'new' ? 'confirmed' : ord.orderStatus,
          confirmedBy: 'shop',
          confirmedAt: new Date(),
          amountDue: ord.total - ord.depositAmount,
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      // Ghi nhận dòng tiền thu tiền cọc
      if (ord.depositAmount > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'income',
          amount: ord.depositAmount,
          category: 'deposit',
          description: `Thu tiền cọc đơn hàng ${ord.orderCode}${transactionId ? ` (Giao dịch: ${transactionId})` : ''}`,
        });
      }

      return updated;
    });
  }

  async markAsShipping(orderCode: string, carrierName: string, trackingCode: string, actualShippingCost?: number) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'confirmed') {
        throw new AppError(`Đơn hàng phải ở trạng thái confirmed để giao bưu cục. Hiện tại: ${ord.orderStatus}`, HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }

      const shippingMargin = ord.shippingFee && actualShippingCost !== undefined
        ? ord.shippingFee - actualShippingCost
        : null;

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'shipping',
          carrierName,
          trackingCode,
          actualShippingCost: actualShippingCost ?? null,
          shippingMargin,
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      return updated;
    });
  }

  async completeOrder(orderCode: string) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus !== 'shipping' && ord.orderStatus !== 'confirmed') {
        throw new AppError(`Đơn hàng phải ở trạng thái shipping hoặc confirmed để hoàn thành. Hiện tại: ${ord.orderStatus}`, HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'completed',
          paymentStatus: 'paid',
          completedAt: new Date(),
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      // Cập nhật trạng thái item thành sold
      const oItems = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderCode, orderCode),
      });

      for (const oi of oItems) {
        await tx
          .update(items)
          .set({ status: 'sold', updatedAt: new Date() })
          .where(eq(items.id, oi.itemId));
      }

      // Ghi nhận dòng tiền thu phần còn lại
      if (ord.amountDue > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'income',
          amount: ord.amountDue,
          category: 'order_payment',
          description: `Thu tiền còn lại cho đơn hàng ${ord.orderCode} khi hoàn tất giao hàng`,
        });
      }

      return updated;
    });
  }

  async processReturn(orderCode: string, refundAmount: number, reason: string) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'returned',
          refundAmount,
          returnedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      // Trả lại các món hàng về kệ (shelf)
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

      // Ghi nhận dòng tiền hoàn trả
      if (refundAmount > 0) {
        await tx.insert(cashFlowEntries).values({
          orderCode: ord.orderCode,
          type: 'refund',
          amount: refundAmount,
          category: 'refund',
          description: `Hoàn tiền đơn hàng ${ord.orderCode}: ${reason}`,
        });
      }

      return updated;
    });
  }

  async cancelOrder(orderCode: string, reason: string) {
    return await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!ord) throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      if (ord.orderStatus === 'completed' || ord.orderStatus === 'cancelled') {
        throw new AppError(`Không thể hủy đơn hàng đã ở trạng thái ${ord.orderStatus}`, HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'cancelled',
          cancelReason: reason,
          cancelledBy: 'shop',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      // Nhả items về shelf
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

      return updated;
    });
  }

  async getCashFlowSummary() {
    const entries = await cashFlowRepository.getRecentEntries(100);

    let totalIncome = 0;
    let totalExpense = 0;
    let totalRefund = 0;

    for (const e of entries) {
      if (e.type === 'income') totalIncome += e.amount;
      else if (e.type === 'expense') totalExpense += e.amount;
      else if (e.type === 'refund') totalRefund += e.amount;
    }

    return {
      totalIncome,
      totalExpense,
      totalRefund,
      netCashFlow: totalIncome - totalExpense - totalRefund,
      recentEntries: entries.slice(0, 20),
    };
  }

  async getBatches() {
    return await batchRepository.findAll();
  }

  async createBatch(data: any) {
    return await batchRepository.create(data);
  }

  async getSettings() {
    return await settingRepository.getSettings();
  }

  async updateSettings(data: any) {
    return await settingRepository.updateSettings(data);
  }
}

export const adminService = new AdminService();
