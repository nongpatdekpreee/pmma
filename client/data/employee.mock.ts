import { getEmployees as getEmployeesFromAPI } from '@/lib/api';
import { asRecord, readString } from '@/lib/unknownUtil';

// Interface สำหรับ Employee
export interface Employee {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  department?: string;
  gmail: string;
  tel: string;
  positionType: string;
  employmentType: string;
  photo?: string | null;
}

function mapApiEmployeeToEmployee(emp: unknown): Employee {
  const r = asRecord(emp);
  const name = readString(r, 'name') ?? '';
  const nameParts = name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const displayName =
    firstName && lastName ? `${firstName} ${lastName.charAt(0)}.` : name;

  const id =
    readString(r, 'id') ??
    (r.user_id != null ? String(r.user_id) : '');

  const photo = r.photo;
  const photoValue =
    typeof photo === 'string' || photo === null ? photo : photo != null ? String(photo) : null;

  return {
    id,
    displayName,
    firstName,
    lastName,
    name,
    department: readString(r, 'department') ?? 'Technical',
    gmail: readString(r, 'gmail') ?? '',
    tel: readString(r, 'tel') ?? readString(r, 'phone') ?? '',
    positionType: readString(r, 'positionType') ?? readString(r, 'type') ?? 'Technical',
    employmentType:
      readString(r, 'employmentType') ?? readString(r, 'employment') ?? 'Full-Time',
    photo: photoValue,
  };
}

// Function สำหรับดึงข้อมูล Employee จาก API (ไม่มี mock data)
export async function fetchEmployeesFromAPI(): Promise<Employee[]> {
  try {
    const result = await getEmployeesFromAPI({ limit: 1000 });
    
    if (!result.success || !result.data || !Array.isArray(result.data)) {
      const resultRec = asRecord(result);
      const msg = readString(resultRec, 'message') ?? readString(resultRec, 'error');
      console.error('API returned invalid data format:', msg || result);
      return [];
    }
    
    // แปลงข้อมูลจาก API ให้ตรงกับโครงสร้างที่ใช้
    return result.data.map(mapApiEmployeeToEmployee);
  } catch (error) {
    console.error('Error fetching employees from API:', error);
    // ไม่ return mock data แทน - return empty array
    return [];
  }
}

// Cache สำหรับเก็บข้อมูลที่ดึงมาแล้ว
let cachedEmployees: Employee[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 นาที

// Function สำหรับดึงข้อมูล Employee (พร้อม cache)
export async function getEmployees(): Promise<Employee[]> {
  const now = Date.now();
  
  // ถ้ามี cache และยังไม่หมดอายุ ให้ใช้ cache
  if (cachedEmployees && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedEmployees;
  }
  
  // ดึงข้อมูลใหม่จาก API
  const employees = await fetchEmployeesFromAPI();
  cachedEmployees = employees;
  cacheTimestamp = now;
  
  return employees;
}

// Function สำหรับ clear cache (ใช้เมื่อมีการอัปเดตข้อมูล)
export function clearEmployeeCache(): void {
  cachedEmployees = null;
  cacheTimestamp = 0;
}

// Cache สำหรับ EMPLOYEE_DATA
let employeeDataCache: Employee[] | null = null;
let employeeDataCacheTimestamp: number = 0;

// Export object สำหรับ backward compatibility (ดึงข้อมูลจาก API เท่านั้น)
export const EMPLOYEE_DATA = {
  get employees(): Employee[] {
    // ถ้ามี cache และยังไม่หมดอายุ ให้ใช้ cache
    const now = Date.now();
    if (employeeDataCache && (now - employeeDataCacheTimestamp) < CACHE_DURATION) {
      return employeeDataCache;
    }
    
    // ถ้ายังไม่มี cache ให้ return empty array
    // Component ควรเรียก getEmployees() หรือ refresh() แทน
    return [];
  },
  
  // Function สำหรับอัปเดต cache (เรียกจาก component)
  async refresh(): Promise<void> {
    const employees = await fetchEmployeesFromAPI();
    employeeDataCache = employees;
    employeeDataCacheTimestamp = Date.now();
  },
  
  // Function สำหรับดึงข้อมูลแบบ async (แนะนำให้ใช้แทน employees property)
  async getEmployeesAsync(): Promise<Employee[]> {
    return await getEmployees();
  }
};
