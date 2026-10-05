import { db } from '../configs/database.js';
import { items, orders, orderItems } from '../db/schema.js';
import { eq, inArray, asc, and, lt, isNotNull } from 'drizzle-orm';
import { settingRepository } from '../repositories/setting.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { toPublicSummary } from '../utils/item-mapper.util.js';

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export class OrderService {
  /**
   * Lazy hold expiry (ADR 007): pending → cancel+release; not_required|received → auto-confirm.
   */
  async applyHoldExpiry(orderCode: string, tx: typeof db = db) {
    const order = await tx.query.orders.findFirst({ where: eq(orders.orderCode, orderCode) });
    if (!order || order.orderStatus !== 'new' || !order.holdExpiresAt) return order;
    if (new Date(order.holdExpiresAt).getTime() > Date.now()) return order;

    const deposit = order.depositStatus;

    if (deposit === 'pending') {
      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'cancelled',
          cancelReason: 'Quá hạn giữ đơn và chưa nhận cọc',
          cancelledBy: 'system',
          cancelledAt: new Date(),
          depositStatus: 'voided',
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      const oItems = await tx.query.orderItems.findMany({ where: eq(orderItems.orderCode, orderCode) });
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
    }

    if (deposit === 'not_required' || deposit === 'received') {
      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'confirmed',
          confirmedBy: 'system',
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();
      return updated;
    }

    return order;
  }

  /**
   * Background / cron scan (ADR 007): all `new` orders past hold_expires_at.
   * Idempotent with lazy-check — safe if multiple workers overlap.
   */
  async expireAllDueHolds(): Promise<{ scanned: number; cancelled: number; confirmed: number }> {
    const due = await db
      .select({
        orderCode: orders.orderCode,
        depositStatus: orders.depositStatus,
      })
      .from(orders)
      .where(
        and(eq(orders.orderStatus, 'new'), isNotNull(orders.holdExpiresAt), lt(orders.holdExpiresAt, new Date()))
      )
      .orderBy(asc(orders.holdExpiresAt));

    let cancelled = 0;
    let confirmed = 0;

    for (const row of due) {
      const updated = await this.applyHoldExpiry(row.orderCode);
      if (!updated || updated.orderCode !== row.orderCode) continue;
      if (updated.orderStatus === 'cancelled') cancelled += 1;
      else if (updated.orderStatus === 'confirmed') confirmed += 1;
    }

    return { scanned: due.length, cancelled, confirmed };
  }

  private mapConfirmation(
    order: typeof orders.$inferSelect,
    itemRows: { id: string; name: string; category: any; condition: any; price: number; size: string; images: any; status: any; batchId?: string | null }[]
  ) {
    return {
      order_code: order.orderCode,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      shipping_address: order.shippingAddress,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      order_status: order.orderStatus,
      subtotal: order.subtotal,
      shipping_fee: order.shippingFee,
      default_shipping_fee: order.defaultShippingFee,
      freeship_applied: order.freeshipApplied,
      total: order.total,
      deposit_status: order.depositStatus,
      deposit_amount: order.depositAmount,
      amount_due: order.amountDue,
      agreed_return_fee: order.agreedReturnFee,
      return_window_days: order.returnWindowDays,
      hold_expires_at: order.holdExpiresAt?.toISOString() ?? null,
      items: itemRows.map((r) =>
        toPublicSummary({
          ...r,
          batchId: r.batchId ?? null,
        } as any)
      ),
      created_at: order.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async createOrder(data: {
    customer_name: string;
    customer_phone: string;
    shipping_address: string;
    customer_note?: string;
    item_ids: string[];
    payment_method: 'bank_transfer' | 'cod';
    policy_accepted: boolean;
    policy_version: number;
    customerId?: string;
  }) {
    const settings = await settingRepository.getSettings();

    if (data.policy_version !== settings.policyVersion) {
      throw new AppError(
        'Phiên bản chính sách của cửa hàng đã thay đổi. Vui lòng tải lại trang để xem cập nhật mới nhất.',
        HttpStatus.CONFLICT,
        ErrorCode.POLICY_VERSION_OUTDATED
      );
    }

    const itemIds = dedupeIds(data.item_ids).sort();
    if (!itemIds.length) {
      throw new AppError('Đơn hàng phải có ít nhất 1 sản phẩm', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
    }

    return await db.transaction(async (tx) => {
      // Release expired holds that still reserve these items
      const activeOrderCodes = await orderRepository.findActiveOrdersReservingItems(itemIds, tx as any);
      for (const code of activeOrderCodes) {
        await this.applyHoldExpiry(code, tx as any);
      }

      const locked = await tx
        .select()
        .from(items)
        .where(inArray(items.id, itemIds))
        .orderBy(asc(items.id))
        .for('update');
      const rows = locked;

      if (rows.length !== itemIds.length) {
        const found = new Set(rows.map((r) => r.id));
        const missing = itemIds.filter((id) => !found.has(id));
        throw new AppError(
          'Một số sản phẩm không tồn tại trong hệ thống',
          HttpStatus.BAD_REQUEST,
          ErrorCode.ITEM_NOT_FOUND,
          undefined,
          { unavailableItemIds: missing }
        );
      }

      const unavailable = rows.filter((r) => r.status !== 'shelf');
      if (unavailable.length > 0) {
        throw new AppError(
          'Một số món trong giỏ hàng vừa được khách khác đặt trước hoặc không còn trên kệ.',
          HttpStatus.CONFLICT,
          ErrorCode.ITEMS_ALREADY_RESERVED_OR_SOLD,
          undefined,
          { unavailableItemIds: unavailable.map((u) => u.id as string) }
        );
      }

      const subtotal = rows.reduce((sum, r) => sum + Number(r.price), 0);
      const freeshipApplied = rows.length >= settings.freeshipMinItems;
      const defaultShippingFee = settings.defaultShippingFee;
      const shippingFee = freeshipApplied ? 0 : defaultShippingFee;
      const total = subtotal + shippingFee;

      let trusted = await orderRepository.hasCompletedOrderBefore(data.customer_phone, tx as any);
      if (!trusted && data.customerId) {
        trusted = await orderRepository.hasCompletedOrderByCustomerId(data.customerId, tx as any);
      }

      let depositAmount = 0;
      let depositStatus: 'not_required' | 'pending' = 'not_required';
      if (!trusted && settings.depositAmount > 0) {
        depositAmount = settings.depositAmount;
        depositStatus = 'pending';
      }

      const amountDue = total - depositAmount;

      const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `DH-${datePart}-${randomSuffix}`;

      const holdMinutes = settings.orderHoldMinutes;
      const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

      for (const r of rows) {
        await tx
          .update(items)
          .set({
            status: 'reserved',
            reservedUntil: holdExpiresAt,
            reservedByCustomerPhone: data.customer_phone,
            updatedAt: new Date(),
          })
          .where(eq(items.id, r.id));
      }

      const [order] = await tx
        .insert(orders)
        .values({
          orderCode,
          customerId: data.customerId ?? null,
          customerName: data.customer_name,
          customerPhone: data.customer_phone,
          shippingAddress: data.shipping_address,
          customerNote: data.customer_note ?? null,
          paymentMethod: data.payment_method,
          paymentStatus: 'unpaid',
          orderStatus: 'new',
          subtotal,
          shippingFee,
          defaultShippingFee,
          freeshipApplied,
          total,
          depositAmount,
          depositStatus,
          amountDue,
          agreedReturnFee: settings.returnFee,
          returnWindowDays: settings.returnWindowDays,
          holdMinutes,
          holdExpiresAt,
          policyAcceptedAt: new Date(),
          policyVersion: data.policy_version,
          timeline: [
            {
              time: new Date().toISOString(),
              title: 'Đặt đơn thành công',
              detail: `Đơn hàng ${orderCode} đã được khởi tạo, giữ đồ trong ${holdMinutes} phút.`,
            },
          ],
        })
        .returning();

      await tx.insert(orderItems).values(
        rows.map((r) => ({
          orderCode,
          itemId: r.id as string,
          priceSnapshot: Number(r.price),
        }))
      );

      return this.mapConfirmation(
        order,
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          condition: r.condition,
          price: Number(r.price),
          size: r.size,
          images: r.images,
          status: 'reserved' as const,
          batchId: r.batchId,
        }))
      );
    });
  }

  async trackOrder(orderCode: string, phone: string) {
    await db.transaction(async (tx) => {
      const ord = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });
      if (ord && ord.customerPhone === phone) {
        await this.applyHoldExpiry(orderCode, tx as any);
      }
    });

    const ord = await orderRepository.findByCodeAndPhone(orderCode, phone);
    if (!ord) {
      throw new AppError(
        'Không tìm thấy đơn hàng phù hợp với thông tin đã nhập',
        HttpStatus.NOT_FOUND,
        ErrorCode.ORDER_NOT_FOUND
      );
    }

    const orderItemRows = await orderRepository.findOrderItems(ord.orderCode);
    const orderItemsMapped = orderItemRows.map(({ item, priceSnapshot }) =>
      toPublicSummary({ ...item, price: priceSnapshot } as any)
    );

    return {
      order_code: ord.orderCode,
      customer_name: ord.customerName,
      customer_phone: ord.customerPhone,
      shipping_address: ord.shippingAddress,
      payment_method: ord.paymentMethod,
      payment_status: ord.paymentStatus,
      order_status: ord.orderStatus,
      subtotal: ord.subtotal,
      shipping_fee: ord.shippingFee,
      default_shipping_fee: ord.defaultShippingFee,
      freeship_applied: ord.freeshipApplied,
      total: ord.total,
      deposit_amount: ord.depositAmount,
      deposit_status: ord.depositStatus,
      amount_due: ord.amountDue,
      agreed_return_fee: ord.agreedReturnFee,
      return_window_days: ord.returnWindowDays,
      hold_minutes: ord.holdMinutes,
      hold_expires_at: ord.holdExpiresAt?.toISOString() ?? null,
      cancel_reason: ord.cancelReason ?? null,
      cancelled_by: ord.cancelledBy ?? null,
      cancelled_at: ord.cancelledAt?.toISOString() ?? null,
      confirmed_by: ord.confirmedBy ?? null,
      carrier_name: ord.carrierName ?? null,
      tracking_code: ord.trackingCode ?? null,
      timeline: ord.timeline ?? [],
      items: orderItemsMapped,
      created_at: ord.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async extendHold(orderCode: string, minutes: number) {
    return await db.transaction(async (tx) => {
      await this.applyHoldExpiry(orderCode, tx as any);

      const order = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!order) {
        throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      }

      if (order.orderStatus !== 'new') {
        throw new AppError(
          'Chỉ có thể gia hạn khi đơn ở trạng thái mới đặt (new)',
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_TRANSITION
        );
      }

      if (order.holdExtendedAt) {
        throw new AppError(
          'Đơn hàng này đã được gia hạn giữ chỗ trước đó',
          HttpStatus.CONFLICT,
          ErrorCode.HOLD_ALREADY_EXTENDED
        );
      }

      const currentExpires = order.holdExpiresAt ? new Date(order.holdExpiresAt) : new Date();
      const newExpiresAt = new Date(currentExpires.getTime() + minutes * 60 * 1000);

      const [updated] = await tx
        .update(orders)
        .set({
          holdExpiresAt: newExpiresAt,
          holdExtendedAt: new Date(),
          holdExtensionMinutes: minutes,
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

      const oItems = await tx.query.orderItems.findMany({ where: eq(orderItems.orderCode, orderCode) });
      for (const oi of oItems) {
        await tx.update(items).set({ reservedUntil: newExpiresAt, updatedAt: new Date() }).where(eq(items.id, oi.itemId));
      }

      return {
        order_code: updated.orderCode,
        hold_expires_at: updated.holdExpiresAt?.toISOString(),
        extension_minutes: minutes,
      };
    });
  }

  async cancelOrderByCustomer(orderCode: string, reason: string) {
    return await db.transaction(async (tx) => {
      await this.applyHoldExpiry(orderCode, tx as any);

      const order = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!order) {
        throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      }

      if (order.orderStatus !== 'new' && order.orderStatus !== 'confirmed') {
        throw new AppError(
          'Chỉ có thể hủy đơn khi shop chưa giao bưu cục',
          HttpStatus.CONFLICT,
          ErrorCode.CANCEL_NOT_ALLOWED
        );
      }

      let depositStatus = order.depositStatus;
      if (order.depositStatus === 'pending') depositStatus = 'voided';
      else if (order.depositStatus === 'received' && order.orderStatus === 'new') depositStatus = 'refunded';
      else if (order.depositStatus === 'received' && order.orderStatus === 'confirmed') depositStatus = 'forfeited';

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'cancelled',
          cancelReason: reason,
          cancelledBy: 'customer',
          cancelledAt: new Date(),
          depositStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.orderCode, orderCode))
        .returning();

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

      return {
        order_code: updated.orderCode,
        order_status: updated.orderStatus,
        message: 'Đã hủy đơn hàng thành công',
      };
    });
  }

  async checkDepositRequirement(phone: string, customerId?: string) {
    const settings = await settingRepository.getSettings();
    let trusted = await orderRepository.hasCompletedOrderBefore(phone);
    if (!trusted && customerId) {
      trusted = await orderRepository.hasCompletedOrderByCustomerId(customerId);
    }

    if (settings.depositAmount <= 0 || trusted) {
      return {
        deposit_required: false,
        deposit_amount: 0,
        return_fee: settings.returnFee,
      };
    }

    return {
      deposit_required: true,
      deposit_amount: settings.depositAmount,
      return_fee: settings.returnFee,
    };
  }
}

export const orderService = new OrderService();
