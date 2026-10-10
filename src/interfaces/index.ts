import { Request } from 'express';
import type { AdminPermission } from '../constants/admin-permissions.js';

export interface CustomerSessionPayload {
  customerId: string;
  phone: string;
  email: string | null;
}

export interface AuthenticatedAdmin {
  id: string;
  username: string;
  displayName: string;
  role: 'owner' | 'staff';
  permissions: AdminPermission[];
}

export interface AuthenticatedRequest extends Request {
  customer?: {
    id: string;
    phone: string;
    email: string | null;
    name: string;
  };
  /** Raw session cookie/Bearer token (for logout-all / change-password). */
  sessionToken?: string;
  isAdmin?: boolean;
  admin?: AuthenticatedAdmin;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
