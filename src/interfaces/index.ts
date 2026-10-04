import { Request } from 'express';

export interface CustomerSessionPayload {
  customerId: string;
  phone: string;
  email: string;
}

export interface AdminSessionPayload {
  role: 'admin';
  username: string;
}

export interface AuthenticatedRequest extends Request {
  customer?: {
    id: string;
    phone: string;
    email: string;
    name: string;
  };
  isAdmin?: boolean;
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
