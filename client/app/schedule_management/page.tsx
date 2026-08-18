'use client';

import { Suspense, useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  FileCheck,
  FileX2,
  FileSpreadsheet,
  Download,
  LayoutGrid,
  List,
  Users,
  Clock3,
  RotateCcw,
} from 'lucide-react';
import { EngineerAvatar } from '@/components/ui/EngineerAvatar';
import { AddTaskModal } from '@/components/ui/AddTaskModal';
import { TaskDetailModal } from '@/components/ui/detail';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { useAlertModal } from '@/components/ui/useAlertModal';
import { apiUrl, responseJsonSafe, responseJsonOrThrow, getSitesLocationWithContracts, getEmployees, getContractsBySite, getDevicesByContract, syncContractsFromReferSof, getImportLocation2HintsByContractAndSof, getPmReportedTaskIds, getMaReportedTaskIds, getHolidays, addHoliday, deleteHoliday, restoreOfficialHolidays, getTasks, type HolidayItem, apiFetch} from '@/lib/api';
import { mapEmployeesToEngineerRoster, engineerRosterLabel, rawEngineerIdFromTaskJson } from '@/lib/engineerRoster';
import { composeRescheduleNoteWithOrigin } from '@/lib/rescheduleNote';
import { getErrorMessage, asRecord, readNumber, readString } from '@/lib/unknownUtil';
import { type ApiTask, apiTaskString } from '@/lib/apiTask';
import { buildTaskSiteDisplayTitle, taskDetailSiteName } from '@/lib/taskDisplayTitle';
import * as XLSX from 'xlsx';


interface Device {
  id: string;
  name: string;
  type: string;
  serialNumber?: string;
  site?: string;
}

interface Engineer {
  id: string;
  name: string;
  lastName?: string;
  photo?: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  color: string;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
  engineer: string;
  // Extended fields for full task data
  taskType?: 'PM' | 'MA';
  contractId?: number;
  sofName?: string;
  replacementDeviceId?: number;
  Sid?: string;
  Sname?: string;
  siteDbName?: string;
  location?: string;
  province?: string;
  Eng_ids?: Engineer[];
  startDate?: string;
  endDate?: string;
  priority?: string;
  coverageScope?: string;
  assets?: Device[];
  vendorName?: string;
  vendorTel?: string;
  reporterName?: string;
  reporterTel?: string;
  reporterPosition?: string;
  reporterEmail?: string;
  ticket?: string;
  rootCause?: string;
  resolution?: string;
  slaTerm?: string;
  duration?: string;
  downtimeDate?: string;
  downtimeTime?: string;
  uptimeDate?: string;
  uptimeTime?: string;
  downtimeTotalHours?: number;
  assetBinding?: string;
  travelMethod?: string;
  travelCost?: string;
  actuallyWent?: boolean;
  photos?: string[];
  notes?: string;
  rescheduleNote?: string;
  status?: 'done' | 'working' | 'stuck' | 'not-started';
  /** MA — จาก tasks.assigned_service */
  assignedService?: string | null;
}

type ExcelCell = string | number | boolean | Date | null | undefined;
type ExcelRow = ExcelCell[];
type ExcelSheet = ExcelRow[];

type SiteLocationApiRow = {
  SLid?: number | string;
  SiteName?: string;
  Location2?: string;
  Location?: string;
  Sid?: number;
  sid?: number;
  lid?: number;
};

type ContractApiRow = {
  contract_id: number;
  sof_name?: string;
  contract_name?: string;
  site_id?: number | null;
  end_date?: string;
};

type ApiDeviceRow = Record<string, unknown> & {
  Did?: number;
  Refer_SOF?: unknown;
  CI_Name?: string;
  Dtypeid?: number;
  DeRoleid?: number;
  roleName?: string;
  model?: string;
  serial?: string;
  Asset_State?: string;
  Asset_Number?: string;
  manufacturername?: string;
  SLid?: number;
  Location2?: string;
};

type ImportedPmTask = {
  taskType: 'PM';
  Eng_ids?: Engineer[];
  _importEngineerRaw?: string;
  siteName?: string;
  location?: string;
  importSid?: number;
  importLid?: number;
  siteId?: string | number;
  Sid?: string;
  Sname?: string;
  siteSid?: number;
  siteLid?: number;
  title?: string;
  sofName?: string;
  contractId?: number;
  _contractEndDate?: string;
  startDate?: string;
  endDate?: string;
  coverageScope?: string;
  notes?: string;
  rescheduleNote?: string;
  devices?: ApiDeviceRow[];
  deviceIds?: number[];
  deviceCount?: number;
  SLid?: number;
  vendorName?: string;
  assetBinding?: string;
  _importSheetRow?: number;
  _importPreviewRow?: number;
  [key: string]: unknown;
};

type TaskSavePayload = Record<string, unknown>;
type TaskUpdateInput = Pick<CalendarEvent, 'id' | 'status'> & { notes?: string | null };

type ImportedAssetPayload = {
  id: number | undefined;
  name: string;
  Dtypeid: number | null;
  DeRoleid: number | null;
  type: string;
  serialNumber: string | null;
  site: string | null;
  assetState: string | null;
  assetNumber: string | null;
  source: 'site';
  SLid: number | null;
  role: string | null;
  manufacturer: string | null;
  model: string | null;
};

function minimalImportedAsset(did: number, siteLabel?: string | null): ImportedAssetPayload {
  return {
    id: did,
    name: `Device ${did}`,
    Dtypeid: null,
    DeRoleid: null,
    type: 'Device',
    serialNumber: null,
    site: siteLabel ?? null,
    assetState: null,
    assetNumber: null,
    source: 'site',
    SLid: null,
    role: null,
    manufacturer: null,
    model: null,
  };
}

function deviceRowToImportedAsset(
  device: ApiDeviceRow,
  siteLabel: string | null,
  slid: number | null
): ImportedAssetPayload {
  return {
    id: device.Did,
    name: device.CI_Name || (device.Did != null ? `Device ${device.Did}` : 'Device'),
    Dtypeid: device.Dtypeid ?? null,
    DeRoleid: device.DeRoleid ?? null,
    type: device.roleName || device.model || 'Device',
    serialNumber: device.serial ?? null,
    site: siteLabel,
    assetState: device.Asset_State ?? null,
    assetNumber: device.Asset_Number ?? null,
    source: 'site',
    SLid: slid,
    role: device.roleName ?? null,
    manufacturer: device.manufacturername ?? null,
    model: device.model ?? null,
  };
}

function apiDeviceJsonToImportedAsset(
  d: Record<string, unknown>,
  did: number,
  siteLabel: string | null,
  slid: number | null
): ImportedAssetPayload {
  return {
    id: readNumber(d, 'Did') ?? did,
    name: readString(d, 'CI_Name') || `Device ${did}`,
    Dtypeid: readNumber(d, 'Dtypeid') ?? null,
    DeRoleid: readNumber(d, 'DeRoleid') ?? null,
    type: readString(d, 'roleName') || readString(d, 'model') || 'Device',
    serialNumber: readString(d, 'serial') ?? null,
    site: siteLabel,
    assetState: readString(d, 'Asset_State') ?? null,
    assetNumber: readString(d, 'Asset_Number') ?? null,
    source: 'site',
    SLid: slid,
    role: readString(d, 'roleName') ?? null,
    manufacturer: readString(d, 'manufacturername') ?? null,
    model: readString(d, 'model') ?? null,
  };
}

/**
 * ใช้ตอน import Excel ก่อนเทียบกับ DB:
 * trim → lowercase → ลบช่องว่างทั้งหมด (รวมช่องว่างระหว่างคำ)
 * ตัดคำนำหน้า "อาคาร" หนึ่งครั้งถ้ามี (เช่น "อาคารแสงโสม พหลโย" → "แสงโสมพหลโย")
 */
function normalizeImportText(value: unknown): string {
  const collapsed = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (collapsed.startsWith('อาคาร')) {
    return collapsed.slice('อาคาร'.length);
  }
  return collapsed;
}

/** Site/Location in import: must match DB text exactly after trim; only letter case may differ. */
function importSiteLocTextEquals(a: unknown, b: unknown): boolean {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Uint32Array(n + 1);
  let cur = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[n];
}

/**
 * Similarity 0–1 after normalize: edit distance + length closeness.
 * Pick the DB row with the highest score; ties favor closer location length when location is used.
 */
function importFieldSimilarityScore(needle: string, db: string): number {
  if (!needle && !db) return 1;
  if (!needle || !db) return 0;
  if (needle === db) return 1;
  const maxLen = Math.max(needle.length, db.length);
  const dist = levenshteinDistance(needle, db);
  const editSim = 1 - dist / maxLen;
  const lenRatio = Math.min(needle.length, db.length) / maxLen;
  return 0.65 * editSim + 0.35 * lenRatio;
}

type ImportSiteRow = {
  id: string;
  name: string;
  location?: string | null;
  sid?: number | null;
  lid?: number | null;
};

/**
 * Legacy one-line errors (no values marker) still name Site / Location / SOF in prose — extract for the table column.
 */
function synthesizeFromYourFileLineFromErrorText(s: string): string | null {
  const pick = (re: RegExp) => {
    const m = re.exec(s);
    const v = m?.[1]?.trim();
    return v || null;
  };
  const site =
    pick(/\bSite\s+"([^"]+)"/i) ||
    pick(/\bSite\s+'([^']+)'/i) ||
    pick(/\bSite\s+\u201c([^\u201d]+)\u201d/i);
  const location =
    pick(/\bLocation\s+"([^"]+)"/i) ||
    pick(/\bLocation\s+'([^']+)'/i) ||
    pick(/\bLocation\s+\u201c([^\u201d]+)\u201d/i);
  const sof =
    pick(/\bSOF\s+"([^"]+)"/i) ||
    pick(/\bSOF\s+'([^']+)'/i) ||
    pick(/\bSOF\s+\u201c([^\u201d]+)\u201d/i);
  const engineer =
    pick(/\bEngineer\s+"([^"]+)"/i) ||
    pick(/\bEngineer\s+'([^']+)'/i) ||
    pick(/\bEngineer\s+\u201c([^\u201d]+)\u201d/i);
  const planStart =
    pick(/\bPlan start\s+"([^"]+)"/i) ||
    pick(/\bPlan start\s+'([^']+)'/i) ||
    pick(/\bPlan start\s+\u201c([^\u201d]+)\u201d/i);
  if (!site && !location && !sof && !engineer && !planStart) return null;
  const bits: string[] = [];
  if (site) bits.push(`Site "${site}"`);
  if (location) bits.push(`Location "${location}"`);
  if (sof) bits.push(`SOF "${sof}"`);
  if (engineer) bits.push(`Engineer "${engineer}"`);
  if (planStart) bits.push(`Plan start "${planStart}"`);
  return `${bits.join(', ')}.`;
}

/** Strip internal "From your file:" labels before showing the values column. */
function formatImportDetailColumn(detail: string): string {
  if (!detail.trim()) return '';
  return detail
    .replace(/^\s*From your file:\s*/i, '')
    .replace(/\n\s*From your file:\s*/gi, '\n')
    .trim();
}

function pickBestSiteRowForImport(
  options: ImportSiteRow[],
  fileSiteName: string,
  fileLocation: string
): {
  best: ImportSiteRow | undefined;
  bestCombined: number;
} {
  const siteT = String(fileSiteName ?? '').trim();
  const locT = String(fileLocation ?? '').trim();
  if (!siteT) return { best: undefined, bestCombined: -1 };

  const matches: ImportSiteRow[] = [];
  for (const s of options) {
    if (!importSiteLocTextEquals(siteT, s.name)) continue;
    if (locT) {
      if (!importSiteLocTextEquals(locT, s.location || '')) continue;
    }
    matches.push(s);
  }
  if (matches.length === 0) return { best: undefined, bestCombined: -1 };
  matches.sort((a, b) => Number(a.id) - Number(b.id));
  return { best: matches[0], bestCombined: 1 };
}

/** จับคู่ SOF กับสัญญา: เลขล้วนใช้ pad 4 หลัก; ไม่ใช่เลขใช้ normalizeImportText */
function normalizeImportSofKey(sof: string): string {
  const t = String(sof).trim();
  if (/^\d+$/.test(t)) return t.padStart(4, '0').toLowerCase();
  return normalizeImportText(t);
}

const IN_PROCESS_REASON_DISPLAY_MAX = 120;

function getScheduleInProcessReason(ev: Pick<CalendarEvent, 'notes' | 'rootCause'>): string {
  const notes = String(ev.notes ?? '')
    .trim()
    .slice(0, IN_PROCESS_REASON_DISPLAY_MAX);
  const root = String(ev.rootCause ?? '').trim();
  if (notes && root) return `${notes} (${root})`;
  if (notes) return notes;
  if (root) return root;
  return 'ยังไม่ระบุเหตุผลในโน้ตงาน';
}

function scheduleInProcessTitleText(ev: CalendarEvent): string {
  const base = ev.title || '(No title)';
  if (ev.status !== 'working') return base;
  const reason = getScheduleInProcessReason(ev);
  const short = reason.length > 44 ? `${reason.slice(0, 41)}…` : reason;
  return `${base} · ${short}`;
}

import { RequireAdmin } from '@/components/auth/RequireAdmin';

export default function ScheduleManagement() {
  return (
    <RequireAdmin>
      <Suspense fallback={null}>
        <ScheduleManagementContent />
      </Suspense>
    </RequireAdmin>
  );
}

/** Site label for table filter — matches Task column (Province - location). */
function tableTaskSiteLabel(
  ev: Pick<CalendarEvent, 'title' | 'Sname' | 'location' | 'province' | 'taskType' | 'vendorName'>,
): string {
  return (
    buildTaskSiteDisplayTitle({
      taskType: ev.taskType,
      province: ev.province,
      location: ev.location,
      siteName: ev.Sname,
      vendorName: ev.vendorName,
    }) || (ev.title || '').trim() || '—'
  );
}

