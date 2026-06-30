import { refreshAccessToken } from '@/lib/auth/authApi';
import { getAccessToken, setAccessToken } from '@/lib/auth/tokenStore';
import type { AuthUser } from '@/lib/auth/types';

let inflight: Promise<AuthUser | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let onSessionExpired: (() => void) | null = null;

const REFRESH_BEFORE_EXPIRY_MS = 60_000;

/** Decode JWT exp — scheduling only, not for verification */
function getJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function isAccessTokenExpiringSoon(token: string, skewMs = REFRESH_BEFORE_EXPIRY_MS): boolean {
  const expMs = getJwtExpMs(token);
  if (expMs == null) return true;
  return Date.now() >= expMs - skewMs;
}

function clearRefreshTimer(): void {
  if (refreshTimer != null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function handleSessionExpired(): void {
  setAccessToken(null);
  clearRefreshTimer();
  inflight = null;
  onSessionExpired?.();
}

/** AuthProvider ลงทะเบียน — หมด session แล้ว redirect ไป /login */
export function registerSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/** ตั้ง timer refresh access token ก่อนหมดอายุ (ฝั่ง frontend) */
export function scheduleAccessTokenRefresh(): void {
  clearRefreshTimer();
  const token = getAccessToken();
  if (!token) return;

  const expMs = getJwtExpMs(token);
  if (expMs == null) return;

  const refreshAt = expMs - REFRESH_BEFORE_EXPIRY_MS;
  const delay = Math.max(1_000, refreshAt - Date.now());

  refreshTimer = setTimeout(() => {
    void (async () => {
      const user = await refreshAccessToken();
      if (user) {
        scheduleAccessTokenRefresh();
      } else {
        handleSessionExpired();
      }
    })();
  }, delay);
}

export function stopAccessTokenRefreshScheduler(): void {
  clearRefreshTimer();
}

export function startAccessTokenRefreshScheduler(): () => void {
  scheduleAccessTokenRefresh();
  return stopAccessTokenRefreshScheduler;
}

/** ดึง/ต่ออายุ access token จาก refresh cookie — dedupe ถ้ามีหลาย request พร้อมกัน */
export function ensureAuthSession(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (token && !isAccessTokenExpiringSoon(token)) {
    return Promise.resolve(null);
  }

  if (!inflight) {
    inflight = refreshAccessToken()
      .then((user) => {
        if (user) {
          scheduleAccessTokenRefresh();
        } else {
          handleSessionExpired();
        }
        return user;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** หลัง 401 — ล้าง token แล้ว refresh ใหม่ */
export async function recoverAuthSession(): Promise<AuthUser | null> {
  setAccessToken(null);
  clearRefreshTimer();
  inflight = null;
  return ensureAuthSession();
}
