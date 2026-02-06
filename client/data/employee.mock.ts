import { apiUrl } from '@/lib/api';

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
}

// Mock data สำหรับ fallback (กรณี API ล้มเหลว)
const MOCK_EMPLOYEES: Employee[] = [
  {
    "id": "EMP001",
    "displayName": "Somsak P.",
    "firstName": "Somsak",
    "lastName": "Prasert",
    "name": "Somsak Prasert",
    "department": "IT",
    "gmail": "somsak.prasert@example.com",
    "tel": "081-234-5678",
    "positionType": "Technical",
    "employmentType": "Full-time"
  },
  {
    "id": "EMP002",
    "displayName": "Suda K.",
    "firstName": "Suda",
    "lastName": "Kaewmanee",
    "name": "Suda Kaewmanee",
    "department": "HR",
    "gmail": "suda.kaewmanee@example.com",
    "tel": "082-345-6789",
    "positionType": "Management",
    "employmentType": "Full-time"
  },
];

// Function สำหรับดึงข้อมูล Employee จาก API
export async function fetchEmployeesFromAPI(): Promise<Employee[]> {
  try {
    const response = await fetch(apiUrl('/api/employees?limit=1000'));
    const data = await response.json();
    
    if (data.success && data.data && Array.isArray(data.data)) {
      // แปลงข้อมูลจาก API ให้ตรงกับโครงสร้างที่ใช้
      return data.data.map((emp: any) => {
        // แยกชื่อและนามสกุลจาก name (ถ้ามี)
        const nameParts = (emp.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const displayName = firstName && lastName 
          ? `${firstName} ${lastName.charAt(0)}.` 
          : emp.name || '';
        
        return {
          id: String(emp.id || emp.user_id || ''),
          displayName,
          firstName,
          lastName,
          name: emp.name || '',
          department: emp.department || 'Technical',
          gmail: emp.gmail || '',
          tel: emp.tel || emp.phone || '',
          positionType: emp.positionType || emp.type || 'Technical',
          employmentType: emp.employmentType || emp.employment || 'Full-Time',
        };
      });
    }
    
    console.warn('API returned invalid data format, using mock data');
    return MOCK_EMPLOYEES;
  } catch (error) {
    console.error('Error fetching employees from API:', error);
    return MOCK_EMPLOYEES;
  }
}

// Export mock data สำหรับ backward compatibility
export const EMPLOYEE_DATA = {
  employees: MOCK_EMPLOYEES,
};

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