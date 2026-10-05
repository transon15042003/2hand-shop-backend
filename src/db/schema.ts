import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  serial,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// ENUMS (PostgreSQL Types)
// =============================================================================

export const itemCategoryEnum = pgEnum('item_category', [
  't_shirts',
  'shirts',
  'sweaters',
  'jackets',
  'blazers',
  'pants',
  'shorts',
  'skirts',
  'dresses',
  'bags',
  'scarves',
  'hats',
  'accessories',
]);

export const itemConditionEnum = pgEnum('item_condition', [
  'new',
  'like_new',
  'good',
  'fair',
  'attention_required',
]);

export const itemStatusEnum = pgEnum('item_status', [
  'draft',
  'shelf',
  'reserved',
  'sold',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'new',
  'confirmed',
  'shipping',
  'completed',
  'cancelled',
  'returned',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'bank_transfer',
  'cod',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid',
  'pending_cod',
  'partial',
  'paid',
  'refunded',
]);

export const depositStatusEnum = pgEnum('deposit_status', [
  'not_required',
  'pending',
  'received',
  'forfeited',
  'refunded',
  'voided',
]);

export const adminRoleEnum = pgEnum('admin_role', ['owner', 'staff']);

/** Staff checkbox permissions; owners ignore this list and get all. */
export type AdminPermission =
  | 'items'
  | 'orders'
  | 'deposits'
  | 'batches'
  | 'cash_flow'
  | 'settings'
  | 'manage_admins';

export const cancelActorEnum = pgEnum('cancel_actor', [
  'customer',
  'shop',
  'system',
]);

export const confirmActorEnum = pgEnum('confirm_actor', [
  'shop',
  'system',
]);

export const batchStatusEnum = pgEnum('batch_status', [
  'processing',
  'active',
  'break_even',
  'completed',
]);

// =============================================================================
// TABLES
// =============================================================================

