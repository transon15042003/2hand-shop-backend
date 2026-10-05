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
  status: z.enum(['draft', 'shelf', 'reserved', 'sold']).optional(),
  category: z.enum(itemCategories).optional(),
  condition: z.enum(itemConditions).optional(),
  batch_id: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc', 'name_desc']).optional().default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** @deprecated alias — prefer itemUpsertSchema */
export const createItemSchema = itemUpsertSchema;
export const updateItemSchema = itemUpsertSchema;
