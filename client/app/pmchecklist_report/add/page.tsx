'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, postPmReport, getTasks, getPmReportedTaskIds, getContractById, uploadReportFile } from '@/lib/api';
import { 
  Upload, 
  X, 
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
  ChevronRight
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  task: string;
  status: 'pending' | 'pass' | 'warning' | 'fail';
  notes?: string;
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

function AddPMReportPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appliedTaskIdFromUrlRef = useRef(false);
  const { toasts, removeToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [slaResult, setSlaResult] = useState<string>('');
  const [comment, setComment] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [pmDate, setPmDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [hasDonePMTasks, setHasDonePMTasks] = useState(false);
  const [donePMTasks, setDonePMTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [checkingTasks, setCheckingTasks] = useState(true);
  const [reportedTaskIds, setReportedTaskIds] = useState<Set<number>>(new Set());
  const [contractSlaMap, setContractSlaMap] = useState<Record<number, number>>({});
  const [searchTaskReport, setSearchTaskReport] = useState('');
  const [sortTaskBy, setSortTaskBy] = useState<'date-desc' | 'date-asc' | 'site' | 'engineer'>('date-desc');
  const [sofFilter, setSofFilter] = useState<string>('');
  const [taskPage, setTaskPage] = useState(1);

  const TASKS_PER_PAGE = 3;

  const taskSofLabel = useCallback((t: any) => String(t?.sofName ?? t?.sof_name ?? '').trim(), []);

  // ดึง task_id ที่มี report_id แล้ว เพื่อกรองออก (แสดงเฉพาะที่ยังไม่มี)
  useEffect(() => {
    const checkDoneTasks = async () => {
      setCheckingTasks(true);
      try {
        const [tasksRes, reportedIdsRes] = await Promise.all([
          getTasks(),
          getPmReportedTaskIds(),
        ]);
        if (tasksRes.success && tasksRes.data) {
          const done = tasksRes.data.filter((task: any) => {
            const status = String(task.status ?? '').toLowerCase();
            const type = String(task.taskType ?? task.task_type ?? '').toUpperCase();
            return status === 'done' && type === 'PM';
          });
          setHasDonePMTasks(done.length > 0);
          setDonePMTasks(done);
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

  // แสดงเฉพาะ Task ที่ยังไม่มี report_id (task_id ไม่อยู่ใน table report)
  const availablePMTasks = useMemo(
    () => donePMTasks.filter((t: any) => !reportedTaskIds.has(Number(t.id))),
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
  }, [availablePMTasks, taskSofLabel]);

  // ค้นหา + เรียง + แบ่งหน้า
  const taskSearchLower = searchTaskReport.trim().toLowerCase();
  const filteredAndSortedTasks = useMemo(() => {
    let list = availablePMTasks;
    if (sofFilter === '__none__') {
      list = list.filter((t: any) => !taskSofLabel(t));
    } else if (sofFilter) {
      list = list.filter((t: any) => taskSofLabel(t) === sofFilter);
    }
    if (taskSearchLower) {
      list = list.filter((t: any) => {
        const site = (t.siteName || t.site_name || '').toLowerCase();
        const start = t.startDate ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const end = t.endDate ? new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const engineers = (t.engineers || []).map((e: any) => (e.name || e.id || '').toString().toLowerCase()).join(' ');
        const devices = (t.assets || []).map((a: any) => (a.name || a.CI_Name || a.id || '').toString().toLowerCase()).join(' ');
        const sof = taskSofLabel(t).toLowerCase();
        return [site, start, end, engineers, devices, sof].some(s => s.includes(taskSearchLower));
      });
    }
    const sorted = [...list].sort((a: any, b: any) => {
      if (sortTaskBy === 'date-desc') return (new Date(b.startDate || 0).getTime()) - (new Date(a.startDate || 0).getTime());
      if (sortTaskBy === 'date-asc') return (new Date(a.startDate || 0).getTime()) - (new Date(b.startDate || 0).getTime());
      if (sortTaskBy === 'site') return (a.siteName || a.site_name || '').localeCompare(b.siteName || b.site_name || '');
      if (sortTaskBy === 'engineer') {
        const aStr = (a.engineers || []).map((e: any) => e.name || e.id).join(', ');
        const bStr = (b.engineers || []).map((e: any) => e.name || e.id).join(', ');
        return aStr.localeCompare(bStr);
      }
      return 0;
    });
    return sorted;
  }, [availablePMTasks, taskSearchLower, sortTaskBy, sofFilter, taskSofLabel]);

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

  /** จากลิงก์ Create Report (เช่น schedule) — เลือก task และเลื่อนไปหน้ารายการที่มี task นั้น */
  useEffect(() => {
    if (checkingTasks || appliedTaskIdFromUrlRef.current) return;
    const raw = searchParams.get('taskId');
    if (!raw?.trim()) return;
    const n = parseInt(raw.trim(), 10);
    if (Number.isNaN(n) || n <= 0) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    const exists = availablePMTasks.some((t: any) => Number(t.id) === n);
    if (!exists) {
      appliedTaskIdFromUrlRef.current = true;
      return;
    }
    appliedTaskIdFromUrlRef.current = true;
    setSelectedTaskId(n);
    const idx = filteredAndSortedTasks.findIndex((t: any) => Number(t.id) === n);
    if (idx >= 0) {
      setTaskPage(Math.floor(idx / TASKS_PER_PAGE) + 1);
    }
    if (pathname) router.replace(pathname, { scroll: false });
  }, [checkingTasks, availablePMTasks, filteredAndSortedTasks, searchParams, router, pathname]);

  // Fallback: เมื่อ Task มี contractId แต่ไม่มี slaTerm ให้ดึง sla_term จาก Contract
  useEffect(() => {
    const toFetch = donePMTasks
      .filter((t: any) => t.contractId != null && (t.slaTerm == null || String(t.slaTerm).trim() === ''))
      .map((t: any) => Number(t.contractId))
      .filter((n: number) => !Number.isNaN(n));
    const uniqueIds = [...new Set(toFetch)];
    if (uniqueIds.length === 0) return;
    const fetchAll = async () => {
      const map: Record<number, number> = {};
      await Promise.all(
        uniqueIds.map(async (cid) => {
          try {
            const res = await getContractById(cid);
            if (res.success && res.data?.sla_term != null) {
              const n = typeof res.data.sla_term === 'number' ? res.data.sla_term : parseInt(String(res.data.sla_term), 10);
              if (!Number.isNaN(n)) map[cid] = n;
            }
          } catch (_) {}
        })
      );
      setContractSlaMap((prev: Record<number, number>) => ({ ...prev, ...map }));
    };
    fetchAll();
  }, [donePMTasks]);

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

  // Handle device selection change
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
  };

  // ดึง device ID จาก task.assets (รองรับหลายรูปแบบที่ API/DB อาจส่งมา)
  const getDeviceIdFromAsset = (a: any): string => {
    if (a == null) return '';
    if (typeof a === 'number') return String(a);
    if (typeof a === 'string') return a.trim();
    const id =
      a.id ?? a.Did ?? a.did ?? a.deviceId ?? a.device_id ?? (a as any).ID;
    return id != null ? String(id).trim() : '';
  };

  /** รวมข้อมูลจาก task.assets เมื่อ device ไม่อยู่ใน GET /api/devices (เช่น limit 1000 + ORDER BY Did DESC ไม่ครอบคลุม Did เก่า) */
  const deviceFromTaskAssetSnapshot = (raw: any, didNum: number): Device => {
    const a = raw as Record<string, unknown>;
    return {
      Did: didNum,
      Asset_State: a.Asset_State as string | undefined,
      CI_Name: (a.CI_Name ?? a.name ?? '') as string | undefined,
      Asset_Number: (a.Asset_Number ?? a.assetNumber ?? '') as string | undefined,
      serial: (a.serial ?? a.serialNumber ?? '') as string | undefined,
      model: (a.model ?? a.type ?? '') as string | undefined,
      Manufacturername: a.Manufacturername as string | undefined,
      Sitename: (a.Sitename ?? a.sitename ?? a.siteName ?? '') as string | undefined,
      Location2: (a.Location2 ?? a.location2 ?? '') as string | undefined,
      PR_No: a.PR_No as string | undefined,
      Vendor: a.Vendor as string | undefined,
      SLid: a.SLid as number | undefined,
    };
  };

  // Device ที่เลือกได้มาจาก Task (assets + replacement) — ใช้ snapshot ใน task ถ้าไม่พบในรายการ devices ที่โหลดมา
  const allowedDevices = useMemo(() => {
    if (selectedTaskId == null) return [];
    const task = availablePMTasks.find((t: any) => Number(t.id) === Number(selectedTaskId));
    if (!task) return [];

    const seen = new Set<string>();
    const out: Device[] = [];

    const addOne = (d: Device) => {
      const key = String(d.Did);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(d);
    };

    for (const raw of task.assets || []) {
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

    if (task.replacementDeviceId != null) {
      const rid = String(task.replacementDeviceId);
      if (!seen.has(rid)) {
        const fromPool = devices.find((d) => String(d.Did) === rid);
        if (fromPool) addOne(fromPool);
        else {
          const n = Number(task.replacementDeviceId);
          if (!Number.isNaN(n)) addOne({ Did: n } as Device);
        }
      }
    }

    return out;
  }, [devices, availablePMTasks, selectedTaskId]);

  const selectedTask = useMemo(() => {
    if (selectedTaskId == null) return null;
    return availablePMTasks.find((t: any) => Number(t.id) === Number(selectedTaskId)) ?? null;
  }, [availablePMTasks, selectedTaskId]);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    const fromAllowed = allowedDevices.find((d) => String(d.Did) === String(selectedDeviceId));
    if (fromAllowed) return fromAllowed;
    return devices.find((d) => String(d.Did) === String(selectedDeviceId)) ?? null;
  }, [devices, selectedDeviceId, allowedDevices]);

  const selectedTaskSiteName = useMemo(() => {
    const t: any = selectedTask as any;
    return (t?.siteName ?? t?.site_name ?? '').toString().trim();
  }, [selectedTask]);

  const selectedDeviceLocationName = useMemo(() => {
    return (selectedDevice?.Location2 ?? '').toString().trim();
  }, [selectedDevice]);

  const selectedSiteDisplayName = useMemo(() => {
    if (selectedTaskId == null) return '';
    if (selectedTaskSiteName) return selectedTaskSiteName;
    return (selectedDevice?.Sitename ?? '').toString().trim();
  }, [selectedTaskId, selectedTaskSiteName, selectedDevice]);

  const selectedLocationDisplayName = useMemo(() => {
    if (selectedTaskId == null) return '';
    const loc = selectedDeviceLocationName;
    if (!loc) return '';
    const site = selectedSiteDisplayName;
    // กันค่าซ้ำ เช่น "Beer Thai Beer Thai"
    if (site && site.toLowerCase().includes(loc.toLowerCase())) return '';
    return loc;
  }, [selectedTaskId, selectedDeviceLocationName, selectedSiteDisplayName]);

  const selectedTaskSiteLocationLabel = useMemo(() => {
    if (selectedTaskId == null) return '';
    // ให้เป็น “อันเดียว” คือ site จาก task ที่เลือก (แล้วค่อยต่อ location ถ้ามี)
    if (selectedTaskSiteName) {
      return [selectedTaskSiteName, selectedLocationDisplayName].filter(Boolean).join(' ').trim();
    }
    // fallback: ถ้า task ไม่มี siteName ให้ใช้จาก device
    const deviceSite = (selectedDevice?.Sitename ?? '').toString().trim();
    return [deviceSite, selectedLocationDisplayName].filter(Boolean).join(' ').trim();
  }, [selectedTaskId, selectedTaskSiteName, selectedLocationDisplayName, selectedDevice]);

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

  // sla_term จาก Contract (ผ่าน Task ที่เลือก) ใช้เป็นเกณฑ์ Pass/Fail
  // Fallback: ถ้า Task ไม่มี slaTerm แต่มี contractId ให้ใช้จาก contractSlaMap
  const slaThreshold = useMemo(() => {
    const task = selectedTaskId != null ? availablePMTasks.find((t: any) => t.id === selectedTaskId) : null;
    if (!task) return 70;
    let st = task.slaTerm ?? task.sla_term;
    if ((st == null || String(st).trim() === '') && task.contractId != null) {
      st = contractSlaMap[Number(task.contractId)];
    }
    if (st == null || String(st).trim() === '') return 70;
    const n = typeof st === 'number' ? st : parseInt(String(st).trim(), 10);
    return Number.isNaN(n) ? 70 : n;
  }, [availablePMTasks, selectedTaskId, contractSlaMap]);

  // ใช้ local date เพื่อไม่ให้ timezone เลื่อนวัน (รับได้ทั้ง ISO และ YYYY-MM-DD)
  const toYmd = (value: any): string => {
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
  };

  // ใช้ข้อมูลจาก Task ที่เลือก pre-fill form
  const applyTaskToForm = (task: any) => {
    setSelectedTaskId(task.id);
    const firstAsset = task.assets && task.assets[0];
    if (firstAsset) {
      const deviceId = getDeviceIdFromAsset(firstAsset);
      if (deviceId) setSelectedDeviceId(deviceId);
    }
    // PM date: ใช้ "วันที่กด Done" (updatedAt) ก่อน แล้วค่อย fallback เป็น startDate
    const doneDate = toYmd(task.updatedAt ?? task.updated_at);
    if (doneDate) setPmDate(doneDate);
    else {
      const start = toYmd(task.startDate ?? task.start_date);
      if (start) setPmDate(start);
    }
    const eng = task.engineers && task.engineers[0];
    if (eng) setTechnicianName(`${eng.name || eng.id || ''} ${eng.lastName || ''}`.trim());
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

    const task: any = availablePMTasks.find((t: any) => Number(t.id) === Number(selectedTaskId));

    setSaving(true);
    try {
      // ต้องเปลี่ยนตาม task ที่เราเลือก (ใช้ site_name จาก task ก่อน)
      const siteName = (task?.siteName ?? task?.site_name ?? selectedDevice?.Sitename ?? '').toString().trim() || 'Unknown';
      const locationName = (selectedDevice?.Location2 ?? '').toString().trim() || 'Unknown';
      const safeForName = (s: string) => s.replace(/[/\\?*|"<>:]/g, '_').replace(/\s+/g, '_') || 'Unknown';
      const getExt = (name: string, type: string) => {
        const m = name?.match(/\.\w+$/);
        if (m) return m[0];
        return type === 'pdf' ? '.pdf' : '.jpg';
      };
      // อัปโหลดไฟล์ก่อน — ตั้งชื่อเป็น Site_Location_วันที่_ลำดับ เพื่อแยกตาม site และมี location
      const filesWithPath: Array<{ name: string; type: string; path?: string }> = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const f = uploadedFiles[i];
        const uploadRes = await uploadReportFile(f.file);
        const ext = getExt(f.name, f.type);
        const displayName = `${safeForName(siteName)}_${safeForName(locationName)}_${pmDate}_${i + 1}${ext}`;
        if (uploadRes.success && uploadRes.path) {
          filesWithPath.push({ name: displayName, type: f.type, path: uploadRes.path });
        } else {
          filesWithPath.push({ name: displayName, type: f.type });
        }
      }

      const reportData = {
        taskId: selectedTaskId,
        deviceId: selectedDeviceId,
        device: selectedDevice ?? undefined,
        checklistItems: [],
        uploadedFiles: filesWithPath,
        comment,
        technicianName,
        pmDate,
        createdAt: new Date().toISOString(),
      };

      const res = await postPmReport(reportData);
      if (res.success) {
        toastSuccess(res.message || 'PM report saved successfully', 3200);
        window.setTimeout(() => router.push('/pmchecklist_report'), 1200);
      } else {
        toastError(res.message || 'Failed to submit report');
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
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <p className="text-slate-500 mb-2">Checking tasks...</p>
            <p className="text-sm text-slate-400">Please wait</p>
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
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
          <div className="text-center p-8">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${allReported ? 'bg-green-100' : 'bg-amber-100'}`}>
              <AlertCircle size={40} className={allReported ? 'text-green-600' : 'text-amber-500'} />
            </div>
            <p className="text-slate-700 text-lg font-semibold mb-2">
              {allReported ? 'All reports completed' : 'Cannot create PM Report'}
            </p>
            <p className="text-slate-500 text-sm mb-6">
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
      
      <div className="flex flex-col p-6 pt-0 gap-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/pmchecklist_report')}
              className="p-2.5 hover:bg-white/80 rounded-xl transition-colors border border-slate-200/80 shadow-sm"
            >
              <ArrowLeft size={22} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Create PM Checklist Report
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Record preventive maintenance report
              </p>
            </div>
          </div>
        </div>

      
        {availablePMTasks.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={22} className="text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">Tasks to Report</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Select completed tasks that do not yet have a report to auto-fill the form. Filter by SOF (from contract) to work on one service order at a time.
            </p>
            <div className="flex flex-col lg:flex-row gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTaskReport}
                  onChange={(e) => { setSearchTaskReport(e.target.value); setTaskPage(1); }}
                  placeholder="Search location, SOF, date, person, device..."
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <select
                value={sofFilter}
                onChange={(e) => { setSofFilter(e.target.value); setTaskPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px]"
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
                onChange={(e) => { setSortTaskBy(e.target.value as any); setTaskPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
              </select>
            </div>
            <div className="mb-3 text-xs text-slate-500">
              Showing {filteredAndSortedTasks.length === 0 ? 0 : (taskPageSafe - 1) * TASKS_PER_PAGE + 1}-{Math.min(taskPageSafe * TASKS_PER_PAGE, filteredAndSortedTasks.length)} of {filteredAndSortedTasks.length} tasks
            </div>
            <div className="space-y-3">
              {paginatedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedTaskId === task.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <MapPin size={16} className="text-slate-400" />
                        {task.siteName || task.site_name || '-'}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <FileText size={16} className="text-slate-400" />
                        <span>
                          SOF:{' '}
                          <span className="font-medium text-slate-800">
                            {taskSofLabel(task) || '—'}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Calendar size={16} className="text-slate-400" />
                        {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        {task.endDate && ` - ${new Date(task.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <User size={16} className="text-slate-400" />
                        {task.engineers?.length
                          ? task.engineers.map((e: any) => e.name || e.id).join(', ')
                          : '-'}
                      </span>
                      {task.assets?.length > 0 && (
                        <span className="text-slate-600">
                          {task.assets.length === 1 ? 'Device' : 'Devices'}: {task.assets.length}
                        </span>
                      )}
                      {task.replacementDeviceId != null && (
                        <span className="text-slate-600">
                          Replacement device: {(() => {
                            const rep = devices.find((d) => d.Did === Number(task.replacementDeviceId));
                            return rep ? (rep.CI_Name || rep.Asset_Number || rep.serial || `Device ${task.replacementDeviceId}`) : `Device ${task.replacementDeviceId}`;
                          })()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyTaskToForm(task)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                        selectedTaskId === task.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
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
                  className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-slate-600 px-2">Page {taskPageSafe} / {totalTaskPages}</span>
                <button
                  type="button"
                  onClick={() => setTaskPage(p => Math.min(totalTaskPages, p + 1))}
                  disabled={taskPageSafe >= totalTaskPages}
                  className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          {/* Devices – แสดงเฉพาะจำนวนอุปกรณ์ ไม่ต้องโชว์ตาราง */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Devices
            </label>
            {loadingDevices ? (
              <p className="text-sm text-slate-500 py-2">Loading devices...</p>
            ) : !selectedTaskId && availablePMTasks.length > 0 ? (
              <p className="text-sm text-slate-500 py-2">Please select a task above first.</p>
            ) : allowedDevices.length > 0 ? (
              <div className="py-2 space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs">
                    {allowedDevices.length}
                  </span>
                  <span>{allowedDevices.length === 1 ? 'Device' : 'Devices'}</span>
                </p>
                {selectedTaskId != null && (selectedSiteDisplayName || selectedLocationDisplayName) ? (
                  <div className="space-y-0.5">
                    <p className="text-base font-extrabold text-slate-900">
                      {selectedSiteDisplayName}
                    </p>
                    {selectedLocationDisplayName ? (
                      <p className="text-xs text-slate-500">
                        {selectedLocationDisplayName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : selectedTaskId != null ? (
              <p className="text-sm text-amber-700 py-2">This task has no linked devices in its data.</p>
            ) : (
              <p className="text-sm text-slate-500 py-2">No devices to show. Select a task above.</p>
            )}
          </div>

          {/* PM Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Technician 
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Enter technician name and surname"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
               Preventive Maintenance Date *
              </label>
              <input
                type="date"
                value={pmDate}
                onChange={(e) => setPmDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

         
          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Upload Images / Documents / PM Results
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
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
                <Upload size={32} className="text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 font-medium">
                  Click to upload files (PDF/Images)
                </p>
                <p className="text-xs text-slate-400 mt-1">
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
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    {file.type === 'image' && file.preview ? (
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
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
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

          {/* PM Result - อิงตาม sla_term จาก Contract (ไม่แสดง threshold)
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              PM Result * <span className="font-normal text-slate-500">(SLA Term)</span>
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="number" 
                min={0}
                max={100}
                value={slaResult}
                onChange={(e) => setSlaResult(e.target.value)}
                placeholder="e.g. 85"
                className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              {slaResult.trim() !== '' && !Number.isNaN(Number(slaResult)) && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${Number(slaResult) > slaThreshold ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {Number(slaResult) > slaThreshold ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  {Number(slaResult) > slaThreshold ? 'Pass' : 'Fail'}
                </span>
              )}
            </div>
          </div> */}

          {/* Comment Field */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
             Notes from Technician
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter additional notes..."
              rows={4}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-blue-500/25"
            >
              <Save size={18} />
              {saving ? 'Sending...' : 'Save PM Report'}
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
