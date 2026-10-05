import { adminUserRepository } from '../repositories/admin-user.repository.js';
import { HashUtil } from '../utils/hash.util.js';
import { JwtUtil } from '../utils/jwt.util.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import {
  ADMIN_PERMISSIONS,
  ALL_ADMIN_PERMISSIONS,
  effectivePermissions,
  type AdminPermission,
} from '../constants/admin-permissions.js';

export type AdminPublicUser = {
  id: string;
  username: string;
  display_name: string;
  role: 'owner' | 'staff';
  permissions: AdminPermission[];
  is_active: boolean;
  created_at: string;
};

export type AdminJwtPayload = {
  typ: 'admin';
  sub: string;
  role: 'owner' | 'staff';
  permissions: AdminPermission[];
  username: string;
  displayName: string;
};

const ADMIN_JWT_TTL = '12h';

function toPublic(row: NonNullable<Awaited<ReturnType<typeof adminUserRepository.findById>>>): AdminPublicUser {
  return {
    id: row.id,
    username: row.username,
    display_name: row.displayName,
    role: row.role,
    permissions: effectivePermissions(row.role, row.permissions),
    is_active: row.isActive,
    created_at: (row.createdAt ?? new Date()).toISOString(),
  };
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function sanitizeStaffPermissions(input: unknown): AdminPermission[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(ADMIN_PERMISSIONS);
  return input.filter((p): p is AdminPermission => typeof p === 'string' && allowed.has(p));
}

export class AdminAuthService {
  async login(username: string, password: string) {
    const user = await adminUserRepository.findByUsername(normalizeUsername(username));
    if (!user || !user.isActive) {
      throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }
    const ok = await HashUtil.comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    const permissions = effectivePermissions(user.role, user.permissions);
    const payload: AdminJwtPayload = {
      typ: 'admin',
      sub: user.id,
      role: user.role,
      permissions,
      username: user.username,
      displayName: user.displayName,
    };
    const token = JwtUtil.sign(payload, ADMIN_JWT_TTL);
    return { token, user: toPublic(user) };
  }

  async createOwner(username: string, password: string, displayName: string) {
    const normalized = normalizeUsername(username);
    if (normalized.length < 3) {
      throw new AppError('Username phải có ít nhất 3 ký tự', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
    }
    if (password.length < 6) {
      throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
    }
    const existing = await adminUserRepository.findByUsername(normalized);
    if (existing) {
      throw new AppError('Username đã tồn tại', HttpStatus.CONFLICT, ErrorCode.VALIDATION_FAILED, {
        username: 'Username đã tồn tại',
      });
    }
    const passwordHash = await HashUtil.hashPassword(password);
    const created = await adminUserRepository.create({
      id: `adm-${Date.now().toString(36)}`,
      username: normalized,
      passwordHash,
      displayName: displayName.trim() || normalized,
      role: 'owner',
      permissions: [],
      isActive: true,
    });
    return toPublic(created);
  }

  async listAdmins() {
    const rows = await adminUserRepository.list();
    return { admins: rows.map(toPublic) };
  }

  async createAdmin(
    actor: { id: string; role: 'owner' | 'staff' },
    data: {
      username: string;
      password: string;
      display_name: string;
      role: 'owner' | 'staff';
      permissions?: AdminPermission[];
    }
  ) {
    if (data.role === 'owner' && actor.role !== 'owner') {
      throw new AppError('Chỉ chủ shop mới được tạo tài khoản owner', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }
    const normalized = normalizeUsername(data.username);
    if (normalized.length < 3) {
      throw new AppError('Username phải có ít nhất 3 ký tự', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
    }
    if (data.password.length < 6) {
      throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
    }
    const existing = await adminUserRepository.findByUsername(normalized);
    if (existing) {
      throw new AppError('Username đã tồn tại', HttpStatus.CONFLICT, ErrorCode.VALIDATION_FAILED, {
        username: 'Username đã tồn tại',
      });
    }

    const role = data.role;
    const permissions = role === 'owner' ? [] : sanitizeStaffPermissions(data.permissions);
    const passwordHash = await HashUtil.hashPassword(data.password);
    const created = await adminUserRepository.create({
      id: `adm-${Date.now().toString(36)}`,
      username: normalized,
      passwordHash,
      displayName: data.display_name.trim() || normalized,
      role,
      permissions,
      isActive: true,
    });
    return toPublic(created);
  }

  async updateAdmin(
    actor: { id: string; role: 'owner' | 'staff' },
    id: string,
    data: {
      display_name?: string;
      role?: 'owner' | 'staff';
      permissions?: AdminPermission[];
      password?: string;
      is_active?: boolean;
    }
  ) {
    const target = await adminUserRepository.findById(id);
    if (!target) {
      throw new AppError('Không tìm thấy tài khoản', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    const nextRole = data.role ?? target.role;

    if (data.role === 'owner' && actor.role !== 'owner') {
      throw new AppError('Chỉ chủ shop mới được gán role owner', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }

    if (
      target.role === 'owner' &&
      target.isActive &&
      ((data.role === 'staff') || data.is_active === false)
    ) {
      const remaining = await adminUserRepository.countActiveOwners(target.id);
      if (remaining < 1) {
        throw new AppError(
          'Không thể hạ quyền hoặc vô hiệu hóa owner cuối cùng',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_FAILED
        );
      }
    }

    const patch: Parameters<typeof adminUserRepository.update>[1] = {};
    if (data.display_name !== undefined) patch.displayName = data.display_name.trim() || target.displayName;
    if (data.role !== undefined) patch.role = data.role;
    if (data.is_active !== undefined) patch.isActive = data.is_active;
    if (data.password !== undefined) {
      if (data.password.length < 6) {
        throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
      }
      patch.passwordHash = await HashUtil.hashPassword(data.password);
    }
    if (nextRole === 'owner') {
      patch.permissions = [];
    } else if (data.permissions !== undefined) {
      patch.permissions = sanitizeStaffPermissions(data.permissions);
    }

    const updated = await adminUserRepository.update(id, patch);
    if (!updated) {
      throw new AppError('Không tìm thấy tài khoản', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }
    return toPublic(updated);
  }
}

export const adminAuthService = new AdminAuthService();

/** Re-export for middleware / tests */
export { ALL_ADMIN_PERMISSIONS, effectivePermissions };
