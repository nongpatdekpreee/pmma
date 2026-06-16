/**
 * Base URL สำหรับ `apiUrl()` — ต้องชี้ไปที่ Express ที่มี `/api/...`
 * - ค่าว่าง / ไม่ตั้ง env: same-origin `/api` (dev ใช้ rewrite ใน next.config → Express)
 * - ตั้งเต็มเมื่อ API อยู่คนละ host (เช่น http://10.x.x.x:5000)
 */
function getApiBase(): string {
  if (typeof process === 'undefined') return '';
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (s === '') return '';
  return s.replace(/\/$/, '');
}
const API_BASE = getApiBase();


export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/**
 * URL สำหรับไฟล์ static ใต้ backend `/uploads/...` (รูปพนักงาน, สัญญา ฯลฯ)
 * — ไฟล์อยู่ที่ Express ไม่ใช่ Next; dev ใช้ rewrite `/uploads` ใน next.config
 */
export function uploadAssetUrl(path: string): string {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const p = raw.startsWith('/') ? raw : `/${raw}`;
  if (API_BASE) return `${API_BASE}${p}`;
  if (typeof window !== 'undefined') return p;
  const target = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000').replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return `${target}${p}`;
  return p;
}

/**
 * Fetch ไปยัง API — ใส่ Accept: application/json เพื่อลดโอกาสที่ proxy ส่งหน้า HTML
 * และให้สอดคล้องกับ Content-Type JSON เมื่อส่ง body (ยกเว้น FormData)
 */
export function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const next = init ?? {};
  const headers = new Headers(next.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const method = String(next.method || 'GET').toUpperCase();
  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    next.body != null &&
    !(next.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...next, headers });
}

/** URL เปิดไฟล์ MA repair notice ตาม task + ชื่อไฟล์ (basename) — ต้องสอดคล้อง route backend */
export function taskMaNoticeUrl(taskId: number | string, fileBasename: string): string {
  const enc = encodeURIComponent(String(fileBasename).trim());
  return apiUrl(`/api/tasks/${taskId}/ma-notice/${enc}`);
}

/**
 * Excel HYPERLINK() must use an absolute http(s) URL. On Windows, a path like `/api/...` is treated as `C:\\api\\...`
 * (local file), which triggers a security warning and breaks the link.
 */
export function absoluteUrlForHyperlink(pathOrUrl: string): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const pathOnly = raw.startsWith('/') ? raw : `/${raw}`;

  let base = '';
  if (typeof window !== 'undefined') {
    const env = process.env.NEXT_PUBLIC_API_URL;
    if (env != null && String(env).trim() !== '') {
      base = String(env).replace(/\/$/, '');
    }
    if (!base) {
      base = window.location.origin || '';
    }
  }
  if (!base) {
    const g = getApiBase();
    base = g && String(g).trim() !== '' ? String(g).replace(/\/$/, '') : '';
  }
  if (!base || base.startsWith('file:')) {
    base = 'http://127.0.0.1:3000';
  }
  if (!/^https?:\/\//i.test(base)) {
    base = `http://${base.replace(/^\/+/, '')}`;
  }

  const out = `${base.replace(/\/$/, '')}${pathOnly}`;
  return /^https?:\/\//i.test(out) ? out : `http://127.0.0.1:3000${pathOnly}`;
}

/**
 * Read fetch body as JSON. Returns null if body is HTML (e.g. nginx/404 page), empty, or invalid JSON.
 * Prevents Uncaught SyntaxError from res.json() when the API base URL / proxy is wrong.
 */
export async function responseJsonSafe<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

/** ข้อความสำหรับสถานะจาก reverse proxy (nginx ฯลฯ) — body มักเป็น HTML ไม่ใช่ JSON จาก Express */
function upstreamHttpMessage(status: number): string | null {
  if (status === 502) {
    return (
      'Bad Gateway (502): gateway could not reach the API (Node/Express). ' +
      'Check that the backend container/process is running, DB is reachable, and nginx/upstream target host:port is correct.'
    );
  }
  if (status === 503) return 'Service Unavailable (503): API is temporarily unavailable.';
  if (status === 504) return 'Gateway Timeout (504): API did not respond in time.';
  return null;
}

