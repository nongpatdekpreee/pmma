'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { apiUrl, postMaReport, getTasks, getMaReports, getMaReportedTaskIds, getContractById, uploadMaReportFile } from '@/lib/api';
import { 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  FileText,
  Image as ImageIcon,
  Save,
  Plus,
  Trash2,
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
  status: 'pending' | 'pass'| 'fail';
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

export default function AddMAReportPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [maResult, setMaResult] = useState<'pass' | 'fail' | ''>('');
  const [comment, setComment] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [maDate, setMaDate] = useState(new Date().toISOString().split('T')[0]);
  const [newChecklistTask, setNewChecklistTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasDoneMATasks, setHasDoneMATasks] = useState(false);
  const [doneMATasks, setDoneMATasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [checkingTasks, setCheckingTasks] = useState(true);
  const [reportedTaskIds, setReportedTaskIds] = useState<Set<number>>(new Set());
  const [contractSlaMap, setContractSlaMap] = useState<Record<number, number>>({});
  const [searchTaskReport, setSearchTaskReport] = useState('');
  const [sortTaskBy, setSortTaskBy] = useState<'date-desc' | 'date-asc' | 'site' | 'engineer'>('date-desc');
  const [taskPage, setTaskPage] = useState(1);

  const TASKS_PER_PAGE = 3;

  // แสดงเฉพาะ Task ที่ยังไม่มี report_id (task_id ไม่อยู่ใน table report)
  const availableMATasks = useMemo(
    () => doneMATasks.filter((t: any) => !reportedTaskIds.has(Number(t.id))),
    [doneMATasks, reportedTaskIds]
  );

  const taskSearchLower = searchTaskReport.trim().toLowerCase();
  const filteredAndSortedTasks = useMemo(() => {
    let list = availableMATasks;
    if (taskSearchLower) {
      list = list.filter((t: any) => {
        const site = (t.siteName || t.site_name || '').toLowerCase();
        const start = t.startDate ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const end = t.endDate ? new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
        const engineers = (t.engineers || []).map((e: any) => (e.name || e.id || '').toString().toLowerCase()).join(' ');
        const devices = (t.assets || []).map((a: any) => (a.name || a.CI_Name || a.id || '').toString().toLowerCase()).join(' ');
        return [site, start, end, engineers, devices].some(s => s.includes(taskSearchLower));
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
          const done = tasksRes.data.filter((task: any) => {
            const status = String(task.status ?? '').toLowerCase();
            const type = String(task.taskType ?? task.task_type ?? '').toUpperCase();
            return status === 'done' && type === 'MA';
          });
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
    const id = a.id ?? a.Did ?? a.deviceId ?? a.device_id ?? (a as any).ID;
    return id != null ? String(id).trim() : '';
  };

  // Device ที่เลือกได้ต้องมาจาก Task (assets + อุปกรณ์ที่เอามาแลกเปลี่ยน ทุกคู่ replacementDeviceId)
  const allowedDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    const addTaskDevices = (task: any) => {
      task.assets?.forEach((a: any, i: number) => {
        const id = getDeviceIdFromAsset(a);
        if (id) ids.add(id);
        const repId = a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null);
        if (repId != null) ids.add(String(repId));
      });
      if (task.replacementDeviceId != null) ids.add(String(task.replacementDeviceId));
    };
    if (selectedTaskId !== null) {
      const task = availableMATasks.find((t: any) => t.id === selectedTaskId);
      if (task) addTaskDevices(task);
    } else {
      availableMATasks.forEach(addTaskDevices);
    }
    return ids;
  }, [availableMATasks, selectedTaskId]);

  // แสดงเฉพาะ Device ที่มาจาก Task (ไม่ fallback เป็น devices ทั้งหมด)
  const allowedDevices = useMemo(() => {
    if (allowedDeviceIds.size === 0) return [];
    return devices.filter((d) => allowedDeviceIds.has(String(d.Did)));
  }, [devices, allowedDeviceIds]);

  // เคลียร์ Device ที่เลือกถ้าไม่อยู่ในรายการที่อนุญาต (เมื่อเปลี่ยน Task)
  useEffect(() => {
    if (selectedDeviceId && allowedDevices.length > 0 && !allowedDevices.some((d) => d.Did.toString() === selectedDeviceId)) {
      setSelectedDeviceId('');
    }
  }, [allowedDevices, selectedDeviceId]);

  // ใช้ข้อมูลจาก Task ที่เลือก pre-fill form
  const applyTaskToForm = (task: any) => {
    setSelectedTaskId(task.id);
    const firstAsset = task.assets && task.assets[0];
    if (firstAsset) {
      const deviceId = getDeviceIdFromAsset(firstAsset);
      if (deviceId) setSelectedDeviceId(deviceId);
    }
    if (task.startDate) setMaDate(task.startDate.split('T')[0]);
    const eng = task.engineers && task.engineers[0];
    if (eng) setTechnicianName(eng.name || eng.id || '');
  };

  // sla_term จาก Contract (ผ่าน Task ที่เลือก) ใช้เป็นเกณฑ์ Pass/Fail
  // Fallback: ถ้า Task ไม่มี slaTerm แต่มี contractId ให้ใช้จาก contractSlaMap
  const slaThreshold = useMemo(() => {
    const task = selectedTaskId != null ? doneMATasks.find((t: any) => t.id === selectedTaskId) : null;
    if (!task) return 70;
    let st = task.slaTerm ?? task.sla_term;
    if ((st == null || String(st).trim() === '') && task.contractId != null) {
      st = contractSlaMap[Number(task.contractId)];
    }
    if (st == null || String(st).trim() === '') return 70;
    const n = typeof st === 'number' ? st : parseInt(String(st).trim(), 10);
    return Number.isNaN(n) ? 70 : n;
  }, [availableMATasks, selectedTaskId, contractSlaMap]);

  // Add new checklist item
  const addChecklistItem = () => {
    if (newChecklistTask.trim()) {
      setChecklistItems([
        ...checklistItems,
        {
          id: `item-${Date.now()}`,
          task: newChecklistTask.trim(),
          status: 'pending' as const,
        },
      ]);
      setNewChecklistTask('');
    }
  };

  // Remove checklist item
  const removeChecklistItem = (id: string) => {
    setChecklistItems(items => items.filter(item => item.id !== id));
  };

  // Update checklist item status
  const updateChecklistStatus = (id: string, status: 'pending' | 'pass' | 'fail') => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === id ? { ...item, status } : item
      )
    );
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
      alert('Please select a task before submitting the report.');
      return;
    }
    if (!selectedDeviceId) {
      alert('Please select a device.');
      return;
    }
    if (!maResult) {
      alert('Please select MA Result (Pass or Fail).');
      return;
    }
    if (maResult === 'fail' && comment.trim() === '') {
      alert('Please enter reason in Notes when result is Fail.');
      return;
    }

    const selectedDevice = devices.find(d => d.Did.toString() === selectedDeviceId);

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
      // อัปโหลดไฟล์ก่อน — ตั้งชื่อเป็น Site_Location_วันที่_ลำดับ เพื่อแยกตาม site และมี location
      const filesWithPath: Array<{ name: string; type: string; path?: string }> = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const f = uploadedFiles[i];
        const uploadRes = await uploadMaReportFile(f.file);
        const ext = getExt(f.name, f.type);
        const displayName = `${safeForName(siteName)}_${safeForName(locationName)}_${maDate}_${i + 1}${ext}`;
        if (uploadRes.success && uploadRes.path) {
          filesWithPath.push({ name: displayName, type: f.type, path: uploadRes.path });
        } else {
          filesWithPath.push({ name: displayName, type: f.type });
        }
      }

      const reportData = {
        taskId: selectedTaskId,
        deviceId: selectedDeviceId,
        device: selectedDevice,
        checklistItems,
        uploadedFiles: filesWithPath,
        maResult,
        comment,
        technicianName,
        maDate,
        createdAt: new Date().toISOString(),
      };

      const res = await postMaReport(reportData);
      if (res.success) {
        alert('MA Checklist Report saved successfully.\n\nItems sent: ' + (res.list?.length ?? checklistItems.length));
        // Redirect กลับไปหน้า list
        router.push('/machecklist_report');
      } else {
        alert(res.message || 'Failed to submit report.');
      }
    } catch (e) {
      console.error(e);
      alert('Error submitting report.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-500';
      case 'warning': return 'bg-amber-400';
      case 'fail': return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 size={18} className="text-white" />;
      case 'fail': return <XCircle size={18} className="text-white" />;
      default: return null;
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
      </SidebarLayout>
    );
  }

  const hasAvailableTasks = availableMATasks.length > 0;
  if (!hasAvailableTasks) {
    const allReported = hasDoneMATasks && doneMATasks.length > 0;
    return (
      <SidebarLayout>
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-50">
          <div className="text-center p-8">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${allReported ? 'bg-green-100' : 'bg-amber-100'}`}>
              <AlertCircle size={40} className={allReported ? 'text-green-600' : 'text-amber-500'} />
            </div>
            <p className="text-slate-700 text-lg font-semibold mb-2">
              {allReported ? 'All reports completed' : 'Cannot create MA Report'}
            </p>
            <p className="text-slate-500 text-sm mb-6">
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
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <DashboardHeader />
      
      <div className="flex flex-col p-6 pt-0 gap-6 min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-50">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/pmchecklist_report?tab=ma')}
              className="p-2.5 hover:bg-white/80 rounded-xl transition-colors border border-slate-200/80 shadow-sm"
            >
              <ArrowLeft size={22} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Create MA Checklist Report
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Record maintenance agreement report
              </p>
            </div>
          </div>
        </div>

        {/* Tasks to Report */}
        {availableMATasks.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={22} className="text-green-600" />
              <h2 className="text-lg font-bold text-slate-800">Tasks to Report</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Select completed tasks (Status = Done) that do not yet have a report to auto-fill the form.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTaskReport}
                  onChange={(e) => { setSearchTaskReport(e.target.value); setTaskPage(1); }}
                  placeholder="Search location, date, person, device..."
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <select
                value={sortTaskBy}
                onChange={(e) => { setSortTaskBy(e.target.value as any); setTaskPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
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
                      ? 'border-green-500 bg-green-50'
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
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-slate-600">
                          {task.assets.map((a: any, idx: number) => {
                            const repId = a.replacementDeviceId ?? (idx === 0 ? task.replacementDeviceId : null);
                            const rep = repId != null ? devices.find((d) => d.Did === Number(repId)) : null;
                            const repName = rep ? (rep.CI_Name || rep.Asset_Number || rep.serial || `Device ${repId}`) : repId != null ? `Device ${repId}` : null;
                            const brokenName = a.name || a.CI_Name || a.id || '-';
                            return (
                              <span key={a.id ?? idx} className="inline-flex items-center gap-1.5">
                                <span>{brokenName}</span>
                                {repName && (
                                  <>
                                    <span className="text-[10px] font-semibold text-slate-400">replaced by</span>
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
                    {(task.vendorName || task.vendor_name || task.vendorTel || task.vendor_tel || task.reporterName || (task as any).reporter_name || task.ticket) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Contract Info: </span>
                        <span>
                          {(task.vendorName || task.vendor_name) && (
                            <>Vendor: <span className="text-slate-800 font-medium">{task.vendorName || task.vendor_name}</span>{' · '}</>
                          )}
                          {(task.reporterName || (task as any).reporter_name) && (
                            <>Reporter: <span className="text-slate-800 font-medium">{task.reporterName || (task as any).reporter_name}</span>{' · '}</>
                          )}
                          {task.ticket && (
                            <>Ticket: <span className="text-slate-800 font-medium">{task.ticket}</span></>
                          )}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => applyTaskToForm(task)}
                      className={`mt-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                        selectedTaskId === task.id
                          ? 'bg-green-500 text-white'
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
          {/* Device Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Device * <span className="text-slate-400 font-normal">(Only from selected Task)</span>
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              disabled={loadingDevices}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingDevices ? 'Loading...' : availableMATasks.length > 0 && allowedDevices.length === 0 ? 'Please select a task above first' : 'Select device...'}
              </option>
              {allowedDevices.map(device => {
                const task = selectedTaskId != null ? availableMATasks.find((t: any) => t.id === selectedTaskId) : null;
                const isReplacement = task && (task.replacementDeviceId === device.Did || task.assets?.some((a: any, i: number) => (a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null)) === device.Did));
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
              <p className="mt-1 text-xs text-slate-500">Only show devices from selected Task</p>
            )}
            {/* Selected device - show fields from fetched device */}
            {selectedDeviceId && (() => {
              const selected = allowedDevices.find(d => d.Did.toString() === selectedDeviceId) ?? devices.find(d => d.Did.toString() === selectedDeviceId);
              if (!selected) return null;
              const task = selectedTaskId != null ? availableMATasks.find((t: any) => t.id === selectedTaskId) : null;
              const isReplacement = task && (task.replacementDeviceId === selected.Did || task.assets?.some((a: any, i: number) => (a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null)) === selected.Did));
              const formatDate = (v: string | null | undefined) => {
                if (!v) return undefined;
                try { return new Date(v).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return v; }
              };
              const deviceFields: { label: string; value?: string | number | null }[] = [
                { label: 'CI Name', value: selected.CI_Name },
                { label: 'Asset Number', value: selected.Asset_Number },
                { label: 'Serial', value: selected.serial },
                { label: 'Model', value: selected.model },
                { label: 'SOF', value: selected.Refer_SOF },
                { label: 'Manufacturer', value: (selected as any).manufacturername ?? selected.Manufacturername },
                { label: 'Site', value: selected.Sitename },
                { label: 'Location', value: (selected as any).Location2 ?? selected.Location2 },
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
                    pairDevice = repId != null ? (allowedDevices.find(d => d.Did === Number(repId)) ?? devices.find(d => d.Did === Number(repId)) ?? null) : null;
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
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-sm font-bold text-slate-700">Selected device</p>
                      {isReplacement && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Replacement device</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {deviceFields.map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-slate-800 truncate" title={value != null && value !== '' ? String(value) : undefined}>
                            {value ?? '-'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {pairDevice && pairLabel && (
                    <div className="p-4 bg-slate-100/80 rounded-xl border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Replaced equipment</p>
                      <p className="text-sm font-bold text-slate-700 mb-2">{pairLabel}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {pairFields.map(({ label, value }) => (
                          <div key={label} className="bg-white rounded-lg p-3 border border-slate-100">
                            <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                            <p className="text-sm font-medium text-slate-800 truncate" title={value != null && value !== '' ? String(value) : undefined}>
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

          {/* Contract Information (full) - โชว์เมื่อเลือก task แล้ว */}
          {selectedTaskId != null && (() => {
            const task = availableMATasks.find((t: any) => t.id === selectedTaskId);
            if (!task) return null;
            const hasContract = task.vendorName || task.vendor_name || task.vendorTel || task.vendor_tel || task.reporterName || (task as any).reporter_name || task.reporterTel || (task as any).reporter_tel || task.ticket;
            if (!hasContract) return null;
            return (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Contract Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {(task.vendorName || task.vendor_name) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Third Party Vendor name</p>
                      <p className="font-medium text-slate-800">{task.vendorName || task.vendor_name}</p>
                    </div>
                  )}
                  {(task.vendorTel || task.vendor_tel) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Third Party Vendor phone</p>
                      <p className="font-medium text-slate-800">{task.vendorTel || task.vendor_tel}</p>
                    </div>
                  )}
                  {(task.reporterName || (task as any).reporter_name) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Reporter name</p>
                      <p className="font-medium text-slate-800">{task.reporterName || (task as any).reporter_name}</p>
                    </div>
                  )}
                  {(task.reporterTel || (task as any).reporter_tel) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Reporter phone</p>
                      <p className="font-medium text-slate-800">{task.reporterTel || (task as any).reporter_tel}</p>
                    </div>
                  )}
                  {task.ticket && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Ticket</p>
                      <p className="font-medium text-slate-800">{task.ticket}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* MA Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Technician *
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Enter technician name"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
               Maintenance Agreement Date *
              </label>
              <input
                type="date"
                value={maDate}
                onChange={(e) => setMaDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Upload Images / Documents / MA Results
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

          {/* MA Result - Pass / Fail */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              MA Result *
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMaResult('pass')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  maResult === 'pass'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                    : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 size={16} />
                Pass
              </button>
              <button
                type="button"
                onClick={() => setMaResult('fail')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  maResult === 'fail'
                    ? 'bg-red-500 text-white border-red-500 shadow-sm'
                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                }`}
              >
                <XCircle size={16} />
                Fail
              </button>
              {maResult === 'fail' && (
                <span className="text-xs text-red-500">
                  Please fill in the reason in Notes below.
                </span>
              )}
            </div>
          </div>

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
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-emerald-500/25"
            >
              <Save size={18} />
              {saving ? 'Sending...' : 'Save MA Report'}
            </button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
