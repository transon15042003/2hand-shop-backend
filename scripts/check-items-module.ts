/**
 * Smoke for items-module. Needs server + migrated DB + seed shelf item.
 * Usage: pnpm exec tsx scripts/check-items-module.ts
 */
import 'dotenv/config';

const base = `http://localhost:${process.env.PORT || 5000}/api`;
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const list = await fetch(`${base}/items`);
  assert(list.status === 200, `public list ${list.status}`);
  const listBody = (await list.json()) as {
    items: { id: string; status: string; main_image: string }[];
    pagination: { total_pages: number; page: number };
  };
  assert(Array.isArray(listBody.items), 'items array');
  assert(typeof listBody.pagination?.total_pages === 'number', 'total_pages');
  assert(listBody.items.every((i) => i.status === 'shelf'), 'list only shelf');
  const shelf = listBody.items.find((i) => i.id === 'item-seed-shelf-001');
  assert(shelf, 'seed shelf item in list');

  const detail = await fetch(`${base}/items/item-seed-shelf-001`);
  assert(detail.status === 200, `shelf detail ${detail.status}`);
  const detailBody = (await detail.json()) as { images: { alt: string }[]; material: string };
  assert(detailBody.material && Array.isArray(detailBody.images), 'detail shape');

  const draft = await fetch(`${base}/items/item-seed-draft-001`);
  assert(draft.status === 404, `draft should 404, got ${draft.status}`);

  const login = await fetch(`${base}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert(login.status === 200, `admin login ${login.status}`);
  const { token } = (await login.json()) as { token: string };
  assert(token, 'admin token');

  const adminList = await fetch(`${base}/admin/items?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(adminList.status === 200, `admin list ${adminList.status}`);
  const adminBody = (await adminList.json()) as {
    items: unknown[];
    pagination: { total: number };
    stats: { on_shelf: number; draft: number };
  };
  assert(adminBody.stats && typeof adminBody.stats.on_shelf === 'number', 'stats');
  assert(adminBody.pagination && typeof adminBody.pagination.total === 'number', 'admin pagination');

  const adminDetail = await fetch(`${base}/admin/items/item-seed-draft-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(adminDetail.status === 200, `admin draft detail ${adminDetail.status}`);

  // draft → shelf should fail publish requirements (no images)
  const badShelf = await fetch(`${base}/admin/items/item-seed-draft-001/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'shelf' }),
  });
  assert(badShelf.status === 400, `expected publish fail, got ${badShelf.status}`);
  const badBody = (await badShelf.json()) as { code: string };
  assert(badBody.code === 'PUBLISH_REQUIREMENTS_NOT_MET', `code ${badBody.code}`);

  console.log('check-items-module: ok');
}

main().catch((err) => {
  console.error('check-items-module: failed', err.message || err);
  process.exitCode = 1;
});