/**
 * Parse JSON from fetch; throws with a clear message for HTML/502 proxy pages.
 * Non-OK responses: if body is JSON (`{` / `[`), returns parsed object so callers can read `success` / `message`.
 */
export async function responseJsonOrThrow<T = unknown>(res: Response, hint?: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();

  // Gateway / proxy errors first — body อาจเป็น HTML, plain text, หรือ JSON จากตัว gateway เอง
  const upFirst = upstreamHttpMessage(res.status);
  if (upFirst) {
    throw new Error(upFirst);
  }

  if (!trimmed) {
    if (!res.ok) {
      throw new Error(hint || `Empty response (HTTP ${res.status}).`);
    }
    throw new Error(hint || 'Empty response from server');
  }

  if (trimmed.startsWith('<')) {
    throw new Error(
      hint ||
        `Invalid response (${res.status}): server returned HTML instead of JSON. Set NEXT_PUBLIC_API_URL to your API base (e.g. http://10.4.102.212:9000).`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(hint || `Invalid JSON from server (HTTP ${res.status})`);
  }
}

async function jsonWithFallback<T>(res: Response, fallback: T): Promise<T> {
  const data = await responseJsonSafe<T>(res);
  return data ?? fallback;
}

/** Parse response as JSON; if server returns HTML (e.g. 404 page), return a safe error object instead of throwing */
async function parseJsonResponse<T>(res: Response, fallback: T): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('<') || !trimmed.startsWith('{')) {
    return { ...fallback, success: false, message: 'Server returned invalid response. Check that the backend is running.' } as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ...fallback, success: false, message: 'Invalid JSON response' } as T;
  }
}

/** GET /api/sites/locations - สำหรับ dropdown Site (SLid, Sid, lid, SiteName, Location2, SOF) */
export async function getSitesLocation(): Promise<{
  success: boolean;
  data: { SLid: number; Sid: number; lid: number; SiteName: string; Location2: string; SOF?: string; Refer_SOF?: string }[];
}> {
  const res = await fetch(apiUrl('/api/sites/locations'));
  return jsonWithFallback(res, { success: false, data: [] });
}

/** PATCH /api/sites/locations/:slid/sof — อัปเดต SOF ที่ sites_location */
export async function updateSitesLocationSof(
  slid: number | string,
  sof: string
): Promise<{ success: boolean; data?: { SLid: number; SOF?: string; Refer_SOF?: string }; message?: string }> {
  const res = await fetch(apiUrl(`/api/sites/locations/${encodeURIComponent(String(slid))}/sof`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ SOF: sof }),
  });
  return res.json();
}

/** GET /api/sites/registry-counts — จำนวนแถวในตาราง sites และ sites_location */
export async function getSiteRegistryCounts(): Promise<{
  success: boolean;
  data?: { siteCount: number; locationCount: number };
  message?: string;
}> {
  const res = await fetch(apiUrl('/api/sites/registry-counts'));
  return res.json();
}

/** GET /api/sites/locations-with-contracts — dropdown Site สำหรับสร้างแพลน (draft + official) */
export async function getSitesLocationWithContracts(): Promise<{ success: boolean; data: { SLid: number; SiteName: string; Location2?: string }[] }> {
  const res = await fetch(apiUrl('/api/sites/locations-with-contracts'));
  return jsonWithFallback(res, { success: false, data: [] });
}

/** GET /api/devices/by-site?site_id= - Devices ตาม SLid */
export async function getDevicesBySite(siteId: number | string): Promise<{ success: boolean; data: { Did: number; CI_Name?: string; Asset_Number?: string }[] }> {
  const res = await fetch(apiUrl(`/api/devices/by-site?site_id=${encodeURIComponent(String(siteId))}`));
  return res.json();
}

