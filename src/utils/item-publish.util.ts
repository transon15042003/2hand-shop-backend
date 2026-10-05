import type { items } from '../db/schema.js';

export type ItemImage = { url: string; alt: string };
export type ItemRow = typeof items.$inferSelect;

export type PublishCandidate = {
  name?: string | null;
  price?: number | null;
  category?: string | null;
  condition?: string | null;
  size?: string | null;
  material?: string | null;
  measurements?: Record<string, number | string> | null;
  images?: ItemImage[] | null;
  defect_description?: string | null;
  defect_images?: ItemImage[] | null;
};

const blank = (value: string | null | undefined) => !value || !value.trim();

export function publishProblems(item: PublishCandidate): Record<string, string> {
  const fields: Record<string, string> = {};
  if (blank(item.name)) fields.name = 'Nhập tên món.';
  if (typeof item.price !== 'number' || !Number.isInteger(item.price) || item.price <= 0) {
    fields.price = 'Giá là số nguyên, lớn hơn 0.';
  }
  if (!item.category) fields.category = 'Chọn phân loại.';
  if (!item.condition) fields.condition = 'Chọn tình trạng.';
  const images = item.images ?? [];
  if (images.length === 0) fields.images = 'Cần ít nhất một ảnh.';
  else if (images.some((image) => blank(image.alt))) fields.images = 'Mỗi ảnh cần chữ mô tả (alt).';
  if (blank(item.size)) fields.size = 'Nhập size ghi trên món.';
  if (blank(item.material)) fields.material = 'Nhập chất liệu.';
  const measurements = Object.values(item.measurements ?? {}).filter(
    (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
  );
  if (measurements.length === 0) fields.measurements = 'Thiếu số đo: nhập ít nhất một số đo centimet.';
  if (item.condition === 'attention_required') {
    if (blank(item.defect_description)) fields.defect_description = 'Tình trạng cần lưu ý phải có chữ mô tả lỗi.';
    const defects = item.defect_images ?? [];
    if (defects.length === 0) fields.defect_images = 'Tình trạng cần lưu ý phải có ít nhất một ảnh lỗi.';
    else if (defects.some((image) => blank(image.alt))) fields.defect_images = 'Mỗi ảnh lỗi cần chữ mô tả (alt).';
  }
  return fields;
}

export function draftProblems(item: PublishCandidate): Record<string, string> {
  return blank(item.name) ? { name: 'Nháp vẫn cần tên món.' } : {};
}

export function canChangeItemStatus(
  from: string,
  to: string
): { allowed: boolean; code?: string; reason?: string } {
  if (from === 'reserved' || from === 'sold') {
    return { allowed: false, code: 'ITEM_IN_ACTIVE_ORDER', reason: 'Món đang nằm trong đơn.' };
  }
  if (to !== 'draft' && to !== 'shelf') {
    return { allowed: false, code: 'INVALID_TRANSITION', reason: 'Chỉ chuyển giữa nháp và trên kệ.' };
  }
  return { allowed: true };
}

export function isPubliclyVisible(status: string): boolean {
  return status === 'shelf' || status === 'reserved';
}
