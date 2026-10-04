import { db } from '../configs/database.js';
import { items, orders, orderItems, cashFlowEntries } from '../db/schema.js';
import { eq, inArray, sql } from 'drizzle-orm';
import { settingRepository } from '../repositories/setting.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';

export class OrderService {
  /**
   * Tạo đơn hàng với tính toàn vẹn 1-of-1 Item Invariant
   */
  async createOrder(data: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    customerNote?: string;
    itemIds: string[];
    paymentMethod: 'bank_transfer' | 'cod';
    policyAccepted: boolean;
    policyVersion: number;
    customerId?: string;
  }) {
    const settings = await settingRepository.getSettings();

    // 1. Kiểm tra phiên bản chính sách theo ADR 005
    if (data.policyVersion !== settings.policyVersion) {
      throw new AppError(
        'Phiên bản chính sách của cửa hàng đã thay đổi. Vui lòng tải lại trang để xem cập nhật mới nhất.',
        HttpStatus.CONFLICT,
        ErrorCode.POLICY_VERSION_OUTDATED
      );
    }

    // 2. Chạy transaction và khóa dòng bằng SELECT ... FOR UPDATE
    return await db.transaction(async (tx) => {
      // Dùng raw query khóa FOR UPDATE các items
      const selectedItems = await tx.execute(
        sql`SELECT * FROM items WHERE id = ANY(${data.itemIds}) FOR UPDATE`
      );

      const rows = selectedItems.rows as any[];

      // Kiểm tra có món nào bị trùng hoặc không tìm thấy
      if (rows.length !== data.itemIds.length) {
        throw new AppError(
          'Một số sản phẩm không tồn tại trong hệ thống',
          HttpStatus.BAD_REQUEST,
          ErrorCode.ITEM_NOT_FOUND
        );
      }

      // Kiểm tra tính khả dụng: tất cả phải ở trạng thái 'shelf'
      const unavailable = rows.filter((r) => r.status !== 'shelf');
      if (unavailable.length > 0) {
        const itemNames = unavailable.map((u) => u.name).join(', ');
        throw new AppError(
          `Rất tiếc! Món [${itemNames}] vừa được người khác đặt trước.`,
          HttpStatus.CONFLICT,
          ErrorCode.OUT_OF_STOCK
        );
      }

      // 3. Tính toán tài chính
      const subtotal = rows.reduce((sum, r) => sum + Number(r.price), 0);
      const freeshipApplied = rows.length >= settings.freeshipMinItems;
      const defaultShippingFee = settings.defaultShippingFee;
      const shippingFee = freeshipApplied ? 0 : defaultShippingFee;
      const total = subtotal + shippingFee;

      // 4. Luật cọc 50k (ADR 004 / ADR 005):
      // Kiểm tra xem số điện thoại này đã có đơn hàng completed nào chưa
      const hasCompleted = await orderRepository.hasCompletedOrderBefore(data.customerPhone);
      const isCod = data.paymentMethod === 'cod';
      const isBankTransfer = data.paymentMethod === 'bank_transfer';

      let depositAmount = 0;
      let depositStatus: any = 'not_required';

      if (isCod) {
        // Đơn COD: khách mới bắt buộc cọc
        if (!hasCompleted) {
          depositAmount = settings.depositAmount; // 50,000đ
          depositStatus = 'pending';
        }
      } else if (isBankTransfer) {
        // Chuyển khoản toàn bộ
        depositAmount = 0;
        depositStatus = 'not_required';
      }

      const amountDue = total - (depositStatus === 'received' ? depositAmount : 0);

      // 5. Sinh mã đơn hàng
      const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `DH-${datePart}-${randomSuffix}`;

      const holdMinutes = settings.orderHoldMinutes;
      const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

      // 6. Cập nhật items sang 'reserved' và gán giữ chỗ
      for (const r of rows) {
        await tx
          .update(items)
          .set({
            status: 'reserved',
            reservedUntil: holdExpiresAt,
            reservedByCustomerPhone: data.customerPhone,
            updatedAt: new Date(),
          })
          .where(eq(items.id, r.id));
      }

      // 7. Tạo bản ghi đơn hàng
      const [order] = await tx
        .insert(orders)
        .values({
          orderCode,
          customerId: data.customerId ?? null,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          shippingAddress: data.shippingAddress,
          customerNote: data.customerNote ?? null,
          paymentMethod: data.paymentMethod,
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
          policyVersion: data.policyVersion,
          timeline: [
            {
              time: new Date().toISOString(),
              title: 'Đặt đơn thành công',
              detail: `Đơn hàng ${orderCode} đã được khởi tạo, giữ đồ trong ${holdMinutes} phút.`,
            },
          ],
        })
        .returning();

      // 8. Tạo chi tiết order_items
      await tx.insert(orderItems).values(
        rows.map((r) => ({
          orderCode,
          itemId: r.id,
          priceSnapshot: Number(r.price),
        }))
      );

      return {
        order_code: order.orderCode,
        order_status: order.orderStatus,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus,
        deposit_status: order.depositStatus,
        deposit_amount: order.depositAmount,
        subtotal: order.subtotal,
        shipping_fee: order.shippingFee,
        total: order.total,
        amount_due: order.amountDue,
        hold_expires_at: order.holdExpiresAt?.toISOString() ?? null,
        bank_transfer_info: {
          bank_name: settings.bankName,
          account_number: settings.bankAccountNumber,
          account_holder: settings.bankAccountHolder,
          qr_image_url: settings.bankQrImageUrl,
          transfer_content: order.orderCode,
        },
      };
    });
  }

  /**
   * Tra cứu đơn hàng
   */
  async trackOrder(orderCode: string, phone: string) {
    const ord = await orderRepository.findByCodeAndPhone(orderCode, phone);
    if (!ord) {
      throw new AppError('Không tìm thấy đơn hàng phù hợp với thông tin đã nhập', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
    }

    const orderItemRows = await orderRepository.findOrderItems(ord.orderCode);
    const orderItemsMapped = orderItemRows.map(({ item, priceSnapshot }) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      condition: item.condition,
      price: priceSnapshot,
      size: item.size,
      main_image: item.images?.[0]?.url ?? '',
      status: item.status,
    }));

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
      cancel_reason: ord.cancelReason,
      cancelled_by: ord.cancelledBy,
      cancelled_at: ord.cancelledAt?.toISOString() ?? null,
      confirmed_by: ord.confirmedBy,
      carrier_name: ord.carrierName,
      tracking_code: ord.trackingCode,
      timeline: ord.timeline ?? [],
      items: orderItemsMapped,
      created_at: ord.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * Gia hạn thời gian giữ đơn 1 lần
   */
  async extendHold(orderCode: string, minutes: number) {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!order) {
        throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      }

      if (order.orderStatus !== 'new') {
        throw new AppError('Chỉ có thể gia hạn khi đơn ở trạng thái mới đặt (new)', HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION);
      }

      if (order.holdExtendedAt) {
        throw new AppError('Đơn hàng này đã được gia hạn giữ chỗ trước đó', HttpStatus.CONFLICT, ErrorCode.HOLD_ALREADY_EXTENDED);
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

      return {
        order_code: updated.orderCode,
        hold_expires_at: updated.holdExpiresAt?.toISOString(),
        extension_minutes: minutes,
      };
    });
  }

  /**
   * Khách tự hủy đơn hàng
   */
  async cancelOrderByCustomer(orderCode: string, reason: string) {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: eq(orders.orderCode, orderCode),
      });

      if (!order) {
        throw new AppError('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
      }

      if (order.orderStatus !== 'new') {
        throw new AppError('Chỉ có thể hủy đơn khi shop chưa xác nhận đơn', HttpStatus.CONFLICT, ErrorCode.CANCEL_NOT_ALLOWED);
      }

      const [updated] = await tx
        .update(orders)
        .set({
          orderStatus: 'cancelled',
          cancelReason: reason,
          cancelledBy: 'customer',
          cancelledAt: new Date(),
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

      return {
        order_code: updated.orderCode,
        order_status: updated.orderStatus,
        message: 'Đã hủy đơn hàng thành công',
      };
    });
  }

  /**
   * Kiểm tra số điện thoại có cần đặt cọc hay không
   */
  async checkDepositRequirement(phone: string) {
    const hasCompleted = await orderRepository.hasCompletedOrderBefore(phone);
    const settings = await settingRepository.getSettings();

    return {
      phone,
      is_trusted_customer: hasCompleted,
      deposit_required: !hasCompleted,
      deposit_amount: hasCompleted ? 0 : settings.depositAmount,
    };
  }
}

export const orderService = new OrderService();