/** GET /api/devices/import-location2-hints — SLid + Location2 on contract where sites_location.SOF matches SOF (import hints) */
export async function getImportLocation2HintsByContractAndSof(
  contractId: number,
  referSof: string
): Promise<{ success: boolean; data: { SLid: number; Location2: string }[] }> {
  const q = new URLSearchParams({
    contract_id: String(contractId),
    refer_sof: String(referSof).trim(),
  });
  const res = await fetch(apiUrl(`/api/devices/import-location2-hints?${q.toString()}`));
  return jsonWithFallback(res, { success: false, data: [] });
}

/** GET /api/devices/assigned-services - รายการ Assigned_Service (DISTINCT จาก devices สำหรับ Add Contract) */
export async function getAssignedServices(): Promise<{ success: boolean; data: string[] }> {
  const res = await fetch(apiUrl('/api/devices/assigned-services'));
  return parseJsonResponse(res, { success: false, data: [] });
}

/** POST /api/contracts/sync-from-refer-sof — สร้าง/อัปเดต contract จาก sites_location.SOF (รวม device ใหม่ของ SOF เดิม) */
export async function syncContractsFromReferSof(options?: {
  dry_run?: boolean;
  refer_sof?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{
  success: boolean;
  message?: string;
  data?: {
    created: number;
    linked: number;
    skipped: number;
    dry_run?: boolean;
    results: Array<{
      refer_sof: string;
      action: string;
      contract_id?: number;
      device_count?: number;
      reason?: string;
      error?: string;
    }>;
  };
}> {
  const res = await fetch(apiUrl('/api/contracts/sync-from-refer-sof'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options ?? {}),
  });
  return parseJsonResponse(res, { success: false });
}

/** GET /api/contracts?site_id=xxx - รายการ Contract ตาม site_id (ไม่ส่ง site_id = ดึงทั้งหมด) */
export async function getContractsBySite(siteId?: number | string | null): Promise<{
  success: boolean;
  data: { contract_id: number; contract_name?: string; start_date?: string; end_date?: string; site_id?: number; site_name?: string; sla_term?: string }[];
}> {
  const url = siteId ? apiUrl(`/api/contracts?site_id=${encodeURIComponent(String(siteId))}`) : apiUrl('/api/contracts');
  const res = await fetch(url);
  return jsonWithFallback(res, { success: false, data: [] });
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
  return jsonWithFallback(res, { success: false });
}

/** GET /api/contracts/:id/devices - Devices ที่ผูกกับ Contract (จาก contract_device). ส่ง site_id (= SLid) เพื่อกรองเฉพาะ site นั้น */
export async function getDevicesByContract(contractId: number | string, siteId?: number | string | null): Promise<{
  success: boolean;
  data: { Did: number; contract_id?: number; CI_Name?: string; Asset_Number?: string; serial?: string; Asset_State?: string; Sid?: number; SiteName?: string }[];
}> {
  const q = siteId != null && siteId !== '' ? `?site_id=${encodeURIComponent(String(siteId))}` : '';
  const res = await fetch(apiUrl(`/api/contracts/${encodeURIComponent(String(contractId))}/devices${q}`));
  return jsonWithFallback(res, { success: false, data: [] });
}

/** GET /api/contracts/statistics/vendor - Vendor Statistics จาก Devices ที่มี Contract */
export async function getVendorStatistics(): Promise<{
  success: boolean;
  data: { name: string; value: number; deviceCount: number; siteCount: number; total: number }[];
}> {
  const res = await fetch(apiUrl('/api/contracts/statistics/vendor'));
  return res.json();
}

/** GET /api/contracts/statistics/top-sites - Top sites ตาม device ใน contract_device (SLid) */
export async function getTopSitesByContractDevice(params?: { limit?: number }): Promise<{
  success: boolean;
  total_devices?: number;
  data?: Array<{
    rank: number;
    slid: number;
    site_name: string;
    location2: string;
    device_count: number;
    contract_count: number;
    contracts_expiring_soon: number;
    pct_of_total: number;
  }>;
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await fetch(apiUrl(`/api/contracts/statistics/top-sites${qs ? `?${qs}` : ''}`));
  return res.json();
}

/** GET /api/contracts/statistics/top-sites-heatmap — เมทริกซ์ site × contract (device ต่อเซลล์) */
export async function getTopSitesHeatmap(params?: {
  site_limit?: number;
  contract_limit?: number;
  /** YYYY-MM-DD — กรองสัญญาที่วันเริ่มสัญญา start_date ∈ [period_start, period_end_exclusive) */
  period_start?: string;
  period_end_exclusive?: string;
}): Promise<{
  success: boolean;
  sites?: Array<{
    slid: number;
    site_name: string;
    location2: string;
    total_devices: number;
    rank: number;
    contracts?: Array<{ contract_id: number; short_id: string; title: string; devices: number }>;
  }>;
  contracts?: Array<{ contract_id: number; short_id: string; title: string }>;
  matrix?: number[][];
  max_value?: number;
  period?: { period_start: string; period_end_exclusive: string };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.site_limit != null) q.set('site_limit', String(params.site_limit));
  if (params?.contract_limit != null) q.set('contract_limit', String(params.contract_limit));
  if (params?.period_start) q.set('period_start', params.period_start);
  if (params?.period_end_exclusive) q.set('period_end_exclusive', params.period_end_exclusive);
  const qs = q.toString();
  const res = await fetch(apiUrl(`/api/contracts/statistics/top-sites-heatmap${qs ? `?${qs}` : ''}`));
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

/** GET /api/device-roles - รายการ Role จากตาราง device_role (switch, router, server ฯลฯ) */
export async function getDeviceRoles(): Promise<{
  success: boolean;
  data?: { DeRoleid: number; name: string; slug?: string; color?: string; device_count?: number }[];
}> {
  const res = await fetch(apiUrl('/api/device-roles'));
  return parseJsonResponse(res, { success: false, data: [] });
}

/** GET /api/device-types - รายการ Model จากตาราง device_type */
export async function getDeviceTypes(): Promise<{
  success: boolean;
  data?: { Dtypeid: number; model: string; slug?: string; u_height?: number; Mid?: number; manufacturer_name?: string; device_count?: number }[];
}> {
  const res = await fetch(apiUrl('/api/device-types'));
  return parseJsonResponse(res, { success: false, data: [] });
}

/** GET /api/analytics/ma-dashboard - ข้อมูล MA Dashboard แบบละเอียด (รองรับ months หรือ year+month) */
export async function getMaDashboard(params?: {
  months?: number;
  year?: number;
  month?: number;
  endMonth?: number;
  roleId?: number;
  slId?: number;
}): Promise<{
  success: boolean;
  data?: {
    months: number;
    range: { start: string; endExclusive: string };
    availableFilters?: { roleIds: number[]; siteIds: number[] };
    summary: {
      totalMA: number;
      totalDone: number;
      totalInprocess: number;
      totalFailed: number;
      totalPassed: number;
      totalOverdue: number;
      totalPending: number;
      completionRate: number;
      failRate: number;
      topVendor: string;
      topVendorCount: number;
      topEquipment: string;
      topEquipmentCount: number;
      /** MA: top model by MA task count; PM: see failed_reports / pm_tasks */
      topEquipmentBasis?: 'ma_tasks' | 'failed_reports' | 'pm_tasks' | 'none';
    };
    monthlyMA: Array<{ month: string; monthKey: string; total: number; done: number; inprocess: number; reportFail: number; reportPass: number; overdue: number; pending: number }>;
    vendorRanking: Array<{ vendor: string; total: number; done: number; inprocess: number; reportFail: number; reportPass: number; overdue: number; pending: number; completionRate: number }>;
    siteRanking: Array<{ site: string; total: number; done: number; inprocess: number; reportFail: number; reportPass: number; overdue: number; pending: number; completionRate: number }>;
    equipmentRanking: Array<{
      deviceId: string;
      deviceName: string;
      model: string | null;
      serial: string | null;
      role?: string | null;
      vendor: string | null;
      site: string | null;
      total: number;
      done: number;
      inprocess: number;
      pending: number;
      reportFail: number;
      reportPass: number;
      /** PM model ranking: distinct device count for this model in range */
      deviceCount?: number;
    }>;
    topModelTrend?: {
      model: string | null;
      points: Array<{ model: string; month_start: string; total: number }>;
    };
    topModelTrendByRole?: Array<{
      roleId: number;
      roleName: string;
      model: string;
      points: Array<{ month_start: string; total: number }>;
    }>;
    vendorMonthly: Array<{ vendor: string; month: string; monthKey: string; total: number }>;
    vendorReportStats: Array<{ vendor: string; totalReports: number; passReports: number; failReports: number; passRate: number }>;
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.months != null) q.set('months', String(params.months));
  if (params?.year != null) q.set('year', String(params.year));
  if (params?.month != null) q.set('month', String(params.month));
  if (params?.endMonth != null) q.set('end_month', String(params.endMonth));
  if (params?.roleId != null) q.set('role_id', String(params.roleId));
  if (params?.slId != null) q.set('sl_id', String(params.slId));
  const query = q.toString();
  const url = query ? `/api/analytics/ma-dashboard?${query}` : '/api/analytics/ma-dashboard';
  const res = await fetch(apiUrl(url));
  return res.json();
}

/** GET /api/analytics/pm-dashboard - ข้อมูล PM Dashboard (โครงเดียวกับ MA, รองรับ year+month) */
export async function getPmDashboard(params?: { months?: number; year?: number; month?: number; endMonth?: number }): Promise<{
  success: boolean;
  data?: {
    months: number;
    range: { start: string; endExclusive: string };
    summary: {
      totalMA: number;
      totalDone: number;
      totalInprocess: number;
      totalFailed: number;
      totalPassed: number;
      totalOverdue: number;
      totalPending: number;
      completionRate: number;
      failRate: number;
      topVendor: string;
      topVendorCount: number;
      topEquipment: string;
      topEquipmentCount: number;
      /** failed_reports = top by report Fail; pm_tasks = fallback when no fails */
      topEquipmentBasis?: 'failed_reports' | 'pm_tasks' | 'none';
    };
    monthlyMA: Array<{ month: string; monthKey: string; total: number; done: number; inprocess: number; reportFail: number; reportPass: number; overdue: number; pending: number }>;
    vendorRanking: Array<{ vendor: string; total: number; done: number; inprocess: number; reportFail: number; reportPass: number; overdue: number; pending: number; completionRate: number }>;
    siteRanking: Array<{ site: string; total: number; done: number; inprocess: number; reportFail: number; reportPass: number; overdue: number; pending: number; completionRate: number }>;
    equipmentRanking: Array<{
      deviceId: string;
      deviceName: string;
      model: string | null;
      serial: string | null;
      role?: string | null;
      vendor: string | null;
      site: string | null;
      total: number;
      done: number;
      inprocess: number;
      pending: number;
      reportFail: number;
      reportPass: number;
      /** PM model ranking: distinct device count for this model in range */
      deviceCount?: number;
    }>;
    vendorMonthly: Array<{ vendor: string; month: string; monthKey: string; total: number }>;
    vendorReportStats: Array<{ vendor: string; totalReports: number; passReports: number; failReports: number; passRate: number }>;
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.months != null) q.set('months', String(params.months));
  if (params?.year != null) q.set('year', String(params.year));
  if (params?.month != null) q.set('month', String(params.month));
  if (params?.endMonth != null) q.set('end_month', String(params.endMonth));
  const res = await fetch(apiUrl(`/api/analytics/pm-dashboard?${q.toString()}`));
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
  const res = await apiFetch(apiUrl('/api/tasks'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
}

/** GET /api/tasks?month=&year= - ดึง Tasks สำหรับปฏิทิน */
export async function getTasks(params?: { month?: number; year?: number }): Promise<{
  success: boolean;
  data?: any[];
  count?: number;
  message?: string;
}> {
  const q = new URLSearchParams();
  if (params?.month != null) q.set('month', String(params.month));
  if (params?.year != null) q.set('year', String(params.year));
  const qs = q.toString();
  const res = await apiFetch(apiUrl(qs ? `/api/tasks?${qs}` : '/api/tasks'));
  return responseJsonOrThrow(
    res,
    'Cannot load tasks: invalid JSON or wrong API URL (check NEXT_PUBLIC_API_URL and that nginx upstream can reach Node on port 5000).'
  );
}

/** GET /api/tasks/overdue?task_type=MA|PM&sid=&lid= - ดึงงานเกินกำหนด (รองรับ filter Sid/lid) */
export async function getOverdueTasks(
  taskType: 'MA' | 'PM',
  filters?: { sid?: number | string | null; lid?: number | string | null }
): Promise<{ success: boolean; data?: any[]; count?: number }> {
  const q = new URLSearchParams();
  q.set('task_type', taskType);
  if (filters?.sid != null && filters.sid !== '') q.set('sid', String(filters.sid));
  if (filters?.lid != null && filters.lid !== '') q.set('lid', String(filters.lid));
  const res = await fetch(apiUrl(`/api/tasks/overdue?${q.toString()}`));
  return res.json();
}

/** GET /api/tasks/completed?task_type=MA|PM&sid=&lid= - งานที่เสร็จแล้ว (รองรับ filter Sid/lid) */
export async function getCompletedTasks(
  taskType: 'MA' | 'PM',
  filters?: { sid?: number | string | null; lid?: number | string | null }
): Promise<{ success: boolean; data?: any[]; count?: number }> {
  const q = new URLSearchParams();
  q.set('task_type', taskType);
  if (filters?.sid != null && filters.sid !== '') q.set('sid', String(filters.sid));
  if (filters?.lid != null && filters.lid !== '') q.set('lid', String(filters.lid));
  const res = await fetch(apiUrl(`/api/tasks/completed?${q.toString()}`));
  return res.json();
}

/** GET /api/tasks/inprocess?task_type=MA|PM&sid=&lid= - งานกำลังดำเนินการ (รองรับ filter Sid/lid) */
export async function getInprocessTasks(
  taskType: 'MA' | 'PM',
  filters?: { sid?: number | string | null; lid?: number | string | null }
): Promise<{ success: boolean; data?: any[]; count?: number }> {
  const q = new URLSearchParams();
  q.set('task_type', taskType);
  if (filters?.sid != null && filters.sid !== '') q.set('sid', String(filters.sid));
  if (filters?.lid != null && filters.lid !== '') q.set('lid', String(filters.lid));
  const res = await fetch(apiUrl(`/api/tasks/inprocess?${q.toString()}`));
  return res.json();
}

/** GET /api/tasks/pending?task_type=MA|PM&sid=&lid= - งาน pending (รองรับ filter Sid/lid) */
export async function getPendingTasks(
  taskType: 'MA' | 'PM',
  filters?: { sid?: number | string | null; lid?: number | string | null }
): Promise<{ success: boolean; data?: any[]; count?: number }> {
  const q = new URLSearchParams();
  q.set('task_type', taskType);
  if (filters?.sid != null && filters.sid !== '') q.set('sid', String(filters.sid));
  if (filters?.lid != null && filters.lid !== '') q.set('lid', String(filters.lid));
  const res = await fetch(apiUrl(`/api/tasks/pending?${q.toString()}`));
  return res.json();
}

/** GET /api/tasks/check-conflict - เช็คว่า engineer มีงานซ้อนทับหรือไม่ */
export async function checkEngineerConflict(params: {
  engineerId: string | number;
  startDate: string;
  endDate?: string;
  excludeTaskId?: string | number;
}): Promise<{
  success: boolean;
  hasConflict?: boolean;
  conflictingTask?: {
    id: number;
    siteName: string;
    startDate: string;
    endDate: string;
  } | null;
}> {
  const q = new URLSearchParams();
  q.set('engineerId', String(params.engineerId));
  q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  if (params.excludeTaskId) q.set('excludeTaskId', String(params.excludeTaskId));
  
  const res = await fetch(apiUrl(`/api/tasks/check-conflict?${q.toString()}`));
  return res.json();
}

/** GET /api/pm-reports/reported-task-ids - ดึง task_id ที่มี report แล้ว (จาก table report) */
export async function getPmReportedTaskIds(): Promise<{ success: boolean; taskIds?: number[] }> {
  const res = await fetch(apiUrl('/api/pm-reports/reported-task-ids'));
  return parseJsonResponse(res, { success: false, taskIds: [] });
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
  return parseJsonResponse(res, { success: false, data: [] });
}

/** DELETE /api/pm-reports/:id — id = report_id */
export async function deletePmReport(reportId: string | number): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(apiUrl(`/api/pm-reports/${encodeURIComponent(String(reportId))}`), {
    method: 'DELETE',
  });
  return parseJsonResponse(res, { success: false });
}

/** POST /api/pm-reports/upload - อัปโหลดไฟล์ Report */
export async function uploadReportFile(file: File): Promise<{ success: boolean; path?: string; name?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(apiUrl('/api/pm-reports/upload'), { method: 'POST', body: fd });
  return parseJsonResponse(res, { success: false });
}

/** POST /api/pm-reports - ส่ง PM Checklist Report */
export async function postPmReport(body: {
  taskId: number;
  deviceId: string;
  device?: object;
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
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
  return parseJsonResponse(res, { success: false });
}

/** GET /api/ma-reports/reported-task-ids - ดึง task_id ที่มี report แล้ว (จาก table report) */
export async function getMaReportedTaskIds(): Promise<{ success: boolean; taskIds?: number[] }> {
  const res = await fetch(apiUrl('/api/ma-reports/reported-task-ids'));
  return parseJsonResponse(res, { success: false, taskIds: [] });
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
    /** ชั่วโมงรวม — จาก tasks.downtime_total_hours */
    downtimeTotalHours?: number;
  }>;
  count?: number;
  total?: number;
}> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const res = await fetch(apiUrl(`/api/ma-reports?${q.toString()}`));
  return parseJsonResponse(res, { success: false, data: [] });
}

/** DELETE /api/ma-reports/:id — id = report_id */
export async function deleteMaReport(reportId: string | number): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(apiUrl(`/api/ma-reports/${encodeURIComponent(String(reportId))}`), {
    method: 'DELETE',
  });
  return parseJsonResponse(res, { success: false });
}

