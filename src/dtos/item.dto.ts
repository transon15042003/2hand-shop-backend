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

export const itemConditions = ['like_new', 'excellent', 'good', 'fair'] as const;

export const createItemSchema = z.object({
  id: z.string().min(1, 'Mã sản phẩm không được trống'),
  name: z.string().min(2, 'Tên sản phẩm phải có ít nhất 2 ký tự'),
  category: z.enum(itemCategories, {
    errorMap: () => ({ message: 'Danh mục sản phẩm không hợp lệ' }),
  }),
  condition: z.enum(itemConditions, {
    errorMap: () => ({ message: 'Độ mới không hợp lệ' }),
  }),
  price: z.number().int().positive('Giá bán phải là số nguyên dương'),
  costPrice: z.number().int().nonnegative().optional(),
  size: z.string().min(1, 'Kích cỡ không được trống'),
  material: z.string().min(1, 'Chất liệu không được trống'),
  origin: z.string().optional(),
  batchId: z.string().optional(),
  measurements: z.record(z.union([z.string(), z.number()])).optional(),
  images: z.array(
    z.object({
      url: z.string().min(1, 'URL ảnh không hợp lệ'),
      displayOrder: z.number().int().nonnegative(),
    })
  ).min(1, 'Phải có ít nhất 1 hình ảnh'),
  defectDescription: z.string().optional(),
  defectImages: z.array(z.string()).optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const queryItemsSchema = z.object({
  category: z.enum(itemCategories).optional(),
  condition: z.enum(itemConditions).optional(),
  status: z.enum(['shelf', 'reserved', 'sold', 'draft']).optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
