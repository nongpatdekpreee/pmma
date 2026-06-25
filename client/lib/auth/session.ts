import { refreshAccessToken } from '@/lib/auth/authApi';
import { getAccessToken, setAccessToken } from '@/lib/auth/tokenStore';
import type { AuthUser } from '@/lib/auth/types';

let inflight: Promise<AuthUser | null> | null = null;

/** ดึง access token จาก refresh cookie — dedupe ถ้ามีหลาย request พร้อมกัน */
export function ensureAuthSession(): Promise<AuthUser | null> {
  if (getAccessToken()) {
    return Promise.resolve(null);
  }

  if (!inflight) {
    inflight = refreshAccessToken().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** หลัง 401 — ล้าง token แล้ว refresh ใหม่ */
export async function recoverAuthSession(): Promise<AuthUser | null> {
  setAccessToken(null);
  inflight = null;
  return ensureAuthSession();
}
