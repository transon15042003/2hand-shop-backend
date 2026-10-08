import nodemailer, { type Transporter } from 'nodemailer';
import { appConfig } from '../configs/app.config.js';
import { Logger } from '../utils/logger.util.js';
import { orderRepository } from '../repositories/order.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface OrderItemEmailDetail {
  name: string;
  price: number;
}

export interface OrderEmailPayload {
  orderCode: string;
  customerName: string;
  items: OrderItemEmailDetail[];
  subtotal: number;
  shippingFee: number;
  total: number;
  depositAmount: number;
  amountDue: number;
  shippingAddress: string;
  paymentMethod: string;
  returnWindowDays?: number;
}

export interface OrderReturnedEmailPayload {
  orderCode: string;
  customerName: string;
  reason?: string;
  returnFee?: number;
  refundAmount?: number;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (appConfig.smtpUser && appConfig.smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: appConfig.smtpHost || 'smtp.gmail.com',
        port: appConfig.smtpPort || 587,
        secure: appConfig.smtpSecure ?? false,
        auth: {
          user: appConfig.smtpUser,
          pass: appConfig.smtpPass,
        },
      });
    }
  }

  /** Mask email address to protect PII in logs */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal = local.length <= 2 ? '*' : `${local[0]}***${local[local.length - 1]}`;
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Core send email method.
   * Priority:
   * 1. Resend API (HTTP fetch) if RESEND_API_KEY is present
   * 2. Nodemailer SMTP if SMTP_USER & SMTP_PASS are configured
   * 3. Fallback to console logger (Dev mode)
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;
    const maskedTo = this.maskEmail(to);

    try {
      // 1. Resend API
      if (appConfig.resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${appConfig.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: appConfig.emailFrom,
            to: [to],
            subject,
            html,
            text,
          }),
        });

        if (!response.ok) {
          const errData = await response.text();
          Logger.error(`[EMAIL] Failed to send email via Resend to ${maskedTo}: ${errData}`);
          return false;
        }

        Logger.info(`[EMAIL] Sent email via Resend to ${maskedTo} | Subject: "${subject}"`);
        return true;
      }

      // 2. Nodemailer SMTP
      if (this.transporter) {
        await this.transporter.sendMail({
          from: appConfig.emailFrom,
          to,
          subject,
          html,
          text,
        });

        Logger.info(`[EMAIL] Sent email via SMTP to ${maskedTo} | Subject: "${subject}"`);
        return true;
      }

      // 3. Dev Mock Fallback
      Logger.info(
        `[EMAIL DEV MOCK] No email provider configured. Mock sending to ${maskedTo} | Subject: "${subject}"`
      );
      if (appConfig.isDev) {
        console.log(`\n================== [DEV EMAIL PREVIEW] ==================`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        if (text) console.log(`Body (text): ${text}`);
        console.log(`=========================================================\n`);
      }
      return true;
    } catch (error: any) {
      Logger.error(`[EMAIL] Error sending email to ${maskedTo}: ${error?.message || error}`);
      return false;
    }
  }

  /**
   * 1. Email xác thực khi đăng ký tài khoản mới hoặc gửi lại mã OTP
   */
  async sendRegistrationOtp(toEmail: string, data: { customerName: string; otp: string }): Promise<boolean> {
    const subject = `[HK Small Store] Mã xác thực tài khoản của bạn: ${data.otp}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #111; margin-bottom: 8px;">HK Small Store</h2>
        <p style="font-size: 15px;">Xin chào <strong>${escapeHtml(data.customerName)}</strong>,</p>
        <p style="font-size: 15px;">Cảm ơn bạn đã đăng ký tài khoản tại <strong>HK Small Store</strong>.</p>
        <p style="font-size: 15px; background-color: #fff8e6; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px;">
          🔔 <strong>Lưu ý:</strong> Để nhận thông tin và cập nhật quan trọng về đơn hàng của bạn qua email, vui lòng xác thực địa chỉ email này.
        </p>
        <p style="font-size: 15px;">Mã xác thực OTP của bạn là:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 12px 24px; background: #f3f4f6; border-radius: 6px; border: 1px dashed #d1d5db; color: #111;">
            ${data.otp}
          </span>
        </div>
        <p style="font-size: 13px; color: #666;">Mã này có hiệu lực trong vòng <strong>15 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">Đây là email tự động từ HK Small Store. Vui lòng không trả lời trực tiếp email này.</p>
      </div>
    `;

    const text = `Xin chào ${data.customerName},\n\nMã xác thực OTP của bạn tại HK Small Store là: ${data.otp} (hiệu lực 15 phút).\nĐể nhận thông tin và cập nhật đơn hàng, vui lòng xác thực email của bạn.\n\nHK Small Store`;
    return this.sendEmail({ to: toEmail, subject, html, text });
  }

  /**
   * 2. Email thông báo xác nhận đơn hàng thành công
   */
  async sendOrderConfirmed(toEmail: string, data: OrderEmailPayload): Promise<boolean> {
    const subject = `[HK Small Store] Đơn hàng #${data.orderCode} đã được xác nhận`;
    const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + '₫';

    const itemsHtml = data.items
      .map(
        (i) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(i.name)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${formatMoney(i.price)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #111; margin-bottom: 8px;">HK Small Store</h2>
        <p style="font-size: 15px;">Xin chào <strong>${escapeHtml(data.customerName)}</strong>,</p>
        <p style="font-size: 15px;">Đơn hàng <strong>#${data.orderCode}</strong> của bạn đã được xác nhận thành công!</p>
        
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 16px; color: #111;">Chi tiết đơn hàng</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #e5e7eb; text-align: left;">
                <th style="padding: 8px 10px;">Sản phẩm</th>
                <th style="padding: 8px 10px; text-align: right;">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Tiền hàng:</span>
              <span>${formatMoney(data.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Phí vận chuyển:</span>
              <span>${formatMoney(data.shippingFee)}</span>
            </div>
            ${
              data.depositAmount > 0
                ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #059669;">
              <span>Tiền cọc đã nhận:</span>
              <span>-${formatMoney(data.depositAmount)}</span>
            </div>
            `
                : ''
            }
            <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db; font-size: 16px; font-weight: bold; color: #111;">
              <span>Số tiền còn lại cần thanh toán:</span>
              <span style="color: #dc2626;">${formatMoney(data.amountDue)}</span>
            </div>
          </div>
        </div>

        <div style="font-size: 14px; margin-bottom: 20px;">
          <p style="margin: 4px 0;"><strong>Địa chỉ nhận hàng:</strong> ${escapeHtml(data.shippingAddress)}</p>
          <p style="margin: 4px 0;"><strong>Phương thức thanh toán:</strong> ${data.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản ngân hàng'}</p>
        </div>

        <p style="font-size: 14px; color: #555;">Tiệm đang tiến hành đóng gói và chuẩn bị giao hàng cho bạn trong thời gian sớm nhất.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">Cảm ơn bạn đã tin tưởng và ủng hộ HK Small Store.</p>
      </div>
    `;

    return this.sendEmail({ to: toEmail, subject, html });
  }

  /**
   * 3. Email thông báo giao hàng thành công
   */
  async sendOrderCompleted(toEmail: string, data: OrderEmailPayload): Promise<boolean> {
    const subject = `[HK Small Store] Đơn hàng #${data.orderCode} đã giao thành công`;
    const returnDays = data.returnWindowDays || 2;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #111; margin-bottom: 8px;">HK Small Store</h2>
        <p style="font-size: 15px;">Xin chào <strong>${escapeHtml(data.customerName)}</strong>,</p>
        <p style="font-size: 15px;">Đơn hàng <strong>#${data.orderCode}</strong> của bạn đã được giao thành công!</p>
        
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #065f46;">
            <strong>Chính sách kiểm tra & đổi trả của tiệm:</strong><br/>
            Bạn có <strong>${returnDays} ngày</strong> kể từ khi nhận hàng để kiểm tra sản phẩm. Nếu món đồ có vấn đề hoặc sai khác so với mô tả, vui lòng liên hệ ngay với tiệm để được hỗ trợ chu đáo nhất.
          </p>
        </div>

        <p style="font-size: 14px;">Chúc bạn có trải nghiệm tuyệt vời cùng những món đồ độc bản từ HK Small Store!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">Cảm ơn bạn đã đồng hành cùng HK Small Store.</p>
      </div>
    `;

    return this.sendEmail({ to: toEmail, subject, html });
  }

  /**
   * 4. Email thông báo hoàn hàng thành công
   */
  async sendOrderReturned(toEmail: string, data: OrderReturnedEmailPayload): Promise<boolean> {
    const subject = `[HK Small Store] Xác nhận hoàn hàng cho đơn hàng #${data.orderCode}`;
    const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + '₫';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #111; margin-bottom: 8px;">HK Small Store</h2>
        <p style="font-size: 15px;">Xin chào <strong>${escapeHtml(data.customerName)}</strong>,</p>
        <p style="font-size: 15px;">Tiệm thông báo đã tiếp nhận và kiểm tra xong kiện hàng hoàn trả của đơn hàng <strong>#${data.orderCode}</strong>.</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
          ${data.reason ? `<p style="margin: 4px 0;"><strong>Lý do hoàn trả:</strong> ${escapeHtml(data.reason)}</p>` : ''}
          ${
            data.refundAmount !== undefined
              ? `<p style="margin: 4px 0; color: #059669;"><strong>Số tiền hoàn trả:</strong> ${formatMoney(data.refundAmount)}</p>`
              : ''
          }
          ${
            data.returnFee !== undefined && data.returnFee > 0
              ? `<p style="margin: 4px 0; color: #dc2626;"><strong>Phí hoàn hàng:</strong> ${formatMoney(data.returnFee)}</p>`
              : ''
          }
        </div>

        <p style="font-size: 14px; color: #555;">Thủ tục hoàn trả đã hoàn tất. Nếu có bất kỳ thắc mắc nào, bạn vui lòng nhắn tin trực tiếp với tiệm để được giải đáp.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">HK Small Store trân trọng cảm ơn bạn.</p>
      </div>
    `;

    return this.sendEmail({ to: toEmail, subject, html });
  }

  /**
   * Helper kiểm tra và chỉ gửi email đơn hàng cho khách hàng CÓ TÀI KHOẢN VÀ ĐÃ XÁC THỰC EMAIL.
   * Quy tắc kinh doanh:
   * "chỉ gửi email cho khách có tài khoản và xác thực email"
   */
  async maybeSendOrderNotification(
    orderCode: string,
    event: 'confirmed' | 'completed' | 'returned',
    extra?: { reason?: string; returnFee?: number; refundAmount?: number }
  ): Promise<void> {
    try {
      const order = await orderRepository.findByCode(orderCode);
      if (!order) return;

      // 1. Tìm thông tin khách hàng (ưu tiên customerId, fallback theo SĐT đặt hàng)
      let customer = null;
      if (order.customerId) {
        customer = await customerRepository.findById(order.customerId);
      } else if (order.customerPhone) {
        customer = await customerRepository.findByPhone(order.customerPhone);
      }

      // 2. HARD RULE: Chỉ gửi email cho khách có tài khoản và ĐÃ XÁC THỰC EMAIL
      if (!customer || !customer.isVerified || !customer.email) {
        // Không gửi email theo quy định
        return;
      }

      const orderItems = await orderRepository.findOrderItems(orderCode);
      const itemsDetail: OrderItemEmailDetail[] = orderItems.map((oi) => ({
        name: oi.item.name,
        price: Number(oi.priceSnapshot),
      }));

      const payload: OrderEmailPayload = {
        orderCode: order.orderCode,
        customerName: order.customerName,
        items: itemsDetail,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee ?? 0,
        total: order.total,
        depositAmount: order.depositAmount,
        amountDue: order.amountDue,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        returnWindowDays: order.returnWindowDays,
      };

      if (event === 'confirmed') {
        await this.sendOrderConfirmed(customer.email, payload);
      } else if (event === 'completed') {
        await this.sendOrderCompleted(customer.email, payload);
      } else if (event === 'returned') {
        await this.sendOrderReturned(customer.email, {
          orderCode: order.orderCode,
          customerName: order.customerName,
          reason: extra?.reason,
          returnFee: extra?.returnFee ?? (order.returnFee ?? undefined),
          refundAmount: extra?.refundAmount ?? (order.refundAmount ?? undefined),
        });
      }
    } catch (err: any) {
      Logger.error(`[EMAIL] Failed to process order notification for #${orderCode}: ${err?.message || err}`);
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const emailService = new EmailService();
