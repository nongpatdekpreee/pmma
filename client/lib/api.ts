const API_BASE = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : 'http://localhost:5000';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** GET /api/sites/locations - สำหรับ dropdown Site (SLid, SiteName, Location2) */
export async function getSitesLocation(): Promise<{ success: boolean; data: { SLid: number; SiteName: string; Location?: string }[] }> {
  const res = await fetch(apiUrl('/api/sites/locations'));
  return res.json();
}

/** GET /api/devices/by-site?site_id= - Devices ตาม SLid */
export async function getDevicesBySite(siteId: number | string): Promise<{ success: boolean; data: { Did: number; CI_Name?: string; Asset_Number?: string }[] }> {
  const res = await fetch(apiUrl(`/api/devices/by-site?site_id=${encodeURIComponent(String(siteId))}`));
  return res.json();
}

/** GET /api/contracts?site_id=xxx - รายการ Contract ตาม site_id */
export async function getContractsBySite(siteId: number | string): Promise<{
  success: boolean;
  data: { contract_id: number; contract_name?: string; start_date?: string; end_date?: string; site_id?: number; site_name?: string; sla_name?: string; sla_detail?: string }[];
}> {
  const res = await fetch(apiUrl(`/api/contracts?site_id=${encodeURIComponent(String(siteId))}`));
  return res.json();
}

/** GET /api/contracts/:id/devices - Devices ที่ผูกกับ Contract (จาก contract_device) */
export async function getDevicesByContract(contractId: number | string): Promise<{
  success: boolean;
  data: { Did: number; CI_Name?: string; Asset_Number?: string; serial?: string; Asset_State?: string; Sid?: number; SiteName?: string }[];
}> {
  const res = await fetch(apiUrl(`/api/contracts/${encodeURIComponent(String(contractId))}/devices`));
  return res.json();
}

/** GET /api/contracts/statistics/vendor - Vendor Statistics จาก Devices ที่มี Contract */
export async function getVendorStatistics(): Promise<{
  success: boolean;
  data: { name: string; value: number; deviceCount: number; siteCount: number; total: number }[];
}> {
  const res = await fetch(apiUrl('/api/contracts/statistics/vendor'));
  return res.json();
}

/** POST /api/tasks - สร้าง Task (PM/MA) */
export async function postTask(body: {
  taskType: 'PM' | 'MA';
  site_id?: number | string | null;
  eng_id?: number | string | null;
  device_id?: number | string | null;
  contract_id?: number | string | null;
  start_date: string;
  end_date: string;
  travel_how?: string;
  travel_cost?: string | number;
  status?: string;
}): Promise<{ success: boolean; message?: string; data?: { id: string; pm_id?: number; ma_id?: number; taskType: string } }> {
  const res = await fetch(apiUrl('/api/tasks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** GET /api/tasks?month=&year= - ดึง Tasks สำหรับปฏิทิน */
export async function getTasks(params?: { month?: number; year?: number }): Promise<{ success: boolean; data?: any[]; count?: number }> {
  const q = new URLSearchParams();
  if (params?.month != null) q.set('month', String(params.month));
  if (params?.year != null) q.set('year', String(params.year));
  const res = await fetch(apiUrl(`/api/tasks?${q.toString()}`));
  return res.json();
}

/** GET /api/devices/with-pm - ดึง Devices พร้อม PM Information สำหรับ Asset & Site Database */
export async function getDevicesWithPM(params?: { search?: string; deviceRole?: string; site?: string }): Promise<{
  success: boolean;
  data: Array<{
    deviceId: string;
    deviceName: string;
    deviceRole: string;
    site: string;
    location: string;
    vendor: string;
    model: string;
    serialNumber: string;
    lastPM: string | null;
    nextPM: string | null;
    pmHistory: Array<{
      id: string;
      date: string;
      status: 'Done' | 'In Progress' | 'Failed' | 'Scheduled';
      technician: string;
      notes?: string | null;
    }>;
    status: 'Active' | 'Inactive' | 'Maintenance';
  }>;
  statistics: {
    totalDevices: number;
    activeDevices: number;
    upcomingPM: number;
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.deviceRole) q.set('deviceRole', params.deviceRole);
  if (params?.site) q.set('site', params.site);
  
  try {
    const res = await fetch(apiUrl(`/api/devices/with-pm?${q.toString()}`));
    
    const data = await res.json();
    
    // Always return data, even if status is not ok
    // Frontend will check response.success to handle errors
    if (!res.ok) {
      console.warn(`API returned status ${res.status}:`, data.message || data.error || 'Unknown error');
    }
    
    return data;
  } catch (error) {
    console.error('Network error fetching devices with PM:', error);
    // Return error response structure instead of throwing
    return {
      success: false,
      data: [],
      statistics: { totalDevices: 0, activeDevices: 0, upcomingPM: 0 },
      message: error instanceof Error ? error.message : 'Network error',
      error: 'Failed to fetch devices'
    };
  }
}
