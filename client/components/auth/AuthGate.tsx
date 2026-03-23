'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'currentUser';

function getLoginUrl(): string {
  const u = process.env.NEXT_PUBLIC_LOGIN_URL;
  if (u && u.trim()) return u.trim().replace(/\/$/, '') + '/';
  return 'http://10.4.102.212/';
}

function isAuthDisabled(): boolean {
  const v = process.env.NEXT_PUBLIC_AUTH_DISABLED;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * บังคับให้มี currentUser ใน localStorage (ตรงกับระบบ login ที่ root และ logout ใน Sidebar)
 * ถ้ายังไม่ login → redirect ไป NEXT_PUBLIC_LOGIN_URL พร้อม returnUrl กลับมาแอป (พอร์ต 9000)
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isAuthDisabled()) {
      setReady(true);
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('currentUser');
      if (fromUrl) {
        localStorage.setItem(STORAGE_KEY, fromUrl);
        params.delete('currentUser');
        const qs = params.toString();
        const path = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
        window.history.replaceState({}, '', path);
      }
    } catch {
      // ignore
    }

    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        setReady(true);
        return;
      }
    } catch {
      // localStorage ไม่ได้ใช้งาน → ไม่บังคับ redirect
      setReady(true);
      return;
    }

    const loginBase = getLoginUrl();
    const returnTo = encodeURIComponent(window.location.href.split('#')[0]);
    const sep = loginBase.includes('?') ? '&' : '?';
    const redirectParam =
      process.env.NEXT_PUBLIC_LOGIN_RETURN_PARAM?.trim() || 'returnUrl';
    window.location.href = `${loginBase}${sep}${redirectParam}=${returnTo}`;
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        กำลังตรวจสอบการเข้าสู่ระบบ...
      </div>
    );
  }

  return <>{children}</>;
}
