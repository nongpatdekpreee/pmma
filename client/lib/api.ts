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

/** GET /api/contracts?site_id=xxx - รายการ Contract ตาม site_id (ไม่ส่ง site_id = ดึงทั้งหมด) */
export async function getContractsBySite(siteId?: number | string | null): Promise<{
  success: boolean;
  data: { contract_id: number; contract_name?: string; start_date?: string; end_date?: string; site_id?: number; site_name?: string; sla_term?: string }[];
}> {
  const url = siteId ? apiUrl(`/api/contracts?site_id=${encodeURIComponent(String(siteId))}`) : apiUrl('/api/contracts');
  const res = await fetch(url);
  return res.json();
}

/** GET /api/contracts/:id/sites - Sites ที่ผูกกับ Contract */
export async function getSitesByContract(contractId: number | string): Promise<{
  success: boolean;
  data: { SLid: number; SiteName: string; Location2?: string }[];
}> {
  const res = await fetch(apiUrl(`/api/contracts/${encodeURIComponent(String(contractId))}/sites`));
  return res.json();
}

/** GET /api/contracts/:id - ดึง Contract เดียว (สำหรับ fallback sla_term) */
export async function getContractById(contractId: number | string): Promise<{
  success: boolean;
  data?: { contract_id: number; contract_name?: string; sla_term?: number | string };
}> {
  const res = await fetch(apiUrl(`/api/contracts/${encodeURIComponent(String(contractId))}`));
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

/** GET /api/analytics/ma-pm - ข้อมูล Report & Analytics (MA Coverage vs Actual PM) */
export async function getMaPmAnalytics(params?: { months?: number }): Promise<{
  success: boolean;
  data?: {
    months: number;
    range: { start: string; endExclusive: string };
    comparisonData: Array<{ month: string; maCoverage: number; actualPM: number; target: number; gap: number }>;
    vendorComparisonData: Array<{ vendor: string; maCoverage: number; actualPM: number; gap: number }>;
    siteComparisonData: Array<{ site: string; maCoverage: number; actualPM: number; gap: number }>;
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.months != null) q.set('months', String(params.months));
  const res = await fetch(apiUrl(`/api/analytics/ma-pm?${q.toString()}`));
  return res.json();
}

/** GET /api/analytics/sla - ข้อมูล SLA Compliance */
export async function getSlaAnalytics(params?: { months?: number }): Promise<{
  success: boolean;
  data?: {
    months: number;
    range: { start: string; endExclusive: string };
    lineChartData: Array<{ month: string; value: number }>;
    vendorData: Array<{ name: string; value: number }>;
    siteData: Array<{ name: string; value: number }>;
    summary: { totalReports: number; passReports: number; overallPct: number };
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.months != null) q.set('months', String(params.months));
  const res = await fetch(apiUrl(`/api/analytics/sla?${q.toString()}`));
  return res.json();
}

/** GET /api/analytics/sla/contracts - รายการ SLA ต่อ contract สำหรับหน้า view all */
export async function getSlaContracts(params?: { months?: number }): Promise<{
  success: boolean;
  data?: {
    months: number;
    range: { start: string; endExclusive: string };
    contracts: Array<{
      contract_id: string;
      vendor: string;
      site: string;
      sla_percentage: number;
      status: 'Pass' | 'Warning' | 'Fail';
      total_reports: number;
    }>;
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.months != null) q.set('months', String(params.months));
  const res = await fetch(apiUrl(`/api/analytics/sla/contracts?${q.toString()}`));
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

/** GET /api/pm-reports - ดึงรายการ PM Reports */
export async function getPmReports(params?: { limit?: number; offset?: number }): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    deviceId: string;
    device?: object;
    checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
    pmResult: 'pass' | 'warning' | 'fail';
    technicianName?: string;
    pmDate?: string;
    createdAt?: string;
  }>;
  count?: number;
  total?: number;
}> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const res = await fetch(apiUrl(`/api/pm-reports?${q.toString()}`));
  return res.json();
}

/** POST /api/pm-reports/upload - อัปโหลดไฟล์ Report */
export async function uploadReportFile(file: File): Promise<{ success: boolean; path?: string; name?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(apiUrl('/api/pm-reports/upload'), { method: 'POST', body: fd });
  return res.json();
}

/** POST /api/pm-reports - ส่ง PM Checklist Report (กรอกตัวเลข sla_result มากกว่า 70 = Pass) */
export async function postPmReport(body: {
  taskId: number;
  deviceId: string;
  device?: object;
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  sla_result: number;
  comment?: string;
  technicianName?: string;
  pmDate?: string;
  createdAt?: string;
}): Promise<{
  success: boolean;
  message?: string;
  data?: object;
  list?: Array<{ id: string; task: string; status: string; notes?: string }>;
}> {
  const res = await fetch(apiUrl('/api/pm-reports'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** GET /api/ma-reports - ดึงรายการ MA Reports */
export async function getMaReports(params?: { limit?: number; offset?: number }): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    deviceId: string;
    device?: object;
    checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
    maResult: 'pass' | 'warning' | 'fail';
    technicianName?: string;
    maDate?: string;
    createdAt?: string;
  }>;
  count?: number;
  total?: number;
}> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const res = await fetch(apiUrl(`/api/ma-reports?${q.toString()}`));
  return res.json();
}

/** POST /api/ma-reports/upload - อัปโหลดไฟล์ Report */
export async function uploadMaReportFile(file: File): Promise<{ success: boolean; path?: string; name?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(apiUrl('/api/ma-reports/upload'), { method: 'POST', body: fd });
  return res.json();
}

/** POST /api/ma-reports - ส่ง MA Checklist Report (กรอกตัวเลข sla_result มากกว่า 70 = Pass) */
export async function postMaReport(body: {
  taskId: number;
  deviceId: string;
  device?: object;
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  sla_result: number;
  comment?: string;
  technicianName?: string;
  maDate?: string;
  createdAt?: string;
}): Promise<{
  success: boolean;
  message?: string;
  data?: object;
  list?: Array<{ id: string; task: string; status: string; notes?: string }>;
}> {
  const res = await fetch(apiUrl('/api/ma-reports'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
