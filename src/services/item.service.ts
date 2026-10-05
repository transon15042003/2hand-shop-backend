import { itemRepository } from '../repositories/item.repository.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { isPubliclyVisible } from '../utils/item-publish.util.js';
import { toPublicDetail, toPublicSummary } from '../utils/item-mapper.util.js';

export class ItemService {
  async getPublicItems(filters?: {
    category?: string;
    condition?: string;
    min_price?: number;
    max_price?: number;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 12;
    const offset = (page - 1) * limit;

    const { items, total } = await itemRepository.findPublicItems({
      category: filters?.category,
      condition: filters?.condition,
      minPrice: filters?.min_price,
      maxPrice: filters?.max_price,
      search: filters?.search,
      limit,
      offset,
      sort: filters?.sort,
    });

    return {
      items: items.map(toPublicSummary),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getPublicItemDetail(id: string) {
    const row = await itemRepository.findById(id);
    if (!row || !isPubliclyVisible(row.status)) {
      throw new AppError('Không tìm thấy sản phẩm này', HttpStatus.NOT_FOUND, ErrorCode.ITEM_NOT_FOUND);
    }
    return toPublicDetail(row);
  }
}

export const itemService = new ItemService();
