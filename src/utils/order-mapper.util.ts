import type { items, orders } from '../db/schema.js';
import { toPublicSummary } from './item-mapper.util.js';

type OrderRow = typeof orders.$inferSelect;
type ItemRow = typeof items.$inferSelect;

type TimelineEntry = { time: string; title: string; detail?: string };

export function appendTimeline(existing: TimelineEntry[] | null | undefined, title: string, detail?: string): TimelineEntry[] {
  const entry: TimelineEntry = { time: new Date().toISOString(), title };
  if (detail) entry.detail = detail;
  return [...(existing ?? []), entry];
}

function returnDeadline(ord: OrderRow): string | null {
  if (!ord.completedAt) return null;
  const days = ord.returnWindowDays ?? 2;
  return new Date(ord.completedAt.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function toAdminOrderSummary(ord: OrderRow, totalItems: number) {
  return {
    id: ord.orderCode,
    order_code: ord.orderCode,
    customer_name: ord.customerName,
    customer_phone: ord.customerPhone,
    total_items: totalItems,
    subtotal: ord.subtotal,
    shipping_fee: ord.shippingFee,
    default_shipping_fee: ord.defaultShippingFee,
    freeship_applied: ord.freeshipApplied,
    total: ord.total,
    payment_method: ord.paymentMethod,
    order_status: ord.orderStatus,
    payment_status: ord.paymentStatus,
    deposit_status: ord.depositStatus,
    deposit_amount: ord.depositAmount,
    amount_due: ord.amountDue,
    hold_expires_at: ord.holdExpiresAt?.toISOString() ?? null,
    carrier_name: ord.carrierName ?? null,
    tracking_code: ord.trackingCode ?? null,
    created_at: ord.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export function toAdminOrderDetail(
  ord: OrderRow,
  itemRows: { item: ItemRow; priceSnapshot: number }[]
) {
  return {
    ...toAdminOrderSummary(ord, itemRows.length),
    customer_id: ord.customerId ?? null,
    shipping_address: ord.shippingAddress,
    customer_note: ord.customerNote ?? null,
    admin_note: ord.adminNote ?? null,
    agreed_return_fee: ord.agreedReturnFee,
    return_window_days: ord.returnWindowDays,
    hold_minutes: ord.holdMinutes,
    hold_extended_at: ord.holdExtendedAt?.toISOString() ?? null,
    hold_extension_minutes: ord.holdExtensionMinutes ?? null,
    cancel_reason: ord.cancelReason ?? null,
    cancelled_by: ord.cancelledBy ?? null,
    cancelled_at: ord.cancelledAt?.toISOString() ?? null,
    confirmed_by: ord.confirmedBy ?? null,
    deposit_paid_at: ord.depositPaidAt?.toISOString() ?? null,
    shipped_at: ord.shippedAt?.toISOString() ?? null,
    completed_at: ord.completedAt?.toISOString() ?? null,
    returned_at: ord.returnedAt?.toISOString() ?? null,
    paid_at: ord.paidAt?.toISOString() ?? null,
    return_fee: ord.returnFee ?? null,
    refund_amount: ord.refundAmount ?? null,
    return_deadline: returnDeadline(ord),
    actual_shipping_cost: ord.actualShippingCost ?? null,
    shipping_margin: ord.shippingMargin ?? null,
    policy_accepted_at: ord.policyAcceptedAt?.toISOString() ?? null,
    policy_version: ord.policyVersion,
    timeline: ord.timeline ?? [],
    items: itemRows.map(({ item, priceSnapshot }) => ({
      ...toPublicSummary(item as any),
      price: priceSnapshot,
    })),
  };
}
