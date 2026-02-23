'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { apiUrl, postPmReport, getTasks, getPmReportedTaskIds, getContractById, uploadReportFile } from '@/lib/api';
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
  ClipboardList
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

export default function AddPMReportPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [slaResult, setSlaResult] = useState<string>('');
  const [comment, setComment] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [pmDate, setPmDate] = useState(new Date().toISOString().split('T')[0]);
  const [newChecklistTask, setNewChecklistTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasDonePMTasks, setHasDonePMTasks] = useState(false);
  const [donePMTasks, setDonePMTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [checkingTasks, setCheckingTasks] = useState(true);
  const [reportedTaskIds, setReportedTaskIds] = useState<Set<number>>(new Set());
  const [contractSlaMap, setContractSlaMap] = useState<Record<number, number>>({});

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
          const done = tasksRes.data.filter(
            (task: any) => task.status === 'done' && task.taskType === 'PM'
          );
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
    const id = a.id ?? a.Did ?? a.deviceId ?? a.device_id ?? (a as any).ID;
    return id != null ? String(id).trim() : '';
  };

  // Device ที่เลือกได้ต้องมาจาก Task (assets + อุปกรณ์ที่เอามาแลกเปลี่ยน replacementDeviceId)
  const allowedDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    const addTaskDevices = (task: any) => {
      task.assets?.forEach((a: any) => {
        const id = getDeviceIdFromAsset(a);
        if (id) ids.add(id);
      });
      if (task.replacementDeviceId != null) ids.add(String(task.replacementDeviceId));
    };
    if (selectedTaskId !== null) {
      const task = availablePMTasks.find((t: any) => t.id === selectedTaskId);
      if (task) addTaskDevices(task);
    } else {
      availablePMTasks.forEach(addTaskDevices);
    }
    return ids;
  }, [availablePMTasks, selectedTaskId]);

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

  // ใช้ข้อมูลจาก Task ที่เลือก pre-fill form
  const applyTaskToForm = (task: any) => {
    setSelectedTaskId(task.id);
    const firstAsset = task.assets && task.assets[0];
    if (firstAsset) {
      const deviceId = getDeviceIdFromAsset(firstAsset);
      if (deviceId) setSelectedDeviceId(deviceId);
    }
    if (task.startDate) setPmDate(task.startDate.split('T')[0]);
    const eng = task.engineers && task.engineers[0];
    if (eng) setTechnicianName(eng.name || eng.id || '');
  };

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
  const updateChecklistStatus = (id: string, status: 'pending' | 'pass' | 'warning' | 'fail') => {
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
      alert('กรุณาเลือก Task ก่อนส่ง Report');
      return;
    }
    if (!selectedDeviceId) {
      alert('กรุณาเลือก Device');
      return;
    }


    const selectedDevice = devices.find(d => d.Did.toString() === selectedDeviceId);

    setSaving(true);
    try {
      // อัปโหลดไฟล์ก่อน
      const filesWithPath: Array<{ name: string; type: string; path?: string }> = [];
      for (const f of uploadedFiles) {
        const uploadRes = await uploadReportFile(f.file);
        if (uploadRes.success && uploadRes.path) {
          filesWithPath.push({ name: f.name, type: f.type, path: uploadRes.path });
        } else {
          filesWithPath.push({ name: f.name, type: f.type });
        }
      }

      const reportData = {
        taskId: selectedTaskId,
        deviceId: selectedDeviceId,
        device: selectedDevice ?? undefined,
        checklistItems,
        uploadedFiles: filesWithPath,
        comment,
        technicianName,
        pmDate,
        createdAt: new Date().toISOString(),
      };

      const res = await postPmReport(reportData);
      if (res.success) {
        alert('Save PM Checklist Report Success\n\nSent: ' + (res.list?.length ?? checklistItems.length) + ' items');
        // Redirect กลับไปหน้า list
        router.push('/pmchecklist_report');
      } else {
        alert(res.message || 'ส่ง Report ไม่สำเร็จ');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการส่ง Report');
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
      case 'warning': return <AlertCircle size={18} className="text-white" />;
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
            <p className="text-slate-500 mb-2">กำลังตรวจสอบ Tasks...</p>
            <p className="text-sm text-slate-400">กรุณารอสักครู่</p>
          </div>
        </div>
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
              {allReported ? 'ทำ Report ครบแล้ว' : 'ไม่สามารถสร้าง Report PM ได้'}
            </p>
            <p className="text-slate-500 text-sm mb-6">
              {allReported
                ? 'ทุก Task ที่ Done ทำ Report ครบแล้ว ไม่มี Task ที่รอทำ Report'
                : 'กรุณารอให้ Task PM มีสถานะ "Done" ก่อน'}
            </p>
            <button
              onClick={() => router.push('/pmchecklist_report')}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
            >
              กลับไปหน้า Report
            </button>
          </div>
        </div>
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
                สร้าง PM Checklist Report
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                บันทึกรายงานการบำรุงรักษาเชิงป้องกัน
              </p>
            </div>
          </div>
        </div>

      
        {availablePMTasks.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={22} className="text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">ข้อมูล Task ที่จะ Report</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              เลือก Task ที่ทำเสร็จแล้ว (Status = Done) และยังไม่มี Report เพื่อนำข้อมูลมาใส่ใน Report ให้อัตโนมัติ
            </p>
            <div className="space-y-3">
              {availablePMTasks.map((task) => (
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
                          Device: {task.assets.map((a: any) => a.name || a.CI_Name || a.id).join(', ')}
                        </span>
                      )}
                      {task.replacementDeviceId != null && (
                        <span className="text-slate-600">
                          อุปกรณ์ที่เอามาแลกเปลี่ยน: {(() => {
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
                      {selectedTaskId === task.id ? 'กำลังใช้ข้อมูลนี้' : 'ใช้ข้อมูล Task นี้'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          {/* Device Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Device * <span className="text-slate-400 font-normal"></span>
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              disabled={loadingDevices}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingDevices ? 'กำลังโหลด...' : availablePMTasks.length > 0 && allowedDevices.length === 0 ? 'กรุณาเลือก Task ด้านบนก่อน' : 'เลือก Device...'}
              </option>
              {allowedDevices.map(device => {
                const isReplacement = selectedTaskId != null && availablePMTasks.find((t: any) => t.id === selectedTaskId)?.replacementDeviceId === device.Did;
                return (
                  <option key={device.Did} value={device.Did.toString()}>
                    {device.CI_Name || device.Asset_Number || `Device ${device.Did}`}
                    {device.serial ? ` (${device.serial})` : ''}
                    {device.Sitename ? ` - ${device.Sitename}` : ''}
                    {isReplacement ? ' [อุปกรณ์ที่เอามาแลกเปลี่ยน]' : ''}
                  </option>
                );
              })}
            </select>
            {availablePMTasks.length > 0 && allowedDevices.length > 0 && (
              <p className="mt-1 text-xs text-slate-500"></p>
            )}
            {selectedDeviceId && (() => {
              const selected = allowedDevices.find(d => d.Did.toString() === selectedDeviceId) ?? devices.find(d => d.Did.toString() === selectedDeviceId);
              if (!selected) return null;
              const isReplacement = selectedTaskId != null && availablePMTasks.find((t: any) => t.id === selectedTaskId)?.replacementDeviceId === selected.Did;
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
              return (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-sm font-bold text-slate-700">ข้อมูล Device ที่เลือก</p>
                    {isReplacement && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">อุปกรณ์ที่เอามาแลกเปลี่ยน</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              );
            })()}
          </div>

          {/* PM Information */}
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
                className="hidden"
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
                placeholder="เช่น 85"
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
              {saving ? 'กำลังส่ง...' : 'Save PM Report'}
            </button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