const TABLE_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseTableTaskStartEnd(ev: Pick<CalendarEvent, 'startDate' | 'endDate'>) {
  const start = ev.startDate ? new Date(ev.startDate) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const endRaw = ev.endDate ? new Date(ev.endDate) : start;
  const end = endRaw && !Number.isNaN(endRaw.getTime()) ? endRaw : start;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function tableTaskSofLabel(
  ev: Pick<CalendarEvent, 'sofName' | 'contractId'>,
  contracts: Array<{ contract_id: number; sof_name: string }> = []
): string {
  if (ev.sofName && String(ev.sofName).trim()) return String(ev.sofName).trim();
  if (ev.contractId) {
    const c = contracts.find((x) => x.contract_id === ev.contractId);
    if (c?.sof_name && String(c.sof_name).trim()) return String(c.sof_name).trim();
  }
  return '';
}

function taskMatchesTableDateFilter(
  ev: Pick<CalendarEvent, 'startDate' | 'endDate'>,
  year: string,
  month: string
): boolean {
  const range = parseTableTaskStartEnd(ev);
  if (!range) return false;
  const { start, end } = range;

  const y = year ? parseInt(year, 10) : null;
  const m = month ? parseInt(month, 10) - 1 : null;

  if (y != null && !Number.isNaN(y)) {
    const ys = new Date(y, 0, 1);
    const ye = new Date(y, 11, 31, 23, 59, 59, 999);
    if (end < ys || start > ye) return false;
  }

  if (m != null && !Number.isNaN(m)) {
    if (y != null && !Number.isNaN(y)) {
      const ms = new Date(y, m, 1);
      const me = new Date(y, m + 1, 0, 23, 59, 59, 999);
      if (end < ms || start > me) return false;
    } else {
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      let found = false;
      while (cur <= endMonth) {
        if (cur.getMonth() === m) {
          found = true;
          break;
        }
        cur.setMonth(cur.getMonth() + 1);
      }
      if (!found) return false;
    }
  }

  return true;
}

function ScheduleManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const draggedEventRef = useRef<CalendarEvent | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [, setDragStartDay] = useState<number | null>(null);
  const [isDragOverTrash, setIsDragOverTrash] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarEvent | null>(null);
  const [, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const { showConfirm, alertModal } = useAlertModal();
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveReason, setMoveReason] = useState('');
  const [pendingMove, setPendingMove] = useState<{
    event: CalendarEvent;
    newDay: number;
    newStartDate: string;
    newEndDate: string;
    previousStartDate: string;
    previousEndDate: string;
  } | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  
  /* ===== Excel/CSV Import ===== */
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedTasks, setImportedTasks] = useState<ImportedPmTask[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  /** After file upload: switch between ready-to-import rows vs validation issues */
  const [importResultTab, setImportResultTab] = useState<'ready' | 'issues'>('ready');
  const [isImporting, setIsImporting] = useState(false);
  const [siteOptions, setSiteOptions] = useState<Array<{
    id: string; // SLid — คีย์แถว sites_location (Site+Location2 ใน Excel ใช้จับคู่มาที่นี่)
    name: string; // SiteName (sites + Sid)
    label: string;
    location: string; // Location2 (location + lid)
    sid?: number;
    lid?: number;
  }>>([]);

  // Force initial view mode via query param: /schedule_management?view=table|calendar
  useEffect(() => {
    const v = (searchParams?.get('view') || '').trim().toLowerCase();
    if (v === 'table') setCalendarViewMode('table');
    if (v === 'calendar') setCalendarViewMode('calendar');
  }, [searchParams]);

  // Deep link from dashboard: /schedule_management?task=<id>
  useEffect(() => {
    const taskId = (searchParams?.get('task') || '').trim();
    if (!taskId) return;

    const ev = calendarEvents.find((e) => String(e.id) === taskId);
    if (!ev) return;

    // Jump calendar to the task's month/year
    if (ev.year && ev.month) {
      const target = new Date(ev.year, Math.max(0, Number(ev.month) - 1), 1);
      if (!Number.isNaN(target.getTime())) {
        const curY = currentDate.getFullYear();
        const curM = currentDate.getMonth();
        if (curY !== target.getFullYear() || curM !== target.getMonth()) {
          setCurrentDate(target);
        }
      }
    }

    // Open detail and highlight
    setSelectedTask(ev);
    setIsDetailModalOpen(true);
    setHighlightTaskId(String(ev.id));

    // Scroll into view after DOM paints
    const to = window.setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${CSS.escape(String(ev.id))}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 150);

    const clear = window.setTimeout(() => setHighlightTaskId(null), 2500);
    return () => {
      window.clearTimeout(to);
      window.clearTimeout(clear);
    };
  }, [searchParams, calendarEvents, currentDate]);
  const [availableEngineers, setAvailableEngineers] = useState<Engineer[]>([]);
  const [availableContracts, setAvailableContracts] = useState<Array<{contract_id: number; sof_name: string; contract_name?: string; site_id?: number; end_date?: string}>>([]);
  const [selectedEngineerFilter, setSelectedEngineerFilter] = useState<string[]>([]);
  const [engineerFilterInput, setEngineerFilterInput] = useState('');
  const [showEngineerFilterDropdown, setShowEngineerFilterDropdown] = useState(false);
  const engineerFilterRef = useRef<HTMLDivElement>(null);
  const [selectedTaskTypeFilter, setSelectedTaskTypeFilter] = useState<'all' | 'PM' | 'MA'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'done' | 'in-progress' | 'pending' | 'overdue'>('all');
  const [reportedPMTaskIds, setReportedPMTaskIds] = useState<Set<number>>(new Set());
  const [reportedMATaskIds, setReportedMATaskIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [importingHolidays, setImportingHolidays] = useState(false);
  const [restoringOfficialHolidays, setRestoringOfficialHolidays] = useState(false);
  const [hidingOfficialHolidays, setHidingOfficialHolidays] = useState(false);
  const holidayFileInputRef = useRef<HTMLInputElement>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'calendar' | 'table'>('calendar');
  const TABLE_PAGE_SIZE = 15;
  const [tablePage, setTablePage] = useState(1);
  /** วันที่ยืดดู task เกิน 2 รายการ (key = YYYY-M-D) */
  const [expandedDayKeys, setExpandedDayKeys] = useState<Set<string>>(() => new Set());
  const MAX_VISIBLE_DAY_PILLS = 2;
  const [tableFilterYear, setTableFilterYear] = useState(() => String(new Date().getFullYear()));
  const [tableFilterMonth, setTableFilterMonth] = useState(() => String(new Date().getMonth() + 1));
  const [tableFilterSof, setTableFilterSof] = useState('');
  const [tableFilterSite, setTableFilterSite] = useState('');
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const mapTaskToEvent = useCallback((task: ApiTask): CalendarEvent => {
    const start = apiTaskString(task, 'startDate', 'start_date') || new Date().toISOString().split('T')[0];
    const end = apiTaskString(task, 'endDate', 'end_date') || start;
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    const engineers = (Array.isArray(task.engineers) ? task.engineers : task.Eng_ids) || [];
    const engineerNames =
      Array.isArray(engineers) && engineers.length > 0
        ? engineers
            .map((e) => {
              const eng = e as Engineer;
              return (eng.name || eng.id) + (eng.lastName ? ' ' + eng.lastName : '');
            })
            .join(', ')
        : 'Unassigned';
    const taskType = (apiTaskString(task, 'taskType', 'task_type') || 'PM') as 'PM' | 'MA';
    const siteName = apiTaskString(task, 'siteName', 'site_name') || readString(task, 'Sname') || '';
    const location = readString(task, 'location') ?? readString(task, 'Location2') ?? '';
    const province = readString(task, 'province') ?? readString(task, 'Province') ?? '';
    const siteDbName = readString(task, 'siteDbName') ?? '';
    const title = buildTaskSiteDisplayTitle({
      taskType,
      province,
      location,
      siteName,
      vendorName: apiTaskString(task, 'vendorName', 'vendor_name'),
    });
    const sofNameRaw = readString(task, 'sofName') ?? readString(task, 'sof_name');

    return {
      id: String(task.id ?? task.taskId ?? task.task_id ?? Date.now()),
      title,
      time: readString(task, 'time') || '09:00',
      color:
        task.priority === 'High'
          ? 'border-red-500'
          : task.priority === 'Medium'
            ? 'border-purple-400'
            : 'border-blue-500',
      startDay: startDateObj.getDate(),
      endDay: endDateObj.getDate(),
      month: startDateObj.getMonth(),
      year: startDateObj.getFullYear(),
      engineer: engineerNames,
      taskType,
      contractId: readNumber(task, 'contractId') ?? readNumber(task, 'contract_id'),
      ...(sofNameRaw && String(sofNameRaw).trim() ? { sofName: String(sofNameRaw).trim() } : {}),
      replacementDeviceId:
        readNumber(task, 'replacementDeviceId') ?? readNumber(task, 'replacement_device_id'),
      Sid: task.siteId ? String(task.siteId) : readString(task, 'Sid'),
      Sname: siteName,
      siteDbName: siteDbName || undefined,
      location,
      province: province || undefined,
      Eng_ids: engineers as Engineer[],
      startDate: start,
      endDate: end,
      ...(readString(task, 'priority') ? { priority: readString(task, 'priority') } : {}),
      coverageScope: readString(task, 'coverageScope'),
      assets: (Array.isArray(task.assets) ? task.assets : []) as Device[],
      vendorName: apiTaskString(task, 'vendorName', 'vendor_name'),
      vendorTel: apiTaskString(task, 'vendorTel', 'vendor_tel'),
      reporterName: apiTaskString(task, 'reporterName', 'reporter_name'),
      reporterTel: apiTaskString(task, 'reporterTel', 'reporter_tel'),
      reporterPosition: apiTaskString(task, 'reporterPosition', 'reporter_position'),
      reporterEmail: apiTaskString(task, 'reporterEmail', 'reporter_email'),
      ticket: readString(task, 'ticket'),
      rootCause: apiTaskString(task, 'rootCause', 'root_cause'),
      resolution: readString(task, 'resolution'),
      ...((apiTaskString(task, 'slaTerm', 'sla_term')
        ? { slaTerm: apiTaskString(task, 'slaTerm', 'sla_term') }
        : {}) as { slaTerm?: string }),
      duration: readString(task, 'duration'),
      downtimeDate:
        apiTaskString(task, 'downtimeDate', 'downTimeStartDate') ??
        readString(task, 'down_time_start_date'),
      downtimeTime:
        apiTaskString(task, 'downtimeTime', 'downTimeStartTime') ??
        readString(task, 'down_time_start_time'),
      uptimeDate:
        apiTaskString(task, 'uptimeDate', 'downTimeEndDate') ?? readString(task, 'down_time_end_date'),
      uptimeTime:
        apiTaskString(task, 'uptimeTime', 'downTimeEndTime') ?? readString(task, 'down_time_end_time'),
      downtimeTotalHours:
        readNumber(task, 'downtimeTotalHours') ?? readNumber(task, 'down_time_total_hours'),
      assignedService:
        (readString(task, 'assignedService') ?? readString(task, 'assigned_service')) || null,
      assetBinding: apiTaskString(task, 'assetBinding', 'asset_binding'),
      travelMethod: apiTaskString(task, 'travelMethod', 'travel_method'),
      travelCost: readString(task, 'travelCost'),
      status: (readString(task, 'status') || 'not-started') as CalendarEvent['status'],
      actuallyWent: Boolean(task.actuallyWent ?? task.actually_went ?? false),
      photos: (Array.isArray(task.photos) ? task.photos : []) as string[],
      notes: readString(task, 'notes') || '',
      rescheduleNote: apiTaskString(task, 'rescheduleNote', 'reschedule_note') || '',
    };
  }, []);

  const loadTasksFromApi = useCallback(async (month?: number, year?: number) => {
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    setIsLoading(true);
    setLoadError(null);
    try {
      const monthsToLoad: Array<{ month: number; year: number }> = [
        { month: targetMonth, year: targetYear },
      ];
      // โหลดเดือนก่อน/หลังด้วย เพื่องานที่คร่อมเดือนโชว์บนปฏิทินได้
      const prev =
        targetMonth === 1
          ? { month: 12, year: targetYear - 1 }
          : { month: targetMonth - 1, year: targetYear };
      const next =
        targetMonth === 12
          ? { month: 1, year: targetYear + 1 }
          : { month: targetMonth + 1, year: targetYear };
      monthsToLoad.push(prev, next);

      const responses = await Promise.all(
        monthsToLoad.map((m) => getTasks({ month: m.month, year: m.year }))
      );
      const byId = new Map<string, CalendarEvent>();
      for (const json of responses) {
        if (!json.success) throw new Error(json.message || 'Cannot load tasks');
        const rows = Array.isArray(json.data) ? (json.data as ApiTask[]) : [];
        for (const row of rows) {
          const ev = mapTaskToEvent(row);
          byId.set(String(ev.id), ev);
        }
      }
      setCalendarEvents(Array.from(byId.values()));
    } catch (error: unknown) {
      console.error('loadTasksFromApi error', error);
      setLoadError(getErrorMessage(error) || 'Cannot load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [mapTaskToEvent, currentDate]);

  const loadReportedTaskIds = useCallback(async () => {
    try {
      const [pmRes, maRes] = await Promise.all([
        getPmReportedTaskIds(),
        getMaReportedTaskIds(),
      ]);
      if (pmRes.success && Array.isArray(pmRes.taskIds)) {
        setReportedPMTaskIds(new Set(pmRes.taskIds));
      }
      if (maRes.success && Array.isArray(maRes.taskIds)) {
        setReportedMATaskIds(new Set(maRes.taskIds));
      }
    } catch (e: unknown) {
      console.error('loadReportedTaskIds error', e);
    }
  }, []);

  const loadHolidays = useCallback(async (year: number) => {
    const res = await getHolidays(year);
    if (res.success && res.data) setHolidays(res.data);
  }, []);

  const normalizeHolidayImportDate = (value: unknown): string | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed?.y && parsed?.m && parsed?.d) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    }

    const slash = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (slash) {
      const a = Number(slash[1]);
      const b = Number(slash[2]);
      const year = slash[3];
      const day = a > 12 ? a : b;
      const month = a > 12 ? b : a;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const parsedDate = new Date(raw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
    }
    return null;
  };

  const handleHolidayImportFile = async (file: File) => {
    try {
      setImportingHolidays(true);
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const rows: ExcelSheet = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = event.target?.result;
            if (!result) throw new Error('Empty file');
            let workbook: XLSX.WorkBook;
            if (ext === 'csv') {
              workbook = XLSX.read(String(result), { type: 'string' });
            } else {
              workbook = XLSX.read(result, { type: 'array', cellDates: true });
            }
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as ExcelSheet;
            resolve(data);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error);
        if (ext === 'csv') reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
      });

      if (!rows.length) {
        toastError('File is empty');
        return;
      }

      const header = (rows[0] || []).map((h) => String(h || '').trim().toLowerCase());
      const dateIdx = header.findIndex((h: string) => ['date', 'holiday_date', 'day'].includes(h));
      const nameIdx = header.findIndex((h: string) => ['name', 'holiday_name', 'title'].includes(h));
      const startIdx = dateIdx >= 0 ? dateIdx : 0;
      const startRow = dateIdx >= 0 || nameIdx >= 0 ? 1 : 0;
      const resolvedNameIdx = nameIdx >= 0 ? nameIdx : 1;

      const customDateSet = new Set(
        holidays.filter((h) => h.source === 'custom').map((h) => h.date)
      );
      const pending = new Map<string, string>();
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i] || [];
        const date = normalizeHolidayImportDate(row[startIdx]);
        const name = String(row[resolvedNameIdx] || '').trim();
        if (!date || !name) continue;
        if (customDateSet.has(date)) continue;
        pending.set(date, name);
      }

      if (pending.size === 0) {
        toastError('No valid holidays to import');
        return;
      }

      let successCount = 0;
      for (const [date, name] of pending) {
        const res = await addHoliday({ date, name });
        if (res.success) successCount += 1;
      }

      await loadHolidays(currentYear);
      if (successCount === pending.size) toastSuccess(`Imported ${successCount} holidays`);
      else toastError(`Imported ${successCount}/${pending.size} holidays`);
    } catch (error: unknown) {
      toastError(`Failed to import holidays: ${getErrorMessage(error) || 'Unknown error'}`);
    } finally {
      setImportingHolidays(false);
      if (holidayFileInputRef.current) holidayFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    void loadTasksFromApi();
  }, [loadTasksFromApi]);

  useEffect(() => {
    void loadReportedTaskIds();
    // Load sites and engineers for Excel import (once on mount)
    const loadSitesAndEngineers = async () => {
      try {
        // ใช้ endpoint ที่กรองเฉพาะ sites ที่มี contract
        const result = await getSitesLocationWithContracts();
        if (result.success) {
          const sites = (result.data || []).map((item: SiteLocationApiRow) => ({
            id: String(item.SLid), // SLid from sites_location table
            name: item.SiteName || 'Site',
            location: item.Location2 || '',
            label: `${item.SiteName || 'Site'}${item.Location2 ? ` - ${item.Location2}` : ''}`,
            sid: item.Sid || item.sid, // Sid from sites table
            lid: item.lid, // lid from location table
          }));
          console.log('Loaded site options:', sites.length, 'sites');
          setSiteOptions(sites);
        }
        
        const employeesResult = await getEmployees({ limit: 2000 });
        if (employeesResult.success && employeesResult.data) {
          setAvailableEngineers(mapEmployeesToEngineerRoster(employeesResult.data) as Engineer[]);
        }

        // Load contracts for sof_name → contract_id lookup
        const contractsResult = await getContractsBySite(undefined, { lite: true });
        if (contractsResult.success && contractsResult.data) {
          setAvailableContracts(contractsResult.data.map((c: ContractApiRow) => ({
            contract_id: c.contract_id,
            sof_name: c.sof_name || '',
            contract_name: c.contract_name || '',
            site_id: c.site_id ?? undefined,
            end_date: c.end_date || undefined,
          })));
        }

        // Sync Refer_SOF เบื้องหลังหลังโหลดเสร็จ (ไม่บล็อกเปิดหน้า)
        setTimeout(() => {
          void (async () => {
            try {
              const syncResult = await syncContractsFromReferSof();
              if (!syncResult.success || !syncResult.data) return;
              const { created = 0, linked = 0 } = syncResult.data;
              if (created === 0 && linked === 0) return;
              const refreshed = await getContractsBySite(undefined, { lite: true });
              if (refreshed.success && refreshed.data) {
                setAvailableContracts(refreshed.data.map((c: ContractApiRow) => ({
                  contract_id: c.contract_id,
                  sof_name: c.sof_name || '',
                  contract_name: c.contract_name || '',
                  site_id: c.site_id ?? undefined,
                  end_date: c.end_date || undefined,
                })));
              }
            } catch (syncErr) {
              console.warn('Refer_SOF contract sync skipped:', syncErr);
            }
          })();
        }, 1500);
      } catch (error) {
        console.error('Error loading sites/engineers/contracts:', error);
      }
    };
    
    void loadSitesAndEngineers();
  }, [loadReportedTaskIds]);

  /* ================= Calendar ================= */
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    setTableFilterYear(String(currentYear));
    setTableFilterMonth(String(currentMonth + 1));
    setTablePage(1);
    setTableSelectedIds(new Set());
  }, [currentYear, currentMonth]);

  useEffect(() => {
    void loadHolidays(currentYear);
  }, [currentYear, loadHolidays]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const getHolidayForDay = (day: number | null): HolidayItem | null => {
    if (day === null) return null;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.find(h => h.date === dateStr) ?? null;
  };

  const calendarWeeks = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1);
    const last = new Date(currentYear, currentMonth + 1, 0);
    // Sunday = 0, Monday = 1, ..., Saturday = 6
    const start = first.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < start; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [currentMonth, currentYear]);

  const goToPreviousMonth = () => {
    setExpandedDayKeys(new Set());
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setExpandedDayKeys(new Set());
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const dayExpandKey = (day: number) => `${currentYear}-${currentMonth}-${day}`;

  const toggleDayExpanded = (day: number) => {
    const key = dayExpandKey(day);
    setExpandedDayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Format date for display (YYYY-MM-DD format, no time) — ใช้ local date เพื่อไม่ให้ timezone เลื่อนวัน
  const formatDateForDisplay = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
      // If already in YYYY-MM-DD format (no time), return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      // Parse as Date and use local date (getFullYear/getMonth/getDate) so timezone doesn't shift the day
      const dateObj = new Date(dateString);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  // แสดงทุก task เหมือนเดิม (รวม task ที่ done และทำ report แล้ว)
  // Enrich events with engineer profile photos from availableEngineers
  const enrichedCalendarEvents = useMemo(() => {
    return calendarEvents.map((event) => ({
      ...event,
      Eng_ids:
        event.Eng_ids?.map((eng) => {
          const id = rawEngineerIdFromTaskJson(eng);
          const photo =
            id ? availableEngineers.find((a) => String(a.id) === id)?.photo ?? null : null;
          return { ...eng, ...(id ? { id } : {}), photo };
        }) ?? [],
    }));
  }, [calendarEvents, availableEngineers]);

  const calendarEventsWithoutDoneReported = useMemo(() => {
    return enrichedCalendarEvents;
  }, [enrichedCalendarEvents]);

  // Filter events by engineer(s), task type (PM/MA), and status (Done / Not done)
  const filteredCalendarEvents = useMemo(() => {
    let list = calendarEventsWithoutDoneReported;
    if (selectedEngineerFilter.length > 0) {
      const selectedIds = new Set(selectedEngineerFilter.map(id => String(id)));
      list = list.filter(e => {
        const eventEngIds = e.Eng_ids?.map((eng: Engineer) => String(eng.id)) || [];
        return selectedIds.size > 0 && [...selectedIds].every(id => eventEngIds.includes(id));
      });
    }
    if (selectedTaskTypeFilter !== 'all') {
      list = list.filter(e => (e.taskType || 'PM') === selectedTaskTypeFilter);
    }
    if (selectedStatusFilter !== 'all') {
      if (selectedStatusFilter === 'done') list = list.filter(e => e.status === 'done');
      else if (selectedStatusFilter === 'in-progress') list = list.filter(e => e.status === 'working');
      else if (selectedStatusFilter === 'pending') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        list = list.filter((e) => {
          const status = e.status;
          const isPendingStatus = status === 'not-started' || status === 'stuck';
          if (!isPendingStatus) return false;
          const endDateStr = e.endDate || e.startDate || '';
          if (!endDateStr) return true; // no date -> keep in pending
          const endDate = new Date(endDateStr);
          if (Number.isNaN(endDate.getTime())) return true; // unparseable -> keep in pending
          endDate.setHours(0, 0, 0, 0);
          const isOverdue = endDate < today;
          return !isOverdue;
        });
      }
      else if (selectedStatusFilter === 'overdue') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        list = list.filter((e) => {
          if (e.status === 'done') return false;
          const endDateStr = e.endDate || e.startDate || '';
          if (!endDateStr) return false;
          const endDate = new Date(endDateStr);
          if (Number.isNaN(endDate.getTime())) return false;
          endDate.setHours(0, 0, 0, 0);
          return endDate < today;
        });
      }
    }
    return list;
  }, [calendarEventsWithoutDoneReported, selectedEngineerFilter, selectedTaskTypeFilter, selectedStatusFilter]);

  // Tasks in current month for table view (events that overlap current month)
  const tasksInCurrentMonth = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1);
    const last = new Date(currentYear, currentMonth + 1, 0);
    first.setHours(0, 0, 0, 0);
    last.setHours(23, 59, 59, 999);
    return filteredCalendarEvents.filter(e => {
      const start = e.startDate ? new Date(e.startDate) : new Date(currentYear, currentMonth, e.startDay);
      const end = e.endDate ? new Date(e.endDate) : new Date(currentYear, currentMonth, e.endDay);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return start <= last && end >= first;
    }).sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
  }, [filteredCalendarEvents, currentYear, currentMonth]);

  const tableFilterYearOptions = useMemo(() => {
    const years = new Set<number>();
    for (const ev of filteredCalendarEvents) {
      const range = parseTableTaskStartEnd(ev);
      if (!range) continue;
      years.add(range.start.getFullYear());
      years.add(range.end.getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [filteredCalendarEvents]);

  const tableFilterSofOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const ev of filteredCalendarEvents) {
      const sof = tableTaskSofLabel(ev, availableContracts);
      if (sof) labels.add(sof);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [filteredCalendarEvents, availableContracts]);

  const tableFilterSiteOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const ev of filteredCalendarEvents) {
      const label = tableTaskSiteLabel(ev);
      if (label && label !== '—') labels.add(label);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [filteredCalendarEvents]);

  const tableTasksFiltered = useMemo(() => {
    return filteredCalendarEvents
      .filter((ev) => {
        if (!taskMatchesTableDateFilter(ev, tableFilterYear, tableFilterMonth)) {
          return false;
        }
        if (tableFilterSite && tableTaskSiteLabel(ev) !== tableFilterSite) return false;
        if (tableFilterSof && tableTaskSofLabel(ev, availableContracts) !== tableFilterSof) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0;
        const db = b.startDate ? new Date(b.startDate).getTime() : 0;
        return da - db;
      });
  }, [
    filteredCalendarEvents,
    availableContracts,
    tableFilterYear,
    tableFilterMonth,
    tableFilterSof,
    tableFilterSite,
  ]);

  const resetTableBulkFilters = () => {
    setTableFilterYear(String(currentYear));
    setTableFilterMonth(String(currentMonth + 1));
    setTableFilterSof('');
    setTableFilterSite('');
    setTablePage(1);
    setTableSelectedIds(new Set());
  };

  const tableSelectClass =
    'px-3 py-2 rounded-xl border-0 bg-card text-sm font-medium text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm transition-colors';

  const tableBulkFiltersActive = Boolean(
    tableFilterSof ||
      tableFilterSite ||
      tableFilterYear !== String(currentYear) ||
      tableFilterMonth !== String(currentMonth + 1)
  );

  const totalTablePages = Math.max(1, Math.ceil(tableTasksFiltered.length / TABLE_PAGE_SIZE));
  const paginatedTableTasks = useMemo(
    () => tableTasksFiltered.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [tableTasksFiltered, tablePage]
  );

  const tablePageAllSelected =
    paginatedTableTasks.length > 0 &&
    paginatedTableTasks.every((ev) => tableSelectedIds.has(String(ev.id)));

  useEffect(() => {
    setTablePage((p) => (p > totalTablePages ? totalTablePages : p < 1 ? 1 : p));
  }, [totalTablePages]);

  useEffect(() => {
    setTablePage(1);
  }, [
    tableFilterYear,
    tableFilterMonth,
    tableFilterSof,
    tableFilterSite,
    selectedTaskTypeFilter,
    selectedStatusFilter,
    selectedEngineerFilter,
  ]);

  useEffect(() => {
    setTableSelectedIds((prev) => {
      const visible = new Set(tableTasksFiltered.map((ev) => String(ev.id)));
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [tableTasksFiltered]);

  const filteredEngineersForFilter = availableEngineers.filter((eng) => {
    const q = engineerFilterInput.toLowerCase();
    return (
      !selectedEngineerFilter.includes(String(eng.id)) &&
      (String(eng.name || '')
        .toLowerCase()
        .includes(q) ||
        String(eng.lastName || '')
          .toLowerCase()
          .includes(q) ||
        engineerRosterLabel(eng).toLowerCase().includes(q) ||
        String(eng.id)
          .toLowerCase()
          .includes(q))
    );
  });
  const addEngineerFilter = (eng: Engineer) => {
    if (!selectedEngineerFilter.includes(String(eng.id))) {
      setSelectedEngineerFilter([...selectedEngineerFilter, String(eng.id)]);
      setEngineerFilterInput('');
      setShowEngineerFilterDropdown(false);
    }
  };
  const removeEngineerFilter = (id: string) => {
    setSelectedEngineerFilter(selectedEngineerFilter.filter(x => x !== id));
  };

  const isMultiDayEvent = (e: CalendarEvent): boolean => {
    if (!e.startDate || !e.endDate) return false;
    const eventStart = new Date(e.startDate);
    const eventEnd = new Date(e.endDate);
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(0, 0, 0, 0);
    const startDay = eventStart.getDate();
    const endDay = eventEnd.getDate();
    if (eventStart.getMonth() !== eventEnd.getMonth() || eventStart.getFullYear() !== eventEnd.getFullYear()) return true;
    return startDay !== endDay;
  };

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(0, 0, 0, 0);
    return filteredCalendarEvents.filter(e => {
      if (isMultiDayEvent(e)) return false;
      if (e.startDate && e.endDate) {
        const eventStart = new Date(e.startDate);
        const eventEnd = new Date(e.endDate);
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(0, 0, 0, 0);
        return checkDate >= eventStart && checkDate <= eventEnd;
      }
      return (
        day >= e.startDay &&
        day <= e.endDay &&
        e.month === currentMonth &&
        e.year === currentYear
      );
    });
  };

  const getMultiDaySpansForWeek = (week: (number | null)[]) => {
    const weekDays = week.filter((d): d is number => d !== null);
    if (weekDays.length === 0) return [];
    const weekMin = Math.min(...weekDays);
    const weekMax = Math.max(...weekDays);
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    const lastOfMonth = new Date(currentYear, currentMonth + 1, 0);
    firstOfMonth.setHours(0, 0, 0, 0);
    lastOfMonth.setHours(0, 0, 0, 0);
    const spans: { event: CalendarEvent; colStart: number; colEnd: number }[] = [];
    filteredCalendarEvents.forEach(e => {
      if (!isMultiDayEvent(e) || !e.startDate || !e.endDate) return;
      const eventStart = new Date(e.startDate);
      const eventEnd = new Date(e.endDate);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      if (eventEnd < firstOfMonth || eventStart > lastOfMonth) return;
      const eventStartInMonth = eventStart < firstOfMonth ? firstOfMonth : eventStart;
      const eventEndInMonth = eventEnd > lastOfMonth ? lastOfMonth : eventEnd;
      const eventStartDay = eventStartInMonth.getDate();
      const eventEndDay = eventEndInMonth.getDate();
      const spanStart = Math.max(eventStartDay, weekMin);
      const spanEnd = Math.min(eventEndDay, weekMax);
      if (spanStart > spanEnd) return;
      const colStart = week.indexOf(spanStart);
      const colEnd = week.indexOf(spanEnd);
      if (colStart === -1 || colEnd === -1) return;
      spans.push({ event: e, colStart, colEnd });
    });
    return spans;
  };

  /** จัดแถวให้แถบงานหลายวันที่ไม่ซ้อนกัน (spans ที่ซ้อนช่วงจะอยู่คนละแถว) */
  const assignRowsToMultiDaySpans = (spans: { event: CalendarEvent; colStart: number; colEnd: number }[]): { event: CalendarEvent; colStart: number; colEnd: number; row: number }[] => {
    const rowIntervals: { start: number; end: number }[][] = [];
    const result: { event: CalendarEvent; colStart: number; colEnd: number; row: number }[] = [];
    for (const s of spans) {
      let row = 0;
      for (;; row++) {
        if (row >= rowIntervals.length) rowIntervals[row] = [];
        const intervals = rowIntervals[row];
        const overlaps = intervals.some(iv => s.colStart <= iv.end && s.colEnd >= iv.start);
        if (!overlaps) break;
      }
      if (row >= rowIntervals.length) rowIntervals[row] = [];
      rowIntervals[row].push({ start: s.colStart, end: s.colEnd });
      result.push({ ...s, row });
    }
    return result;
  };

  const persistTaskDates = async (taskId: string, startDate: string, endDate: string, reason?: string) => {
    try {
      const body: { startDate: string; endDate: string; rescheduleNote?: string } = { startDate, endDate };
      if (reason) {
        body.rescheduleNote = reason;
      }
      const res = await apiFetch(apiUrl(`/api/tasks/${taskId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await responseJsonOrThrow<{ success?: boolean; message?: string }>(
        res,
        'Update task dates failed: server returned non-JSON (check API URL).'
      );
      if (!res.ok) {
        throw new Error(json.message || 'Update task dates failed');
      }
      // Reload tasks to get updated data from server
      await loadTasksFromApi();
      return json;
    } catch (error) {
      console.error('persistTaskDates error', error);
      // Reload on error to revert optimistic update
      await loadTasksFromApi();
      throw error;
    }
  };

  /* ================= Drag ================= */
  const beginTaskDrag = (event: CalendarEvent) => {
    if (event.status === 'done') return;
    draggedEventRef.current = event;
    setDraggedEvent(event);
  };

  const handleTrashDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverTrash(true);
    setDragOverDay(null);
  };

  const handleTrashDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setIsDragOverTrash(false);
    }
  };

  const handleTrashDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTrash(false);
    const event = draggedEventRef.current;
    if (!event || event.status === 'done') {
      handleDragEnd();
      return;
    }
    const taskId = String(event.id);
    draggedEventRef.current = null;
    setDraggedEvent(null);
    setDragOverDay(null);
    setDragStartDay(null);
    await handleDeleteTask(taskId);
  };

  const handleDrop = async (e: React.DragEvent, day: number | null) => {
    e.preventDefault();
    if (!day || !draggedEvent) return;
    if (draggedEvent.status === 'done') return; // Task that is done cannot be changed

    // Calculate duration from original startDate and endDate
    const originalStart = draggedEvent.startDate 
      ? new Date(draggedEvent.startDate) 
      : new Date(draggedEvent.year, draggedEvent.month, draggedEvent.startDay);
    const originalEnd = draggedEvent.endDate 
      ? new Date(draggedEvent.endDate) 
      : new Date(draggedEvent.year, draggedEvent.month, draggedEvent.endDay);
    
    // Calculate duration in days
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

    // Create new start date from the dropped day
    const newStartDate = new Date(currentYear, currentMonth, day);
    // Calculate new end date by adding duration
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    // Format dates as YYYY-MM-DD
    const formatDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const newStartDateStr = formatDateString(newStartDate);
    const newEndDateStr = formatDateString(newEndDate);

    // เช็คว่าย้ายวันจริงหรือไม่ ถ้าวันเดิมไม่ต้องขึ้น modal notes
    const originalStartStr = formatDateString(originalStart);
    const originalEndStr = formatDateString(originalEnd);
    if (newStartDateStr === originalStartStr) {
      // วันเดิม ไม่ย้าย ไม่ต้องถามเหตุผล
      setDraggedEvent(null);
      setDragOverDay(null);
      setDragStartDay(null);
      return;
    }

    // ย้ายวันจริง แสดง modal ถามเหตุผลก่อนย้าย
    setPendingMove({
      event: draggedEvent,
      newDay: day,
      newStartDate: newStartDateStr,
      newEndDate: newEndDateStr,
      previousStartDate: originalStartStr,
      previousEndDate: originalEndStr,
    });
    setIsMoveModalOpen(true);
    setMoveReason('');

    // Clear drag state
    setDraggedEvent(null);
    setDragOverDay(null);
    setDragStartDay(null);
  };

  const confirmMoveTask = async () => {
    if (!pendingMove || !moveReason.trim()) {
      toastError('Please provide a reason for moving the task');
      return;
    }

    const { event, newStartDate, newEndDate, previousStartDate, previousEndDate } = pendingMove;

    const toMonthDayYear = (s: string | undefined) => {
      if (!s) return '—';
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-');
        return `${m}/${d}/${y}`;
      }
      const d0 = new Date(s);
      if (!Number.isNaN(d0.getTime())) {
        const y = d0.getFullYear();
        const m = String(d0.getMonth() + 1).padStart(2, '0');
        const day = String(d0.getDate()).padStart(2, '0');
        return `${m}/${day}/${y}`;
      }
      return s;
    };
    const rescheduleNoteFull = composeRescheduleNoteWithOrigin(
      previousStartDate,
      previousEndDate,
      moveReason.trim(),
      toMonthDayYear
    );

    // Optimistic update - update UI immediately
    const newStartDateObj = new Date(newStartDate);
    const newEndDateObj = new Date(newEndDate);
    
    setCalendarEvents(events =>
      events.map(ev => {
        if (ev.id === event.id) {
          const updatedEvent = {
            ...ev,
            startDay: newStartDateObj.getDate(),
            endDay: newEndDateObj.getDate(),
            month: newStartDateObj.getMonth(),
            year: newStartDateObj.getFullYear(),
            startDate: newStartDate,
            endDate: newEndDate,
            rescheduleNote: rescheduleNoteFull,
          };
          return updatedEvent;
        }
        return ev;
      })
    );

    // Close modal
    setIsMoveModalOpen(false);
    setPendingMove(null);
    setMoveReason('');

    // Update backend (will reload data on success/error)
    try {
      await persistTaskDates(
        String(event.id),
        newStartDate,
        newEndDate,
        rescheduleNoteFull
      );
        toastSuccess('Move task successfully');
    } catch (error) {
      console.error('Failed to move task:', error);
      toastError('Move task failed');
      // Error is already handled in persistTaskDates (reloads data)
    }
  };

  const cancelMoveTask = () => {
    setIsMoveModalOpen(false);
    setPendingMove(null);
    setMoveReason('');
  };

  const handleDragEnd = () => {
    draggedEventRef.current = null;
    setDraggedEvent(null);
    setDragOverDay(null);
    setDragStartDay(null);
    setIsDragOverTrash(false);
  };

  /* ================= Modal ================= */
  const handleSaveFromModal = async (data: TaskSavePayload | TaskSavePayload[]) => {
    const batch = Array.isArray(data) ? data : [data];
    const first = batch[0];
    if (!first) {
      throw new Error('No task data to save');
    }

    const wasEditingExisting = !!editingEvent;
    const normalizedTaskType = first.taskType || editingEvent?.taskType || 'PM';
    const normalizedStartDate = first.startDate || editingEvent?.startDate || '';
    const normalizedEndDate =
      first.endDate || first.startDate || editingEvent?.endDate || editingEvent?.startDate || '';

    if (!editingEvent && (!normalizedTaskType || !normalizedStartDate || !normalizedEndDate)) {
      throw new Error('Please specify taskType, startDate, endDate');
    }

    try {
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const repDev = asRecord(item.replacementDevice);
        const repDevId = repDev.id;
        const payload = {
          taskType: item.taskType || normalizedTaskType,
          contractId: item.contractId || item.contract_id || null,
          replacementDeviceId:
            item.replacementDeviceId ||
            (repDevId != null
              ? typeof repDevId === 'number'
                ? repDevId
                : parseInt(String(repDevId), 10)
              : null),
          siteId: item.siteId || (item.Sid ? Number(item.Sid) : null),
          siteName: item.Sname || item.siteName,
          vendorName: item.vendorName,
          vendorTel: item.vendorTel,
          reporterName: item.reporterName,
          reporterTel: item.reporterTel,
          reporterPosition: item.reporterPosition,
          reporterEmail: item.reporterEmail,
          ticket: item.ticket,
          rootCause: item.rootCause,
          resolution: item.resolution,
          duration: item.duration,
          downtimeDate: item.downtimeDate,
          downtimeTime: item.downtimeTime,
          uptimeDate: item.uptimeDate,
          uptimeTime: item.uptimeTime,
          assignedService: item.assignedService ?? item.assigned_service ?? null,
          assetBinding: item.assetBinding,
          ...(item.slaTerm ? { slaTerm: item.slaTerm } : {}),
          coverageScope: item.coverageScope,
          startDate: item.startDate || normalizedStartDate,
          endDate: item.endDate || item.startDate || normalizedEndDate,
          travelMethod: item.travelMethod,
          travelCost: item.travelCost,
          engineers: item.Eng_ids || [],
          assets: item.assets || [],
          status: editingEvent?.status || item.status || 'not-started',
          actuallyWent: item.actuallyWent ?? editingEvent?.actuallyWent ?? false,
          notes: item.notes ?? editingEvent?.notes ?? '',
          rescheduleNote: item.rescheduleNote ?? editingEvent?.rescheduleNote ?? null,
          photos: item.photos ?? editingEvent?.photos ?? [],
        };

        const res = await apiFetch(
          apiUrl(editingEvent ? `/api/tasks/${editingEvent.id}` : '/api/tasks'),
          {
            method: editingEvent ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        const json = await responseJsonOrThrow<{ success: boolean; message?: string; data?: unknown }>(
          res,
          'Save task failed: server returned HTML or invalid JSON (check NEXT_PUBLIC_API_URL).'
        );
        if (!json.success) {
          const j = json as { message?: string; error?: string };
          const detail = [j.message, j.error].filter((x) => x && String(x).trim()).join(' — ');
          throw new Error(detail || 'Save task failed');
        }

        const mapped = mapTaskToEvent((json.data ?? {}) as ApiTask);
        setCalendarEvents((events) =>
          editingEvent
            ? events.map((ev) => (ev.id === mapped.id ? mapped : ev))
            : [...events, mapped]
        );
      }

      setEditingEvent(null);
      setIsModalOpen(false);
      toastSuccess(batch.length > 1 ? `Plan success (${batch.length} tasks)` : 'Plan success');
      if (wasEditingExisting) {
        router.push('/calendar');
      }
    } catch (error: unknown) {
      console.error('handleSaveFromModal error', error);
      toastError(getErrorMessage(error) || 'Save task failed');
    }
  };

  const deleteTaskById = async (taskId: string) => {
    const res = await apiFetch(apiUrl(`/api/tasks/${taskId}`), { method: 'DELETE' });
    const json = await responseJsonOrThrow<{ success: boolean; message?: string }>(
      res,
      'Delete task failed: server returned non-JSON (check API URL).'
    );
    if (!json.success) throw new Error(json.message || 'Delete task failed');
  };

  // Handle delete task from detail modal
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskById(taskId);
      setCalendarEvents((prev) => prev.filter((e) => e.id !== taskId));
      setTableSelectedIds((prev) => {
        if (!prev.has(taskId)) return prev;
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setIsDetailModalOpen(false);
      setSelectedTask(null);
      toastSuccess('Delete task successfully');
    } catch (error: unknown) {
      console.error('handleDeleteTask error', error);
      toastError(getErrorMessage(error) || 'Delete task failed');
    }
  };

  const toggleTableTaskSelection = (taskId: string) => {
    setTableSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleTablePageSelection = () => {
    setTableSelectedIds((prev) => {
      const next = new Set(prev);
      if (tablePageAllSelected) {
        for (const ev of paginatedTableTasks) next.delete(String(ev.id));
      } else {
        for (const ev of paginatedTableTasks) next.add(String(ev.id));
      }
      return next;
    });
  };

  const selectAllFilteredTableTasks = () => {
    setTableSelectedIds(new Set(tableTasksFiltered.map((ev) => String(ev.id))));
  };

  const handleBulkDeleteSelected = () => {
    const ids: string[] = Array.from(tableSelectedIds);
    if (ids.length === 0) return;
    const filterBits: string[] = [];
    if (tableFilterYear) filterBits.push(`ปี ${tableFilterYear}`);
    if (tableFilterMonth) {
      const mi = parseInt(tableFilterMonth, 10);
      filterBits.push(
        `เดือน ${!Number.isNaN(mi) && mi >= 1 && mi <= 12 ? TABLE_MONTH_NAMES[mi - 1] : tableFilterMonth}`
      );
    }
    if (tableFilterSof) filterBits.push(`SOF ${tableFilterSof}`);
    if (tableFilterSite) filterBits.push(`Site ${tableFilterSite}`);
    if (selectedTaskTypeFilter !== 'all') filterBits.push(selectedTaskTypeFilter);
    const filterHint = filterBits.length > 0 ? ` (${filterBits.join(', ')})` : '';
    showConfirm(
      `Delete ${ids.length} selected plan(s)${filterHint}? This cannot be undone.`,
      async () => {
        setIsBulkDeleting(true);
        let successCount = 0;
        const failed: string[] = [];
        for (const taskId of ids) {
          try {
            await deleteTaskById(taskId);
            successCount += 1;
          } catch (err: unknown) {
            failed.push(taskId);
            console.error('bulk delete task', taskId, err);
          }
        }
        const deletedSet = new Set(ids.filter((id) => !failed.includes(id)));
        setCalendarEvents((prev) => prev.filter((e) => !deletedSet.has(String(e.id))));
        setTableSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of deletedSet) next.delete(id);
          return next;
        });
        if (selectedTask && deletedSet.has(String(selectedTask.id))) {
          setIsDetailModalOpen(false);
          setSelectedTask(null);
        }
        setIsBulkDeleting(false);
        if (successCount === ids.length) {
          toastSuccess(`Deleted ${successCount} plan(s)`);
        } else if (successCount > 0) {
          toastError(`Deleted ${successCount}/${ids.length} plan(s). ${failed.length} failed.`);
        } else {
          toastError('Failed to delete selected plans');
        }
      },
      {
        title: 'Delete selected plans',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        dangerConfirm: true,
      }
    );
  };

  // Handle task click to open detail modal
  const handleTaskClick = (event: CalendarEvent) => {
    setSelectedTask(event);
    setIsDetailModalOpen(true);
  };

  /* ===== Excel/CSV Import Functions ===== */
  /** เทียบ Refer_SOF ในฐานข้อมูลกับ SOF ที่ import (รองรับเลขแบบมี/ไม่มี 0 นำหน้า, ช่องว่าง, คั่นตัวเลขใน DB) */
  const importReferSofMatches = (referSofDb: unknown, importSof: string): boolean => {
    const imp = String(importSof ?? '').replace(/\s+/g, '').trim();
    if (!imp) return false;
    const dbRaw =
      referSofDb == null || referSofDb === ''
        ? ''
        : String(referSofDb).replace(/\s+/g, '').trim();
    if (!dbRaw) return false;
    const stripLeadZeros = (s: string) => (/^\d+$/.test(s) ? s.replace(/^0+/, '') || '0' : s);
    // SOF ที่ import เป็นตัวเลขล้วน → เทียบกับ Refer_SOF ที่อาจมีช่องว่าง/ขีดคั่นใน DB
    if (/^\d+$/.test(imp)) {
      const dbDigits = dbRaw.replace(/\D/g, '');
      if (dbDigits && /^\d+$/.test(dbDigits)) {
        return stripLeadZeros(dbDigits) === stripLeadZeros(imp);
      }
    }
    if (/^\d+$/.test(imp) || /^\d+$/.test(dbRaw)) {
      return stripLeadZeros(dbRaw) === stripLeadZeros(imp);
    }
    return dbRaw.toLowerCase() === imp.toLowerCase();
  };

  // หลัง parse: มี SLid + SOF + สัญญาแล้ว — นับเครื่องให้ตรงหน้า contract / Add Plan
  // 1) GET /api/contracts/:id/devices?site_id= (contract_device + SLid)
  // 2) ถ้า 0 เครื่อง → ดึงทั้งสัญญาไม่กรอง site (เครื่องอาจผูก cd.SLid คนละ d.SLid)
  // 3) fallback by-sof-and-site แล้วเทียบ Refer_SOF
  const fetchDevicesBySiteSOFLocation = async (
    sofName: string, 
    siteId: number | null, 
    _location: string | null,
    contractId?: number | null
  ): Promise<{deviceIds: number[]; count: number; devices: ApiDeviceRow[]}> => {
    if (!sofName || !siteId) {
      return { deviceIds: [], count: 0, devices: [] };
    }

    const doFetchByContractDevices = async (slid: number | null) => {
      if (!contractId) return [];
      const result = await getDevicesByContract(contractId, slid);
      if (!result.success || !result.data) return [];
      return result.data as ApiDeviceRow[];
    };
    const doFetchBySof = async (sof: string) => {
      const res = await apiFetch(apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(sof)}&site_id=${siteId}`));
      const json = await responseJsonSafe<{ success?: boolean; data?: unknown[] }>(res);
      if (!json || !json.success || !json.data) return [];
      return json.data as ApiDeviceRow[];
    };

    try {
      let devices: ApiDeviceRow[] = contractId ? await doFetchByContractDevices(siteId) : [];
      if (devices.length === 0 && contractId) {
        devices = await doFetchByContractDevices(null);
      }

      if (devices.length === 0) {
        devices = await doFetchBySof(sofName);
        devices = devices.filter((d) => importReferSofMatches(d.Refer_SOF, sofName));
      }
      if (devices.length === 0 && /^\d+$/.test(sofName)) {
        const altSof = parseInt(sofName, 10).toString();
        if (altSof !== sofName) {
          devices = await doFetchBySof(altSof);
          devices = devices.filter((d) => importReferSofMatches(d.Refer_SOF, sofName));
        }
        if (devices.length === 0) {
          devices = await doFetchBySof(sofName.padStart(4, '0'));
          devices = devices.filter((d) => importReferSofMatches(d.Refer_SOF, sofName));
        }
      }

      devices = devices.filter(
        (d) => String(d.Asset_State ?? '').trim().toLowerCase() === 'in use'
      );

      const deviceIds = devices.map((d) => d.Did).filter((id): id is number => id != null);
      return {
        deviceIds,
        count: deviceIds.length,
        devices,
      };
    } catch (error) {
      console.error(`Error fetching devices for SOF ${sofName}, Site ${siteId}:`, error);
      return { deviceIds: [], count: 0, devices: [] };
    }
  };

  const parseDateString = (dateStr: string | number): string => {
    if (dateStr === null || dateStr === undefined) return '';
    const str = String(dateStr).trim();
    if (!str) return '';
    // ต้องเช็คก่อน Excel serial — ไม่งั้น "2024-06-01" จะถูก parseInt → 2024 แล้วแปลงผิด
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Excel serial number (days since 1899-12-30)
    const serial = typeof dateStr === 'number' ? dateStr : parseInt(str, 10);
    if (!isNaN(serial) && serial > 0 && serial < 1000000) {
      const excelEpoch = new Date(1899, 11, 30);
      const dateObj = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getFullYear(), m = dateObj.getMonth(), d = dateObj.getDate();
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    // Handle format: "Friday, February 20, 2026" or "February 20, 2026" (day-of-week optional, flexible spaces/comma)
    const dateMatch = str.match(/(?:\w+day\s*,?\s*)?(\w+)\s+(\d{1,2})\s*,\s*(\d{4})/i);
    if (dateMatch) {
      const [, monthName, day, year] = dateMatch;
      const monthMap: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
      };
      const month = monthMap[monthName.toLowerCase()] || '01';
      const dayPadded = String(day).padStart(2, '0');
      return `${year}-${month}-${dayPadded}`;
    }
    // Malformed ISO like +046072-12-31: first number can be Excel serial
    const serialMatch = str.match(/^\+?0*(\d+)-\d{2}-\d{2}/);
    if (serialMatch) {
      const serial = parseInt(serialMatch[1], 10);
      if (serial > 0 && serial < 1000000) {
        const excelEpoch = new Date(1899, 11, 30);
        const dateObj = new Date(excelEpoch.getTime() + serial * 86400000);
        if (!isNaN(dateObj.getTime())) {
          const y = dateObj.getFullYear(), m = dateObj.getMonth(), d = dateObj.getDate();
          return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
    // Try standard Date parsing (avoid malformed ISO like +046072-12-31)
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      if (y > 1900 && y < 2100) {
        const m = dateObj.getMonth(), d = dateObj.getDate();
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return str;
  };

  /** Format date for display as mm/dd/yyyy (US) */
  const formatDateMonthDayYear = (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${m}/${d}/${y}`;
    }
    const dateObj = new Date(dateStr);
    if (!Number.isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${m}/${d}/${y}`;
    }
    return dateStr;
  };

  const parseEngineerNames = (engineerStr: string): string[] => {
    if (!engineerStr) return [];
    // First split by newline (main separator in CSV)
    const lines = engineerStr.split(/\r?\n/);
    const names: string[] = [];
    
    lines.forEach(line => {
      // Remove phone numbers first (patterns like 061-397-1743, 0935747706, etc.)
      let cleaned = line.replace(/\d{2,3}[-\s]?\d{3}[-\s]?\d{4,}/g, '').trim();
      // Also remove standalone phone numbers at the end
      cleaned = cleaned.replace(/\s+\d{9,}$/, '').trim();
      
      // Split by comma or multiple spaces if still multiple names
      const parts = cleaned.split(/,|\s{2,}/);
      parts.forEach(part => {
        const name = part.trim().replace(/\s+/g, ' ');
        if (name && name.length > 2 && !/^\d+$/.test(name)) {
          names.push(name);
        }
      });
    });
    
    return names;
  };

  /**
   * Split import error: row badge, why (reason before “From your file:”), detail (upload values), hints.
   * Errors should be built as: `Row N: <why>\n<detail>` then optional `Hints: ...`.
   */
  const splitImportErrorLine = (
    raw: string
  ): { rowBadge: string; why: string; detail: string; hintChunks: string[] } => {
    const hintSplit = raw.split(/\bHints:\s*/i);
    const mainPart = (hintSplit[0] ?? raw).trim();
    const hintsPart = hintSplit.length > 1 ? hintSplit.slice(1).join('Hints:').trim() : '';

    let rowBadge = '';
    let body = mainPart;

    const previewParens = /^Preview row (\d+) \(([\s\S]+?)\):\s*([\s\S]+)$/.exec(mainPart);
    const rowOnly = /^Row (\d+):\s*([\s\S]+)$/.exec(mainPart);
    if (previewParens) {
      const inner = previewParens[2].trim();
      const innerSpread = /^spreadsheet row (\d+)$/i.exec(inner);
      if (innerSpread) {
        rowBadge = `Row ${innerSpread[1]} (sheet)`;
        body = previewParens[3].trim();
      } else {
        rowBadge = `Preview ${previewParens[1]}`;
        body = `${inner} — ${previewParens[3].trim()}`;
      }
    } else if (rowOnly) {
      rowBadge = `Row ${rowOnly[1]}`;
      body = rowOnly[2].trim();
    } else {
      rowBadge = 'General';
      body = mainPart;
    }

    const bodyNorm = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u2028/g, '\n');

    let why = '';
    let detail = '';

    const multilineFrom = /\n\s*From your file:\s*/i.exec(bodyNorm);
    if (multilineFrom) {
      why = bodyNorm.slice(0, multilineFrom.index).trim();
      detail = bodyNorm.slice(multilineFrom.index + 1).trim();
    } else {
      const inlineFrom = /\bFrom your file:\s*/i.exec(bodyNorm);
      if (inlineFrom) {
        if (inlineFrom.index > 0) {
          why = bodyNorm.slice(0, inlineFrom.index).trim();
          detail = bodyNorm.slice(inlineFrom.index).trim();
        } else {
          why = '—';
          detail = bodyNorm.trim();
        }
      } else {
        const nl = bodyNorm.indexOf('\n');
        why = nl >= 0 ? bodyNorm.slice(0, nl).trim() : bodyNorm.trim();
        detail = nl >= 0 ? bodyNorm.slice(nl + 1).trim() : '';
      }
    }

    if (!detail && bodyNorm.includes(' — ')) {
      const parts = bodyNorm.split(' — ');
      if (parts.length >= 2) {
        why = (parts[0] || '').trim();
        detail = parts.slice(1).join(' — ').trim();
      }
    }

    const hintChunks = hintsPart
      ? hintsPart
          .split(/\s*;\s*/)
          .map((s) => s.replace(/^[\s"']+|[\s"']+$/g, '').trim())
          .filter(Boolean)
      : [];

    if (!detail.trim()) {
      const synth =
        synthesizeFromYourFileLineFromErrorText(bodyNorm) ||
        synthesizeFromYourFileLineFromErrorText(mainPart) ||
        synthesizeFromYourFileLineFromErrorText(raw);
      if (synth) detail = synth;
    }

    return { rowBadge, why, detail, hintChunks };
  };

  const parseExcelFile = async (file: File): Promise<{ tasks: ImportedPmTask[]; errors: string[] }> => {
    return new Promise(async (resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let jsonData: ExcelSheet;
          
          if (file.name.endsWith('.csv')) {
            // Parse CSV using XLSX library (handles quoted fields and multiline)
            const text = e.target?.result as string;
            const workbook = XLSX.read(text, { type: 'string', sheetRows: 0 });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as ExcelSheet;
          } else {
            // Parse Excel
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as ExcelSheet;
          }
          
          if (jsonData.length < 2) {
            reject(new Error('File must have at least a header row and one data row'));
            return;
          }

          const headers = (jsonData[0] || []).map((h) =>
            String(h || '').replace(/\uFEFF/g, '').trim().toLowerCase()
          );
          // Normalize header for lookup (หลายช่องว่าง → ช่องว่างเดียว) เพื่อให้ตรงกับ columnMap
          const normalizeHeader = (h: string) => h.replace(/\s+/g, ' ').trim();
          
          const columnMap: Record<string, string> = {
            // เป้าหมายคือ SLid (sites_location). Site/Location ในไฟล์ = คำอธิบายชื่อไซต์ (sites+Sid) + Location2 (location+lid) เพื่อจับคู่แถวนั้น
            'site': 'siteName', 'site name': 'siteName', 'sitename': 'siteName',
            'location': 'location', 'location2': 'location',
            // ทางเลือก: slid หรือ sid+lid ตัวเลข → ชี้ SLid โดยตรง
            'sid': 'importSid',
            'site sid': 'importSid',
            'site_sid': 'importSid',
            'lid': 'importLid',
            'site lid': 'importLid',
            'site_lid': 'importLid',
            'location id': 'importLid',
            'location_id': 'importLid',
            // SLid โดยตรง (sites_location.SLid)
            'slid': 'csvSlid',
            'site slid': 'csvSlid',
            'sl_id': 'csvSlid',
            'plan start': 'startDate', 'start date': 'startDate', 'startdate': 'startDate',
            'plan end': 'endDate', 'end date': 'endDate', 'enddate': 'endDate',
            'engineer': 'engineer', 'engineers': 'engineer',
            'sof': 'sofName', 'sof_name': 'sofName', 'sof name': 'sofName', 'refer_sof': 'sofName', 'refer sof': 'sofName',
            'coverage scope': 'coverageScope', 'coverage_scope': 'coverageScope', 'coveragescope': 'coverageScope', // → coverage_scope (from CSV column)
            // Optional
            'notes': 'notes',
            'reschedule note': 'rescheduleNote',
            'reschedule_note': 'rescheduleNote',
            'reschedule': 'rescheduleNote',
          };

          const tasks: ImportedPmTask[] = [];
          const errors: string[] = [];

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.every(cell => !cell)) continue;

            const task: ImportedPmTask = { taskType: 'PM' };

            headers.forEach((header, colIndex) => {
              const value = row[colIndex];
              const headerNorm = normalizeHeader(header);
              const mappedKey = columnMap[headerNorm] || columnMap[header];
              if (!mappedKey) return;
              // สำหรับ coverageScope, notes, rescheduleNote รับค่าแม้ cell ว่าง
              if (value === null || value === undefined) return;
              if (mappedKey !== 'coverageScope' && mappedKey !== 'notes' && mappedKey !== 'rescheduleNote' && value === '') return;
              if (mappedKey) {
                // taskType is always 'PM', skip any taskType mapping
                if (mappedKey === 'engineer' || mappedKey === 'engineerId') {
                  const rawEngCell = String(value ?? '').trim();
                  if (rawEngCell) task._importEngineerRaw = rawEngCell;
                  if (!task.Eng_ids) task.Eng_ids = [];
                  const engineerNames = parseEngineerNames(String(value));
                  engineerNames.forEach(val => {
                    if (!val) return;
                    const eng = availableEngineers.find(e => {
                      const fullName = `${e.name} ${e.lastName || ''}`.trim().toLowerCase();
                      const firstName = e.name.toLowerCase();
                      const lastName = (e.lastName || '').toLowerCase();
                      const valLower = val.toLowerCase();
                      
                      if (valLower === firstName || valLower === fullName) return true;
                      if (firstName.includes(valLower) || valLower.includes(firstName)) return true;
                      if (lastName && (valLower.includes(lastName) || lastName.includes(valLower))) return true;
                      if (fullName.includes(valLower)) return true;
                      return false;
                    });
                    if (eng && !(task.Eng_ids ?? []).find((e: Engineer) => e.id === eng.id)) {
                      if (!task.Eng_ids) task.Eng_ids = [];
                      task.Eng_ids.push(eng);
                    } else if (!eng) {
                      console.warn(`Row ${i + 1}: Engineer "${val}" not found`);
                    }
                  });
                } else if (mappedKey === 'startDate' || mappedKey === 'endDate') {
                  task[mappedKey] = parseDateString(typeof value === 'number' ? value : String(value));
                } else if (mappedKey === 'siteName') {
                  task.siteName = String(value).trim();
                } else if (mappedKey === 'location') {
                  task.location = String(value).trim();
                } else if (mappedKey === 'importSid') {
                  const n = parseInt(String(value).trim(), 10);
                  if (!Number.isNaN(n)) task.importSid = n;
                } else if (mappedKey === 'importLid') {
                  const n = parseInt(String(value).trim(), 10);
                  if (!Number.isNaN(n)) task.importLid = n;
                } else if (mappedKey === 'csvSlid') {
                  const v = String(value).trim();
                  if (/^\d+$/.test(v)) task.siteId = v;
                } else if (mappedKey === 'sofName') {
                  // เก็บ SOF เป็นข้อความ; เติม 0 นำหน้าถ้าเป็นตัวเลข (Excel อาจแปลง 0987 เป็น 987)
                  const raw = String(value).trim();
                  const sofVal = /^\d+$/.test(raw) ? raw.padStart(4, '0') : raw;
                  task.sofName = sofVal;
                  console.log(`Row ${i + 1}: Parsed SOF "${sofVal}"`);
                  const contract = availableContracts.find((c) => {
                    if (!c.sof_name) return false;
                    return normalizeImportSofKey(String(c.sof_name)) === normalizeImportSofKey(sofVal);
                  });
                  if (contract) {
                    task.contractId = contract.contract_id;
                    task._contractEndDate = contract.end_date; // เก็บไว้เช็คหมดอายุ
                    console.log(`Row ${i + 1}: Found contract_id ${contract.contract_id} for SOF "${sofVal}"`);
                  } else {
                    console.warn(`Row ${i + 1}: SOF "${sofVal}" not found in contracts. Available SOFs:`, availableContracts.map(c => c.sof_name).filter(Boolean));
                  }
                } else if (mappedKey === 'coverageScope') {
                  task.coverageScope = String(value).trim();
                } else if (mappedKey === 'notes') {
                  task.notes = String(value).trim();
                } else if (mappedKey === 'rescheduleNote') {
                  task.rescheduleNote = String(value).trim();
                } else {
                  task[mappedKey] = String(value).trim();
                }
              }
            });

            // ทางเลือก: sid + lid ตัวเลข (คอลัมน์แยก) → หาแถว sites_location เดียวกัน = SLid เดียวกับ Site+Location2
            let resolvedSlidFromSidLid = false;
            if (
              task.importSid !== undefined &&
              task.importSid !== null &&
              !Number.isNaN(Number(task.importSid)) &&
              task.importLid !== undefined &&
              task.importLid !== null &&
              !Number.isNaN(Number(task.importLid))
            ) {
              const sidN = Number(task.importSid);
              const lidN = Number(task.importLid);
              const siteByPair = siteOptions.find(
                (s) => Number(s.sid) === sidN && Number(s.lid) === lidN
              );
              if (!siteByPair) {
                const sofL = String(task.sofName || '').trim() || '(no SOF)';
                errors.push(
                  `Row ${i + 1}: Sid ${sidN} + Lid ${lidN} does not have matching Site+Location in contract rows (SOF "${sofL}")\nFrom your file: Sid ${sidN}, Lid ${lidN}, SOF "${sofL}".`
                );
                continue;
              }
              task.siteId = siteByPair.id;
              task.Sid = siteByPair.id;
              task.Sname = siteByPair.name;
              task.siteSid = siteByPair.sid;
              task.siteLid = siteByPair.lid;
              if (!String(task.siteName || '').trim()) task.siteName = siteByPair.name;
              task.location = siteByPair.location || task.location || '';
              task.title = `${siteByPair.sid}-${siteByPair.lid}`;
              resolvedSlidFromSidLid = true;
              console.log(`Row ${i + 1}: Resolved SLid ${siteByPair.id} from Sid ${sidN} + Lid ${lidN}`);
            }

            // Coverage Scope should come from CSV column "Coverage Scope" - DO NOT OVERRIDE if provided
            // Generate title as sid-lid format for title (but keep coverageScope from CSV if provided)
            if (task.siteSid && task.siteLid) {
              task.title = `${task.siteSid}-${task.siteLid}`;
            } else if (!resolvedSlidFromSidLid) {
              // If sid/lid not found, try Site + Location vs DB (exact text, case-insensitive)
              const { best: matchedSite } = pickBestSiteRowForImport(
                siteOptions,
                String(task.Sname || task.siteName || ''),
                String(task.location || '')
              );

              if (matchedSite && matchedSite.sid && matchedSite.lid) {
                task.siteSid = matchedSite.sid;
                task.siteLid = matchedSite.lid;
                task.title = `${matchedSite.sid}-${matchedSite.lid}`;
              }
            }
            
            // If coverageScope not provided from CSV, use title as fallback
            // BUT if coverageScope exists from CSV, DO NOT override it
            if (!task.coverageScope) {
              if (task.title) {
                task.coverageScope = task.title;
              } else if (task.siteSid && task.siteLid) {
                task.coverageScope = `${task.siteSid}-${task.siteLid}`;
                task.title = task.coverageScope;
              }
            }
            
            // Set title if not set (but don't override coverageScope)
            if (!task.title && task.coverageScope) {
              task.title = task.coverageScope;
            }
            
            // Ensure taskType is always PM
            task.taskType = 'PM';

            // จับคู่ SiteName + Location2 → SLid (ข้อความตรงทุกตัวหลัง trim; ตัวพิมพ์เล็ก/ใหญ่ไม่สน)
            if (!resolvedSlidFromSidLid && !task.siteId && task.siteName) {
              const siteNeedleNorm = normalizeImportText(task.siteName);
              const fileLocT = String(task.location || '').trim();

              const { best: site } = pickBestSiteRowForImport(
                siteOptions,
                String(task.siteName || ''),
                String(task.location || '')
              );
              const sofForMsg = String(task.sofName || '').trim() || '(no SOF)';
              if (fileLocT) {
                if (!site) {
                  const siteOnlyHits = siteOptions.filter((s) =>
                    importSiteLocTextEquals(task.siteName, s.name)
                  );
                  if (siteOnlyHits.length === 0) {
                    const closestDbSites = siteOptions
                      .map((s) => ({
                        name: (s.name || '').trim() || '—',
                        sim: importFieldSimilarityScore(siteNeedleNorm, normalizeImportText(s.name)),
                      }))
                      .filter((x) => x.name !== '—')
                      .sort((a, b) => b.sim - a.sim)
                      .slice(0, 4);
                    const closestStr = closestDbSites
                      .map((x) => `DB SiteName "${x.name}" (~${Math.round(Math.min(1, Math.max(0, x.sim)) * 100)}% vs your Site)`)
                      .join('; ');
                    errors.push(
                      `Row ${i + 1}: Site and Location in file must match system SiteName and Location2 exactly (case-insensitive) — no matching Site row (SOF "${sofForMsg}"). ${closestStr ? `Closest in DB: ${closestStr}.` : ''}\nFrom your file: Site "${task.siteName}", Location "${task.location || '—'}", SOF "${sofForMsg}".`
                    );
                  } else {
                    const dbSiteNamesFromHits: string[] = [];
                    const seenSiteLower = new Set<string>();
                    for (const row of siteOnlyHits) {
                      const nm = String(row.name ?? '').trim();
                      if (!nm) continue;
                      const k = nm.toLowerCase();
                      if (seenSiteLower.has(k)) continue;
                      seenSiteLower.add(k);
                      dbSiteNamesFromHits.push(nm);
                    }
                    const quotedDbSites = dbSiteNamesFromHits.slice(0, 3).map((n) => `"${n}"`);
                    let dbSiteThaiList = '';
                    if (quotedDbSites.length === 0) {
                      dbSiteThaiList = '(no SiteName text on rows that match file Site)';
                    } else if (quotedDbSites.length === 1) {
                      dbSiteThaiList = quotedDbSites[0];
                    } else if (quotedDbSites.length === 2) {
                        dbSiteThaiList = `${quotedDbSites[0]} and ${quotedDbSites[1]}`;
                    } else {
                      dbSiteThaiList = `${quotedDbSites[0]} ${quotedDbSites[1]} and ${quotedDbSites[2]}${
                        dbSiteNamesFromHits.length > 3
                          ? ` (and ${dbSiteNamesFromHits.length - 3} more names in DB)`
                          : ''
                      }`;
                    }
                    const hitSlids = new Set(siteOnlyHits.map((s) => String(s.id)));
                    const fallbackHints = () =>
                      siteOnlyHits
                        .map((s) => `"${(s.location || '').trim() || '(empty Location2)'}" (SLid ${s.id})`)
                        .slice(0, 5)
                        .join('; ');

                    let locHints = fallbackHints();
                    const sofTrimRow = String(task.sofName || '').trim();
                    if (task.contractId && sofTrimRow) {
                      try {
                        const hintRes = await getImportLocation2HintsByContractAndSof(
                          Number(task.contractId),
                          sofTrimRow
                        );
                        const rows = hintRes.data || [];
                        const pairs = rows
                          .map((r: { SLid?: number; Location2?: string }) => ({
                            id: String(r.SLid ?? ''),
                            loc: String(r.Location2 ?? '').trim(),
                          }))
                          .filter((p) => p.id && p.loc);
                        const onSameSiteName = pairs.filter((p) => hitSlids.has(p.id));
                        const useList = onSameSiteName.length > 0 ? onSameSiteName : pairs;
                        if (useList.length > 0) {
                          locHints = useList
                            .slice(0, 15)
                            .map((p) => `"${p.loc}" (SLid ${p.id})`)
                            .join('; ');
                        }
                      } catch (hintErr) {
                        console.warn('import Location2 hints fetch failed', hintErr);
                      }
                    }

                    errors.push(
                      `Row ${i + 1}: Site in file "${task.siteName}" matches system SiteName ${dbSiteThaiList} (has ${siteOnlyHits.length} rows) but Location in file "${task.location || '—'}" does not match any Location2 exactly (case-insensitive) for those rows — SOF "${sofForMsg}"\n` +
                        `From your file: Site "${task.siteName}", Location "${task.location || '—'}", SOF "${sofForMsg}". Hints: ${locHints}${siteOnlyHits.length > 5 && !task.contractId ? ' …' : ''}`
                    );
                  }
                  console.warn(`Available sites:`, siteOptions.map((s) => `${s.name} - ${s.location} (SLid: ${s.id})`));
                  continue;
                }
              } else {
                if (!site) {
                  const closestDbSitesNoLoc = siteOptions
                    .map((s) => ({
                      name: (s.name || '').trim() || '—',
                      sim: importFieldSimilarityScore(siteNeedleNorm, normalizeImportText(s.name)),
                    }))
                    .filter((x) => x.name !== '—')
                    .sort((a, b) => b.sim - a.sim)
                    .slice(0, 4);
                  const closestNoLocStr = closestDbSitesNoLoc
                    .map((x) => `DB SiteName "${x.name}" (~${Math.round(Math.min(1, Math.max(0, x.sim)) * 100)}%)`)
                    .join('; ');
                  errors.push(
                    `Row ${i + 1}: Site in file must match system SiteName exactly (case-insensitive) — no Location in file and no matching Site (SOF "${sofForMsg}"). ${closestNoLocStr ? `Closest in DB: ${closestNoLocStr}.` : ''}\nFrom your file: Site "${task.siteName}", SOF "${sofForMsg}".`
                  );
                  console.warn(`Available sites:`, siteOptions.map((s) => `${s.name} - ${s.location} (SLid: ${s.id})`));
                  continue;
                }
              }

              task.siteId = site.id;
              task.Sid = site.id;
              task.Sname = site.name;
              task.siteSid = site.sid ?? undefined;
              task.siteLid = site.lid ?? undefined;
              console.log(
                `Row ${i + 1}: Found SLid ${site.id} (Sid: ${site.sid}, lid: ${site.lid}) for Site "${task.siteName}" + Location "${task.location || 'none'}"`
              );
            } else if (!resolvedSlidFromSidLid && task.siteId) {
              const sofCsv = String(task.sofName || '').trim() || '(no SOF)';
              const site = siteOptions.find((s) => s.id === String(task.siteId));
              if (!site) {
                errors.push(
                  `Row ${i + 1}: SLid "${task.siteId}" does not exist in contract rows (SOF "${sofCsv}")\nFrom your file: SLid "${task.siteId}", SOF "${sofCsv}".`
                );
                continue;
              }
              task.Sid = site.id;
              task.Sname = site.name;
              task.siteSid = site.sid ?? undefined;
              task.siteLid = site.lid ?? undefined;
              const locCsv = (task.location || '').trim();
              if (locCsv && !/^\d+$/.test(locCsv)) {
                const ok = importSiteLocTextEquals(locCsv, site.location || '');
                if (!ok) {
                  errors.push(
                    `Row ${i + 1}: SLid ${task.siteId}: DB SiteName "${(site.name || '').trim() || '—'}", DB Location2 "${(site.location || '').trim() || '—'}" — file Location "${task.location || '—'}" did not match that Location2 (SOF "${sofCsv}")${String(task.siteName || task.Sname || '').trim() ? `; file Site "${String(task.siteName || task.Sname).trim()}"` : ''}.\nFrom your file: SLid ${task.siteId}, Location "${task.location || '—'}", SOF "${sofCsv}".`
                  );
                  continue;
                }
              }
            }

            if (!task.Sid && !task.siteId) {
              errors.push(
                `Row ${i + 1}: Cannot find Site/SLid — in file Site "${task.siteName || '—'}", Location "${task.location || '—'}", SOF "${String(task.sofName || '').trim() || '(ว่าง)'}"\nFrom your file: Site "${task.siteName || '—'}", Location "${task.location || '—'}", SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
              );
              continue;
            }
            if (!task.startDate) {
              errors.push(
                `Row ${i + 1}: Plan start in file "${String(task.startDate ?? '').trim() || '—'}" is empty or invalid (SOF "${String(task.sofName || '').trim() || '(ว่าง)'}")\nFrom your file: Plan start "${String(task.startDate ?? '').trim() || '—'}", SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
              );
              continue;
            }
            if (!task.Eng_ids || task.Eng_ids.length === 0) {
              errors.push(
                `Row ${i + 1}: Engineer in file "${String(task._importEngineerRaw || '').trim() || '—'}" does not match system name (SOF "${String(task.sofName || '').trim() || '(ว่าง)'}")\nFrom your file: Engineer "${String(task._importEngineerRaw || '').trim() || '—'}", SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
              );
              continue;
            }
            
            // Ensure coverageScope exists (should come from CSV column "Coverage Scope")
            // If not provided, use title as fallback
            // BUT if coverageScope exists from CSV, DO NOT override it
            if (!task.coverageScope) {
              if (task.title) {
                task.coverageScope = task.title;
              } else if (task.siteSid && task.siteLid) {
                task.coverageScope = `${task.siteSid}-${task.siteLid}`;
                task.title = task.coverageScope;
              } else {
                task.coverageScope = task.Sname || task.siteName || '';
                task.title = task.coverageScope;
              }
            }
            
            // Ensure title exists (but don't override coverageScope if it exists)
            if (!task.title && task.coverageScope) {
              task.title = task.coverageScope;
            }

            // Ensure dates are in YYYY-MM-DD format (convert if possible, otherwise keep as-is — ใส่วันที่วันไหนก็ได้ ไม่ดัก)
            if (task.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.startDate)) {
              const parsed = parseDateString(task.startDate);
              task.startDate = parsed || task.startDate;
            }
            if (task.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.endDate)) {
              const parsed = parseDateString(task.endDate);
              task.endDate = parsed || task.startDate;
            }
            if (!task.endDate && task.startDate) {
              task.endDate = task.startDate;
            }

            // Ensure title/coverageScope exists (should already be set above)
            // BUT if coverageScope exists from CSV, DO NOT override it
            if (!task.coverageScope && task.title) {
              task.coverageScope = task.title;
            } else if (!task.title && task.coverageScope) {
              task.title = task.coverageScope;
            }

            // Import: ต้องมี SOF → เช็คสัญญาในระบบ → ยังไม่หมดอายุ ก่อนรับแถวและก่อนดึง device
            const sofTrim = (task.sofName && String(task.sofName).trim()) || '';
            if (!sofTrim) {
                errors.push(
                  `Row ${i + 1}: SOF ว่าง — มี SLid ${task.Sid || task.siteId || '—'} แต่ต้องระบุ SOF เพื่อผูกสัญญา\nFrom your file: SOF ว่าง, SLid ${task.Sid || task.siteId || '—'}.`
                );
              continue;
            }
            if (!task.contractId) {
              errors.push(
                `Row ${i + 1}: SOF in file "${sofTrim}" does not match the contract's sof_name (Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'})\nFrom your file: SOF "${sofTrim}", Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'}.`
              );
              continue;
            }
            const endDateStr =
              task._contractEndDate ||
              availableContracts.find(c => c.contract_id === task.contractId)?.end_date;
            if (endDateStr) {
              const endDate = new Date(endDateStr);
              endDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (endDate < today) {
                errors.push(
                  `Row ${i + 1}: Contract of SOF "${sofTrim}" has expired (Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'})\nFrom your file: SOF "${sofTrim}", Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'}.`
                );
                continue;
              }
            }

            task._importSheetRow = i + 1;
            task._importPreviewRow = tasks.length + 1;
            tasks.push(task);
          }

          // หลัง SOF+สัญญาและ SLid (site+location) ชัดแล้ว — ดึง device ต่อคีย์ Site+SOF+Location+contract
          const devicesMap: Record<string, {deviceIds: number[]; count: number; devices: ApiDeviceRow[]}> = {};
          for (const task of tasks) {
            console.log(`Processing task:`, {
              row: tasks.indexOf(task) + 2,
              siteName: task.siteName,
              Sid: task.Sid,
              sofName: task.sofName,
              location: task.location,
              contractId: task.contractId
            });
            
            if (task.Sid) {
              const key = `${task.Sid}_${task.sofName}_${task.location || ''}_${task.contractId ?? 'none'}`;
              if (!devicesMap[key]) {
                console.log(`[${key}] Fetching devices for SOF: "${task.sofName}", Site ID: ${task.Sid}, Location: "${task.location || 'none'}"`);
                const result = await fetchDevicesBySiteSOFLocation(
                  task.sofName ?? '',
                  Number(task.Sid),
                  task.location || null,
                  task.contractId ? Number(task.contractId) : null
                );
                console.log(`[${key}] API returned:`, {
                  success: result.count > 0,
                  count: result.count,
                  deviceIds: result.deviceIds,
                  devices: result.devices
                });
                devicesMap[key] = result;
              } else {
                console.log(`[${key}] Using cached devices:`, devicesMap[key].count);
              }
              
              // Assign devices and count to task
              task.deviceIds = devicesMap[key].deviceIds;
              task.deviceCount = devicesMap[key].count;
              task.devices = devicesMap[key].devices;
              console.log(`✓ Task "${task.siteName}" - SOF "${task.sofName}": ${task.deviceCount} devices assigned`, task.deviceIds);
              if (task.deviceCount === 0) {
                console.warn(
                  `[import] No devices for SLid ${task.Sid} + SOF "${task.sofName}" — plan can still be created without devices`,
                );
              }
            } else {
              console.warn(`✗ Task missing Site ID (SLid):`, { 
                sofName: task.sofName, 
                Sid: task.Sid, 
                siteName: task.siteName,
                siteId: task.siteId 
              });
              const previewN = task._importPreviewRow ?? tasks.indexOf(task) + 1;
              const sheetN = task._importSheetRow;
              const rowRef =
                sheetN != null
                  ? `Preview row ${previewN} (spreadsheet row ${sheetN})`
                  : `Preview row ${previewN}`;
              errors.push(
                `${rowRef}: No SLid — SOF "${String(task.sofName || '').trim() || '(ว่าง)'}", Site "${task.Sname || task.siteName || '—'}"\nFrom your file: SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
              );
              // Set default values
              task.deviceIds = [];
              task.deviceCount = 0;
              task.devices = [];
            }
          }
          
          console.log('=== Final tasks summary ===');
          tasks.forEach((t, idx) => {
            console.log(`Task ${idx + 1}:`, {
              site: t.Sname || t.siteName,
              location: t.location,
              sof: t.sofName,
              deviceCount: t.deviceCount,
              deviceIds: t.deviceIds?.length || 0,
              hasDevices: (t.deviceIds?.length || 0) > 0
            });
          });

          resolve({ tasks, errors });
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new Error(getErrorMessage(error)));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toastError('Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)');
      return;
    }

    try {
      setIsImporting(true);
      setImportErrors([]);
      console.log('Starting file upload...');
      const { tasks, errors: parseErrors } = await parseExcelFile(file);
      console.log('Parsed tasks:', tasks.length, tasks);
      setImportedTasks(tasks);
      setImportErrors(parseErrors);
      setImportResultTab(parseErrors.length > 0 ? 'issues' : 'ready');
      setIsImportModalOpen(true);
    } catch (error: unknown) {
      toastError(`Error importing file: ${getErrorMessage(error)}`);
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBulkCreate = async () => {
    if (importedTasks.length === 0) return;

    setIsImporting(true);
    const errors: string[] = [];
    let successCount = 0;

    for (let idx = 0; idx < importedTasks.length; idx++) {
      const task = importedTasks[idx];
      const bulkRow =
        (task as { _importPreviewRow?: number })._importPreviewRow ??
        (task as { _importSheetRow?: number })._importSheetRow ??
        idx + 1;
      const sheetNForBulk = (task as { _importSheetRow?: number })._importSheetRow;
      const bulkRowHead =
        sheetNForBulk != null
          ? `Preview row ${bulkRow} (spreadsheet row ${sheetNForBulk}):`
          : `Preview row ${bulkRow}:`;
      try {
        if (!task.Sid && !task.siteId) {
          errors.push(
            `${bulkRowHead} ไม่มี SLid/Site — SOF "${String(task.sofName || '').trim() || '(ว่าง)'}", Site "${task.Sname || task.siteName || '—'}"\nFrom your file: SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
          );
          continue;
        }
        if (!task.startDate) {
          errors.push(
            `${bulkRowHead} วันเริ่ม "${String(task.startDate ?? '').trim() || '—'}" ว่างหรือผิด (SOF "${String(task.sofName || '').trim() || '(ว่าง)'}")\nFrom your file: Plan start "${String(task.startDate ?? '').trim() || '—'}", SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
          );
          continue;
        }
        if (!task.Eng_ids || task.Eng_ids.length === 0) {
          const engRawBulk = String((task as { _importEngineerRaw?: string })._importEngineerRaw ?? '').trim() || '—';
          errors.push(
            `${bulkRowHead} ชื่อวิศวกรในไฟล์ "${engRawBulk}" ไม่ตรงในระบบ (SOF "${String(task.sofName || '').trim() || '(ว่าง)'}")\nFrom your file: Engineer "${engRawBulk}", SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
          );
          continue;
        }
        if (!task.title) {
          errors.push(
            `${bulkRowHead} ไม่มี Title/Coverage scope (SOF "${String(task.sofName || '').trim() || '(ว่าง)'}", SLid ${task.Sid || task.siteId || '—'})\nFrom your file: SOF "${String(task.sofName || '').trim() || '(ว่าง)'}".`
          );
          continue;
        }

        const sofTrimBulk = (task.sofName && String(task.sofName).trim()) || '';
        if (!sofTrimBulk) {
          errors.push(
            `${bulkRowHead} SOF ว่าง — SLid ${task.Sid || task.siteId || '—'}, Site "${task.Sname || task.siteName || '—'}"\nFrom your file: Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'}, SOF ว่าง.`
          );
          continue;
        }
        const contractIdBulk = task.contractId ? Number(task.contractId) : null;
        if (!contractIdBulk) {
          errors.push(
            `${bulkRowHead} SOF "${sofTrimBulk}" ไม่ตรงสัญญาในระบบ (Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'})\nFrom your file: SOF "${sofTrimBulk}", Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'}.`
          );
          continue;
        }
        const contractBulk = availableContracts.find(c => c.contract_id === contractIdBulk);
        if (contractBulk?.end_date) {
          const endDate = new Date(contractBulk.end_date);
          endDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (endDate < today) {
            errors.push(
              `${bulkRowHead} สัญญา SOF "${sofTrimBulk}" หมดอายุแล้ว (Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'})\nFrom your file: SOF "${sofTrimBulk}", Site "${task.Sname || task.siteName || '—'}", SLid ${task.Sid || task.siteId || '—'}.`
            );
            continue;
          }
        }

        // ===== Prepare payload according to database schema (tasks.sql) =====
        const engineersArray = task.Eng_ids
          ? task.Eng_ids.map((e: Engineer) => ({
              id: String(e.id),
              name: e.name || '',
              lastName: e.lastName || '',
            }))
          : [];

        // assets → JSON array with full device data (empty allowed — plan without devices)
        let assetsArray: ImportedAssetPayload[] = [];
        if (task.devices && task.devices.length > 0) {
          const siteLabel = task.Sname || task.siteName || null;
          const slid = Number(task.Sid) || task.SLid || null;
          assetsArray = task.devices.map((device) => deviceRowToImportedAsset(device, siteLabel, slid));
        } else if (task.deviceIds && task.deviceIds.length > 0) {
          // Fallback: if no devices but has deviceIds, fetch all device details from API
          console.warn(`⚠️ Task "${task.siteName}" has deviceIds but no devices array. Fetching device details...`);
          try {
            const siteLabel = task.Sname || task.siteName || null;
            const slid = Number(task.Sid) || null;
            const devicePromises = task.deviceIds.map(async (did: number) => {
              try {
                const res = await apiFetch(apiUrl(`/api/devices/${did}`));
                const json = await responseJsonSafe<{ success?: boolean; data?: Record<string, unknown> }>(res);
                if (json?.success && json.data) {
                  return apiDeviceJsonToImportedAsset(json.data, did, siteLabel, slid);
                }
              } catch (err) {
                console.error(`Error fetching device ${did}:`, err);
              }
              return minimalImportedAsset(did, siteLabel);
            });
            assetsArray = await Promise.all(devicePromises);
          } catch (error) {
            console.error('Error fetching device details:', error);
            assetsArray = task.deviceIds.map((did: number) =>
              minimalImportedAsset(did, task.Sname || task.siteName || null)
            );
          }
        }
        
        // contract_id from sof_name lookup (if still not found, search again)
        let contractId = task.contractId ? Number(task.contractId) : null;
        if (!contractId && task.sofName) {
          const contract = availableContracts.find(
            (c) => c.sof_name && normalizeImportSofKey(String(c.sof_name)) === normalizeImportSofKey(String(task.sofName))
          );
          if (contract) contractId = contract.contract_id;
        }
        
        // Combine siteName and location for display
        const siteNameValue = task.Sname || task.siteName || '';
        const locationValue = task.location || '';
        const siteNameWithLocation = locationValue 
          ? `${siteNameValue} - ${locationValue}` 
          : siteNameValue;
        
        // coverageScope should be the correct value (sid-lid format or PM Task - Site - Location)
        // notes = in-process / โน้ตงาน; reschedule ใช้ reschedule_note เมื่อย้ายวัน
        const payload = {
          taskType: 'PM',                                               // task_type always 'PM'
          contractId: contractId,                                        // contract_id int(11) - from sof_name lookup
          siteId: Number(task.Sid || task.siteId) || null,              // site_id int(11)
          siteName: siteNameWithLocation,                                 // site_name varchar(255) - includes location
          vendorName: task.vendorName || null,                          // vendor_name varchar(255)
          coverageScope: task.coverageScope || task.title || '',        // coverage_scope text (stored as sid-lid format or PM Task - Site - Location)
          startDate: task.startDate,                                     // start_date date NOT NULL
          endDate: task.endDate || task.startDate,                      // end_date date NOT NULL
          engineers: engineersArray,                                     // engineers longtext JSON
          assets: assetsArray,                                           // assets longtext JSON
          assetBinding: task.assetBinding || null,                      // asset_binding varchar(255)
          replacementDeviceId: null,                                     // replacement_device_id int(11)
          status: 'not-started',                                         // status enum('not-started','working','stuck','done')
          actuallyWent: false,                                           // actually_went tinyint(1)
          notes: task.notes != null && String(task.notes).trim() ? String(task.notes).trim() : null,
          rescheduleNote:
            task.rescheduleNote != null && String(task.rescheduleNote).trim()
              ? String(task.rescheduleNote).trim()
              : null,
          photos: [],                                                    // photos longtext JSON
        };

        // Call API directly to match database requirements
        const res = await apiFetch(apiUrl('/api/tasks'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await responseJsonOrThrow<{ success: boolean; message?: string; data?: unknown }>(
          res,
          `Failed to create task (preview row ${bulkRow}): server returned HTML or invalid JSON — check NEXT_PUBLIC_API_URL matches your API (e.g. port 9000).`
        );
        if (!json.success) {
          throw new Error(json.message || 'Failed to create task');
        }
        
        // Update local state
        const mapped = mapTaskToEvent((json.data ?? {}) as ApiTask);
        setCalendarEvents((events) => [...events, mapped]);
        successCount++;
      } catch (error: unknown) {
        const sheetN = task._importSheetRow;
        const head =
          sheetN != null
            ? `Preview row ${bulkRow} (spreadsheet row ${sheetN}):`
            : `Preview row ${bulkRow}:`;
        errors.push(
          `${head} สร้างงานไม่สำเร็จ (Site "${task.Sname || task.siteName || '—'}", SOF "${String(task.sofName || '').trim() || '—'}"): ${getErrorMessage(error) || 'ไม่ทราบสาเหตุ'}\nFrom your file: Site "${task.Sname || task.siteName || '—'}", SOF "${String(task.sofName || '').trim() || '—'}".`
        );
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      if (errors.length > 0) {
        toastSuccess(
          `Created ${successCount} task(s). ${errors.length} row(s) could not be imported.`
        );
      } else {
        toastSuccess(`Successfully created ${successCount} tasks!`);
      }
      setIsImportModalOpen(false);
      setImportedTasks([]);
      setImportErrors([]);
      setImportResultTab('ready');
      try {
        await loadTasksFromApi();
      } catch (loadErr) {
        console.error('loadTasksFromApi after import:', loadErr);
      }
      return;
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      setImportResultTab('issues');
      toastError(
        `Failed to create tasks. ${errors.slice(0, 3).join(' ')}${errors.length > 3 ? ` … +${errors.length - 3} more` : ''}`
      );
    }
  };

  // Handle task update from detail modal (for status updates only)
  const handleTaskUpdate = async (updatedTask: TaskUpdateInput) => {
    const originalEvent = calendarEvents.find((e) => e.id === updatedTask.id);
    const originalStartDate = originalEvent?.startDate;
    const originalEndDate = originalEvent?.endDate;

    const payload: { status?: CalendarEvent['status']; notes?: string | null } = {
      status: updatedTask.status,
    };
    if (updatedTask.notes !== undefined) {
      payload.notes = updatedTask.notes ?? null;
    }
    let serverTask: Record<string, unknown> | null = null;
    try {
      const res = await apiFetch(apiUrl(`/api/tasks/${updatedTask.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await responseJsonOrThrow<{
        success: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }>(res, 'Update status failed: server returned non-JSON (check API URL).');
      if (!json.success) {
        throw new Error(json.message || 'Update status failed');
      }
      serverTask = json.data && typeof json.data === 'object' ? json.data : null;
      toastSuccess('Update status successfully');
    } catch (error) {
      console.error('handleTaskUpdate error', error);
      toastError('Update status failed');
      await loadTasksFromApi();
      return;
    }

    const mergeFromServer = (ev: (typeof calendarEvents)[number]) => {
      const base = {
        ...ev,
        status: updatedTask.status,
        ...(updatedTask.notes !== undefined ? { notes: updatedTask.notes ?? undefined } : {}),
        startDate: originalStartDate || ev.startDate,
        endDate: originalEndDate || ev.endDate,
      };
      if (!serverTask) return base;
      const d = serverTask;
      return {
        ...base,
        ...(typeof d.uptimeDate === 'string' && d.uptimeDate ? { uptimeDate: d.uptimeDate } : {}),
        ...(typeof d.uptimeTime === 'string' && d.uptimeTime ? { uptimeTime: d.uptimeTime } : {}),
        ...(d.downtimeTotalHours != null && d.downtimeTotalHours !== ''
          ? { downtimeTotalHours: Number(d.downtimeTotalHours) }
          : {}),
      };
    };

    setCalendarEvents((prevEvents) => {
      const updatedEvents = prevEvents.map((event) =>
        event.id === updatedTask.id ? mergeFromServer(event) : event
      );
      if (selectedTask && selectedTask.id === updatedTask.id) {
        const updated = updatedEvents.find((e) => e.id === updatedTask.id);
        if (updated) setSelectedTask(updated);
      }
      return updatedEvents;
    });

    setIsDetailModalOpen(false);
    setSelectedTask(null);
    router.push('/calendar');
  };

  /* ================= Render ================= */
  return (
    <SidebarLayout>
      <DashboardHeader />

      <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        {loadError && (
          <div className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 border border-red-100">
            {loadError}
          </div>
        )}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="page-heading">
              Schedule Management
            </h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={() => {
                  setImportedTasks([]);
                  setImportErrors([]);
                  setImportResultTab('ready');
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-green-600 transition-colors"
              >
                <Download size={16} /> Import Plans
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
              >
                <Plus size={16} /> Add Plan
              </button>
            </div>
          </div>
          {/* Filters: Engineer (multi), Type (PM/MA), Status (Done/Not done) */}
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="relative flex items-center gap-2 flex-1 sm:flex-none sm:min-w-[240px] max-w-[320px]" ref={engineerFilterRef}>
              <label htmlFor="engineer-filter-input" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Engineer:
              </label>
              <div
                id="engineer-filter"
                className={`flex-1 sm:min-w-[200px] min-h-[40px] px-3 py-1.5 rounded-xl border-0 bg-card text-sm font-medium text-muted-foreground shadow-sm flex flex-wrap gap-1.5 items-center ${showEngineerFilterDropdown && filteredEngineersForFilter.length > 0 ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => document.getElementById('engineer-filter-input')?.focus()}
              >
                {selectedEngineerFilter.length === 0 && !engineerFilterInput && (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Users size={18} className="shrink-0 text-muted-foreground" aria-hidden />
                    All Engineers
                  </span>
                )}
                {selectedEngineerFilter.map((id) => {
                  const eng = availableEngineers.find((e) => String(e.id) === id);
                  const label = eng ? engineerRosterLabel(eng) : id;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-medium"
                    >
                      <EngineerAvatar
                        photoUrl={eng?.photo}
                        displayName={label}
                        size="sm"
                      />
                      {label}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeEngineerFilter(id); }}
                        className="hover:bg-blue-200 rounded p-0.5"
                        aria-label="Remove"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                <input
                  id="engineer-filter-input"
                  type="text"
                  value={engineerFilterInput}
                  onChange={(e) => { setEngineerFilterInput(e.target.value); setShowEngineerFilterDropdown(true); }}
                  onFocus={() => setShowEngineerFilterDropdown(true)}
                  onBlur={() => setTimeout(() => setShowEngineerFilterDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredEngineersForFilter.length > 0) {
                      addEngineerFilter(filteredEngineersForFilter[0]);
                    }
                    if (e.key === 'Backspace' && !engineerFilterInput && selectedEngineerFilter.length > 0) {
                      removeEngineerFilter(selectedEngineerFilter[selectedEngineerFilter.length - 1]);
                    }
                  }}
                  placeholder=""
                  className="flex-1 min-w-[80px] py-1 bg-transparent outline-none border-0 text-muted-foreground placeholder:text-muted-foreground"
                />
              </div>
              {showEngineerFilterDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 min-w-[200px] max-h-48 overflow-auto rounded-xl border border-border bg-card shadow-lg py-1">
                  {availableEngineers.length === 0 ? (
                    <div className="px-3 py-2 text-muted-foreground text-sm">Loading engineers...</div>
                  ) : filteredEngineersForFilter.length === 0 ? (
                    <div className="px-3 py-2 text-muted-foreground text-sm">{engineerFilterInput ? 'No engineers found' : 'All selected'}</div>
                  ) : (
                    filteredEngineersForFilter.map((eng) => {
                      const dn = engineerRosterLabel(eng);
                      return (
                        <button
                          key={eng.id}
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                          onClick={() => addEngineerFilter(eng)}
                        >
                          <EngineerAvatar photoUrl={eng.photo} displayName={dn} size="md" />
                          <span className="min-w-0 truncate">{dn}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="task-type-filter-schedule" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Type:
              </label>
              <select
                id="task-type-filter-schedule"
                value={selectedTaskTypeFilter}
                onChange={(e) => setSelectedTaskTypeFilter(e.target.value as 'all' | 'PM' | 'MA')}
                className="px-4 py-2 rounded-xl border-0 bg-card text-sm font-medium text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[100px] shadow-sm transition-colors"
              >
                <option value="all">All</option>
                <option value="PM">PM</option>
                <option value="MA">MA</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter-schedule" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Status:
              </label>
              <select
                id="status-filter-schedule"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as 'all' | 'done' | 'in-progress' | 'pending' | 'overdue')}
                className="px-4 py-2 rounded-xl border-0 bg-card text-sm font-medium text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[120px] shadow-sm transition-colors"
              >
                <option value="all">All</option>
                <option value="done">Done</option>
                <option value="overdue">Overdue</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        <AddTaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveFromModal}
          editingEvent={editingEvent}
          reportedPMTaskIds={reportedPMTaskIds}
          reportedMATaskIds={reportedMATaskIds}
        />

        <div
          className={`rounded-[2.5rem] bg-card border border-border p-6 shadow-sm ${
            calendarViewMode === 'calendar'
              ? 'flex min-h-0 flex-1 flex-col xl:min-h-[calc(100dvh-8rem)]'
              : ''
          }`}
        >
          <div className="mb-6 flex shrink-0 items-center gap-4">
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(true)}
                className="px-4 py-2 rounded-xl text-amber-800 text-sm font-medium hover:bg-amber-100 border border-amber-200"
              >
                Holidays
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center gap-8">
              <button
                onClick={goToPreviousMonth}
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="page-heading">
                {monthNames[currentMonth]}, {currentYear}
              </span>
              <button
                onClick={goToNextMonth}
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </div>
            <div className="flex-shrink-0">
              <div className="flex rounded-xl border border-border p-0.5 bg-muted">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-muted-foreground'}`}
                >
                  <LayoutGrid size={16} />
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-muted-foreground'}`}
                >
                  <List size={16} />
                  Table
                </button>
              </div>
            </div>
          </div>

          {calendarViewMode === 'table' ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="table-filter-year" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Year:
                    </label>
                    <select
                      id="table-filter-year"
                      value={tableFilterYear}
                      onChange={(e) => setTableFilterYear(e.target.value)}
                      className={`${tableSelectClass} min-w-[5.5rem]`}
                    >
                      <option value="">All</option>
                      {tableFilterYearOptions.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="table-filter-month" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Month:
                    </label>
                    <select
                      id="table-filter-month"
                      value={tableFilterMonth}
                      onChange={(e) => setTableFilterMonth(e.target.value)}
                      className={`${tableSelectClass} min-w-[7rem]`}
                    >
                      <option value="">All</option>
                      {TABLE_MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={String(idx + 1)}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="table-filter-sof" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      SOF:
                    </label>
                    <select
                      id="table-filter-sof"
                      value={tableFilterSof}
                      onChange={(e) => setTableFilterSof(e.target.value)}
                      className={`${tableSelectClass} min-w-[8rem] max-w-[14rem]`}
                    >
                      <option value="">All</option>
                      {tableFilterSofOptions.map((sof) => (
                        <option key={sof} value={sof}>
                          {sof}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex min-w-[10rem] flex-1 items-center gap-2">
                    <label htmlFor="table-filter-site" className="shrink-0 text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Site:
                    </label>
                    <select
                      id="table-filter-site"
                      value={tableFilterSite}
                      onChange={(e) => setTableFilterSite(e.target.value)}
                      className={`${tableSelectClass} min-w-[10rem] max-w-md flex-1`}
                    >
                      <option value="">All sites</option>
                      {tableFilterSiteOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {tableBulkFiltersActive && (
                    <button
                      type="button"
                      onClick={resetTableBulkFilters}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-muted-foreground"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {tableTasksFiltered.length} plan(s) · {tableSelectedIds.size} selected
                  </span>
                  {tableTasksFiltered.length > 0 && tableSelectedIds.size < tableTasksFiltered.length && (
                    <button
                      type="button"
                      onClick={selectAllFilteredTableTasks}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      Select all {tableTasksFiltered.length}
                    </button>
                  )}
                  {tableSelectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setTableSelectedIds(new Set())}
                      className="text-xs font-semibold text-muted-foreground hover:text-muted-foreground whitespace-nowrap"
                    >
                      Clear selection
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={tableSelectedIds.size === 0 || isBulkDeleting}
                    onClick={handleBulkDeleteSelected}
                    className={`ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors whitespace-nowrap ${
                      tableSelectedIds.size === 0 || isBulkDeleting
                        ? 'cursor-not-allowed bg-slate-300'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    <Trash2 size={16} />
                    {isBulkDeleting ? 'Deleting…' : `Delete selected (${tableSelectedIds.size})`}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="w-10 py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={tablePageAllSelected}
                          onChange={toggleTablePageSelection}
                          disabled={paginatedTableTasks.length === 0}
                          className="rounded border-border"
                          aria-label="Select all on this page"
                          title="Select all on this page"
                        />
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                        <span className="block">Date</span>
                        <span className="block text-[10px] font-normal text-muted-foreground normal-case">mm/dd/yyyy</span>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground whitespace-nowrap">Status Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Task</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground whitespace-nowrap">SOF</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Responsible</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableTasksFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground">
                          {filteredCalendarEvents.length === 0
                            ? 'No tasks match the schedule filters above'
                            : 'No tasks match these table filters'}
                        </td>
                      </tr>
                    ) : (
                      paginatedTableTasks.map((ev) => {
                        const isMA = ev.taskType === 'MA';
                        const isDone = ev.status === 'done';
                        const hasReport = isMA ? reportedMATaskIds.has(Number(ev.id)) : reportedPMTaskIds.has(Number(ev.id));
                        const endDateStr = ev.endDate || ev.startDate || '';
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endDate = endDateStr ? new Date(endDateStr) : null;
                        if (endDate) endDate.setHours(0, 0, 0, 0);
                        const isOverdue = !isDone && endDate && endDate < today;

                        let incomingText = '—';
                        let incomingTone: 'future' | 'today' | 'overdue' | 'neutral' = 'neutral';
                        if (isDone) {
                          incomingText = '—';
                        } else if (endDate) {
                          const msDay = 86400000;
                          const diffDays = Math.round((endDate.getTime() - today.getTime()) / msDay);
                          if (diffDays > 0) {
                            incomingText = diffDays === 1 ? 'In 1 day' : `In ${diffDays} days`;
                            incomingTone = 'future';
                          } else if (diffDays === 0) {
                            incomingText = 'Due today';
                            incomingTone = 'today';
                          } else {
                            const overdueDays = -diffDays;
                            incomingText =
                              overdueDays === 1 ? 'Overdue 1 day' : `Overdue ${overdueDays} days`;
                            incomingTone = 'overdue';
                          }
                        }
                        const isInProcess = ev.status === 'working';
                        const statusLabel = isDone
                          ? 'Done'
                          : isOverdue
                            ? 'Overdue'
                            : hasReport && isMA
                              ? 'Reported'
                              : ev.status === 'working'
                                ? 'In process'
                                : ev.status === 'stuck'
                                  ? 'Stuck'
                                  : 'Pending';
                        return (
                          <tr
                            key={ev.id}
                            draggable={!isDone}
                            onDragStart={() => beginTaskDrag(ev)}
                            onDragEnd={handleDragEnd}
                            className={`border-b border-border hover:bg-muted/50 transition-colors ${!isDone ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedEvent?.id === ev.id ? 'opacity-50' : ''} ${tableSelectedIds.has(String(ev.id)) ? 'bg-blue-50/40' : ''}`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={tableSelectedIds.has(String(ev.id))}
                                onChange={() => toggleTableTaskSelection(String(ev.id))}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="rounded border-border"
                                aria-label={`Select plan ${ev.title}`}
                              />
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                              {ev.startDate === ev.endDate || !ev.endDate
                                ? formatDateMonthDayYear(
                                    ev.startDate ||
                                      `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(ev.startDay).padStart(2, '0')}`
                                  )
                                : `${formatDateMonthDayYear(ev.startDate)} – ${formatDateMonthDayYear(ev.endDate)}`}
                            </td>
                            <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                              <span
                                className={
                                  incomingTone === 'future'
                                    ? 'text-sky-700 font-medium'
                                    : incomingTone === 'today'
                                      ? 'text-amber-800 font-medium'
                                      : incomingTone === 'overdue'
                                        ? 'text-red-700 font-medium'
                                        : 'text-muted-foreground'
                                }
                              >
                                {incomingText}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-medium text-foreground max-w-[280px] truncate xl:max-w-none" title={ev.title}>{ev.title}</td>
                            <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                              {tableTaskSofLabel(ev, availableContracts) || '—'}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isMA ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ev.taskType || 'PM'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground">{ev.engineer || '—'}</td>
                            <td className="py-2.5 px-4 align-top min-w-[9rem] max-w-[min(100%,240px)]">
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isInProcess
                                      ? 'bg-amber-100 text-amber-800'
                                      : isOverdue
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {isInProcess && <Clock3 size={12} className="shrink-0" strokeWidth={2.5} />}
                                {statusLabel}
                              </span>
                              {isInProcess && (
                                <p className="mt-1 text-[11px] text-amber-900/90 line-clamp-2">
                                  {getScheduleInProcessReason(ev)}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <button
                                type="button"
                                onClick={() => { setSelectedTask(ev); setIsDetailModalOpen(true); }}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {tableTasksFiltered.length > TABLE_PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted">
                  <p className="text-xs text-muted-foreground">
                    Showing {(tablePage - 1) * TABLE_PAGE_SIZE + 1}–{Math.min(tablePage * TABLE_PAGE_SIZE, tableTasksFiltered.length)} of {tableTasksFiltered.length}
                    {filteredCalendarEvents.length !== tableTasksFiltered.length
                      ? ` (from ${filteredCalendarEvents.length} in list)`
                      : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage <= 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {tablePage} of {totalTablePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                      disabled={tablePage >= totalTablePages}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted xl:min-h-[calc(100dvh-14rem)]">
            {/* Header row */}
            <div className="grid shrink-0 grid-cols-7 gap-px">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <div
                  key={day}
                  className={`bg-muted p-3 text-center text-xs font-bold uppercase xl:py-4 ${index === 0 || index === 6
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-slate-500 to-slate-600 bg-clip-text text-transparent'
                    }`}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* มี task ในเดือนนี้ → ความสูงตามเนื้อหา; ไม่มี → แถวเท่ากันเต็มกรอบ */}
            <div
              className={
                tasksInCurrentMonth.length > 0
                  ? 'flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overflow-x-hidden xl:min-h-0'
                  : 'flex min-h-0 flex-1 flex-col gap-px overflow-hidden xl:min-h-0'
              }
            >
            {calendarWeeks.map((week, weekIndex) => {
              const multiDaySpans = getMultiDaySpansForWeek(week);
              const multiDaySpansWithRow = assignRowsToMultiDaySpans(multiDaySpans);
              const multiDayRowCount = multiDaySpansWithRow.length > 0 ? Math.max(...multiDaySpansWithRow.map(s => s.row)) + 1 : 0;
              const BAR_HEIGHT = 28;
              const TASK_GAP = 4;
              const DAY_HEADER_PX = 28;
              const HOLIDAY_EXTRA_PX = 20;
              const CELL_PAD_TOP_PX = 8; // matches p-2
              const CELL_PAD_PX = 16;
              const PILL_ROW_PX = 36;
              const MIN_VISIBLE_PILL_ROWS = 2;
              const weekHasHoliday = week.some((d) => d !== null && Boolean(getHolidayForDay(d)));
              const weekHeaderPx = DAY_HEADER_PX + (weekHasHoliday ? HOLIDAY_EXTRA_PX : 0);
              const multiDayTopOffset =
                CELL_PAD_TOP_PX + weekHeaderPx + (multiDayRowCount > 0 ? TASK_GAP : 0);
              const multiDayBarsBlockPx =
                multiDayRowCount > 0
                  ? multiDayRowCount * BAR_HEIGHT + Math.max(0, multiDayRowCount - 1) * TASK_GAP
                  : 0;
              const weekMultiDayLaneAfterHeaderPx =
                multiDayRowCount > 0 ? multiDayBarsBlockPx + TASK_GAP : 0;
              const multiDayEventIds = new Set(multiDaySpans.map(({ event }) => event.id));
              const dayLayouts = week.map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day);
                const singleDayEventsOnly = dayEvents.filter(ev => !multiDayEventIds.has(ev.id));
                const spansCoveringThisDay = multiDaySpansWithRow.filter(s => dayIndex >= s.colStart && dayIndex <= s.colEnd);
                const hasMultiDayBarAbove = spansCoveringThisDay.length > 0;
                const holidayForDay = getHolidayForDay(day);
                const dayKey = day === null ? '' : dayExpandKey(day);
                const isDayExpanded = day !== null && expandedDayKeys.has(dayKey);
                const hiddenPillCount = Math.max(0, singleDayEventsOnly.length - MAX_VISIBLE_DAY_PILLS);
                const visibleSingleDayEvents =
                  isDayExpanded || hiddenPillCount === 0
                    ? singleDayEventsOnly
                    : singleDayEventsOnly.slice(0, MAX_VISIBLE_DAY_PILLS);
                const showMoreLink = !isDayExpanded && hiddenPillCount > 0;
                const showLessLink = isDayExpanded && hiddenPillCount > 0;
                const nPills = visibleSingleDayEvents.length + (showMoreLink || showLessLink ? 1 : 0);
                const nPillsForHeight = day === null ? 0 : Math.max(nPills, MIN_VISIBLE_PILL_ROWS);
                const pillsStackPx = nPillsForHeight * PILL_ROW_PX;
                const headerPx = DAY_HEADER_PX + (holidayForDay ? HOLIDAY_EXTRA_PX : 0);
                const headerAlignPadPx = Math.max(0, weekHeaderPx - headerPx);
                const pillsMtPx =
                  weekMultiDayLaneAfterHeaderPx > 0
                    ? headerAlignPadPx + weekMultiDayLaneAfterHeaderPx
                    : nPillsForHeight > 0
                      ? 6
                      : 0;
                let cellMinH: number;
                if (day === null) {
                  cellMinH = 40;
                } else {
                  cellMinH = Math.ceil(
                    headerPx + pillsMtPx + pillsStackPx + CELL_PAD_PX + 4
                  );
                }
                return {
                  cellMinH,
                  singleDayEventsOnly: visibleSingleDayEvents,
                  hiddenPillCount,
                  showMoreLink,
                  showLessLink,
                  hasMultiDayBarAbove,
                  holidayForDay,
                  pillsStackPx,
                  pillsMtPx,
                };
              });
              const weekRowMinH = Math.max(48, ...dayLayouts.map(l => l.cellMinH));
              const expandCalendarByTasks = tasksInCurrentMonth.length > 0;
              return (
                <div
                  key={weekIndex}
                  className={
                    expandCalendarByTasks
                      ? 'relative grid shrink-0 grid-cols-7 gap-px overflow-hidden'
                      : 'relative grid min-h-[3.5rem] flex-1 grid-cols-7 grid-rows-[minmax(0,1fr)] gap-px overflow-hidden sm:min-h-[4rem] xl:min-h-[5rem]'
                  }
                  style={{ minHeight: weekRowMinH }}
                >
                  {week.map((day, dayIndex) => {
                    const {
                      cellMinH,
                      singleDayEventsOnly,
                      hiddenPillCount,
                      showMoreLink,
                      showLessLink,
                      hasMultiDayBarAbove,
                      holidayForDay,
                      pillsStackPx,
                      pillsMtPx,
                    } = dayLayouts[dayIndex];
                    return (
                      <div
                        key={dayIndex}
                        onDrop={e => handleDrop(e, day)}
                        onDragOver={e => e.preventDefault()}
                        className={`relative flex h-full min-h-0 flex-col overflow-hidden border-l border-t border-border p-2 ${day === null ? 'bg-muted' : holidayForDay ? 'bg-red-100' : 'bg-card'
                          } ${day !== null && dragOverDay === day && draggedEvent
                            ? 'border-2 border-blue-300 bg-blue-50'
                            : ''
                          }`}
                        style={{ minHeight: cellMinH }}
                      >
                        {day !== null && (
                          <>
                            <div className="shrink-0">
                              <span
                                className={`text-xs font-bold ${isToday(day)
                                    ? 'bg-gradient-to-br from-sky-500 to-pink-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md text-[10px]'
                                    : 'bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent'
                                  }`}
                              >
                                {day}
                              </span>
                              {holidayForDay && (
                                <span className="block mt-0.5 text-[10px] font-medium text-amber-700 truncate" title={holidayForDay.name}>
                                  {holidayForDay.name}
                                </span>
                              )}
                            </div>
                            {/* มี task ในเดือน → flex-none + min สูงตาม pills; ไม่มี → flex-1 เติมเซลล์ */}
                            <div
                              className={`flex w-full flex-col overflow-x-hidden [scrollbar-width:thin] space-y-0.5 relative z-[5] ${expandCalendarByTasks ? 'flex-none overflow-y-auto' : 'min-h-0 flex-1 overflow-y-hidden'}`}
                              style={{
                                ...(pillsMtPx > 0 ? { marginTop: `${pillsMtPx}px` } : {}),
                                ...(pillsStackPx > 0 ? { minHeight: pillsStackPx } : {}),
                              }}
                            >
                              {singleDayEventsOnly.map((ev, eventIndex) => {
                                const isMA = ev.taskType === 'MA';
                                const isDone = ev.status === 'done';
                                const hasReport = isMA ? reportedMATaskIds.has(Number(ev.id)) : reportedPMTaskIds.has(Number(ev.id));
                                const endDateStr = ev.endDate || ev.startDate || '';
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const endDate = endDateStr ? new Date(endDateStr) : null;
                                if (endDate) endDate.setHours(0, 0, 0, 0);
                                const isOverdue = !isDone && endDate && endDate < today;
                                const isInProcess = ev.status === 'working';
                                // สีตามสถานะ: เสร็จแล้ว=เขียว, กำลังทำ=เหลือง, เลยกำหนด=แดง, MA=ม่วง, PM=ฟ้า
                                const pillStyle = isDone
                                  ? 'border-l-4 border-l-emerald-500 bg-emerald-50/90 text-emerald-800'
                                  : isInProcess
                                    ? 'border-l-4 border-l-amber-500 bg-amber-50/90 text-amber-950'
                                    : isOverdue
                                      ? 'border-l-4 border-l-red-500 bg-red-50/90 text-red-800'
                                      : isMA
                                        ? 'border-l-4 border-l-purple-500 bg-purple-50/90 text-purple-800'
                                        : 'border-l-4 border-l-blue-500 bg-sky-50/90 text-blue-800';
                                return (
                                  <div
                                    key={`${day}-${ev.id}-${eventIndex}`}
                                    data-task-id={String(ev.id)}
                                    draggable={!isDone}
                                    onDragStart={() => beginTaskDrag(ev)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => handleTaskClick(ev)}
                                    onMouseEnter={(e) => {
                                      setHoveredEvent(ev);
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const tooltipWidth = 320;
                                      const tooltipHeight = 400;
                                      const padding = 16;
                                      const spaceOnRight = window.innerWidth - rect.right;
                                      const spaceOnLeft = rect.left;
                                      const spaceOnBottom = window.innerHeight - rect.bottom;
                                      let x = rect.right + 10;
                                      let y = rect.top;
                                      if (spaceOnRight < tooltipWidth + 20 && spaceOnLeft >= tooltipWidth + 20) x = rect.left - tooltipWidth - 10;
                                      if (spaceOnBottom < tooltipHeight && rect.top > tooltipHeight) y = rect.bottom - tooltipHeight;
                                      x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
                                      y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));
                                      setTooltipPosition({ x, y });
                                    }}
                                    onMouseLeave={() => { setHoveredEvent(null); setTooltipPosition(null); }}
                                    className={`box-border flex h-[28px] min-h-[28px] max-h-[28px] min-w-0 w-full shrink-0 flex-nowrap items-center leading-none rounded-none pl-2.5 pr-3 py-1 text-[10px] font-semibold shadow-sm overflow-hidden ${pillStyle} ${isDone ? 'cursor-pointer opacity-90' : 'cursor-move'} transition-colors ${draggedEvent?.id === ev.id ? 'opacity-50' : ''} ${hasMultiDayBarAbove && eventIndex === 0 ? 'mt-0' : 'mt-1'} ${highlightTaskId === String(ev.id) ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                                  >
                                    <span className="flex-shrink-0 mr-1.5 px-1 py-0.5 leading-none rounded-none text-[9px] font-bold bg-card/60">
                                      {isMA ? 'MA' : 'PM'}
                                    </span>
                                    <span className={`flex-1 min-w-0 truncate leading-none ${isDone ? 'line-through' : ''}`}>
                                      {scheduleInProcessTitleText(ev)}
                                    </span>
                                    {ev.Eng_ids && ev.Eng_ids.length > 0 && (
                                      <span className="flex flex-shrink-0 ml-1.5 relative inline-block" title={ev.Eng_ids.map(e => `${e.name}${e.lastName ? ' ' + e.lastName : ''}`).join(', ')}>
                                        <span className="inline-flex h-5 w-5 rounded-full overflow-hidden border border-white bg-muted ring-1 ring-slate-300">
                                          {ev.Eng_ids[0].photo ? (
                                            <Image
                                              src={ev.Eng_ids[0].photo.startsWith('http') ? ev.Eng_ids[0].photo : apiUrl(ev.Eng_ids[0].photo)}
                                              alt=""
                                              width={20}
                                              height={20}
                                              unoptimized
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-muted-foreground">
                                              {(ev.Eng_ids[0].name?.[0] || ev.Eng_ids[0].id?.[0] || '?').toUpperCase()}
                                            </span>
                                          )}
                                        </span>
                                        {ev.Eng_ids.length > 1 && (
                                          <span className="absolute bottom-0.5 -right-1 inline-flex h-3 w-3 rounded-full border border-white bg-slate-300 ring-1 ring-slate-300 items-center justify-center text-[6px] font-bold text-muted-foreground leading-none">
                                            +{ev.Eng_ids.length - 1}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {hasReport && (
                                      <span className="ml-1 flex-shrink-0 text-emerald-600" title="Reported">
                                        <FileCheck size={12} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {isDone && !hasReport && (
                                      <span className="ml-1 flex-shrink-0 text-rose-600" title="No report">
                                        <FileX2 size={12} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {isInProcess && (
                                      <span className="ml-1 flex-shrink-0 text-amber-700">
                                        <Clock3 size={12} strokeWidth={2.5} aria-hidden />
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {showMoreLink && day !== null && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDayExpanded(day);
                                  }}
                                  className={`mt-1 w-full shrink-0 rounded-none px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${hasMultiDayBarAbove && singleDayEventsOnly.length === 0 ? 'mt-0' : ''}`}
                                >
                                  +{hiddenPillCount} more
                                </button>
                              )}
                              {showLessLink && day !== null && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDayExpanded(day);
                                  }}
                                  className="mt-1 w-full shrink-0 rounded-none px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                >
                                  Show less
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {/* แถบงานหลายวัน — แสดงในช่องวันแรกและลากข้ามช่อง (จัดหลายแถวถ้าซ้อนกัน) */}
                  {multiDaySpansWithRow.map(({ event, colStart, colEnd, row }) => {
                    const isMA = event.taskType === 'MA';
                    const isDone = event.status === 'done';
                    const hasReport = isMA ? reportedMATaskIds.has(Number(event.id)) : reportedPMTaskIds.has(Number(event.id));
                    const endDateStr = event.endDate || event.startDate || '';
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const endDate = endDateStr ? new Date(endDateStr) : null;
                    if (endDate) endDate.setHours(0, 0, 0, 0);
                    const isOverdue = !isDone && endDate && endDate < today;
                    const isInProcess = event.status === 'working';
                    // สีตามสถานะ: เสร็จแล้ว=เขียว, กำลังทำ=เหลือง, เลยกำหนด=แดง, MA=ม่วง, PM=ฟ้า
                    const barStyle = isDone
                      ? 'border-l-4 border-l-emerald-500 bg-emerald-50/90 text-emerald-800'
                      : isInProcess
                        ? 'border-l-4 border-l-amber-500 bg-amber-50/90 text-amber-950'
                        : isOverdue
                          ? 'border-l-4 border-l-red-500 bg-red-50/90 text-red-800'
                          : isMA
                            ? 'border-l-4 border-l-purple-500 bg-purple-50/90 text-purple-800'
                            : 'border-l-4 border-l-blue-500 bg-sky-50/90 text-blue-800';
                    const topPx = multiDayTopOffset + row * (BAR_HEIGHT + TASK_GAP);
                    return (
                      <div
                        key={event.id}
                        data-task-id={String(event.id)}
                        style={{
                          gridColumn: `${colStart + 1} / ${colEnd + 2}`,
                          position: 'absolute',
                          top: `${topPx}px`,
                          left: '8px',
                          right: '8px',
                        }}
                        draggable={!isDone}
                        onDragStart={() => beginTaskDrag(event)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleTaskClick(event)}
                        onMouseEnter={(e) => {
                          setHoveredEvent(event);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const tooltipWidth = 320;
                          const tooltipHeight = 400;
                          const padding = 16;
                          const spaceOnRight = window.innerWidth - rect.right;
                          const spaceOnLeft = rect.left;
                          const spaceOnBottom = window.innerHeight - rect.bottom;
                          let x = rect.right + 10;
                          let y = rect.top;
                          if (spaceOnRight < tooltipWidth + 20 && spaceOnLeft >= tooltipWidth + 20) x = rect.left - tooltipWidth - 10;
                          if (spaceOnBottom < tooltipHeight && rect.top > tooltipHeight) y = rect.bottom - tooltipHeight;
                          x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
                          y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));
                          setTooltipPosition({ x, y });
                        }}
                        onMouseLeave={() => { setHoveredEvent(null); setTooltipPosition(null); }}
                        className={`box-border flex h-[28px] min-h-[28px] max-h-[28px] min-w-0 shrink-0 flex-nowrap items-center leading-none rounded-none pl-2.5 pr-3 py-1 text-[10px] font-semibold shadow-sm overflow-hidden ${barStyle} ${isDone ? 'cursor-pointer opacity-90' : 'cursor-move'} transition-colors ${draggedEvent?.id === event.id ? 'opacity-50' : ''} z-20 ${highlightTaskId === String(event.id) ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                      >
                        <span className="flex-shrink-0 mr-1.5 px-1 py-0.5 leading-none rounded-none text-[9px] font-bold bg-card/60">
                          {isMA ? 'MA' : 'PM'}
                        </span>
                        <span className={`flex-1 min-w-0 truncate leading-none ${isDone ? 'line-through' : ''}`}>
                          {scheduleInProcessTitleText(event)}
                        </span>
                        {event.Eng_ids && event.Eng_ids.length > 0 && (
                          <span className="flex flex-shrink-0 ml-1.5 relative inline-block" title={event.Eng_ids.map(e => `${e.name}${e.lastName ? ' ' + e.lastName : ''}`).join(', ')}>
                            <span className="inline-flex h-5 w-5 rounded-full overflow-hidden border border-white bg-muted ring-1 ring-slate-300">
                              {event.Eng_ids[0].photo ? (
                                <Image
                                  src={event.Eng_ids[0].photo.startsWith('http') ? event.Eng_ids[0].photo : apiUrl(event.Eng_ids[0].photo)}
                                  alt=""
                                  width={20}
                                  height={20}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-muted-foreground">
                                  {(event.Eng_ids[0].name?.[0] || event.Eng_ids[0].id?.[0] || '?').toUpperCase()}
                                </span>
                              )}
                            </span>
                            {event.Eng_ids.length > 1 && (
                              <span className="absolute bottom-0.5 -right-1 inline-flex h-3 w-3 rounded-full border border-white bg-slate-300 ring-1 ring-slate-300 items-center justify-center text-[6px] font-bold text-muted-foreground leading-none">
                                +{event.Eng_ids.length - 1}
                              </span>
                            )}
                          </span>
                        )}
                        {hasReport && (
                          <span className="ml-1 flex-shrink-0 text-emerald-600" title="Reported">
                            <FileCheck size={12} strokeWidth={2.5} />
                          </span>
                        )}
                        {isDone && !hasReport && (
                          <span className="ml-1 flex-shrink-0 text-rose-600" title="No report">
                            <FileX2 size={12} strokeWidth={2.5} />
                          </span>
                        )}
                        {isInProcess && (
                          <span className="ml-1 flex-shrink-0 text-amber-700">
                            <Clock3 size={12} strokeWidth={2.5} aria-hidden />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </div>
          )}
        </div>
      </main>

      {/* Task Detail Tooltip */}
      {hoveredEvent && tooltipPosition && (
        <div
          className="fixed z-[300] bg-card rounded-lg shadow-2xl border border-border p-4 max-w-sm pointer-events-none max-h-[calc(100vh-32px)] overflow-y-auto"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(0)',
            maxWidth: 'min(320px, calc(100vw - 32px))'
          }}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-xs font-bold ${
                hoveredEvent.taskType === 'MA' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {hoveredEvent.taskType || 'PM'}
              </span>
              {hoveredEvent.status && (
                <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${
                  hoveredEvent.status === 'done' ? 'bg-green-100 text-green-700' :
                  hoveredEvent.status === 'working' ? 'bg-amber-100 text-amber-800' :
                  hoveredEvent.status === 'stuck' ? 'bg-red-100 text-red-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {hoveredEvent.status === 'working' && <Clock3 size={12} className="shrink-0" strokeWidth={2.5} />}
                  {hoveredEvent.status === 'done' ? 'Done' :
                   hoveredEvent.status === 'working' ? 'In process' :
                   hoveredEvent.status === 'stuck' ? 'Stuck' :
                   'Pending'}
                </span>
              )}
              {(hoveredEvent.taskType === 'MA' ? reportedMATaskIds.has(Number(hoveredEvent.id)) : reportedPMTaskIds.has(Number(hoveredEvent.id))) && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700" title="Reported">
                  <FileCheck size={12} strokeWidth={2.5} className="shrink-0" />
                  Reported
                </span>
              )}
              {hoveredEvent.status === 'done' && !(hoveredEvent.taskType === 'MA' ? reportedMATaskIds.has(Number(hoveredEvent.id)) : reportedPMTaskIds.has(Number(hoveredEvent.id))) && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700" title="No report">
                  <FileX2 size={12} strokeWidth={2.5} className="shrink-0" />
                  No report
                </span>
              )}
            </div>

            {hoveredEvent.status === 'working' && (
              <div className="w-full min-w-0 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                <p className="mb-1 block w-full text-xs font-semibold leading-snug text-amber-800 whitespace-normal">
                  Reason for in process
                </p>
                <p className="text-sm text-amber-950 whitespace-pre-wrap break-words">
                  {getScheduleInProcessReason(hoveredEvent)}
                </p>
              </div>
            )}

            {hoveredEvent.location && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Location</p>
                <p className="text-sm font-bold text-foreground">{hoveredEvent.location}</p>
              </div>
            )}
            {/* Site Name */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Site</p>
              <p className="text-sm font-bold text-foreground">{taskDetailSiteName(hoveredEvent)}</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              {hoveredEvent.startDate && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(hoveredEvent.startDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
              {hoveredEvent.endDate && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">End Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(hoveredEvent.endDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Engineers */}
            {hoveredEvent.Eng_ids && hoveredEvent.Eng_ids.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Engineers</p>
                <div className="flex flex-col gap-1.5">
                  {hoveredEvent.Eng_ids.map((eng, idx) => (
                    <div key={eng.id || idx} className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 rounded-full overflow-hidden border border-border bg-muted">
                        {eng.photo ? (
                          <Image
                            src={eng.photo.startsWith('http') ? eng.photo : apiUrl(eng.photo)}
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                            {(eng.name?.[0] || eng.id?.[0] || '?').toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-foreground">
                        {eng.name}{eng.lastName ? ` ${eng.lastName}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Move Task Reason Modal */}
      {isMoveModalOpen && pendingMove && (
        <div 
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelMoveTask();
            }
          }}
        >
          <div 
            className="bg-card w-full max-w-sm rounded-2xl shadow-xl p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-center relative mb-4">
              <h3 className="text-lg font-bold text-foreground">Move Task</h3>
              <button
                onClick={cancelMoveTask}
                className="absolute right-0 p-1 bg-muted rounded-full hover:bg-muted transition-colors"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            
            {/* Task Info */}
            <div className="mb-4 p-3 bg-muted rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2 truncate">
                <span className="font-medium">{pendingMove.event.title}</span>
              </p>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-muted-foreground font-medium">From:</span>
                <span className="text-foreground font-semibold bg-card px-2 py-1 rounded border border-border">
                  {formatDateForDisplay(pendingMove.previousStartDate)}
                </span>
                <span className="text-muted-foreground/60">→</span>
                <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  {formatDateForDisplay(pendingMove.newStartDate)}
                </span>
              </div>
            </div>

            {/* Reason Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                placeholder="Why are you moving this task?"
                rows={3}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none resize-none transition-all"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-3 border-t border-border">
              <button
                onClick={cancelMoveTask}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMoveTask}
                disabled={!moveReason.trim()}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-all ${
                  moveReason.trim()
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holidays modal - add/delete holidays */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setIsHolidayModalOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card border border-border shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-bold text-foreground">Manage holidays</h2>
              <button type="button" onClick={() => setIsHolidayModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <input
                  ref={holidayFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleHolidayImportFile(file);
                  }}
                />
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 sm:w-auto sm:min-w-[11rem] sm:flex-1"
                />
                <input
                  type="text"
                  placeholder="Holiday name"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 sm:min-w-[12rem] sm:flex-1"
                />
                <button
                  type="button"
                  disabled={addingHoliday || !newHolidayDate.trim()}
                  onClick={async () => {
                    if (!newHolidayDate.trim()) return;
                    setAddingHoliday(true);
                    const res = await addHoliday({ date: newHolidayDate.trim(), name: newHolidayName.trim() || 'Holiday' });
                    setAddingHoliday(false);
                    if (res.success) {
                      setNewHolidayDate('');
                      setNewHolidayName('');
                      await loadHolidays(currentYear);
                      toastSuccess('Holiday added');
                    } else {
                      toastError(res.message || 'Failed to add');
                    }
                  }}
                  className="w-full shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:whitespace-nowrap"
                >
                  Add
                </button>
              </div>
              <div className="rounded-xl border border-border bg-muted/80 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                  type="button"
                  disabled={importingHolidays}
                  onClick={() => holidayFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Import holidays from CSV/Excel file (columns: date, name)"
                  aria-label="Import holidays from CSV or Excel"
                >
                  {importingHolidays ? 'Importing...' : 'Import'}
                </button>
                <div className="text-xs leading-relaxed text-muted-foreground">
                  Holidays are highlighted on the calendar.
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={hidingOfficialHolidays}
                    onClick={async () => {
                      const officialHolidays = holidays.filter((h) => h.source === 'official');
                      if (officialHolidays.length === 0) {
                        toastError('No official holidays to hide');
                        return;
                      }

                      setHidingOfficialHolidays(true);
                      const results = [] as Array<{ success: boolean; message?: string }>;
                      for (const h of officialHolidays) {
                        results.push(await deleteHoliday(h.id));
                      }
                      setHidingOfficialHolidays(false);

                      if (results.every((r) => r.success)) {
                        await loadHolidays(currentYear);
                        toastSuccess('All official holidays hidden');
                      } else {
                        toastError('Some official holidays could not be hidden');
                      }
                    }}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-card text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Hide all official holidays"
                    title="Hide all official holidays"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={restoringOfficialHolidays}
                    onClick={async () => {
                      setRestoringOfficialHolidays(true);
                      const res = await restoreOfficialHolidays();
                      setRestoringOfficialHolidays(false);
                      if (res.success) {
                        await loadHolidays(currentYear);
                        toastSuccess('Official holidays restored');
                      } else {
                        toastError(res.message || 'Failed to restore official holidays');
                      }
                    }}
                    className="h-9 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Restore official holidays"
                    aria-label="Restore official holidays"
                  >
                    Restore 
                  </button>
                </div>
              </div>
              <ul className="space-y-1.5">
                {holidays.length === 0 && <li className="text-sm text-muted-foreground py-2">No holidays yet. Add one above.</li>}
                {holidays.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 px-3 bg-muted rounded-lg text-sm">
                    <span className="font-medium text-foreground">{h.date}</span>
                    <span className="text-muted-foreground flex-1 mx-2 truncate">{h.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full mr-1 ${h.source === 'official' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                      {h.source === 'official' ? 'Official' : 'Custom'}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await deleteHoliday(h.id);
                        if (res.success) {
                          await loadHolidays(currentYear);
                          toastSuccess(h.source === 'official' ? 'Official holiday hidden' : 'Holiday removed');
                        } else {
                          toastError(res.message || 'Failed to remove');
                        }
                      }}
                      className={`p-1.5 rounded-lg ${h.source === 'official' ? 'hover:bg-amber-100 text-amber-700' : 'hover:bg-red-100 text-red-600'}`}
                      aria-label={h.source === 'official' ? 'Hide official holiday' : 'Delete'}
                      title={h.source === 'official' ? 'Hide this official holiday' : 'Delete custom holiday'}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
        onEdit={(task) => {
          setEditingEvent(task as CalendarEvent);
          setIsDetailModalOpen(false);
          setIsModalOpen(true);
        }}
        onDelete={handleDeleteTask}
        reportLink={selectedTask && (selectedTask.taskType === 'MA' ? reportedMATaskIds.has(Number(selectedTask.id)) : reportedPMTaskIds.has(Number(selectedTask.id)))
          ? `/pmchecklist_report?tab=${selectedTask.taskType === 'MA' ? 'ma' : 'pm'}&taskId=${selectedTask.id}`
          : null}
        createReportLink={selectedTask && selectedTask.status === 'done' && !(selectedTask.taskType === 'MA' ? reportedMATaskIds.has(Number(selectedTask.id)) : reportedPMTaskIds.has(Number(selectedTask.id)))
          ? (selectedTask.taskType === 'MA'
              ? `/machecklist_report/add?taskId=${encodeURIComponent(String(selectedTask.id))}`
              : `/pmchecklist_report/add?taskId=${encodeURIComponent(String(selectedTask.id))}`)
          : null}
      />
      {/* Import Excel/CSV Modal */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsImportModalOpen(false);
              setImportedTasks([]);
              setImportErrors([]);
              setImportResultTab('ready');
            }
          }}
        >
          <div
            className="bg-card w-full max-w-6xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">Import Plans from Excel/CSV</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload a file to create multiple plans according to database schema
                  </p>
                 
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedTasks([]);
                  setImportErrors([]);
                  setImportResultTab('ready');
                }}
                className="p-1.5 bg-card rounded-full hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-green-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="sr-only"
                  aria-label="Select Excel or CSV file"
                  id="excel-file-input"
                />
                <label
                  htmlFor="excel-file-input"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="p-4 bg-green-100 rounded-full">
                    <Download size={32} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Click to upload Excel/CSV file
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports .xlsx, .xls, and .csv formats
                    </p>
                  </div>
                </label>
              </div>

              {/* Excel Format Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-blue-800">File Format Guide:</h4>
                  <span className="inline-flex items-center gap-3">
                    <a
                      href="/task_upload_template.xlsx"
                      download="task_upload_template.xlsx"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Excel (.xlsx)
                    </a>
                    <a
                      href="/task_upload_template.csv"
                      download="task_upload_template.csv"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </a>
                  </span>
                </div>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Required columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Site</strong> → site_name Example: &quot;Thai Beverage Public Company Limited&quot;</li>
                    <li><strong>Location</strong> → location Example: &quot;Beer Thai&quot;</li>
                    <li><strong>Plan Start</strong> → start_date Example: &quot;Monday, February 23, 2026&quot;</li>
                    <li><strong>Plan End</strong> → end_date Example: &quot;Friday, February 27, 2026&quot;</li>
                    <li><strong>Engineer</strong> → engineers Example: [&quot;John Doe&quot;, &quot;Jane Smith&quot;]</li>
                    <li><strong>SOF</strong> → contract_id (From sof, then fetch devices from that contract)</li>
                  </ul>
                  <p className="mt-2"><strong>Optional columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Coverage Scope</strong> → coverage_scope (text)</li>
                  </ul>
                  <p className="mt-2 text-[10px] text-blue-600">
                    <strong>Note:</strong> Engineers can be separated by newline or comma.
                    Date format: &quot;Monday, February 23, 2026&quot; is supported.
                    <br />
                    <strong>Devices:</strong> Will be fetched automatically based on Site + SOF + Location and shown in preview table
                  </p>
                </div>
              </div>

              {/* Parse result: tabs + tables */}
              {(importedTasks.length > 0 || importErrors.length > 0) && (
                <div className="space-y-3">
                  {importedTasks.length > 0 && importErrors.length > 0 && (
                    <p className="text-xs text-muted-foreground rounded-lg bg-muted border border-border px-3 py-2">
                      <strong className="text-emerald-700">{importedTasks.length}</strong> row(s) ready to import —{' '}
                      <strong className="text-amber-800">{importErrors.length}</strong> issue(s) to fix (other rows in
                      the file did not enter preview).
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setImportResultTab('ready')}
                      className={`flex-1 min-w-[140px] rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                        importResultTab === 'ready'
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Ready to import ({importedTasks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportResultTab('issues')}
                      disabled={importErrors.length === 0}
                      className={`flex-1 min-w-[140px] rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                        importResultTab === 'issues'
                          ? 'bg-card text-red-900 shadow-sm ring-1 ring-red-200'
                          : importErrors.length === 0
                            ? 'text-muted-foreground cursor-not-allowed'
                            : 'text-muted-foreground hover:text-red-900'
                      }`}
                    >
                      Issues ({importErrors.length})
                    </button>
                  </div>

                  {importResultTab === 'ready' && importedTasks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground mb-2">
                        Preview table — use Import below to create tasks
                      </h4>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="max-h-[min(28rem,55vh)] overflow-x-auto overflow-y-auto">
                          <table className="w-full text-xs min-w-full">
                            <thead className="bg-muted sticky top-0">
                              <tr>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Site</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Location</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Plan Start</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Plan End</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Engineer</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">SOF</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Devices</th>
                                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Coverage Scope</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importedTasks.map((task, idx) => (
                                <tr key={idx} className="border-t border-border hover:bg-muted">
                                  <td className="px-2 py-2 min-w-[200px]">{task.Sname || task.siteName || '—'}</td>
                                  <td className="px-2 py-2 min-w-[120px]">{task.location || '—'}</td>
                                  <td className="px-2 py-2 whitespace-nowrap">{formatDateMonthDayYear(task.startDate)}</td>
                                  <td className="px-2 py-2 whitespace-nowrap">{formatDateMonthDayYear(task.endDate)}</td>
                                  <td className="px-2 py-2 min-w-[100px]">
                                    {task.Eng_ids && task.Eng_ids.length > 0 ? (
                                      <div className="flex flex-col gap-0.5">
                                        {task.Eng_ids.map((e: Engineer) => (
                                          <div key={e.id} className="text-sm">
                                            {e.name}{e.lastName ? ` ${e.lastName}` : ''}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap">
                                    {task.sofName || (task.contractId ? `#${task.contractId}` : '—')}
                                  </td>
                                  <td className="px-2 py-2 text-center whitespace-nowrap">
                                    {task.deviceCount !== undefined && task.deviceCount > 0 ? (
                                      <span className="font-semibold text-blue-600">{task.deviceCount}</span>
                                    ) : task.deviceIds?.length ? (
                                      <span className="font-semibold text-blue-600">{task.deviceIds.length}</span>
                                    ) : (
                                      <span className="text-muted-foreground">{task.sofName ? '0' : '—'}</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 min-w-[150px]">{task.coverageScope || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {importResultTab === 'ready' && importedTasks.length === 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                      No rows passed validation — open the <strong>Issues</strong> tab to see causes and fix your file.
                    </div>
                  )}

                  {importResultTab === 'issues' && importErrors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50/60 overflow-hidden">
                      <div className="px-3 py-2 border-b border-red-200/80 bg-red-100/50">
                        <h4 className="text-xs font-bold text-red-900">Items to fix ({importErrors.length})</h4>
                      </div>
                      <div className="max-h-[min(28rem,55vh)] overflow-x-auto overflow-y-auto border-t border-red-100/80 bg-card">
                        <table className="w-full text-xs min-w-[900px] border-collapse">
                          <thead className="bg-red-50/90 sticky top-0 z-10 shadow-sm">
                            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-red-900">
                              <th className="px-2 py-2 w-10 border-b border-red-200/80">#</th>
                              <th className="px-2 py-2 w-[7.5rem] whitespace-nowrap border-b border-red-200/80">Row</th>
                              <th className="px-2 py-2 min-w-[200px] border-b border-red-200/80">Why it did not match</th>
                              <th className="px-2 py-2 min-w-[220px] border-b border-red-200/80">
                                Upload row values
                              </th>
                              <th className="px-2 py-2 min-w-[220px] border-b border-red-200/80">
                                Hints (contract + SOF)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {importErrors.map((error, idx) => {
                              const { rowBadge, why, detail, hintChunks } = splitImportErrorLine(error);
                              return (
                                <tr key={idx} className="border-b border-border align-top hover:bg-muted/80">
                                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{idx + 1}</td>
                                  <td className="px-2 py-2 whitespace-nowrap">
                                    <span className="inline-flex items-center rounded-md bg-red-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                      {rowBadge}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-foreground leading-relaxed font-medium whitespace-pre-line break-words">
                                    {why}
                                  </td>
                                  <td className="px-2 py-2 min-w-[200px] max-w-md text-muted-foreground leading-relaxed text-[11px] break-words">
                                    {(() => {
                                      const shown = formatImportDetailColumn(detail);
                                      return shown ? (
                                        <span className="whitespace-pre-line">{shown}</span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-2 py-2 text-muted-foreground">
                                    {hintChunks.length === 0 ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <ul className="list-disc pl-4 space-y-0.5 marker:text-muted-foreground">
                                        {hintChunks.map((h, hi) => (
                                          <li key={hi} className="break-words text-[11px] leading-snug">
                                            {h}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {importResultTab === 'issues' && importErrors.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No errors</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedTasks([]);
                  setImportErrors([]);
                  setImportResultTab('ready');
                }}
                className="px-6 py-2 text-sm font-semibold text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCreate}
                disabled={importedTasks.length === 0 || isImporting}
                className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all ${
                  importedTasks.length === 0 || isImporting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isImporting ? 'Importing...' : `Import ${importedTasks.length} Tasks`}
              </button>
            </div>
          </div>
        </div>
      )}

      {draggedEvent && draggedEvent.status !== 'done' && (
        <div
          role="region"
          aria-label="Drop here to delete plan"
          onDragOver={handleTrashDragOver}
          onDragLeave={handleTrashDragLeave}
          onDrop={handleTrashDrop}
          className={`fixed bottom-6 left-1/2 z-[150] flex -translate-x-1/2 items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-4 shadow-lg transition-all ${
            isDragOverTrash
              ? 'scale-105 border-red-500 bg-red-100 text-red-800'
              : 'border-red-300 bg-red-50/95 text-red-700'
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              isDragOverTrash ? 'bg-red-500 text-white' : 'bg-red-200 text-red-700'
            }`}
          >
            <Trash2 size={24} />
          </div>
          <div className="text-sm font-semibold">
            {isDragOverTrash ? 'Drop here to delete plan' : 'Drag plan here to delete'}
          </div>
        </div>
      )}

      {alertModal}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}
