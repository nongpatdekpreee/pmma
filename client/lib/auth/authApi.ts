import { apiUrl } from '@/lib/api';
import { setAccessToken } from '@/lib/auth/tokenStore';
import type {
  AuthApiError,
  AuthLoginResponse,
  AuthMeResponse,
  AuthUser,
  AuthUsersListResponse,
} from '@/lib/auth/types';

const AUTH_FETCH_INIT: RequestInit = {
  credentials: 'include',
  headers: { Accept: 'application/json' },
};

function normalizeRole(role: string | undefined): AuthUser['Role'] {
  const r = String(role ?? '').trim().toUpperCase();
  return r === 'ADMIN' ? 'ADMIN' : 'USER';
}

function mapUser(data: { id: number; Username: string; Role: string }): AuthUser {
  return {
    id: data.id,
    Username: data.Username,
    Role: normalizeRole(data.Role),
  };
}

async function parseAuthJson<T>(res: Response): Promise<T | AuthApiError> {
  try {
    return (await res.json()) as T;
  } catch {
    return { success: false, message: 'Invalid response from server' };
  }
}

export async function loginRequest(
  Username: string,
  Password: string
): Promise<{ user: AuthUser; token: string } | { error: string }> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: { ...AUTH_FETCH_INIT.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username, Password }),
  });
  const body = await parseAuthJson<AuthLoginResponse>(res);
  if (!res.ok || !body.success || !('data' in body) || !body.data?.token) {
    const msg =
      'message' in body && body.message
        ? body.message
        : 'Username หรือ Password ไม่ถูกต้อง';
    return { error: msg };
  }
  const user = mapUser(body.data);
  setAccessToken(body.data.token);
  return { user, token: body.data.token };
}

export async function registerRequest(
  Username: string,
  Password: string
): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: { ...AUTH_FETCH_INIT.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username, Password }),
  });
  const body = await parseAuthJson<{ success: boolean; message?: string }>(res);
  if (!res.ok || !body.success) {
    return { error: body.message || 'ไม่สามารถสร้างบัญชีได้' };
  }
  return { ok: true };
}

export async function refreshAccessToken(): Promise<AuthUser | null> {
  const res = await fetch(apiUrl('/api/auth/refresh'), {
    ...AUTH_FETCH_INIT,
    method: 'POST',
  });
  const body = await parseAuthJson<AuthLoginResponse>(res);
  if (!res.ok || !body.success || !('data' in body) || !body.data?.token) {
    setAccessToken(null);
    return null;
  }
  setAccessToken(body.data.token);
  return mapUser(body.data);
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      ...AUTH_FETCH_INIT,
      method: 'POST',
    });
  } finally {
    setAccessToken(null);
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return null;

  const res = await fetch(apiUrl('/api/auth/me'), {
    ...AUTH_FETCH_INIT,
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseAuthJson<AuthMeResponse>(res);
  if (!res.ok || !body.success || !body.data) {
    return null;
  }
  return mapUser(body.data);
}

export async function fetchUsers(): Promise<AuthUser[]> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return [];

  const res = await fetch(apiUrl('/api/auth/users'), {
    ...AUTH_FETCH_INIT,
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseAuthJson<AuthUsersListResponse>(res);
  if (!res.ok || !body.success || !body.data) return [];
  return body.data.map((u) =>
    mapUser({
      id: u.id ?? (u as { User_id?: number }).User_id ?? 0,
      Username: u.Username,
      Role: u.Role,
    })
  );
}

export async function updateUserRole(
  id: number,
  Role: AuthUser['Role']
): Promise<{ ok: true } | { error: string }> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { error: 'ไม่พบ session' };

  const res = await fetch(apiUrl(`/api/auth/users/${id}`), {
    ...AUTH_FETCH_INIT,
    method: 'PUT',
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ Role }),
  });
  const body = await parseAuthJson<{ success: boolean; message?: string }>(res);
  if (!res.ok || !body.success) {
    return { error: body.message || 'ไม่สามารถอัปเดต Role ได้' };
  }
  return { ok: true };
}