/** POST /api/ma-reports/upload - อัปโหลดไฟล์ Report */
export async function uploadMaReportFile(file: File): Promise<{ success: boolean; path?: string; name?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(apiUrl('/api/ma-reports/upload'), { method: 'POST', body: fd });
  return parseJsonResponse(res, { success: false });
}

/** POST /api/ma-reports - ส่ง MA Checklist Report (ใช้ maResult: 'pass' | 'fail') */
export async function postMaReport(body: {
  taskId: number;
  deviceId: string;
  device?: object;
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  sla_result?: number;
  maResult?: 'pass' | 'fail';
  comment?: string;
  technicianName?: string;
  maDate?: string;
  createdAt?: string;
  /** บันทึกลง tasks.uptime_date / uptime_time */
  uptimeDate?: string;
  uptimeTime?: string;
  /** ชื่อฟิลด์เก่า — backend ยังรับได้ */
  downTimeEndDate?: string;
  downTimeEndTime?: string;
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
  return parseJsonResponse(res, { success: false });
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

/** POST /api/employees/upload - อัปโหลดรูปพนักงาน */
export async function uploadEmployeePhoto(file: File): Promise<{ success: boolean; path?: string; message?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(apiUrl('/api/employees/upload'), { method: 'POST', body: fd });
  let data: { success?: boolean; path?: string; message?: string } = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    return {
      success: false,
      message: data.message || `Upload failed (${res.status})`,
    };
  }
  return { success: Boolean(data.success), path: data.path, message: data.message };
}

/** GET /api/employees - ดึงข้อมูล Employees จาก user_profiles */
export async function getEmployees(params?: { limit?: number; page?: number; search?: string }): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    gmail: string;
    tel: string;
    positionType: string;
    employmentType: string;
    photo?: string | null;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
  error?: string;
}> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  
  try {
    const res = await fetch(apiUrl(`/api/employees?${q.toString()}`));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: (data && (data.message || data.error)) || res.statusText || `HTTP ${res.status}`,
        error: data?.error || res.statusText,
      };
    }
    return data as { success: boolean; data?: typeof data.data; pagination?: typeof data.pagination; message?: string; error?: string };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch employees',
      error: 'Network error'
    };
  }
}

