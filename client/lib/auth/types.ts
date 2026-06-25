export type AppRole = 'USER' | 'ADMIN';

export interface AuthUser {
  id: number;
  Username: string;
  Role: AppRole;
}

export interface AuthLoginResponse {
  success: boolean;
  message?: string;
  data?: AuthUser & { token: string };
}

export interface AuthMeResponse {
  success: boolean;
  data?: AuthUser;
  message?: string;
}

export interface AuthUsersListResponse {
  success: boolean;
  count?: number;
  data?: AuthUser[];
  message?: string;
}

export interface AuthApiError {
  success: false;
  message?: string;
}
