'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, getTasks, getPmReportedTaskIds, type ApiTask } from '@/lib/api';
import { apiTaskString } from '@/lib/apiTask';
import { asRecord, readString } from '@/lib/unknownUtil';
import { formatTaskEngineersLine } from '@/lib/taskEngineers';
import { PmReportWizard, type PmReportWizardHandle, type PmSavePhase } from '@/components/pm-report-wizard/PmReportWizard';
import { computePmNo, type PmTaskForRound } from '@/lib/pmWorkOrder';
import { 
  AlertCircle,
  FileText,
  Save,
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

type TaskSortOption = 'date-desc' | 'date-asc' | 'site' | 'engineer';

function taskSofLabel(t: ApiTask): string {
  return (apiTaskString(t, 'sofName', 'sof_name') ?? '').trim();
}

function taskIdNum(t: ApiTask): number {
  const id = t.id;
  const n = typeof id === 'number' ? id : parseInt(String(id ?? ''), 10);
  return Number.isNaN(n) ? -1 : n;
}

function isDonePmTask(task: ApiTask): boolean {
  const status = String(task.status ?? '').toLowerCase();
  const type = String(task.taskType ?? task.task_type ?? '').toUpperCase();
  return status === 'done' && type === 'PM';
}

function taskAssets(task: ApiTask): unknown[] {
  return Array.isArray(task.assets) ? task.assets : [];
}

function getDeviceIdFromAsset(a: unknown): string {
  if (a == null) return '';
  if (typeof a === 'number') return String(a);
  if (typeof a === 'string') return a.trim();
  const rec = asRecord(a);
  const id = rec.id ?? rec.Did ?? rec.did ?? rec.deviceId ?? rec.device_id ?? rec.ID;
  return id != null ? String(id).trim() : '';
}

function deviceFromTaskAssetSnapshot(raw: unknown, didNum: number): Device {
  const a = asRecord(raw);
  return {
    Did: didNum,
    Asset_State: readString(a, 'Asset_State'),
    CI_Name: readString(a, 'CI_Name') ?? readString(a, 'name') ?? '',
    Asset_Number: readString(a, 'Asset_Number') ?? readString(a, 'assetNumber') ?? '',
    serial: readString(a, 'serial') ?? readString(a, 'serialNumber') ?? '',
    model: readString(a, 'model') ?? readString(a, 'type') ?? '',
    Manufacturername: readString(a, 'Manufacturername'),
    Sitename: readString(a, 'Sitename') ?? readString(a, 'sitename') ?? readString(a, 'siteName') ?? '',
    Location2: readString(a, 'Location2') ?? readString(a, 'location2') ?? '',
    PR_No: readString(a, 'PR_No'),
    Vendor: readString(a, 'Vendor') ?? readString(a, 'vendor') ?? '',
    Refer_SOF: readString(a, 'Refer_SOF') ?? readString(a, 'refer_sof') ?? '',
    SLid: typeof a.SLid === 'number' ? a.SLid : undefined,
  };
}

function toYmd(value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

function AddPMReportPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appliedTaskIdFromUrlRef = useRef(false);
  const tasksInitialLoadDoneRef = useRef(false);
  const lastAppliedTaskSyncRef = useRef('');
  const wizardRef = useRef<PmReportWizardHandle>(null);
  const { toasts, removeToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [technicianName, setTechnicianName] = useState('');
  const [pmDate, setPmDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<PmSavePhase>(null);
  const [pdfPreparing, setPdfPreparing] = useState(false);
  const [externalPdfMode, setExternalPdfMode] = useState(false);
  const [hasDonePMTasks, setHasDonePMTasks] = useState(false);
  const [donePMTasks, setDonePMTasks] = useState<ApiTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [checkingTasks, setCheckingTasks] = useState(true);
  const [reportedTaskIds, setReportedTaskIds] = useState<Set<number>>(new Set());
  const [searchTaskReport, setSearchTaskReport] = useState('');
  const [sortTaskBy, setSortTaskBy] = useState<TaskSortOption>('date-desc');
  const [sofFilter, setSofFilter] = useState<string>('');
  const [taskPage, setTaskPage] = useState(1);

  const TASKS_PER_PAGE = 3;

  // ดึง task_id ที่มี report_id แล้ว เพื่อกรองออก (แสดงเฉพาะที่ยังไม่มี)
  useEffect(() => {
    let cancelled = false;
    const checkDoneTasks = async () => {
      if (!tasksInitialLoadDoneRef.current) setCheckingTasks(true);
      try {
        const [tasksRes, reportedIdsRes] = await Promise.all([
          getTasks(),
          getPmReportedTaskIds(),
        ]);
        if (cancelled) return;
        if (tasksRes.success && tasksRes.data) {
          const done = tasksRes.data.filter(isDonePmTask);
          setHasDonePMTasks(done.length > 0);
          setDonePMTasks(done);
        }
        if (reportedIdsRes.success && Array.isArray(reportedIdsRes.taskIds)) {
          setReportedTaskIds(new Set(reportedIdsRes.taskIds));
        }
      } catch (error) {
        console.error('Error checking tasks:', error);
      } finally {
        if (!cancelled) {
          tasksInitialLoadDoneRef.current = true;
          setCheckingTasks(false);
        }
      }
    };
    void checkDoneTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  // แสดงเฉพาะ Task ที่ยังไม่มี report_id (task_id ไม่อยู่ใน table report)
  const availablePMTasks = useMemo(
    () => donePMTasks.filter((t) => !reportedTaskIds.has(taskIdNum(t))),
    [donePMTasks, reportedTaskIds]
  );

  const { sofNamesForFilter, sofFilterHasNoSof } = useMemo(() => {
    const named = new Set<string>();
    let noSof = false;
    for (const t of availablePMTasks) {
      const s = taskSofLabel(t);
      if (s) named.add(s);
      else noSof = true;
    }
    return {
      sofNamesForFilter: [...named].sort((a, b) => a.localeCompare(b)),
      sofFilterHasNoSof: noSof,
    };
  }, [availablePMTasks]);

  // ค้นหา + เรียง + แบ่งหน้า
  const taskSearchLower = searchTaskReport.trim().toLowerCase();
  const filteredAndSortedTasks = useMemo(() => {
    let list = availablePMTasks;
    if (sofFilter === '__none__') {
      list = list.filter((t) => !taskSofLabel(t));
    } else if (sofFilter) {
      list = list.filter((t) => taskSofLabel(t) === sofFilter);
    }
    if (taskSearchLower) {
      list = list.filter((t) => {
        const site = (apiTaskString(t, 'siteName', 'site_name') ?? '').toLowerCase();
        const startRaw = apiTaskString(t, 'startDate', 'start_date');
        const endRaw = apiTaskString(t, 'endDate', 'end_date');
        const start = startRaw ? new Date(startRaw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const end = endRaw ? new Date(endRaw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const engineers = formatTaskEngineersLine(t.engineers ?? t.Eng_ids).toLowerCase();
        const devices = taskAssets(t).map((a) => {
          const rec = asRecord(a);
          return (readString(rec, 'name') ?? readString(rec, 'CI_Name') ?? String(rec.id ?? '')).toLowerCase();
        }).join(' ');
        const sof = taskSofLabel(t).toLowerCase();
        return [site, start, end, engineers, devices, sof].some(s => s.includes(taskSearchLower));
      });
    }
    const sorted = [...list].sort((a, b) => {
      const aStart = apiTaskString(a, 'startDate', 'start_date');
      const bStart = apiTaskString(b, 'startDate', 'start_date');
      if (sortTaskBy === 'date-desc') return (new Date(bStart || 0).getTime()) - (new Date(aStart || 0).getTime());
      if (sortTaskBy === 'date-asc') return (new Date(aStart || 0).getTime()) - (new Date(bStart || 0).getTime());
      if (sortTaskBy === 'site') {
        return (apiTaskString(a, 'siteName', 'site_name') ?? '').localeCompare(apiTaskString(b, 'siteName', 'site_name') ?? '');
      }
      if (sortTaskBy === 'engineer') {
        const aStr = formatTaskEngineersLine(a.engineers ?? a.Eng_ids);
        const bStr = formatTaskEngineersLine(b.engineers ?? b.Eng_ids);
        return aStr.localeCompare(bStr);
      }
      return 0;
    });
    return sorted;
  }, [availablePMTasks, taskSearchLower, sortTaskBy, sofFilter]);

  const totalTaskPages = Math.max(1, Math.ceil(filteredAndSortedTasks.length / TASKS_PER_PAGE));
  const taskPageSafe = Math.min(Math.max(1, taskPage), totalTaskPages);
  const paginatedTasks = useMemo(
    () => filteredAndSortedTasks.slice((taskPageSafe - 1) * TASKS_PER_PAGE, taskPageSafe * TASKS_PER_PAGE),
    [filteredAndSortedTasks, taskPageSafe]
  );

  // รีเซ็ตหน้าเมื่อค้นหา/เรียงเปลี่ยน
  useEffect(() => {
    setTaskPage(p => Math.min(p, Math.max(1, Math.ceil(filteredAndSortedTasks.length / TASKS_PER_PAGE)) || 1));
  }, [searchTaskReport, sortTaskBy, sofFilter, filteredAndSortedTasks.length]);

  /** จาก Calendar/Schedule (?taskId=) — pre-fill ช่าง/วันที่/อุปกรณ์เมื่อเลือก task */
  useEffect(() => {
    if (checkingTasks) return;
    if (appliedTaskIdFromUrlRef.current) return;
    const raw = searchParams.get('taskId');
    if (!raw?.trim()) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    const n = parseInt(raw.trim(), 10);
    if (Number.isNaN(n) || n <= 0) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    const exists = availablePMTasks.some((t) => taskIdNum(t) === n);
    if (!exists) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    appliedTaskIdFromUrlRef.current = true;
    setSelectedTaskId(n);
    const idx = filteredAndSortedTasks.findIndex((t) => taskIdNum(t) === n);
    if (idx >= 0) {
      setTaskPage(Math.floor(idx / TASKS_PER_PAGE) + 1);
    }
    if (pathname) router.replace(pathname, { scroll: false });
  }, [checkingTasks, availablePMTasks, filteredAndSortedTasks, searchParams, router, pathname]);

  // Fetch devices from API
  useEffect(() => {
    const fetchDevices = async () => {
      setLoadingDevices(true);
      try {
        const response = await fetch(apiUrl('/api/devices?limit=1000'));
        const data = await response.json();
        if (data.success && data.data) {
          setDevices(data.data);
        }
      } catch (error) {
        console.error('Error fetching devices:', error);
      } finally {
        setLoadingDevices(false);
      }
    };
    fetchDevices();
  }, []);

  // Device ที่เลือกได้มาจาก Task (assets + replacement) — ใช้ snapshot ใน task ถ้าไม่พบในรายการ devices ที่โหลดมา
  const allowedDevices = useMemo(() => {
    if (selectedTaskId == null) return [];
    const task = availablePMTasks.find((t) => taskIdNum(t) === Number(selectedTaskId));
    if (!task) return [];

    const seen = new Set<string>();
    const out: Device[] = [];

    const addOne = (d: Device) => {
      const key = String(d.Did);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(d);
    };

    for (const raw of taskAssets(task)) {
      const idStr = getDeviceIdFromAsset(raw);
      if (!idStr) continue;
      const fromPool = devices.find((d) => String(d.Did) === String(idStr));
      if (fromPool) {
        addOne(fromPool);
        continue;
      }
      const didNum = parseInt(String(idStr), 10);
      if (Number.isNaN(didNum)) continue;
      addOne(deviceFromTaskAssetSnapshot(raw, didNum));
    }

    const replacementId = task.replacementDeviceId ?? task.replacement_device_id;
    if (replacementId != null) {
      const rid = String(replacementId);
      if (!seen.has(rid)) {
        const fromPool = devices.find((d) => String(d.Did) === rid);
        if (fromPool) addOne(fromPool);
        else {
          const n = Number(replacementId);
          if (!Number.isNaN(n)) addOne({ Did: n });
        }
      }
    }

    return out;
  }, [devices, availablePMTasks, selectedTaskId]);

  const selectedTask = useMemo(() => {
    if (selectedTaskId == null) return null;
    return availablePMTasks.find((t) => taskIdNum(t) === Number(selectedTaskId)) ?? null;
  }, [availablePMTasks, selectedTaskId]);

  const selectedTaskContractId = useMemo((): number | null => {
    if (!selectedTask) return null;
    const raw = selectedTask.contractId ?? selectedTask.contract_id;
    if (raw == null || raw === '') return null;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedTask]);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    const fromAllowed = allowedDevices.find((d) => String(d.Did) === String(selectedDeviceId));
    if (fromAllowed) return fromAllowed;
    return devices.find((d) => String(d.Did) === String(selectedDeviceId)) ?? null;
  }, [devices, selectedDeviceId, allowedDevices]);

  const selectedTaskSiteName = useMemo(() => {
    if (!selectedTask) return '';
    return (apiTaskString(selectedTask, 'siteName', 'site_name') ?? '').trim();
  }, [selectedTask]);

  const selectedSiteDisplayName = useMemo(() => {
    if (selectedTaskId == null) return '';
    if (selectedTaskSiteName) return selectedTaskSiteName;
    return (selectedDevice?.Sitename ?? '').toString().trim();
  }, [selectedTaskId, selectedTaskSiteName, selectedDevice]);

  /** PM No. = ครั้งที่ทำ PM ของ site ในปี (ไม่ใช่ลำดับ device/หน้า) */
  const selectedTaskPmNo = useMemo(() => {
    if (selectedTaskId == null) return '1';
    return computePmNo(donePMTasks as PmTaskForRound[], selectedTaskId, pmDate);
  }, [donePMTasks, selectedTaskId, pmDate]);

  // เคลียร์ Device ที่เลือกถ้าไม่อยู่ในรายการที่อนุญาต (เมื่อเปลี่ยน Task)
  useEffect(() => {
    if (selectedTaskId == null) {
      setSelectedDeviceId('');
      return;
    }
    if (selectedDeviceId && allowedDevices.length > 0 && !allowedDevices.some((d) => d.Did.toString() === selectedDeviceId)) {
      setSelectedDeviceId('');
    }
  }, [selectedTaskId, allowedDevices, selectedDeviceId]);

  // เลือก device แรกอัตโนมัติเมื่อมี devices (หลังเลือก Task)
  useEffect(() => {
    if (allowedDevices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(allowedDevices[0].Did.toString());
    }
  }, [allowedDevices, selectedDeviceId]);

  const applyTaskToForm = useCallback((task: ApiTask) => {
    const taskId = taskIdNum(task);
    setSelectedTaskId(taskId >= 0 ? taskId : null);
    lastAppliedTaskSyncRef.current = `${String(task.id ?? '')}:${apiTaskString(task, 'updatedAt', 'updated_at') ?? ''}`;
    const assets = taskAssets(task);
    const firstAsset = assets[0];
    if (firstAsset) {
      const deviceId = getDeviceIdFromAsset(firstAsset);
      if (deviceId) setSelectedDeviceId(deviceId);
    }
    const doneDate = toYmd(task.updatedAt ?? task.updated_at);
    if (doneDate) setPmDate(doneDate);
    else {
      const start = toYmd(task.startDate ?? task.start_date);
      if (start) setPmDate(start);
    }
    setTechnicianName(formatTaskEngineersLine(task.engineers ?? task.Eng_ids));
  }, []);

  /** Pre-fill จาก task ที่เลือก — ไม่ re-run ทุกครั้งที่ donePMTasks ได้ array ใหม่ (กัน wizard กระพริบ) */
  useEffect(() => {
    if (selectedTaskId == null) return;
    const task = donePMTasks.find((t) => taskIdNum(t) === Number(selectedTaskId));
    if (!task) return;
    const syncKey = `${String(task.id ?? '')}:${apiTaskString(task, 'updatedAt', 'updated_at') ?? ''}`;
    if (lastAppliedTaskSyncRef.current === syncKey) return;
    lastAppliedTaskSyncRef.current = syncKey;
    applyTaskToForm(task);
  }, [selectedTaskId, donePMTasks, applyTaskToForm]);

  const saveButtonLabel = saving
    ? savePhase === 'generating-pdf'
      ? 'Generating PDF...'
      : savePhase === 'uploading-pdf'
        ? 'Uploading PDF...'
        : savePhase === 'saving-report'
          ? 'Saving report...'
          : 'Sending...'
    : pdfPreparing
      ? 'Preparing PDF...'
      : 'Save PM Report';

  // Handle save — ผ่าน wizard (สร้าง PDF แล้วอัปโหลดไฟล์เดียว)
  const handleSave = async () => {
    if (!selectedTaskId) {
      toastWarning('Please select a task before submitting the report.');
      return;
    }
    if (!wizardRef.current?.canSave()) {
      toastWarning(
        'Upload a finished PDF in Step 1, or complete backup and before/after photos for every device.'
      );
      return;
    }
    setSaving(true);
    try {
      await wizardRef.current.save();
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

  const hasAvailableTasks = availablePMTasks.length > 0;
  if (!hasAvailableTasks) {
    const allReported = hasDonePMTasks && donePMTasks.length > 0;
    return (
      <SidebarLayout>
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center p-8">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${allReported ? 'bg-green-100' : 'bg-amber-100'}`}>
              <AlertCircle size={40} className={allReported ? 'text-green-600' : 'text-amber-500'} />
            </div>
            <p className="text-muted-foreground text-lg font-semibold mb-2">
              {allReported ? 'All reports completed' : 'Cannot create PM Report'}
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              {allReported
                ? 'All done tasks have reports. No tasks pending report.'
                : 'Please wait until PM tasks have status "Done".'}
            </p>
            <button
              onClick={() => router.push('/pmchecklist_report')}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
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
              onClick={() => router.push('/pmchecklist_report')}
              className="p-2.5 hover:bg-card/80 rounded-xl transition-colors border border-border shadow-sm"
            >
              <ArrowLeft size={22} className="text-muted-foreground" />
            </button>
            <div>
              <h1 className="page-heading">
                Create PM Checklist Report
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Record preventive maintenance report
              </p>
            </div>
          </div>
        </div>

      
        {availablePMTasks.length > 0 && (
          <div className="bg-card/95 backdrop-blur-sm p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={22} className="text-blue-600" />
              <h2 className="text-lg font-bold text-foreground">Tasks to Report</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Select completed tasks that do not yet have a report to auto-fill the form. Each plan
              with a different SOF is a separate task — mark both done to see two rows here. Filter
              by SOF to work on one service order at a time.
            </p>
            <div className="flex flex-col lg:flex-row gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTaskReport}
                  onChange={(e) => { setSearchTaskReport(e.target.value); setTaskPage(1); }}
                  placeholder="Search location, SOF, date, person, device..."
                  className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <select
                value={sofFilter}
                onChange={(e) => { setSofFilter(e.target.value); setTaskPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px]"
                aria-label="Filter by SOF"
              >
                <option value="">All SOF</option>
                {sofFilterHasNoSof && (
                  <option value="__none__">(No SOF on contract)</option>
                )}
                {sofNamesForFilter.map((name) => (
                  <option key={name} value={name}>
                    SOF: {name}
                  </option>
                ))}
              </select>
              <select
                value={sortTaskBy}
                onChange={(e) => { setSortTaskBy(e.target.value as TaskSortOption); setTaskPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
              </select>
            </div>
            <div className="mb-3 text-xs text-muted-foreground">
              Showing {filteredAndSortedTasks.length === 0 ? 0 : (taskPageSafe - 1) * TASKS_PER_PAGE + 1}-{Math.min(taskPageSafe * TASKS_PER_PAGE, filteredAndSortedTasks.length)} of {filteredAndSortedTasks.length} tasks
            </div>
            <div className="space-y-3">
              {paginatedTasks.map((task) => {
                const tid = taskIdNum(task);
                const assetList = taskAssets(task);
                const startRaw = apiTaskString(task, 'startDate', 'start_date');
                const endRaw = apiTaskString(task, 'endDate', 'end_date');
                const replacementId = task.replacementDeviceId ?? task.replacement_device_id;
                return (
                <div
                  key={String(task.id ?? tid)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedTaskId === tid
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border bg-muted hover:border-border'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin size={16} className="text-muted-foreground" />
                        {apiTaskString(task, 'siteName', 'site_name') || '-'}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText size={16} className="text-muted-foreground" />
                        <span>
                          SOF:{' '}
                          <span className="font-medium text-foreground">
                            {taskSofLabel(task) || '—'}
                          </span>
                        </span>
                      </span>
                      {tid > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Task #{tid}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar size={16} className="text-muted-foreground" />
                        {startRaw ? new Date(startRaw).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        {endRaw && ` - ${new Date(endRaw).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <User size={16} className="text-muted-foreground" />
                        {formatTaskEngineersLine(task.engineers ?? task.Eng_ids) || '—'}
                      </span>
                      {assetList.length > 0 && (
                        <span className="text-muted-foreground">
                          {assetList.length === 1 ? 'Device' : 'Devices'}: {assetList.length}
                        </span>
                      )}
                      {replacementId != null && (
                        <span className="text-muted-foreground">
                          Replacement device: {(() => {
                            const rep = devices.find((d) => d.Did === Number(replacementId));
                            return rep ? (rep.CI_Name || rep.Asset_Number || rep.serial || `Device ${replacementId}`) : `Device ${replacementId}`;
                          })()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyTaskToForm(task)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                        selectedTaskId === tid
                          ? 'bg-blue-500 text-white'
                          : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {selectedTaskId === tid ? 'Using this data' : 'Use this task'}
                    </button>
                  </div>
                </div>
              );})}
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
          {/* PM Document Wizard — Backup + Before/After photos + PDF */}
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">PM Document Report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Step 1: upload a finished PDF to submit immediately — or create a new report from backup and photos.
              </p>
            </div>
            <PmReportWizard
              ref={wizardRef}
              selectedTaskId={selectedTaskId}
              contractId={selectedTaskContractId}
              technicianName={technicianName}
              pmDate={pmDate}
              siteName={selectedSiteDisplayName}
              pmNo={selectedTaskPmNo}
              allowedDevices={allowedDevices}
              loadingDevices={loadingDevices}
              toastSuccess={toastSuccess}
              toastError={toastError}
              toastWarning={toastWarning}
              onSavePhase={setSavePhase}
              onPdfPrepareState={({ preparing }) => setPdfPreparing(preparing)}
              onExternalPdfModeChange={setExternalPdfMode}
            />
          </div>

          {/* PM Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">
                Technician 
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Enter technician name and surname"
                className="w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">
               Preventive Maintenance Date *
              </label>
              <input
                type="date"
                value={pmDate}
                onChange={(e) => setPmDate(e.target.value)}
                className="w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Save — อัปโหลด PDF สำเร็จรูปจาก wizard อัตโนมัติ */}
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-muted-foreground text-right max-w-md">
              {externalPdfMode
                ? 'Finished PDF uploaded in Step 1 — click Save to upload and submit the report.'
                : 'After completing backup and photos, save here. The PM PDF is generated and uploaded automatically.'}
            </p>
            <button
              onClick={() => void handleSave()}
              disabled={saving || (pdfPreparing && !externalPdfMode)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-blue-500/25"
            >
              <Save size={18} />
              {saveButtonLabel}
            </button>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}

export default function AddPMReportPage() {
  return (
    <Suspense fallback={null}>
      <AddPMReportPageContent />
    </Suspense>
  );
}
