'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  fetchMe,
  loginRequest,
  logoutRequest,
  registerRequest,
} from '@/lib/auth/authApi';
import { ensureAuthSession } from '@/lib/auth/session';
import type { AuthUser } from '@/lib/auth/types';

const PUBLIC_PATHS = new Set(['/login', '/register']);

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const bootstrap = useCallback(async () => {
    const me = await fetchMe();
    if (me) {
      setUser(me);
      return;
    }
    await ensureAuthSession();
    const meAfter = await fetchMe();
    setUser(meAfter);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isPublic = PUBLIC_PATHS.has(pathname);

    (async () => {
      if (isPublic) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      await bootstrap();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, bootstrap]);

  const login = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      const result = await loginRequest(username, password);
      if ('error' in result) return result.error;
      setUser(result.user);
      router.replace('/calendar');
      return null;
    },
    [router]
  );

  const register = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      const result = await registerRequest(username, password);
      if ('error' in result) return result.error;
      router.replace('/login');
      return null;
    },
    [router]
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    await bootstrap();
  }, [bootstrap]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: user != null,
      isAdmin: user?.Role === 'ADMIN',
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {PUBLIC_PATHS.has(pathname) || !loading ? (
        children
      ) : (
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          กำลังโหลด…
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
