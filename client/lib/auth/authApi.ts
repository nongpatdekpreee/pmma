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
    if (msg === 'API route not found') {
      return {
        error:
          'ไม่พบ API login — เปิดแอปที่ http://localhost (พอร์ต 80) หรือ rebuild frontend; login ต้องเป็น POST ไม่ใช่เปิด URL ใน browser',
      };
    }
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

export async function fetchUsers(): Promise<
  { ok: true; users: AuthUser[] } | { ok: false; error: string }
> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { ok: false, error: 'Session expired. Please sign in again.' };

  const res = await fetch(apiUrl('/api/auth/users'), {
    ...AUTH_FETCH_INIT,
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseAuthJson<AuthUsersListResponse>(res);
  if (!res.ok || !body.success || !body.data) {
    return {
      ok: false,
      error: ('message' in body && body.message) || 'Unable to load users.',
    };
  }
  return {
    ok: true,
    users: body.data.map((u) =>
      mapUser({
        id: u.id ?? (u as { User_id?: number }).User_id ?? 0,
        Username: u.Username,
        Role: u.Role,
      })
    ),
  };
}

export async function updateUserAccount(
  id: number,
  patch: {
    Username?: string;
    Password?: string;
    Role?: AuthUser['Role'];
    adminPassword?: string;
  }
): Promise<{ ok: true; user?: AuthUser } | { error: string }> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { error: 'Session expired. Please sign in again.' };

  const res = await fetch(apiUrl(`/api/auth/users/${id}`), {
    ...AUTH_FETCH_INIT,
    method: 'PUT',
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  const body = await parseAuthJson<{
    success: boolean;
    message?: string;
    data?: { id: number; Username: string; Role: string };
  }>(res);
  if (!res.ok || !body.success) {
    return { error: body.message || 'Unable to update user.' };
  }
  const user = body.data ? mapUser(body.data) : undefined;
  return { ok: true, user };
}

/** @deprecated use updateUserAccount */
export async function updateUserRole(
  id: number,
  Role: AuthUser['Role']
): Promise<{ ok: true } | { error: string }> {
  const result = await updateUserAccount(id, { Role });
  if ('error' in result) return result;
  return { ok: true };
}

export async function deleteUserAccount(
  id: number
): Promise<{ ok: true } | { error: string }> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { error: 'Session expired. Please sign in again.' };

  const res = await fetch(apiUrl(`/api/auth/users/${id}`), {
    ...AUTH_FETCH_INIT,
    method: 'DELETE',
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseAuthJson<{ success: boolean; message?: string }>(res);
  if (!res.ok || !body.success) {
    return { error: body.message || 'Unable to delete user.' };
  }
  return { ok: true };
}

export async function adminCreateUser(
  Username: string,
  Password: string,
  Role: AuthUser['Role'] = 'USER',
  adminPassword?: string
): Promise<{ ok: true; user: AuthUser } | { error: string }> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: { ...AUTH_FETCH_INIT.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username, Password }),
  });
  const body = await parseAuthJson<{
    success: boolean;
    message?: string;
    data?: { id: number; Username: string; Role: string };
  }>(res);
  if (!res.ok || !body.success || !body.data?.id) {
    return { error: body.message || 'Unable to create user.' };
  }

  let user = mapUser(body.data);
  if (Role === 'ADMIN' && user.Role !== 'ADMIN') {
    const updated = await updateUserAccount(user.id, { Role: 'ADMIN', adminPassword });
    if ('error' in updated) return { error: updated.error };
    if (updated.user) user = updated.user;
    else user = { ...user, Role: 'ADMIN' };
  }
  return { ok: true, user };
}
