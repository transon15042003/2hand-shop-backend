/**
 * Dev seed — insert-if-missing. Do not run automatically on production deploy.
 * Usage: pnpm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from '../configs/database.js';
import { batches, customers, items, shopSettings } from './schema.js';

async function seed() {
  const existingSettings = await db.query.shopSettings.findFirst({
    where: eq(shopSettings.id, 1),
  });
  if (!existingSettings) {
    await db.insert(shopSettings).values({ id: 1 });
    console.log('seed: shop_settings id=1');
  } else {
    console.log('seed: shop_settings already present');
  }

  const batchId = 'batch-seed-001';
  const existingBatch = await db.query.batches.findFirst({
    where: eq(batches.id, batchId),
  });
  if (!existingBatch) {
    await db.insert(batches).values({
      id: batchId,
      code: 'SEED-001',
      name: 'Kiện seed local',
      category: 't_shirts',
      importDate: '2026-10-01',
      initialCapital: 500000,
      processingCost: 0,
      targetMarginPercent: 30,
      status: 'active',
      notes: 'Sample batch for local dev',
    });
    console.log('seed: batch', batchId);
  } else {
    console.log('seed: batch already present');
  }

  const sampleItems = [
    {
      id: 'item-seed-shelf-001',
      name: 'Áo thun seed (shelf)',
      category: 't_shirts' as const,
      condition: 'good' as const,
      price: 120000,
      size: 'M',
      material: 'Cotton',
      status: 'shelf' as const,
      batchId,
      measurements: { chest_cm: 50 },
      images: [
        {
          url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
          alt: 'Áo thun seed mặt trước',
        },
      ],
    },
    {
      id: 'item-seed-draft-001',
      name: 'Áo sơ mi seed (draft)',
      category: 'shirts' as const,
      condition: 'like_new' as const,
      price: 180000,
      size: 'L',
      material: 'Cotton',
      status: 'draft' as const,
      batchId,
      measurements: { chest_cm: 54 },
      images: [],
    },
  ];

  for (const row of sampleItems) {
    const found = await db.query.items.findFirst({ where: eq(items.id, row.id) });
    if (!found) {
      await db.insert(items).values(row);
      console.log('seed: item', row.id);
    } else {
      console.log('seed: item already present', row.id);
    }
  }

  const demoCustomerId = 'cust-seed-001';
  const existingCustomer = await db.query.customers.findFirst({
    where: eq(customers.id, demoCustomerId),
  });
  if (!existingCustomer) {
    const passwordHash = await bcrypt.hash(process.env.SEED_CUSTOMER_PASSWORD || '123456', 10);
    await db.insert(customers).values({
      id: demoCustomerId,
      name: 'Khách seed',
      phone: '0901234567',
      email: 'khachhang@hksmallstore.vn',
      passwordHash,
      isVerified: true,
    });
    console.log('seed: customer', demoCustomerId);
  } else {
    console.log('seed: customer already present');
  }

  console.log('seed: done');
}

seed()
  .catch((err) => {
    console.error('seed: failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
