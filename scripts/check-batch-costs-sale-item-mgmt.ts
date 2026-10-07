import { db } from '../src/configs/database.js';
import { adminService } from '../src/services/admin.service.js';
import { batches, items, orders, orderItems, cashFlowEntries } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  console.log('--- BẮT ĐẦU TEST LUỒNG QUẢN TRỊ KIỆN & SẢN PHẨM ---');

  const testBatchCode = `TEST_B_${Date.now()}`;
  const testBatchCode2 = `TEST_B2_${Date.now()}`;

  try {
    // 1. Tạo kiện hàng với đa chi phí
    console.log('\n[1] Tạo kiện hàng với đầy đủ thành phần chi phí:');
    const createdBatch = await adminService.createBatch({
      code: testBatchCode,
      name: 'Kiện thử nghiệm Đa Chi Phí',
      import_date: '2026-10-07',
      initial_capital: 10000000,
      shipping_cost: 500000,
      processing_cost: 800000,
      other_cost: 200000,
      target_margin_percent: 30,
      notes: 'Thử nghiệm phí ship và chi phí khác',
    });

    console.log('✅ Kiện đã tạo:', {
      code: createdBatch.code,
      total_investment: createdBatch.total_investment,
      break_even_target: createdBatch.break_even_target,
      shipping_cost: createdBatch.shipping_cost,
      other_cost: createdBatch.other_cost,
    });

    if (createdBatch.total_investment !== 11500000) {
      throw new Error(`Total investment sai: mong đợi 11500000, thực tế ${createdBatch.total_investment}`);
    }

    // Kiểm tra dòng tiền cash_flow_entries
    const entries = await db
      .select()
      .from(cashFlowEntries)
      .where(eq(cashFlowEntries.batchId, createdBatch.id));
    console.log(`✅ Đã ghi nhận ${entries.length} khoản chi phí vào dòng tiền cash_flow_entries.`);

    // 2. Cập nhật chi phí phát sinh sau khi bóc kiện
    console.log('\n[2] Cập nhật chi phí phát sinh sau khi bóc kiện (updateBatchCosts):');
    const updatedBatch = await adminService.updateBatchCosts(createdBatch.id, {
      processing_cost: 1000000, // Tăng thêm 200k tiền giặt đợt 2
    });
    console.log('✅ Kiện sau khi điều chỉnh chi phí:', {
      total_investment: updatedBatch.total_investment,
      break_even_target: updatedBatch.break_even_target,
    });
    if (updatedBatch.total_investment !== 11700000) {
      throw new Error(`Total investment sau update sai: mong đợi 11700000, thực tế ${updatedBatch.total_investment}`);
    }

    // Tạo kiện thứ 2 để test chuyển kiện
    await adminService.createBatch({
      code: testBatchCode2,
      name: 'Kiện đích chuyển đổi',
      import_date: '2026-10-07',
      initial_capital: 5000000,
    });

    // 3. Tạo các sản phẩm trong kiện
    console.log('\n[3] Tạo sản phẩm trong kiện:');
    const item1 = await adminService.createItem({
      name: 'Áo khoác len vintage',
      batch_id: testBatchCode,
      category: 'sweaters',
      condition: 'good',
      price: 300000,
      cost_price: 150000,
      size: 'L',
      material: 'Wool',
      measurements: { chest: 55, length: 68 },
      images: [{ url: 'https://example.com/item1.jpg', alt: 'Áo khoác' }],
      status: 'shelf',
    });

    const item2 = await adminService.createItem({
      name: 'Áo sơ mi lụa tuyển',
      batch_id: testBatchCode,
      category: 'shirts',
      condition: 'like_new',
      price: 500000,
      cost_price: 200000,
      size: 'M',
      material: 'Silk',
      measurements: { chest: 50, length: 70 },
      images: [{ url: 'https://example.com/item2.jpg', alt: 'Áo sơ mi' }],
      status: 'shelf',
    });

    const item3 = await adminService.createItem({
      name: 'Món nhập nhầm cần xóa',
      batch_id: testBatchCode,
      category: 't_shirts',
      condition: 'fair',
      price: 200000,
      cost_price: 80000,
      size: 'S',
      material: 'Cotton',
      measurements: { chest: 48, length: 65 },
      images: [{ url: 'https://example.com/item3.jpg', alt: 'Áo thun' }],
      status: 'draft',
    });
    console.log(`✅ Đã tạo 3 món: ${item1.id}, ${item2.id}, ${item3.id}`);

    // 4. Test Sale lẻ & Kiểm tra an toàn giá vốn
    console.log('\n[4] Test Sale lẻ sản phẩm:');
    // 4a. Giảm giá 20%
    const discountedItem1 = await adminService.applyItemDiscount(item1.id, {
      discount_percent: 20,
    });
    console.log('✅ Item 1 sau khi sale 20%:', {
      price: discountedItem1.price,
      original_price: discountedItem1.original_price,
      is_on_sale: discountedItem1.is_on_sale,
      discount_percent: discountedItem1.discount_percent,
    });
    if (discountedItem1.price !== 240000 || discountedItem1.original_price !== 300000) {
      throw new Error('Tính giá sale 20% không chính xác');
    }

    // 4b. Test chặn sale dưới giá vốn
    console.log('\n[4b] Test chặn bán dưới giá vốn:');
    let caughtBelowCostError = false;
    try {
      await adminService.applyItemDiscount(item1.id, {
        sale_price: 100000, // < cost_price 150000
        allow_below_cost: false,
      });
    } catch (err: any) {
      if (err.errorCode === 'SALE_BELOW_COST') {
        caughtBelowCostError = true;
        console.log('✅ Đã chặn thành công khi giá sale < giá vốn mà chưa có cờ allow_below_cost');
      }
    }
    if (!caughtBelowCostError) {
      throw new Error('Lỗi: Hệ thống không chặn khi sale dưới giá vốn');
    }

    // 4c. Hủy sale, khôi phục giá gốc
    console.log('\n[4c] Khôi phục giá gốc:');
    const restoredItem1 = await adminService.removeItemDiscount(item1.id);
    console.log('✅ Item 1 sau khi bỏ sale:', {
      price: restoredItem1.price,
      original_price: restoredItem1.original_price,
      is_on_sale: restoredItem1.is_on_sale,
    });
    if (restoredItem1.price !== 300000 || restoredItem1.original_price !== null) {
      throw new Error('Khôi phục giá gốc không chính xác');
    }

    // 5. Test Sale hàng loạt theo kiện
    console.log('\n[5] Test Sale hàng loạt theo kiện (bulkDiscount):');
    const bulkRes = await adminService.bulkDiscount({
      batch_id: testBatchCode,
      discount_percent: 15,
    });
    console.log('✅ Kết quả bulk discount:', bulkRes);
    if (bulkRes.updated_count < 2) {
      throw new Error('Bulk discount không cập nhật đủ số món');
    }

    // Bỏ sale hàng loạt
    const bulkRemoveRes = await adminService.bulkRemoveDiscount({
      batch_id: testBatchCode,
    });
    console.log('✅ Kết quả bulk remove discount:', bulkRemoveRes);

    // 6. Test Xóa sản phẩm chưa bán (deleteItem)
    console.log('\n[6] Test Xóa món chưa bán (deleteItem):');
    const deleteRes = await adminService.deleteItem(item3.id, {
      refund_capital: true,
      refund_amount: 80000,
    });
    console.log('✅ Đã xóa món thành công:', deleteRes);

    // 7. Test Tiêu hủy / Hư hỏng món si (discardItem)
    console.log('\n[7] Test Ghi nhận món hỏng / tiêu hủy (discardItem):');
    const discarded = await adminService.discardItem(item2.id, {
      reason: 'Phát hiện rách lớn ở nách không khắc phục được',
      write_off_loss: true,
    });
    console.log('✅ Món sau khi discard:', {
      id: discarded.id,
      status: discarded.status,
      discard_reason: discarded.discard_reason,
    });
    if (discarded.status !== 'discarded') {
      throw new Error('Trạng thái món không phải discarded');
    }

    // 8. Test Chuyển kiện hàng (reassignItemBatch)
    console.log('\n[8] Test Chuyển kiện hàng (reassignItemBatch):');
    const reassigned = await adminService.reassignItemBatch(item1.id, testBatchCode2);
    console.log('✅ Món sau khi chuyển kiện:', {
      id: reassigned.id,
      batch_id: reassigned.batch_id,
    });
    if (reassigned.batch_id !== testBatchCode2) {
      throw new Error('Chuyển kiện thất bại');
    }

    // 9. Kiểm tra chi tiết thống kê kiện
    console.log('\n[9] Kiểm tra thống kê chi tiết kiện hàng:');
    const batchDetail = await adminService.getBatchDetail(testBatchCode);
    console.log('✅ Thống kê kiện ban đầu:', {
      total_items_count: batchDetail.total_items_count,
      item_status_counts: batchDetail.item_status_counts,
      estimated_cost_per_item: batchDetail.estimated_cost_per_item,
    });

    console.log('\n🎉 TOÀN BỘ CÁC BƯỚC TEST ĐÃ HOÀN TẤT THÀNH CÔNG VƯỢT TRỘI! 🎉');
  } finally {
    // Dọn dẹp dữ liệu test
    console.log('\n[Dọn dẹp dữ liệu test]');
    await db.delete(cashFlowEntries).where(inArray(cashFlowEntries.batchId, [testBatchCode, testBatchCode2]));
    await db.delete(items).where(inArray(items.batchId, [testBatchCode, testBatchCode2]));
    await db.delete(batches).where(inArray(batches.id, [testBatchCode, testBatchCode2]));
    console.log('✅ Đã dọn dẹp xong.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('❌ Lỗi khi test:', err);
  process.exit(1);
});
