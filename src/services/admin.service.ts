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

export class AdminService {
  async getAdminItems(filters?: {
    status?: string;
    category?: string;
    batchId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const conditions = [];
    if (filters?.status) conditions.push(eq(items.status, filters.status as any));
    if (filters?.category) conditions.push(eq(items.category, filters.category as any));
    if (filters?.batchId) conditions.push(eq(items.batchId, filters.batchId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemList, countRes] = await Promise.all([
      db
        .select()
        .from(items)
        .where(whereClause)
        .orderBy(desc(items.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(items)
        .where(whereClause),
    ]);

    return {
      items: itemList,
      total: Number(countRes[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createItem(data: any) {
    return await itemRepository.create({
      ...data,
      status: 'shelf',
    });
  }

  async updateItem(id: string, data: any) {
    const existing = await itemRepository.findById(id);
    if (!existing) {
      throw new AppError('Sản phẩm không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }
    return await itemRepository.update(id, data);
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
