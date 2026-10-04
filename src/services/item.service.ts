import { itemRepository } from '../repositories/item.repository.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';

export class ItemService {
  async getPublicItems(filters?: {
    category?: string;
    condition?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = (page - 1) * limit;

    const { items, total } = await itemRepository.findAvailableItems({
      category: filters?.category,
      condition: filters?.condition,
      limit,
      offset,
      sort: filters?.sort,
    });

    const mapped = items.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      condition: r.condition,
      price: r.price,
      size: r.size,
      main_image: r.images?.[0]?.url ?? '',
      status: r.status,
    }));

    return {
      items: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPublicItemDetail(id: string) {
    const r = await itemRepository.findById(id);
    if (!r) {
      throw new AppError('Không tìm thấy sản phẩm này', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }

    return {
      id: r.id,
      name: r.name,
      category: r.category,
      condition: r.condition,
      price: r.price,
      size: r.size,
      material: r.material,
      origin: r.origin ?? undefined,
      status: r.status,
      measurements: r.measurements,
      images: r.images,
      defect_description: r.defectDescription ?? null,
      defect_images: r.defectImages ?? [],
    };
  }
}

export const itemService = new ItemService();
