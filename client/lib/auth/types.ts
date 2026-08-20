export type AppRole = 'USER' | 'ADMIN';
export type AppTenant = 'SNS' | 'TCC';

export interface AuthUser {
  id: number;
  Username: string;
  Role: AppRole;
  tenant?: AppTenant;
}

export interface EmployeeAccountRow {
  employeeId: string;
  name: string;
  gmail: string;
  tel: string;
  positionType: string;
  employmentType: string;
  photo: string | null;
  account: AuthUser | null;
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

export interface EmployeeAccountsListResponse {
  success: boolean;
  count?: number;
  data?: EmployeeAccountRow[];
  message?: string;
}

export interface AuthApiError {
  success: false;
  message?: string;
}
