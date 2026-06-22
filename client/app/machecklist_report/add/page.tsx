'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, postMaReport, getTasks, getMaReportedTaskIds, uploadMaReportFile } from '@/lib/api';
import { formatFileSize, prepareReportUploadFile } from '@/lib/prepareReportUploadFile';
import { asRecord } from '@/lib/unknownUtil';
import { formatTaskEngineersLine } from '@/lib/taskEngineers';
import {
  computeDownTimeTotalHours,
  formatDateLocale,
  formatTime12h,
  toDateOnly,
  toTimeHHmm,
} from '@/lib/downtimeHours';
import { 
  Upload, 
  X, 
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Save,
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  Paperclip,
} from 'lucide-react';

/** paths จาก task.photos — ใบแจ้งซ่อมที่แนบตอนสร้างงาน */
function normalizeRepairPathsFromPhotos(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  const out: string[] = [];
  for (const p of photos) {
    if (typeof p === 'string' && p.trim()) out.push(p.trim());
    else if (p && typeof p === 'object') {
      const o = p as Record<string, unknown>;
      const path =
        typeof o.path === 'string'
          ? o.path.trim()
          : typeof o.url === 'string'
            ? o.url.trim()
            : '';
      if (path) out.push(path);
    }
  }
  return out;
}

function repairFileHref(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return apiUrl(path.startsWith('/') ? path : `/${path}`);
}

interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  file: File;
  preview?: string;
}

interface Device {
  Did: number;
  Asset_State?: string;
  CI_Name?: string;
  Asset_Number?: string;
  serial?: string;
  model?: string;
  Manufacturername?: string;
  Sitename?: string;
  PR_No?: string;
  Vendor?: string;
  SLid?: number;
  Location2?: string;
  PO_No?: string;
  Loan_Start?: string | null;
  Request_Date?: string | null;
  Refer_SOF?: string;
  Refer_Ticket?: string;
  Assigned_Service?: string;
  Reason?: string;
}

interface MaTaskAsset {
  id?: string | number;
  name?: string;
  CI_Name?: string;
  Asset_Number?: string;
  assetNumber?: string;
  serial?: string;
  serialNumber?: string;
  model?: string;
  type?: string;
  site?: string;
  SiteName?: string;
  replacementDeviceId?: string | number | null;
}

interface DoneMATask {
  id: number;
  status?: string;
  taskType?: string;
  task_type?: string;
  siteName?: string;
  site_name?: string;
  startDate?: string;
  endDate?: string;
  engineers?: unknown;
  Eng_ids?: unknown;
  assets?: MaTaskAsset[];
  replacementDeviceId?: string | number | null;
  vendorName?: string;
  vendor_name?: string;
  vendorTel?: string;
  vendor_tel?: string;
  reporterName?: string;
  reporter_name?: string;
  reporterTel?: string;
  reporter_tel?: string;
  ticket?: string;
  photos?: unknown;
  slaTerm?: string | number | null;
  sla_term?: string | number | null;
  contractId?: string | number | null;
  uptimeDate?: string;
  uptime_date?: string;
  downTimeEndDate?: string;
  down_time_end_date?: string;
  uptimeTime?: string;
  uptime_time?: string;
  downTimeEndTime?: string;
  down_time_end_time?: string;
  downtimeDate?: string;
  downtime_date?: string;
  downTimeStartDate?: string;
  down_time_start_date?: string;
  downtimeTime?: string;
  downtime_time?: string;
  downTimeStartTime?: string;
  down_time_start_time?: string;
}

type SortTaskBy = 'date-desc' | 'date-asc' | 'site' | 'engineer';

function maTaskSiteName(t: DoneMATask): string {
  return t.siteName || t.site_name || '';
}

function maTaskReporterName(t: DoneMATask): string | undefined {
  return t.reporterName || t.reporter_name;
}

function maTaskReporterTel(t: DoneMATask): string | undefined {
  return t.reporterTel || t.reporter_tel;
}

function isDoneMaTask(raw: unknown): boolean {
  const r = asRecord(raw);
  const status = String(r.status ?? '').toLowerCase();
  const type = String(r.taskType ?? r.task_type ?? '').toUpperCase();
  const id = Number(r.id);
  return status === 'done' && type === 'MA' && Number.isFinite(id);
}

function toDoneMaTask(raw: unknown): DoneMATask | null {
  if (!isDoneMaTask(raw)) return null;
  const rec = asRecord(raw);
  return { ...rec, id: Number(rec.id) } as DoneMATask;
}

/** แปลงแถวจาก GET /api/devices ให้เป็น Device รูปแบบเดียวกัน */
function normalizeApiDevice(raw: Record<string, unknown>): Device {
  const did = Number(raw.Did ?? raw.did);
  const str = (v: unknown) => {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };
  return {
    Did: did,
    Asset_State: str(raw.Asset_State ?? raw.assetState),
    CI_Name: str(raw.CI_Name ?? raw.name),
    Asset_Number: str(raw.Asset_Number ?? raw.assetNumber),
    serial: str(raw.serial ?? raw.serialNumber),
    model: str(raw.model ?? raw.type),
    Manufacturername: str(raw.Manufacturername ?? raw.manufacturername ?? raw.manufacturer),
    Sitename: str(raw.Sitename ?? raw.SiteName ?? raw.site ?? raw.sitename),
    Location2: str(raw.Location2 ?? raw.location ?? raw.Location),
    PR_No: str(raw.PR_No),
    Vendor: str(raw.Vendor ?? raw.vendor),
    SLid: raw.SLid != null ? Number(raw.SLid) : undefined,
    Refer_SOF: str(raw.Refer_SOF ?? raw.refer_sof ?? raw.SOF),
    Refer_Ticket: str(raw.Refer_Ticket ?? raw.refer_ticket),
    Assigned_Service: str(raw.Assigned_Service ?? raw.assigned_service),
    Reason: str(raw.Reason),
  };
}

