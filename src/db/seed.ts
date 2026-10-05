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

  const batchId = 'SEED-001';
  const existingBatch = await db.query.batches.findFirst({
    where: eq(batches.id, batchId),
  });
  if (!existingBatch) {
    await db.insert(batches).values({
      id: batchId,
      code: 'SEED-001',
      name: 'Kiện seed đa loại',
      importDate: '2026-10-01',
      initialCapital: 2_000_000,
      processingCost: 150_000,
      targetMarginPercent: 30,
      status: 'active',
      notes: 'Sample multi-category batch for local dev',
    });
    console.log('seed: batch', batchId);
  } else {
    console.log('seed: batch already present');
  }

  const batch2Id = 'SEED-002';
  const existingBatch2 = await db.query.batches.findFirst({
    where: eq(batches.id, batch2Id),
  });
  if (!existingBatch2) {
    await db.insert(batches).values({
      id: batch2Id,
      code: 'SEED-002',
      name: 'Kiện phụ kiện & túi',
      importDate: '2026-09-15',
      initialCapital: 800_000,
      processingCost: 50_000,
      targetMarginPercent: 30,
      status: 'active',
      notes: 'Second sample batch',
    });
    console.log('seed: batch', batch2Id);
  } else {
    console.log('seed: batch 2 already present');
  }

  const sampleItems: (typeof items.$inferInsert)[] = [
    {
      id: 'SEED-001-001',
      name: 'Áo thun seed (shelf)',
      category: 't_shirts',
      condition: 'good',
      price: 120000,
      size: 'M',
      material: 'Cotton',
      status: 'shelf',
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
      id: 'SEED-001-002',
      name: 'Áo sơ mi seed (draft)',
      category: 'shirts',
      condition: 'like_new',
      price: 180000,
      size: 'L',
      material: 'Cotton',
      status: 'draft',
      batchId,
      measurements: { chest_cm: 54 },
      images: [],
    },
    {
      id: 'SEED-001-003',
      name: 'Quần dài seed (sold)',
      category: 'pants',
      condition: 'good',
      price: 220000,
      size: '30',
      material: 'Denim',
      status: 'sold',
      batchId,
      measurements: { waist_cm: 78 },
      images: [
        {
          url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
          alt: 'Quần dài seed',
        },
      ],
    },
    {
      id: 'SEED-002-001',
      name: 'Túi canvas seed (shelf)',
      category: 'bags',
      condition: 'like_new',
      price: 250000,
      size: 'One size',
      material: 'Canvas',
      status: 'shelf',
      batchId: batch2Id,
      measurements: {},
      images: [
        {
          url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400',
          alt: 'Túi seed',
        },
      ],
    },
    {
      id: 'SEED-002-002',
      name: 'Khăn lụa seed (draft)',
      category: 'scarves',
      condition: 'good',
      price: 90000,
      size: 'One size',
      material: 'Silk',
      status: 'draft',
      batchId: batch2Id,
      measurements: {},
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

  const demoEmail = 'demo@example.com';
  const existingCustomer = await db.query.customers.findFirst({
    where: eq(customers.email, demoEmail),
  });
  if (!existingCustomer) {
    const passwordHash = await bcrypt.hash('password123', 10);
    await db.insert(customers).values({
      id: 'cust-seed-001',
      name: 'Demo Customer',
      phone: '0901234567',
      email: demoEmail,
      passwordHash,
      isVerified: true,
    });
    console.log('seed: customer', demoEmail);
  } else {
    console.log('seed: customer already present');
  }

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
