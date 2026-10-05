import type { ItemRow } from './item-publish.util.js';

function normalizeImages(raw: unknown): { url: string; alt: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === 'string') return { url: entry, alt: '' };
    const obj = entry as { url?: string; alt?: string };
    return { url: obj.url ?? '', alt: obj.alt ?? '' };
  });
}

export function toPublicSummary(row: ItemRow) {
  const images = normalizeImages(row.images);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    condition: row.condition,
    price: row.price,
    size: row.size,
    main_image: images[0]?.url ?? '',
    status: row.status,
    batch_id: row.batchId ?? undefined,
  };
}

export function toPublicDetail(row: ItemRow) {
  const images = normalizeImages(row.images);
  return {
    ...toPublicSummary(row),
    material: row.material,
    origin: row.origin ?? undefined,
    measurements: row.measurements ?? {},
    images,
    defect_description: row.defectDescription ?? null,
    defect_images: normalizeImages(row.defectImages),
  };
}

export function toAdminSummary(row: ItemRow) {
  return {
    ...toPublicSummary(row),
    batch_id: row.batchId ?? '',
    created_at: (row.createdAt ?? new Date()).toISOString(),
  };
}

export function toAdminDetail(row: ItemRow) {
  return {
    ...toPublicDetail(row),
    batch_id: row.batchId ?? '',
    cost_price: row.costPrice ?? null,
    created_at: (row.createdAt ?? new Date()).toISOString(),
    updated_at: (row.updatedAt ?? new Date()).toISOString(),
  };
}

export function upsertBodyToRow(body: {
  name: string;
  batch_id: string;
  category: string;
  condition: string;
  price: number;
  cost_price?: number | null;
  size: string;
  material: string;
  origin?: string | null;
  measurements: Record<string, number | string>;
  images: { url: string; alt: string }[];
  defect_description?: string | null;
  defect_images?: { url: string; alt: string }[];
  status: 'draft' | 'shelf';
}): Partial<ItemRow> & {
  name: string;
  batchId: string;
  category: any;
  condition: any;
  price: number;
  size: string;
  material: string;
  status: 'draft' | 'shelf';
  measurements: Record<string, number | string>;
  images: { url: string; alt: string }[];
} {
  return {
    name: body.name,
    batchId: body.batch_id,
    category: body.category as any,
    condition: body.condition as any,
    price: body.price,
    costPrice: body.cost_price ?? null,
    size: body.size,
    material: body.material,
    origin: body.origin ?? null,
    measurements: body.measurements ?? {},
    images: body.images ?? [],
    defectDescription: body.defect_description ?? null,
    defectImages: body.defect_images ?? [],
    status: body.status,
  };
}