/** ใช้ snapshot จาก task.assets เมื่อ Did ไม่อยู่ใน GET /api/devices */
function deviceFromTaskAssetSnapshot(raw: unknown, didNum: number): Device {
  const a = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };
  return {
    Did: didNum,
    Asset_State: str(a.Asset_State ?? a.assetState),
    CI_Name: str(a.CI_Name ?? a.name),
    Asset_Number: str(a.Asset_Number ?? a.assetNumber),
    serial: str(a.serial ?? a.serialNumber),
    model: str(a.model ?? a.type),
    Manufacturername: str(a.Manufacturername ?? a.manufacturername ?? a.manufacturer),
    Sitename: str(a.Sitename ?? a.sitename ?? a.siteName ?? a.site ?? a.SiteName),
    Location2: str(a.Location2 ?? a.location2 ?? a.location ?? a.Location),
    PR_No: str(a.PR_No),
    Vendor: str(a.Vendor ?? a.vendor),
    Refer_SOF: str(a.Refer_SOF ?? a.refer_sof ?? a.SOF),
    Assigned_Service: str(a.Assigned_Service ?? a.assigned_service),
    SLid: a.SLid != null ? Number(a.SLid) : undefined,
  };
}

/** เติมค่าจาก task (SOF สัญญา, Assigned Service, Vendor) เมื่อ device ไม่มีหลัง MA Done */
function enrichDeviceForDisplay(device: Device, task: DoneMATask | Record<string, unknown> | null | undefined): Device {
  if (!task) return device;
  const rec = asRecord(task);
  const str = (v: unknown) => {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };
  return {
    ...device,
    Refer_SOF: device.Refer_SOF ?? str(rec.sofName ?? rec.contract_sof_name),
    Assigned_Service:
      device.Assigned_Service ?? str(rec.assignedService ?? rec.assigned_service),
    Vendor: device.Vendor ?? str(rec.vendorName ?? rec.vendor_name),
    Sitename: device.Sitename ?? str(rec.siteName ?? rec.site_name),
  };
}

/** ดึง device ID จาก task.assets (รองรับหลายรูปแบบที่ API/DB อาจส่งมา) */
function getDeviceIdFromAsset(a: unknown): string {
  if (a == null) return '';
  if (typeof a === 'number') return String(a);
  if (typeof a === 'string') return a.trim();
  const o = a as Record<string, unknown>;
  const id = o.id ?? o.Did ?? o.did ?? o.deviceId ?? o.device_id ?? o.ID;
  return id != null ? String(id).trim() : '';
}

function AddMAReportPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appliedTaskIdFromUrlRef = useRef(false);
  const { toasts, removeToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [finishedPdfFile, setFinishedPdfFile] = useState<File | null>(null);
  const finishedPdfInputRef = useRef<HTMLInputElement>(null);
  const maResult = 'pass' as const;
  const [comment, setComment] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [maDate, setMaDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [hasDoneMATasks, setHasDoneMATasks] = useState(false);
  const [doneMATasks, setDoneMATasks] = useState<DoneMATask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [checkingTasks, setCheckingTasks] = useState(true);
  const [reportedTaskIds, setReportedTaskIds] = useState<Set<number>>(new Set());
  const [searchTaskReport, setSearchTaskReport] = useState('');
  const [sortTaskBy, setSortTaskBy] = useState<SortTaskBy>('date-desc');
  const [taskPage, setTaskPage] = useState(1);

  const TASKS_PER_PAGE = 3;

  const selectedMaTask = useMemo(
    () =>
      selectedTaskId == null
        ? null
        : (doneMATasks.find((t) => Number(t.id) === Number(selectedTaskId)) ?? null),
    [doneMATasks, selectedTaskId]
  );

  /** Uptime กรอกเองตอนส่ง report — pre-fill จากงานถ้ามีค่าใน DB แล้ว */
  const [reportUptimeDate, setReportUptimeDate] = useState('');
  const [reportUptimeTime, setReportUptimeTime] = useState('');

  useEffect(() => {
    if (!selectedMaTask) {
      setReportUptimeDate('');
      setReportUptimeTime('');
      return;
    }
    const endD =
      selectedMaTask.uptimeDate ??
      selectedMaTask.downTimeEndDate ??
      selectedMaTask.down_time_end_date ??
      selectedMaTask.uptime_date;
    const ut =
      selectedMaTask.uptimeTime ??
      selectedMaTask.downTimeEndTime ??
      selectedMaTask.down_time_end_time ??
      selectedMaTask.uptime_time;
    setReportUptimeDate(endD ? toDateOnly(endD) : '');
    setReportUptimeTime(ut ? toTimeHHmm(ut) : '');
  }, [selectedMaTask]);

  /** ชั่วโมงรวม + ข้อความช่วยเมื่อคำนวณไม่ได้ (เช่น Uptime ก่อน Downtime) */
  const downtimeTotalPreview = useMemo(() => {
    if (!selectedMaTask || !reportUptimeDate?.trim() || !reportUptimeTime?.trim()) {
      return {
        hours: null as number | null,
        emptyHint: '— Enter Uptime date and Uptime time below —' as string | null,
      };
    }
    const startDate = toDateOnly(
      selectedMaTask.downtimeDate ??
        selectedMaTask.downTimeStartDate ??
        selectedMaTask.down_time_start_date ??
        selectedMaTask.downtime_date
    );
    if (!startDate) {
      return { hours: null, emptyHint: '— Add downtime date on the MA task first —' };
    }
    const startTRaw =
      selectedMaTask.downtimeTime ??
      selectedMaTask.downTimeStartTime ??
      selectedMaTask.down_time_start_time ??
      selectedMaTask.downtime_time;
    const startTH = startTRaw ? toTimeHHmm(startTRaw) : undefined;
    const hours = computeDownTimeTotalHours(
      startDate,
      reportUptimeDate,
      reportUptimeTime,
      startTH
    );
    if (hours != null) return { hours, emptyHint: null };

    const stPart = startTH || '00:00';
    const ed = toDateOnly(reportUptimeDate);
    const tt = toTimeHHmm(reportUptimeTime);
    if (ed && tt) {
      const t0 = new Date(`${startDate}T${stPart}:00`).getTime();
      const t1 = new Date(`${ed}T${tt}:00`).getTime();
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 < t0) {
        return {
          hours: null,
          emptyHint:
            '— คิดชั่วโมงรวมไม่ได้: เวลา Uptime ต้องไม่ก่อนเวลาเริ่ม Downtime (ในภาพ Uptime ก่อน Downtime) — แก้เวลา Downtime ในงานให้ถูก หรือให้ Done หลังเวลาเริ่ม outage —',
        };
      }
    }
    return { hours: null, emptyHint: '— Cannot compute — check date/time values —' };
  }, [selectedMaTask, reportUptimeDate, reportUptimeTime]);

  // แสดงเฉพาะ Task ที่ยังไม่มี report_id (task_id ไม่อยู่ใน table report)
  const availableMATasks = useMemo(
    () => doneMATasks.filter((t) => !reportedTaskIds.has(Number(t.id))),
    [doneMATasks, reportedTaskIds]
  );

  const taskSearchLower = searchTaskReport.trim().toLowerCase();
  const filteredAndSortedTasks = useMemo(() => {
    let list = availableMATasks;
    if (taskSearchLower) {
      list = list.filter((t) => {
        const site = maTaskSiteName(t).toLowerCase();
        const start = t.startDate ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const end = t.endDate ? new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const engineers = formatTaskEngineersLine(t.engineers ?? t.Eng_ids).toLowerCase();
        const devices = (t.assets || []).map((a) => (a.name || a.CI_Name || a.id || '').toString().toLowerCase()).join(' ');
        return [site, start, end, engineers, devices].some(s => s.includes(taskSearchLower));
      });
    }
    const sorted = [...list].sort((a, b) => {
      if (sortTaskBy === 'date-desc') return (new Date(b.startDate || 0).getTime()) - (new Date(a.startDate || 0).getTime());
      if (sortTaskBy === 'date-asc') return (new Date(a.startDate || 0).getTime()) - (new Date(b.startDate || 0).getTime());
      if (sortTaskBy === 'site') return maTaskSiteName(a).localeCompare(maTaskSiteName(b));
      if (sortTaskBy === 'engineer') {
        const aStr = formatTaskEngineersLine(a.engineers ?? a.Eng_ids);
        const bStr = formatTaskEngineersLine(b.engineers ?? b.Eng_ids);
        return aStr.localeCompare(bStr);
      }
      return 0;
    });
    return sorted;
  }, [availableMATasks, taskSearchLower, sortTaskBy]);

  const totalTaskPages = Math.max(1, Math.ceil(filteredAndSortedTasks.length / TASKS_PER_PAGE));
  const taskPageSafe = Math.min(Math.max(1, taskPage), totalTaskPages);
  const paginatedTasks = useMemo(
    () => filteredAndSortedTasks.slice((taskPageSafe - 1) * TASKS_PER_PAGE, taskPageSafe * TASKS_PER_PAGE),
    [filteredAndSortedTasks, taskPageSafe]
  );

  useEffect(() => {
    setTaskPage(p => Math.min(p, Math.max(1, Math.ceil(filteredAndSortedTasks.length / TASKS_PER_PAGE)) || 1));
  }, [searchTaskReport, sortTaskBy, filteredAndSortedTasks.length]);

  /** จากลิงก์ Create Report — เลือก task และเลื่อนไปหน้ารายการที่มี task นั้น */
  useEffect(() => {
    if (checkingTasks || appliedTaskIdFromUrlRef.current) return;
    const raw = searchParams.get('taskId');
    if (!raw?.trim()) return;
    const n = parseInt(raw.trim(), 10);
    if (Number.isNaN(n) || n <= 0) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    const exists = availableMATasks.some((t) => Number(t.id) === n);
    if (!exists) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    appliedTaskIdFromUrlRef.current = true;
    setSelectedTaskId(n);
    const idx = filteredAndSortedTasks.findIndex((t) => Number(t.id) === n);
    if (idx >= 0) {
      setTaskPage(Math.floor(idx / TASKS_PER_PAGE) + 1);
    }
    if (pathname) router.replace(pathname, { scroll: false });
  }, [checkingTasks, availableMATasks, filteredAndSortedTasks, searchParams, router, pathname]);

  // Check if there are done MA tasks
  useEffect(() => {
    const checkDoneTasks = async () => {
      setCheckingTasks(true);
      try {
        const [tasksRes, reportedIdsRes] = await Promise.all([
          getTasks(),
          getMaReportedTaskIds(), // ดึง task_id ที่มี report_id แล้ว เพื่อกรองออก (แสดงเฉพาะที่ยังไม่มี)
        ]);
        if (tasksRes.success && tasksRes.data) {
          const done = tasksRes.data
            .map(toDoneMaTask)
            .filter((t): t is DoneMATask => t != null);
          setHasDoneMATasks(done.length > 0);
          setDoneMATasks(done);
        }
        if (reportedIdsRes.success && Array.isArray(reportedIdsRes.taskIds)) {
          setReportedTaskIds(new Set(reportedIdsRes.taskIds));
        }
      } catch (error) {
        console.error('Error checking tasks:', error);
      } finally {
        setCheckingTasks(false);
      }
    };
    checkDoneTasks();
  }, [router]);

  // Fetch devices from API
  useEffect(() => {
    const fetchDevices = async () => {
      setLoadingDevices(true);
      try {
        const response = await fetch(apiUrl('/api/devices?limit=1000'));
        const data = await response.json();
        if (data.success && data.data) {
          setDevices(
            (data.data as Record<string, unknown>[]).map((row) => normalizeApiDevice(row))
          );
        }
      } catch (error) {
        console.error('Error fetching devices:', error);
      } finally {
        setLoadingDevices(false);
      }
    };
    fetchDevices();
  }, []);

  /** เครื่องในงาน MA อาจไม่อยู่ใน GET /api/devices?limit=1000 — ดึงรายละเอียดตาม Did แล้ว merge */
  useEffect(() => {
    if (selectedTaskId == null) return;
    const task = availableMATasks.find((t) => Number(t.id) === Number(selectedTaskId));
    if (!task) return;

    const need = new Set<number>();
    const pushId = (id: unknown) => {
      const n = typeof id === 'number' ? id : parseInt(String(id), 10);
      if (!Number.isNaN(n) && n > 0) need.add(n);
    };
    (task.assets || []).forEach((a, i: number) => {
      pushId(getDeviceIdFromAsset(a));
      pushId(a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null));
    });
    if (task.replacementDeviceId != null) pushId(task.replacementDeviceId);

    const missing = [...need].filter((id) => !devices.some((d) => Number(d.Did) === id));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const rows = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(apiUrl(`/api/devices/${id}`));
            const data = await res.json();
            if (data?.success && data.data) return normalizeApiDevice(data.data as Record<string, unknown>);
          } catch (e) {
            console.error('[MA report add] fetch device by id', id, e);
          }
          return null;
        })
      );
      if (cancelled) return;
      const fetched = rows.filter((d): d is Device => d != null);
      if (fetched.length === 0) return;
      setDevices((prev) => {
        const seen = new Set(prev.map((d) => String(d.Did)));
        const next = [...prev];
        for (const d of fetched) {
          const k = String(d.Did);
          if (!seen.has(k)) {
            seen.add(k);
            next.push(d);
          }
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTaskId, availableMATasks, devices]);

  // Handle device selection change
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
  };

  // Device จาก Task ที่เลือก (assets + replacement) — ใช้ snapshot ใน task ถ้าไม่พบในรายการ devices ที่โหลดมา
  const allowedDevices = useMemo(() => {
    if (selectedTaskId == null) return [];
    const task = availableMATasks.find((t) => Number(t.id) === Number(selectedTaskId));
    if (!task) return [];

    const seen = new Set<string>();
    const out: Device[] = [];

    const addOne = (d: Device) => {
      const key = String(d.Did);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(d);
    };

    const addReplacement = (repId: unknown) => {
      if (repId == null || repId === '') return;
      const rid = String(repId);
      if (seen.has(rid)) return;
      const fromPool = devices.find((d) => String(d.Did) === rid);
      if (fromPool) addOne(fromPool);
      else {
        const n = Number(repId);
        if (!Number.isNaN(n)) addOne({ Did: n } as Device);
      }
    };

    (task.assets || []).forEach((a, i: number) => {
      const idStr = getDeviceIdFromAsset(a);
      if (idStr) {
        const fromPool = devices.find((d) => String(d.Did) === String(idStr));
        if (fromPool) addOne(fromPool);
        else {
          const didNum = parseInt(String(idStr), 10);
          if (!Number.isNaN(didNum)) addOne(deviceFromTaskAssetSnapshot(a, didNum));
        }
      }
      const repId = a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null);
      addReplacement(repId);
    });

    if (task.replacementDeviceId != null) {
      addReplacement(task.replacementDeviceId);
    }

    return out.map((d) => enrichDeviceForDisplay(d, task));
  }, [devices, availableMATasks, selectedTaskId]);

  useEffect(() => {
    if (selectedTaskId == null) {
      setSelectedDeviceId('');
      setFinishedPdfFile(null);
      return;
    }
    if (selectedDeviceId && allowedDevices.length > 0 && !allowedDevices.some((d) => d.Did.toString() === selectedDeviceId)) {
      setSelectedDeviceId('');
    }
  }, [selectedTaskId, allowedDevices, selectedDeviceId]);

  useEffect(() => {
    if (allowedDevices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(allowedDevices[0].Did.toString());
    }
  }, [allowedDevices, selectedDeviceId]);

  // ใช้ข้อมูลจาก Task ที่เลือก pre-fill form
  const applyTaskToForm = (task: DoneMATask) => {
    setSelectedTaskId(task.id);
    const firstAsset = task.assets && task.assets[0];
    if (firstAsset) {
      const deviceId = getDeviceIdFromAsset(firstAsset);
      if (deviceId) setSelectedDeviceId(deviceId);
    }
    if (task.startDate) setMaDate(String(task.startDate).split('T')[0]);
    setTechnicianName(formatTaskEngineersLine(task.engineers ?? task.Eng_ids));
  };

  /** จาก Calendar/Schedule (?taskId=) — pre-fill ช่าง/วันที่/อุปกรณ์เมื่อเลือก task หรือโหลดรายการ task เสร็จ */
  useEffect(() => {
    if (selectedTaskId == null) return;
    const task = doneMATasks.find((t) => Number(t.id) === Number(selectedTaskId));
    if (!task) return;
    applyTaskToForm(task);
     
  }, [selectedTaskId, doneMATasks]);

  const handleFinishedPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toastWarning('Please upload a PDF file.');
      return;
    }
    if (!selectedTaskId) {
      toastWarning('Please select a task before uploading the MA PDF.');
      return;
    }
    setFinishedPdfFile(file);
    toastSuccess('MA PDF ready — enter Uptime and click Save MA Report.');
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const fileType = file.type.startsWith('image/') ? 'image' : 
                      file.type === 'application/pdf' ? 'pdf' : 'other';
      
      const uploadedFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: fileType,
        file,
      };

      // Create preview for images
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedFile.preview = e.target?.result as string;
          setUploadedFiles(prev => [...prev, uploadedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadedFiles(prev => [...prev, uploadedFile]);
      }
    });
  };

  // Remove uploaded file
  const removeFile = (id: string) => {
    setUploadedFiles(files => files.filter(f => f.id !== id));
  };

  // Handle save - อัปโหลดไฟล์ก่อน แล้วส่ง report
  const handleSave = async () => {
    if (!selectedTaskId) {
      toastWarning('Please select a task before submitting the report.');
      return;
    }
    if (!selectedDeviceId) {
      toastWarning('Please select a device.');
      return;
    }
    if (!reportUptimeDate?.trim() || !reportUptimeTime?.trim()) {
      toastWarning('Please enter Uptime date and Uptime time (service back online time)');
      return;
    }
    const downStart = selectedMaTask
      ? toDateOnly(
          selectedMaTask.downtimeDate ??
            selectedMaTask.downTimeStartDate ??
            selectedMaTask.down_time_start_date ??
            selectedMaTask.downtime_date
        )
      : '';
    const startTimeHH =
      selectedMaTask &&
      toTimeHHmm(
        selectedMaTask.downtimeTime ??
          selectedMaTask.downTimeStartTime ??
          selectedMaTask.down_time_start_time ??
          selectedMaTask.downtime_time
      );
    if (
      downStart &&
      computeDownTimeTotalHours(
        downStart,
        reportUptimeDate,
        reportUptimeTime,
        startTimeHH || undefined
      ) === null
    ) {
        toastWarning('Time range is incorrect — Uptime must not be before the task downtime');
        return;
    }
    const selectedDevice =
      allowedDevices.find((d) => d.Did.toString() === selectedDeviceId) ??
      devices.find((d) => d.Did.toString() === selectedDeviceId);

    const attachmentSources: Array<{ file: File; type: UploadedFile['type']; name: string }> = [];
    if (finishedPdfFile) {
      attachmentSources.push({ file: finishedPdfFile, type: 'pdf', name: finishedPdfFile.name });
    }
    for (const f of uploadedFiles) {
      attachmentSources.push({ file: f.file, type: f.type, name: f.name });
    }
    if (attachmentSources.length === 0) {
      toastWarning('Upload a finished MA PDF in Step 1, or attach files below.');
      return;
    }

    setSaving(true);
    try {
      const siteName = (selectedDevice?.Sitename ?? '').toString().trim() || 'Unknown';
      const locationName = (selectedDevice?.Location2 ?? '').toString().trim() || 'Unknown';
      const safeForName = (s: string) => s.replace(/[/\\?*|"<>:]/g, '_').replace(/\s+/g, '_') || 'Unknown';
      const getExt = (name: string, type: string) => {
        const m = name?.match(/\.\w+$/);
        if (m) return m[0];
        return type === 'pdf' ? '.pdf' : '.jpg';
      };
      const filesWithPath: Array<{ name: string; type: string; path?: string }> = [];
      for (let i = 0; i < attachmentSources.length; i++) {
        const f = attachmentSources[i];
        const ext = getExt(f.name, f.type);
        const displayName = `${safeForName(siteName)}_${safeForName(locationName)}_${maDate}_${i + 1}${ext}`;

        let fileToUpload: File;
        try {
          if (f.type === 'pdf' && f.file.size > 28 * 1024 * 1024) {
            toastWarning(`Compressing PDF (${formatFileSize(f.file.size)}) before upload…`);
          }
          fileToUpload = await prepareReportUploadFile(f.file, f.type);
        } catch (compressErr) {
          const msg =
            compressErr instanceof Error
              ? compressErr.message
              : 'Failed to prepare file for upload';
          toastError(`${f.name}: ${msg}`);
          return;
        }

        const uploadRes = await uploadMaReportFile(fileToUpload);
        if (!uploadRes.success || !uploadRes.path) {
          toastError(
            uploadRes.message ||
              `Upload failed: ${displayName}${fileToUpload.size ? ` (${formatFileSize(fileToUpload.size)})` : ''}`
          );
          return;
        }
        filesWithPath.push({ name: displayName, type: f.type, path: uploadRes.path });
      }

      const reportData = {
        taskId: selectedTaskId,
        deviceId: selectedDeviceId,
        device: selectedDevice,
        checklistItems: [],
        uploadedFiles: filesWithPath,
        maResult,
        comment,
        technicianName,
        maDate,
        createdAt: new Date().toISOString(),
        uptimeDate: reportUptimeDate.trim().slice(0, 10),
        uptimeTime: reportUptimeTime.trim(),
      };

      const res = await postMaReport(reportData);
      if (res.success) {
        toastSuccess(res.message || 'MA report saved successfully', 3200);
        window.setTimeout(() => router.push('/machecklist_report'), 1200);
      } else {
        toastError(res.message || 'Failed to submit report.');
      }
    } catch (e) {
      console.error(e);
      toastError('Error submitting report.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingTasks) {
    return (
      <SidebarLayout>
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-screen bg-muted">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Checking tasks...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </div>
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </SidebarLayout>
    );
  }

  const hasAvailableTasks = availableMATasks.length > 0;
  if (!hasAvailableTasks) {
    const allReported = hasDoneMATasks && doneMATasks.length > 0;
    return (
      <SidebarLayout>
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center p-8">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${allReported ? 'bg-green-100' : 'bg-amber-100'}`}>
              <AlertCircle size={40} className={allReported ? 'text-green-600' : 'text-amber-500'} />
            </div>
            <p className="text-muted-foreground text-lg font-semibold mb-2">
              {allReported ? 'All reports completed' : 'Cannot create MA Report'}
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              {allReported
                ? 'All done tasks have reports. No tasks pending report.'
                : 'Please wait until MA tasks have status "Done".'}
            </p>
            <button
              onClick={() => router.push('/pmchecklist_report?tab=ma')}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Back to Report
            </button>
          </div>
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <DashboardHeader />
      
      <div className="flex flex-col p-6 pt-0 gap-6 min-h-screen bg-background">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/pmchecklist_report?tab=ma')}
              className="p-2.5 hover:bg-card/80 rounded-xl transition-colors border border-border shadow-sm"
            >
              <ArrowLeft size={22} className="text-muted-foreground" />
            </button>
            <div>
              <h1 className="page-heading">
                Create MA Checklist Report
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Record maintenance agreement report
              </p>
            </div>
          </div>
        </div>

        {/* Tasks to Report */}
        {availableMATasks.length > 0 && (
          <div className="bg-card/95 backdrop-blur-sm p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={22} className="text-green-600" />
              <h2 className="text-lg font-bold text-foreground">Tasks to Report</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Select completed tasks that do not yet have a report to auto-fill the form.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTaskReport}
                  onChange={(e) => { setSearchTaskReport(e.target.value); setTaskPage(1); }}
                  placeholder="Search location, date, person, device..."
                  className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <select
                value={sortTaskBy}
                onChange={(e) => { setSortTaskBy(e.target.value as SortTaskBy); setTaskPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
              </select>
            </div>
            <div className="mb-3 text-xs text-muted-foreground">
              Showing {filteredAndSortedTasks.length === 0 ? 0 : (taskPageSafe - 1) * TASKS_PER_PAGE + 1}-{Math.min(taskPageSafe * TASKS_PER_PAGE, filteredAndSortedTasks.length)} of {filteredAndSortedTasks.length} tasks
            </div>
            <div className="space-y-3">
              {paginatedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedTaskId === task.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-border bg-muted hover:border-border'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin size={16} className="text-muted-foreground" />
                        {task.siteName || task.site_name || '-'}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar size={16} className="text-muted-foreground" />
                        {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        {task.endDate && ` - ${new Date(task.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <User size={16} className="text-muted-foreground" />
                        {formatTaskEngineersLine(task.engineers ?? task.Eng_ids) || '—'}
                      </span>
                      {(task.assets?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-muted-foreground">
                          {(task.assets ?? []).map((a, idx: number) => {
                            const repId = a.replacementDeviceId ?? (idx === 0 ? task.replacementDeviceId : null);
                            const rep = repId != null ? devices.find((d) => d.Did === Number(repId)) : null;
                            const repName = rep ? (rep.CI_Name || rep.Asset_Number || rep.serial || `Device ${repId}`) : repId != null ? `Device ${repId}` : null;
                            const brokenName = a.name || a.CI_Name || a.id || '-';
                            return (
                              <span key={a.id ?? idx} className="inline-flex items-center gap-1.5">
                                <span>{brokenName}</span>
                                {repName && (
                                  <>
                                    <span className="text-[10px] font-semibold text-muted-foreground">replaced by</span>
                                    <span className="text-green-700">{repName}</span>
                                  </>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {/* Contract Information (MA) - compact one line */}
                    {(task.vendorName || task.vendor_name || task.vendorTel || task.vendor_tel || maTaskReporterName(task) || task.ticket) && (
                      <div className="mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground">
                        <span className="font-bold text-muted-foreground">Contract Info: </span>
                        <span>
                          {(task.vendorName || task.vendor_name) && (
                            <>Vendor: <span className="text-foreground font-medium">{task.vendorName || task.vendor_name}</span>{' · '}</>
                          )}
                          {maTaskReporterName(task) && (
                            <>Reporter: <span className="text-foreground font-medium">{maTaskReporterName(task)}</span>{' · '}</>
                          )}
                          {task.ticket && (
                            <>Ticket: <span className="text-foreground font-medium">{task.ticket}</span></>
                          )}
                        </span>
                      </div>
                    )}
                    {normalizeRepairPathsFromPhotos(task.photos).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border w-full">
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Paperclip size={14} className="text-sky-600 shrink-0" aria-hidden />
                          Remark
                        </p>
                        <ul className="text-xs space-y-1">
                          {normalizeRepairPathsFromPhotos(task.photos).map((path) => {
                            const name = path.replace(/^.*[/\\]/, '') || path;
                            return (
                              <li key={path}>
                                <a
                                  href={repairFileHref(path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-700 hover:text-sky-900 hover:underline break-all"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {name}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => applyTaskToForm(task)}
                      className={`mt-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                        selectedTaskId === task.id
                          ? 'bg-green-500 text-white'
                          : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {selectedTaskId === task.id ? 'Using this data' : 'Use this task'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {totalTaskPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskPage(p => Math.max(1, p - 1))}
                  disabled={taskPageSafe <= 1}
                  className="p-2 rounded-lg border border-border bg-card disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-muted-foreground px-2">Page {taskPageSafe} / {totalTaskPages}</span>
                <button
                  type="button"
                  onClick={() => setTaskPage(p => Math.min(totalTaskPages, p + 1))}
                  disabled={taskPageSafe >= totalTaskPages}
                  className="p-2 rounded-lg border border-border bg-card disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Form */}
        <div className="bg-card/95 backdrop-blur-sm p-6 rounded-2xl border border-border shadow-sm">
          {/* Step 1 — Finished MA PDF */}
          <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                1
              </span>
              <h2 className="text-lg font-bold text-foreground">Upload finished MA PDF</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              If you already have the MA report PDF, upload it here — then enter Uptime below and click{' '}
              <strong>Save MA Report</strong>. No need to attach files again in Step 2.
            </p>
            {!selectedTaskId ? (
              <p className="text-sm text-muted-foreground">Select a task above first.</p>
            ) : (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => finishedPdfInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      finishedPdfInputRef.current?.click();
                    }
                  }}
                  className="rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                >
                  <input
                    ref={finishedPdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    onChange={handleFinishedPdfChange}
                  />
                  <FileText size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Drop PDF here or click to browse</p>
                  {finishedPdfFile && (
                    <p className="mt-2 text-xs text-emerald-800 font-medium">{finishedPdfFile.name}</p>
                  )}
                </div>
                {finishedPdfFile && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 size={18} />
                      PDF ready — fill Uptime and save below
                    </span>
                    <button
                      type="button"
                      onClick={() => setFinishedPdfFile(null)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              2
            </span>
            <h2 className="text-lg font-bold text-foreground">Report details & attachments</h2>
          </div>

          {/* Device Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-muted-foreground mb-3">
              Device * <span className="text-muted-foreground font-normal">(Only from selected Task)</span>
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              disabled={loadingDevices}
              className="w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingDevices
                  ? 'Loading...'
                  : selectedTaskId == null && availableMATasks.length > 0
                    ? 'Please select a task above first'
                    : selectedTaskId != null && allowedDevices.length === 0
                      ? 'No devices found for this task'
                      : 'Select device...'}
              </option>
              {allowedDevices.map(device => {
                const task = selectedTaskId != null ? availableMATasks.find((t) => t.id === selectedTaskId) : null;
                const isReplacement = task && (task.replacementDeviceId === device.Did || task.assets?.some((a, i: number) => (a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null)) === device.Did));
                return (
                  <option key={device.Did} value={device.Did.toString()}>
                    {device.CI_Name || device.Asset_Number || `Device ${device.Did}`}
                    {device.serial ? ` (${device.serial})` : ''}
                    {device.Sitename ? ` - ${device.Sitename}` : ''}
                    {isReplacement ? ' [Replacement device]' : ''}
                  </option>
                );
              })}
            </select>
            {doneMATasks.length > 0 && allowedDevices.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Only show devices from selected Task</p>
            )}
            {/* Selected device - show fields from fetched device */}
            {selectedDeviceId && (() => {
              const rawSelected =
                allowedDevices.find((d) => d.Did.toString() === selectedDeviceId) ??
                devices.find((d) => d.Did.toString() === selectedDeviceId);
              if (!rawSelected) return null;
              const task = selectedTaskId != null ? availableMATasks.find((t) => t.id === selectedTaskId) : null;
              const selected = enrichDeviceForDisplay(rawSelected, task);
              const isReplacement = task && (task.replacementDeviceId === selected.Did || task.assets?.some((a, i: number) => (a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null)) === selected.Did));
              const deviceFields: { label: string; value?: string | number | null }[] = [
                { label: 'CI Name', value: selected.CI_Name },
                { label: 'Asset Number', value: selected.Asset_Number },
                { label: 'Serial', value: selected.serial },
                { label: 'Model', value: selected.model },
                { label: 'SOF', value: selected.Refer_SOF },
                { label: 'Manufacturer', value: selected.Manufacturername },
                { label: 'Site', value: selected.Sitename },
                { label: 'Location', value: selected.Location2 },
                { label: 'Vendor', value: selected.Vendor },
                { label: 'Asset State', value: selected.Asset_State },
                { label: 'Assigned Service', value: selected.Assigned_Service },
              ];
              // MA: find the other device in the replace pair (replaced / replacement)
              let pairDevice: Device | null = null;
              let pairLabel = '';
              if (task?.assets?.length) {
                for (let i = 0; i < task.assets.length; i++) {
                  const a = task.assets[i];
                  const brokenId = getDeviceIdFromAsset(a);
                  const repId = a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null);
                  if (String(selectedDeviceId) === String(brokenId)) {
                    const repNum = repId != null ? Number(repId) : NaN;
                    pairDevice =
                      repId != null && !Number.isNaN(repNum)
                        ? (allowedDevices.find((d) => Number(d.Did) === repNum) ??
                            devices.find((d) => Number(d.Did) === repNum) ??
                            null)
                        : null;
                    pairLabel = 'Replacement device';
                    break;
                  }
                  if (repId != null && String(repId) === String(selectedDeviceId)) {
                    pairDevice = allowedDevices.find(d => d.Did.toString() === String(brokenId)) ?? devices.find(d => d.Did.toString() === String(brokenId)) ?? null;
                    if (!pairDevice && brokenId) {
                      pairDevice = {
                        Did: Number(brokenId) || 0,
                        CI_Name: a.name ?? a.CI_Name ?? a.Asset_Number ?? `Device ${brokenId}`,
                        Asset_Number: a.Asset_Number ?? a.assetNumber,
                        serial: a.serial ?? a.serialNumber,
                        model: a.model ?? a.type,
                        Sitename: a.site ?? a.SiteName,
                      } as Device;
                    }
                    pairLabel = 'Replaced device (original)';
                    break;
                  }
                }
              }
              const pairFields = pairDevice ? [
                { label: 'CI Name', value: pairDevice.CI_Name },
                { label: 'Asset Number', value: pairDevice.Asset_Number },
                { label: 'Serial', value: pairDevice.serial },
                { label: 'Model', value: pairDevice.model },
                { label: 'Site', value: pairDevice.Sitename },
              ] : [];
              return (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-sm font-bold text-muted-foreground">Selected device</p>
                      {isReplacement && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Replacement device</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {deviceFields.map(({ label, value }) => (
                        <div key={label} className="bg-card rounded-lg p-3 border border-border">
                          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-foreground truncate" title={value != null && value !== '' ? String(value) : undefined}>
                            {value ?? '-'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {pairDevice && pairLabel && (
                    <div className="p-4 bg-muted/80 rounded-xl border border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Replaced equipment</p>
                      <p className="text-sm font-bold text-muted-foreground mb-2">{pairLabel}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {pairFields.map(({ label, value }) => (
                          <div key={label} className="bg-card rounded-lg p-3 border border-border">
                            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                            <p className="text-sm font-medium text-foreground truncate" title={value != null && value !== '' ? String(value) : undefined}>
                              {value ?? '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Downtime จากงาน / Uptime กรอกตอนส่ง report */}
          {selectedTaskId != null && selectedMaTask && (
            <div className="mb-6 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
              <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <Calendar size={18} className="text-emerald-600 shrink-0" aria-hidden />
                Uptime & total downtime
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the date and time the system came back online (Uptime) — will be saved to the task when submitting the report
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Downtime date</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatDateLocale(
                      selectedMaTask.downtimeDate ??
                        selectedMaTask.downTimeStartDate ??
                        selectedMaTask.down_time_start_date ??
                        selectedMaTask.downtime_date,
                      'en-US'
                    ) || '— not set in the task —'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Downtime time</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatTime12h(
                      selectedMaTask.downtimeTime ??
                        selectedMaTask.downTimeStartTime ??
                        selectedMaTask.down_time_start_time ??
                        selectedMaTask.downtime_time,
                      'en-US'
                    ) || '— not set —'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Uptime date</p>
                  <input
                    type="date"
                    value={reportUptimeDate}
                    onChange={(e) => setReportUptimeDate(e.target.value)}
                    className="w-full text-sm font-semibold text-foreground tabular-nums p-2.5 bg-card border border-border rounded-xl min-h-[42px] focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Uptime time</p>
                  <input
                    type="time"
                    step={60}
                    value={reportUptimeTime}
                    onChange={(e) => setReportUptimeTime(e.target.value)}
                    className="w-full text-sm font-semibold text-foreground tabular-nums p-2.5 bg-card border border-border rounded-xl min-h-[42px] focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Total downtime (ชม.)</p>
                  <p className="text-sm font-semibold text-emerald-800 tabular-nums min-h-[2.5rem] flex items-center">
                    {downtimeTotalPreview.hours != null
                      ? `${downtimeTotalPreview.hours} hrs`
                      : downtimeTotalPreview.emptyHint}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contract Information (full) - โชว์เมื่อเลือก task แล้ว */}
          {selectedTaskId != null && (() => {
            const task = availableMATasks.find((t) => t.id === selectedTaskId);
            if (!task) return null;
            const hasContract = task.vendorName || task.vendor_name || task.vendorTel || task.vendor_tel || maTaskReporterName(task) || maTaskReporterTel(task) || task.ticket;
            if (!hasContract) return null;
            return (
              <div className="mb-6 p-4 bg-muted rounded-xl border border-border">
                <h3 className="text-sm font-bold text-muted-foreground mb-3">Contract Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {(task.vendorName || task.vendor_name) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Third Party Vendor name</p>
                      <p className="font-medium text-foreground">{task.vendorName || task.vendor_name}</p>
                    </div>
                  )}
                  {(task.vendorTel || task.vendor_tel) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Third Party Vendor phone</p>
                      <p className="font-medium text-foreground">{task.vendorTel || task.vendor_tel}</p>
                    </div>
                  )}
                  {maTaskReporterName(task) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Reporter name</p>
                      <p className="font-medium text-foreground">{maTaskReporterName(task)}</p>
                    </div>
                  )}
                  {maTaskReporterTel(task) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Reporter phone</p>
                      <p className="font-medium text-foreground">{maTaskReporterTel(task)}</p>
                    </div>
                  )}
                  {task.ticket && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Ticket</p>
                      <p className="font-medium text-foreground">{task.ticket}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Repair notice (ใบแจ้งซ่อม) — จากงานที่เลือก เพื่อดูรายละเอียดก่อนส่งรายงาน */}
          {selectedTaskId != null &&
            (() => {
              const task = availableMATasks.find((t) => t.id === selectedTaskId);
              if (!task) return null;
              const paths = normalizeRepairPathsFromPhotos(task.photos);
              if (paths.length === 0) return null;
              return (
                <div className="mb-6 p-4 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                      <Paperclip size={18} aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Repair notice</h3>
                      <p className="text-xs text-muted-foreground">Files attached when the MA task was created</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {paths.map((path) => {
                      const name = path.replace(/^.*[/\\]/, '') || path;
                      return (
                        <li
                          key={path}
                          className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                          <a
                            href={repairFileHref(path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sky-700 hover:text-sky-900 hover:underline break-all"
                          >
                            {name}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}

          {/* MA Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">
                Technician 
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="กรอกชื่อ-นามสกุล"
                className="w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">
               Maintenance Agreement Date *
              </label>
              <input
                type="date"
                value={maDate}
                onChange={(e) => setMaDate(e.target.value)}
                className="w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-muted-foreground mb-3">
              Additional images / documents {finishedPdfFile ? '(optional)' : ''}
            </label>
            <div className="border-2 border-dashed border-border rounded-xl p-6 bg-muted">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="sr-only"
                aria-label="Upload image or PDF"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload size={32} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground font-medium">
                  Click to upload files (PDF/Images)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports image and PDF files
                </p>
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                  >
                    {file.type === 'image' && file.preview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        {file.type === 'pdf' ? (
                          <FileText size={20} className="text-blue-600" />
                        ) : (
                          <ImageIcon size={20} className="text-blue-600" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.type === 'image' ? 'Image' : file.type === 'pdf' ? 'PDF' : 'File'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MA Result - Complete */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-muted-foreground mb-3">
              MA Result *
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border bg-emerald-500 text-white border-emerald-500 shadow-sm">
                <CheckCircle2 size={16} />
                Complete
              </div>
              <span className="text-xs text-muted-foreground">
                Saved automatically as complete.
              </span>
            </div>
          </div>

          {/* Comment Field */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-muted-foreground mb-3">
             Notes from Technician
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter additional notes..."
              rows={4}
              className="w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex flex-col items-end gap-2">
            {finishedPdfFile && (
              <p className="text-xs text-muted-foreground text-right max-w-md">
                Finished PDF uploaded in Step 1 — enter Uptime and click Save to submit.
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-emerald-500/25"
            >
              <Save size={18} />
              {saving ? 'Sending...' : 'Save MA Report'}
            </button>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}

export default function AddMAReportPage() {
  return (
    <Suspense fallback={null}>
      <AddMAReportPageContent />
    </Suspense>
  );
}
