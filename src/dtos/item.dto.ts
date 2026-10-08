import { z } from 'zod';

export const itemCategories = [
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
] as const;

export const itemConditions = ['new', 'like_new', 'good', 'fair', 'attention_required'] as const;

const itemImageSchema = z.object({
  url: z.string().min(1, 'URL ảnh không hợp lệ'),
  alt: z.string(),
});

export const itemUpsertSchema = z.object({
  name: z.string().min(1, 'Tên món không được trống'),
  batch_id: z.string().min(1, 'Mã kiện không được trống'),
  category: z.enum(itemCategories, { errorMap: () => ({ message: 'Danh mục không hợp lệ' }) }),
  condition: z.enum(itemConditions, { errorMap: () => ({ message: 'Tình trạng không hợp lệ' }) }),
  price: z.number().int().nonnegative('Giá không hợp lệ'),
  cost_price: z.number().int().nonnegative().nullable().optional(),
  size: z.string().min(1, 'Size không được trống'),
  material: z.string().min(1, 'Chất liệu không được trống'),
  origin: z.string().nullable().optional(),
  measurements: z.record(z.union([z.string(), z.number()])).default({}),
  images: z.array(itemImageSchema).default([]),
  defect_description: z.string().nullable().optional(),
  defect_images: z.array(itemImageSchema).optional(),
  status: z.enum(['draft', 'shelf']),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(['draft', 'shelf']),
});

export const queryPublicItemsSchema = z.object({
  category: z.enum(itemCategories).optional(),
  condition: z.enum(itemConditions).optional(),
  min_price: z.coerce.number().int().nonnegative().optional(),
  max_price: z.coerce.number().int().nonnegative().optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
});

export const queryAdminItemsSchema = z.object({
  status: z.enum(['draft', 'shelf', 'reserved', 'sold', 'discarded']).optional(),
  category: z.enum(itemCategories).optional(),
  condition: z.enum(itemConditions).optional(),
  batch_id: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc', 'name_desc']).optional().default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const applyItemDiscountSchema = z
  .object({
    discount_percent: z.number().int().min(1).max(99).optional(),
    sale_price: z.number().int().nonnegative().optional(),
    allow_below_cost: z.boolean().optional().default(false),
  })
  .refine(
    (data) => data.discount_percent !== undefined || data.sale_price !== undefined,
    { message: 'Cần nhập discount_percent hoặc sale_price' }
  );

export const bulkDiscountSchema = z
  .object({
    item_ids: z.array(z.string().min(1)).optional(),
    batch_id: z.string().min(1).optional(),
    category: z.enum(itemCategories).optional(),
    discount_percent: z.number().int().min(1).max(99, 'Tỷ lệ giảm giá phải từ 1% đến 99%'),
    allow_below_cost: z.boolean().optional().default(false),
  })
  .refine(
    (data) => (data.item_ids && data.item_ids.length > 0) || data.batch_id || data.category,
    { message: 'Cần chọn ít nhất item_ids, batch_id hoặc category để áp dụng sale' }
  );

export const bulkRemoveDiscountSchema = z
  .object({
    item_ids: z.array(z.string().min(1)).optional(),
    batch_id: z.string().min(1).optional(),
    category: z.enum(itemCategories).optional(),
  })
  .refine(
    (data) => (data.item_ids && data.item_ids.length > 0) || data.batch_id || data.category,
    { message: 'Cần chọn ít nhất item_ids, batch_id hoặc category để kết thúc sale' }
  );

export const discardItemSchema = z.object({
  reason: z.string().min(1, 'Vui lòng nhập lý do hủy / hỏng món hàng'),
  write_off_loss: z.boolean().optional().default(true),
});

export const reassignBatchSchema = z.object({
  target_batch_id: z.string().nullable(),
});

export const deleteItemQuerySchema = z.object({
  refund_capital: z.enum(['true', 'false']).transform((v) => v === 'true').optional().default('false'),
  refund_amount: z.coerce.number().int().nonnegative().optional(),
});

/** @deprecated alias — prefer itemUpsertSchema */
export const createItemSchema = itemUpsertSchema;
export const updateItemSchema = itemUpsertSchema;
