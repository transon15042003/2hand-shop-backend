import { Response } from 'express';
import { appConfig } from '../configs/app.config.js';
import { ADMIN_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from '../constants/http-status.js';

/** Build Set-Cookie without Expires (ADR 006 / FE mock gate: Max-Age only). */
function buildCookie(name: string, value: string, maxAgeSec?: number): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (typeof maxAgeSec === 'number') parts.splice(2, 0, `Max-Age=${maxAgeSec}`);
  if (!appConfig.isDev) parts.push('Secure');
  return parts.join('; ');
}

export function setCustomerSessionCookie(res: Response, token: string) {
  res.append('Set-Cookie', buildCookie(SESSION_COOKIE_NAME, token, SESSION_MAX_AGE_SEC));
}

export function clearCustomerSessionCookie(res: Response) {
  res.append('Set-Cookie', buildCookie(SESSION_COOKIE_NAME, '', 0));
}

export function setAdminSessionCookie(res: Response, token: string) {
  // Session cookie (no Max-Age) — ends with browser session
  res.append('Set-Cookie', buildCookie(ADMIN_COOKIE_NAME, token));
}

export function clearAdminSessionCookie(res: Response) {
  res.append('Set-Cookie', buildCookie(ADMIN_COOKIE_NAME, '', 0));
}