/** POST /api/employees - สร้าง Employee ใหม่ */
export async function createEmployee(body: {
  name: string;
  gmail: string;
  tel: string;
  positionType?: string;
  employmentType?: string;
  photo?: string | null;
}): Promise<{ success: boolean; data?: object; message?: string }> {
  const res = await fetch(apiUrl('/api/employees'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** PUT /api/employees/:id - แก้ไข Employee */
export async function updateEmployee(
  id: string,
  body: {
    name: string;
    gmail: string;
    tel: string;
    positionType?: string;
    employmentType?: string;
    photo?: string | null;
  }
): Promise<{ success: boolean; data?: object; message?: string }> {
  const res = await fetch(apiUrl(`/api/employees/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** DELETE /api/employees/:id - ลบ Employee */
export async function deleteEmployee(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(apiUrl(`/api/employees/${encodeURIComponent(id)}`), { method: 'DELETE' });
  return res.json();
}

/** POST /api/employees/import - Import หลายคน */
export async function importEmployees(employees: Array<{
  name: string;
  gmail: string;
  tel: string;
  positionType?: string;
  employmentType?: string;
}>): Promise<{ success: boolean; message?: string; data?: { created: number; failed: number; errors?: Array<{ row: number; message: string }> } }> {
  const res = await fetch(apiUrl('/api/employees/import'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employees }),
  });
  return res.json();
}

// --- Holidays (Express /api/holidays when NEXT_PUBLIC_API_URL is set; same as other APIs) ---

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
  source?: 'custom' | 'official';
}

/** GET /api/holidays - list holidays (backend API via apiUrl) */
export async function getHolidays(year?: number): Promise<{ success: boolean; data?: HolidayItem[] }> {
  const path =
    typeof year === 'number' ? `/api/holidays?year=${encodeURIComponent(String(year))}` : '/api/holidays';
  const res = await fetch(apiUrl(path));
  return parseJsonResponse(res, { success: false, data: [] });
}

/** POST /api/holidays - add holiday. Body: { date: "YYYY-MM-DD", name: string } */
export async function addHoliday(body: { date: string; name: string }): Promise<{
  success: boolean;
  message?: string;
  data?: HolidayItem;
}> {
  const res = await fetch('/api/holidays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** DELETE /api/holidays/[id] */
export async function deleteHoliday(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(apiUrl(`/api/holidays/${encodeURIComponent(id)}`), { method: 'DELETE' });
  return parseJsonResponse(res, { success: false, message: 'Invalid response' });
}

/** POST /api/holidays/restore-official - clear hidden official holiday overrides */
export async function restoreOfficialHolidays(): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(apiUrl('/api/holidays/restore-official'), { method: 'POST' });
  return parseJsonResponse(res, { success: false, message: 'Invalid response' });
}

/** POST /api/holidays/clear-custom - delete all custom holidays */
export async function clearCustomHolidays(): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(apiUrl('/api/holidays/clear-custom'), { method: 'POST' });
  return parseJsonResponse(res, { success: false, message: 'Invalid response' });
}
