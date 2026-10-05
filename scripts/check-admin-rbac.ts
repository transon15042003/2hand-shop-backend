/**
 * Assert admin permission helpers + JWT payload shape (no DB).
 * Run: pnpm exec tsx scripts/check-admin-rbac.ts
 */
import assert from 'node:assert/strict';
import {
  ALL_ADMIN_PERMISSIONS,
  effectivePermissions,
  hasPermission,
} from '../src/constants/admin-permissions.js';
import { JwtUtil } from '../src/utils/jwt.util.js';

assert.equal(effectivePermissions('owner', []).length, ALL_ADMIN_PERMISSIONS.length);
assert.deepEqual(effectivePermissions('staff', ['items', 'orders']), ['items', 'orders']);
assert.equal(hasPermission('owner', [], 'settings'), true);
assert.equal(hasPermission('staff', ['items'], 'settings'), false);
assert.equal(hasPermission('staff', ['items', 'orders'], ['items', 'orders']), true);
assert.equal(hasPermission('staff', ['items'], ['items', 'orders']), false);

const token = JwtUtil.sign(
  {
    typ: 'admin',
    sub: 'adm-test',
    role: 'staff',
    permissions: ['items'],
    username: 'staff1',
    displayName: 'Staff',
  },
  '1h'
);
const payload = JwtUtil.verify<{ typ: string; sub: string; role: string }>(token);
assert.equal(payload?.typ, 'admin');
assert.equal(payload?.sub, 'adm-test');
assert.equal(payload?.role, 'staff');

console.log('check-admin-rbac: ok');
