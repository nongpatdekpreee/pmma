import { apiUrl } from '@/lib/api';
import { setAccessToken } from '@/lib/auth/tokenStore';
import type {
  AuthApiError,
  AuthLoginResponse,
  AuthMeResponse,
  AuthUser,
  EmployeeAccountRow,
  EmployeeAccountsListResponse,
} from '@/lib/auth/types';

const AUTH_FETCH_INIT: RequestInit = {
  credentials: 'include',
  headers: { Accept: 'application/json' },
};

function normalizeRole(role: string | undefined): AuthUser['Role'] {
  const r = String(role ?? '').trim().toUpperCase();
  return r === 'ADMIN' ? 'ADMIN' : 'USER';
}

function mapUser(data: { id: number; Username: string; Role: string; tenant?: string }): AuthUser {
  const tenantRaw = String(data.tenant ?? '').trim().toUpperCase();
  const tenant: AuthUser['tenant'] | undefined =
    tenantRaw === 'SNS' ? 'SNS' : tenantRaw === 'TCC' ? 'TCC' : undefined;
  return {
    id: data.id,
    Username: data.Username,
    Role: normalizeRole(data.Role),
    ...(tenant ? { tenant } : {}),
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
          'API login not found - please rebuild frontend; login must be POST, not open URL in browser',
      };
    }
    return { error: msg };
  }
  const user = mapUser(body.data);
  setAccessToken(body.data.token);
  const { scheduleAccessTokenRefresh } = await import('@/lib/auth/session');
  scheduleAccessTokenRefresh();
  return { user, token: body.data.token };
}

export async function registerRequest(
  Username: string,
  Password: string,
  profile: { gmail: string; tel: string }
): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: { ...AUTH_FETCH_INIT.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Username,
      Password,
      gmail: profile.gmail,
      tel: profile.tel,
    }),
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
  const { scheduleAccessTokenRefresh } = await import('@/lib/auth/session');
  scheduleAccessTokenRefresh();
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
    const { stopAccessTokenRefreshScheduler } = await import('@/lib/auth/session');
    stopAccessTokenRefreshScheduler();
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

export async function fetchEmployeeAccounts(): Promise<
  { ok: true; rows: EmployeeAccountRow[] } | { ok: false; error: string }
> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { ok: false, error: 'Session expired. Please sign in again.' };

  const res = await fetch(apiUrl('/api/auth/employee-accounts'), {
    ...AUTH_FETCH_INIT,
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseAuthJson<EmployeeAccountsListResponse>(res);
  if (!res.ok || !body.success || !body.data) {
    return {
      ok: false,
      error: ('message' in body && body.message) || 'Unable to load employees.',
    };
  }
  return {
    ok: true,
    rows: body.data.map((row) => ({
      employeeId: String(row.employeeId),
      name: row.name || '',
      gmail: row.gmail || '',
      tel: row.tel || '',
      positionType: row.positionType || 'Technical',
      employmentType: row.employmentType || 'Full-Time',
      photo: row.photo ?? null,
      account: row.account
        ? mapUser({
            id: row.account.id,
            Username: row.account.Username,
            Role: row.account.Role,
          })
        : null,
    })),
  };
}

export async function createEmployeeLoginAccount(input: {
  employeeId: string;
  Username: string;
  Password: string;
  Role?: AuthUser['Role'];
  adminPassword?: string;
}): Promise<{ ok: true; row: { employeeId: string; account: AuthUser } } | { error: string }> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { error: 'Session expired. Please sign in again.' };

  const res = await fetch(apiUrl('/api/auth/employee-accounts'), {
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body = await parseAuthJson<{
    success: boolean;
    message?: string;
    data?: { employeeId: string; account: { id: number; Username: string; Role: string } };
  }>(res);
  if (!res.ok || !body.success || !body.data?.account) {
    return { error: body.message || 'Unable to create account.' };
  }
  return {
    ok: true,
    row: {
      employeeId: String(body.data.employeeId),
      account: mapUser(body.data.account),
    },
  };
}

export async function linkEmployeeLoginAccount(
  employeeId: string,
  link: { authUserId?: number; Username?: string }
): Promise<{ ok: true; account: AuthUser } | { error: string }> {
  const token = (await import('@/lib/auth/tokenStore')).getAccessToken();
  if (!token) return { error: 'Session expired. Please sign in again.' };

  const res = await fetch(apiUrl(`/api/auth/employee-accounts/${encodeURIComponent(employeeId)}/link`), {
    ...AUTH_FETCH_INIT,
    method: 'PUT',
    headers: {
      ...AUTH_FETCH_INIT.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(link),
  });
  const body = await parseAuthJson<{
    success: boolean;
    message?: string;
    data?: { account: { id: number; Username: string; Role: string } };
  }>(res);
  if (!res.ok || !body.success || !body.data?.account) {
    return { error: body.message || 'Unable to link account.' };
  }
  return { ok: true, account: mapUser(body.data.account) };
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
