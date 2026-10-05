import type { AdminPermission } from '../db/schema.js';

export const ADMIN_PERMISSIONS = [
  'items',
  'orders',
  'deposits',
  'batches',
  'cash_flow',
  'settings',
  'manage_admins',
] as const satisfies readonly AdminPermission[];

export type { AdminPermission };

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [...ADMIN_PERMISSIONS];

export function effectivePermissions(
  role: 'owner' | 'staff',
  permissions: AdminPermission[] | null | undefined
): AdminPermission[] {
  if (role === 'owner') return ALL_ADMIN_PERMISSIONS;
  const set = new Set(permissions ?? []);
  return ADMIN_PERMISSIONS.filter((p) => set.has(p));
}

export function hasPermission(
  role: 'owner' | 'staff',
  permissions: AdminPermission[] | null | undefined,
  required: AdminPermission | AdminPermission[]
): boolean {
  const effective = effectivePermissions(role, permissions);
  const need = Array.isArray(required) ? required : [required];
  return need.every((p) => effective.includes(p));
}