export const shopSettings = pgTable('shop_settings', {
  id: serial('id').primaryKey(),
  depositAmount: integer('deposit_amount').notNull().default(50000),
  returnFee: integer('return_fee').notNull().default(50000),
  returnWindowDays: integer('return_window_days').notNull().default(2),
  orderHoldMinutes: integer('order_hold_minutes').notNull().default(30),
  policyVersion: integer('policy_version').notNull().default(1),
  shopPhone: varchar('shop_phone', { length: 20 }).notNull().default('0900000000'),
  shopZalo: varchar('shop_zalo', { length: 100 }).notNull().default('0900000000'),
  shopMessengerUrl: varchar('shop_messenger_url', { length: 255 }),
  bankName: varchar('bank_name', { length: 100 }).notNull().default('Vietcombank'),
  bankAccountNumber: varchar('bank_account_number', { length: 50 }).notNull().default('0000000000'),
  bankAccountHolder: varchar('bank_account_holder', { length: 100 }).notNull().default('CHU SHOP'),
  bankQrImageUrl: varchar('bank_qr_image_url', { length: 500 }),
  shippingFeePresets: jsonb('shipping_fee_presets').$type<number[]>().notNull().default([20000, 30000]),
  defaultShippingFee: integer('default_shipping_fee').notNull().default(30000),
  freeshipMinItems: integer('freeship_min_items').notNull().default(4),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const batches = pgTable('batches', {
  id: varchar('id', { length: 50 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  importDate: date('import_date').notNull(),
  initialCapital: integer('initial_capital').notNull(),
  processingCost: integer('processing_cost').notNull().default(0),
  targetMarginPercent: integer('target_margin_percent').notNull().default(30),
  status: batchStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const items = pgTable('items', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: itemCategoryEnum('category').notNull(),
  condition: itemConditionEnum('condition').notNull(),
  price: integer('price').notNull(),
  originalPrice: integer('original_price'),
  costPrice: integer('cost_price'),
  size: varchar('size', { length: 50 }).notNull(),
  material: varchar('material', { length: 255 }).notNull(),
  origin: varchar('origin', { length: 100 }),
  status: itemStatusEnum('status').notNull().default('shelf'),
  batchId: varchar('batch_id', { length: 50 }).references(() => batches.id),
  measurements: jsonb('measurements').$type<Record<string, number | string>>().notNull().default({}),
  images: jsonb('images').$type<{ url: string; alt: string }[]>().notNull().default([]),
  defectDescription: text('defect_description'),
  defectImages: jsonb('defect_images').$type<{ url: string; alt: string }[]>().default([]),
  reservedUntil: timestamp('reserved_until', { withTimezone: true }),
  reservedByCustomerPhone: varchar('reserved_by_customer_phone', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const customers = pgTable('customers', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  verificationOtp: varchar('verification_otp', { length: 10 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  defaultShippingAddress: text('default_shipping_address'),
  defaultShippingNote: text('default_shipping_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const adminUsers = pgTable('admin_users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  role: adminRoleEnum('role').notNull().default('staff'),
  permissions: jsonb('permissions').$type<AdminPermission[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const customerSessions = pgTable('customer_sessions', {
  tokenHash: varchar('token_hash', { length: 128 }).primaryKey(),
  customerId: varchar('customer_id', { length: 50 })
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const orders = pgTable('orders', {
  orderCode: varchar('order_code', { length: 50 }).primaryKey(),
  customerId: varchar('customer_id', { length: 50 }).references(() => customers.id),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 20 }).notNull(),
  shippingAddress: text('shipping_address').notNull(),
  customerNote: text('customer_note'),
  adminNote: text('admin_note'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
  orderStatus: orderStatusEnum('order_status').notNull().default('new'),
  subtotal: integer('subtotal').notNull(),
  shippingFee: integer('shipping_fee'),
  defaultShippingFee: integer('default_shipping_fee'),
  freeshipApplied: boolean('freeship_applied').notNull().default(false),
  total: integer('total').notNull(),
  depositAmount: integer('deposit_amount').notNull().default(0),
  depositStatus: depositStatusEnum('deposit_status').notNull().default('not_required'),
  amountDue: integer('amount_due').notNull(),
  agreedReturnFee: integer('agreed_return_fee').notNull().default(50000),
  returnWindowDays: integer('return_window_days').notNull().default(2),
  holdMinutes: integer('hold_minutes').notNull().default(30),
  holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
  holdExtendedAt: timestamp('hold_extended_at', { withTimezone: true }),
  holdExtensionMinutes: integer('hold_extension_minutes'),
  cancelReason: text('cancel_reason'),
  cancelledBy: cancelActorEnum('cancelled_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  confirmedBy: confirmActorEnum('confirmed_by'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  depositPaidAt: timestamp('deposit_paid_at', { withTimezone: true }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  returnFee: integer('return_fee'),
  refundAmount: integer('refund_amount'),
  carrierName: varchar('carrier_name', { length: 100 }),
  trackingCode: varchar('tracking_code', { length: 100 }),
  actualShippingCost: integer('actual_shipping_cost'),
  shippingMargin: integer('shipping_margin'),
  policyAcceptedAt: timestamp('policy_accepted_at', { withTimezone: true }),
  policyVersion: integer('policy_version').notNull().default(1),
  timeline: jsonb('timeline').$type<{ time: string; title: string; detail?: string }[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderCode: varchar('order_code', { length: 50 })
    .notNull()
    .references(() => orders.orderCode, { onDelete: 'cascade' }),
  itemId: varchar('item_id', { length: 50 })
    .notNull()
    .references(() => items.id),
  priceSnapshot: integer('price_snapshot').notNull(),
});

export const cashFlowEntries = pgTable('cash_flow_entries', {
  id: serial('id').primaryKey(),
  orderCode: varchar('order_code', { length: 50 }).references(() => orders.orderCode),
  batchId: varchar('batch_id', { length: 50 }).references(() => batches.id),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense' | 'refund'
  amount: integer('amount').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const reconciliationSessions = pgTable('reconciliation_sessions', {
  id: varchar('id', { length: 50 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  carrier: varchar('carrier', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('processing'),
  totalDiscrepancy: integer('total_discrepancy').notNull().default(0),
  records: jsonb('records').$type<Record<string, unknown> | any[]>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// =============================================================================
// RELATIONS
// =============================================================================

export const itemsRelations = relations(items, ({ one, many }) => ({
  batch: one(batches, {
    fields: [items.batchId],
    references: [batches.id],
  }),
  orderItems: many(orderItems),
}));

export const batchesRelations = relations(batches, ({ many }) => ({
  items: many(items),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  orderItems: many(orderItems),
  cashFlowEntries: many(cashFlowEntries),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderCode],
    references: [orders.orderCode],
  }),
  item: one(items, {
    fields: [orderItems.itemId],
    references: [items.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  sessions: many(customerSessions),
}));
