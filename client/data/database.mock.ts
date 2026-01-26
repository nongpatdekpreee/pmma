// ============================================
// Mock Data for Database
// Using naming: did (device), sid (site), sname (site name)
// ============================================

import { Site, Device, DeviceWithSite, Employee, Task, TaskWithRelations } from '@/interfaces/database';

// ============================================
// SITES
// ============================================
export const MOCK_SITES: Site[] = [
  {
    sid: 'SITE-001',
    sname: 'ยำยำช้างน้อย Office',
    location: 'Bangkok, Thailand',
    status: 'Active',
  },
  {
    sid: 'SITE-002',
    sname: 'มาม่าต้มยำ',
    location: 'Bangkok, Thailand',
    status: 'Active',
  },
  {
    sid: 'SITE-003',
    sname: 'เบียร์ช้าง',
    location: 'Bangkok, Thailand',
    status: 'Active',
  },
  {
    sid: 'SITE-004',
    sname: 'Bangkok Office',
    location: 'Bangkok, Thailand',
    status: 'Active',
  },
  {
    sid: 'SITE-005',
    sname: 'Chiang Mai Branch',
    location: 'Chiang Mai, Thailand',
    status: 'Active',
  },
];

// ============================================
// DEVICES
// ============================================
export const MOCK_DEVICES: Device[] = [
  // Devices for SITE-001 (ยำยำช้างน้อย Office)
  {
    did: 'D1',
    device_name: 'Router-HQ-01',
    device_type: 'Router',
    sid: 'SITE-001',
    location: 'Server Room 1',
    vendor: 'Cisco',
    model: 'ISR 4331',
    serial_number: 'SN-RT-001',
    status: 'Active',
    last_pm_date: new Date('2025-01-15'),
    next_pm_date: new Date('2025-04-15'),
  },
  {
    did: 'D2',
    device_name: 'Switch-HQ-02',
    device_type: 'Switch',
    sid: 'SITE-001',
    location: 'Server Room 1',
    vendor: 'Cisco',
    model: 'Catalyst 9300',
    serial_number: 'SN-SW-002',
    status: 'Active',
    last_pm_date: new Date('2025-01-18'),
    next_pm_date: new Date('2025-04-18'),
  },
  {
    did: 'D3',
    device_name: 'Firewall-HQ',
    device_type: 'Firewall',
    sid: 'SITE-001',
    location: 'Server Room 1',
    vendor: 'Palo Alto',
    model: 'PA-220',
    serial_number: 'SN-FW-003',
    status: 'Active',
    last_pm_date: new Date('2025-01-19'),
    next_pm_date: new Date('2025-04-19'),
  },
  {
    did: 'D4',
    device_name: 'AP-HQ-01',
    device_type: 'Access Point',
    sid: 'SITE-001',
    location: 'Floor 1',
    vendor: 'Aruba',
    model: 'AP-515',
    serial_number: 'SN-AP-004',
    status: 'Active',
    last_pm_date: new Date('2025-01-20'),
    next_pm_date: new Date('2025-04-20'),
  },
  // Devices for SITE-002 (มาม่าต้มยำ)
  {
    did: 'D5',
    device_name: 'Router-MAMA-01',
    device_type: 'Router',
    sid: 'SITE-002',
    location: 'Main Office',
    vendor: 'Cisco',
    model: 'ISR 4321',
    serial_number: 'SN-RT-005',
    status: 'Active',
    last_pm_date: new Date('2025-01-15'),
    next_pm_date: new Date('2025-04-15'),
  },
  {
    did: 'D6',
    device_name: 'Switch-MAMA-01',
    device_type: 'Switch',
    sid: 'SITE-002',
    location: 'Main Office',
    vendor: 'Cisco',
    model: 'Catalyst 2960',
    serial_number: 'SN-SW-006',
    status: 'Active',
    last_pm_date: new Date('2025-01-16'),
    next_pm_date: new Date('2025-04-16'),
  },
  // Devices for SITE-003 (เบียร์ช้าง)
  {
    did: 'D7',
    device_name: 'Core-SW-CHANG',
    device_type: 'Switch',
    sid: 'SITE-003',
    location: 'Data Center',
    vendor: 'Cisco',
    model: 'Nexus 9000',
    serial_number: 'SN-SW-007',
    status: 'Active',
    last_pm_date: new Date('2025-01-17'),
    next_pm_date: new Date('2025-04-17'),
  },
];

// ============================================
// DEVICES WITH SITE INFORMATION
// ============================================
export const MOCK_DEVICES_WITH_SITE: DeviceWithSite[] = MOCK_DEVICES.map((device) => {
  const site = MOCK_SITES.find((s) => s.sid === device.sid);
  return {
    ...device,
    sname: site?.sname || '',
    site_location: site?.location,
  };
});

// ============================================
// EMPLOYEES
// ============================================
export const MOCK_EMPLOYEES: Employee[] = [
  {
    employee_id: 'ENG001',
    display_name: 'Yotsawan',
    first_name: 'Yotsawan',
    last_name: '',
    department: 'IT',
    position: 'DevOps Engineer',
    position_type: 'Technical',
    employment_type: 'Full-time',
  },
  {
    employee_id: 'ENG002',
    display_name: 'Somsai',
    first_name: 'Somsai',
    last_name: '',
    department: 'IT',
    position: 'System Analyst',
    position_type: 'Technical',
    employment_type: 'Full-time',
  },
  {
    employee_id: 'ENG003',
    display_name: 'Somchai',
    first_name: 'Somchai',
    last_name: '',
    department: 'IT',
    position: 'Senior Developer',
    position_type: 'Technical',
    employment_type: 'Full-time',
  },
  {
    employee_id: 'ENG004',
    display_name: 'Narong',
    first_name: 'Narong',
    last_name: '',
    department: 'IT',
    position: 'DevOps Engineer',
    position_type: 'Technical',
    employment_type: 'Full-time',
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get devices by site ID (sid)
 */
export function getDevicesBySid(sid: string): Device[] {
  return MOCK_DEVICES.filter((d) => d.sid === sid);
}

/**
 * Get devices by site name (sname)
 */
export function getDevicesBySname(sname: string): Device[] {
  const site = MOCK_SITES.find((s) => s.sname === sname);
  if (!site) return [];
  return MOCK_DEVICES.filter((d) => d.sid === site.sid);
}

/**
 * Get site by ID (sid)
 */
export function getSiteBySid(sid: string): Site | undefined {
  return MOCK_SITES.find((s) => s.sid === sid);
}

/**
 * Get site by name (sname)
 */
export function getSiteBySname(sname: string): Site | undefined {
  return MOCK_SITES.find((s) => s.sname === sname);
}

/**
 * Get device by ID (did)
 */
export function getDeviceByDid(did: string): Device | undefined {
  return MOCK_DEVICES.find((d) => d.did === did);
}

/**
 * Get devices with site information
 */
export function getDevicesWithSite(): DeviceWithSite[] {
  return MOCK_DEVICES_WITH_SITE;
}

/**
 * Get devices by site ID with site information
 */
export function getDevicesWithSiteBySid(sid: string): DeviceWithSite[] {
  return MOCK_DEVICES_WITH_SITE.filter((d) => d.sid === sid);
}

/**
 * Get devices by site name with site information
 */
export function getDevicesWithSiteBySname(sname: string): DeviceWithSite[] {
  return MOCK_DEVICES_WITH_SITE.filter((d) => d.sname === sname);
}
