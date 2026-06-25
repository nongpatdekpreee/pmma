'use client';

import { X, CheckCircle2, Trash2, FileText, Download, Paperclip, Clock3, Calendar, MoreHorizontal } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { apiUrl, apiFetch} from '@/lib/api';
import { DEFAULT_IN_STORE_SITE_NAME } from '@/lib/inStoreSite';
import { parseRescheduleNoteOrigin } from '@/lib/rescheduleNote';
import { formatDateLocale, formatTime12h } from '@/lib/downtimeHours';
import { readString } from '@/lib/unknownUtil';
import { useAlertModal } from '@/components/ui/useAlertModal';
import {
  buildDeviceMapsFromDetail,
  buildMaWorkOrderFilename,
  downloadMaWorkOrderPdf,
  fetchMaWorkOrderFromTask,
} from '@/lib/maWorkOrder';
import ExcelJS from 'exceljs';

/** Reason for in process (notes เมื่อ status = working) */
const IN_PROCESS_REASON_MAX_CHARS = 120;

function parseRepairNoticePaths(photos?: string[] | null): string[] {
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

interface Device {
  id: string;
  name: string;
  type: string;
  role?: string;
  serialNumber?: string;
  site?: string;
  assetNumber?: string;
  replacementDeviceId?: string | number | null;
}

interface Engineer {
  id: string;
  name: string;
  lastName?: string;
  photo?: string | null;
}

interface TaskDetail {
  id: string;
  taskType?: 'PM' | 'MA';
  title: string;
  time: string;
  color?: string;
  startDay?: number;
  endDay?: number;
  month?: number;
  year?: number;
  Sid?: string;
  Sname?: string;
  location?: string;
  Eng_ids?: Engineer[];
  lastName?: string;
  engineer?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  coverageScope?: string;
  assets?: Device[];
  vendorName?: string;
  vendorTel?: string;
  reporterName?: string;
  reporterTel?: string;
  ticket?: string;
  /** MA — tasks.assigned_service */
  assignedService?: string | null;
  rootCause?: string;
  resolution?: string;
  slaTerm?: string;
  duration?: string;
  /** MA — จากงาน / หลังส่ง report */
  assetBinding?: string;
  travelMethod?: string;
  travelCost?: string;
  contractId?: string | number;
  replacementDeviceId?: string | number;
  downtimeDate?: string | null;
  downtimeTime?: string | null;
  uptimeDate?: string | null;
  uptimeTime?: string | null;
  downtimeTotalHours?: string | number | null;
  // Status fields
  actuallyWent?: boolean;
  photos?: string[]; // Array of base64 or URLs
  /** เหตุผล / โน้ต ขณะ In process */
  notes?: string;
  /** เหตุผลเมื่อย้ายวันนัด (ลากบนปฏิทิน) */
  rescheduleNote?: string;
  status?: 'done' | 'working' | 'stuck' | 'not-started';
}

/** แสดง MA downtime/uptime — camelCase จาก API + snake_case ถ้า payload ไม่ผ่าน mapTaskRow */
function getMaDowntimeDisplay(task: TaskDetail | null | undefined) {
  if (!task) {
    return {
      downtimeDate: undefined as string | null | undefined,
      downtimeTime: undefined as string | null | undefined,
      uptimeDate: undefined as string | null | undefined,
      uptimeTime: undefined as string | null | undefined,
      downtimeTotalHours: undefined as string | number | null | undefined,
    };
  }
  const r = task as unknown as Record<string, unknown>;
  return {
    downtimeDate: (task.downtimeDate ?? r.downtime_date ?? r.down_time_start_date) as string | null | undefined,
    downtimeTime: (task.downtimeTime ?? r.downtime_time ?? r.down_time_start_time) as string | null | undefined,
    uptimeDate: (task.uptimeDate ?? r.uptime_date ?? r.down_time_end_date) as string | null | undefined,
    uptimeTime: (task.uptimeTime ?? r.uptime_time ?? r.down_time_end_time) as string | null | undefined,
    downtimeTotalHours: (task.downtimeTotalHours ?? r.downtime_total_hours ?? r.down_time_total_hours) as
      | string
      | number
      | null
      | undefined,
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDetail | null;
  onUpdate?: (updatedTask: TaskDetail) => void;
  onEdit?: (task: TaskDetail) => void;
  onDelete?: (taskId: string) => void;
  /** เมื่อมี report แล้ว ใส่ link ไปหน้ารายงาน (เช่น /pmchecklist_report?tab=pm&taskId=123) */
  reportLink?: string | null;
  /** ถ้ายังไม่มี report ให้ใส่ link ไปหน้าสร้างรายงาน (เช่น /pmchecklist_report/add) */
  createReportLink?: string | null;
}

export function TaskDetailModal({ isOpen, onClose, task, onUpdate, onEdit, onDelete, reportLink, createReportLink }: Props) {
  const { showConfirm, showAlert, alertModal } = useAlertModal();
  const [status, setStatus] = useState<'done' | 'working' | 'stuck' | 'not-started'>(task?.status || 'not-started');
  /** โน้ตเหตุผล in process — บังคับกรอกก่อนบันทึกเมื่อ status = working */
  const [inProcessReasonDraft, setInProcessReasonDraft] = useState('');
  const [assetDetailsMap, setAssetDetailsMap] = useState<Record<string, Device>>({});
  const [replacementDevicesMap, setReplacementDevicesMap] = useState<Record<string, Device>>({});
  const [assetPage, setAssetPage] = useState(1);
  const assetsPerPage = 5;
  const [maWorkOrderDownloading, setMaWorkOrderDownloading] = useState(false);

  const handleDownloadMaWorkOrder = async () => {
    if (!task || task.taskType !== 'MA') return;
    setMaWorkOrderDownloading(true);
    try {
      const taskRecord = task as unknown as Record<string, unknown>;
      const assets = task.assets ?? [];
      const prefetched =
        assets.length > 0
          ? buildDeviceMapsFromDetail(
              assets,
              assetDetailsMap,
              replacementDevicesMap,
              task.replacementDeviceId
            )
          : undefined;
      const data = await fetchMaWorkOrderFromTask(taskRecord, prefetched);
      await downloadMaWorkOrderPdf(data, buildMaWorkOrderFilename(taskRecord));
    } catch (err) {
      console.error('MA work order PDF download failed:', err);
      showAlert('Cannot create PDF file, please try again', 'warning', 'Download failed');
    } finally {
      setMaWorkOrderDownloading(false);
    }
  };

  const maDowntimeDisplay = useMemo(() => getMaDowntimeDisplay(task), [task]);

  // Update local state when task changes
  useEffect(() => {
    if (task) {
      setStatus(task.status || 'not-started');
      setInProcessReasonDraft(
        String(task.notes ?? '')
          .trim()
          .slice(0, IN_PROCESS_REASON_MAX_CHARS)
      );
      setAssetPage(1);
    }
  }, [task]);

  useEffect(() => {
    if (!isOpen || !task?.assets || task.assets.length === 0) {
      setAssetDetailsMap({});
      return;
    }

    let cancelled = false;

    const load = async () => {
      const map: Record<string, Device> = {};
      await Promise.all(
        task.assets!.map(async (asset) => {
          try {
            const res = await apiFetch(apiUrl(`/api/devices/${asset.id}`));
            const json = await res.json();
            if (!cancelled && res.ok && json.data) {
              const d = json.data;
              map[String(asset.id)] = {
                id: String(d.Did ?? asset.id),
                name: task.taskType === 'MA'
                  ? (d.model || d.CI_Name || d.Asset_Number || asset.name || '')
                  : (d.CI_Name || d.Asset_Number || asset.name || ''),
                type: d.model || d.manufacturername || asset.type || '—',
                role: d.roleName || asset.role || undefined,
                serialNumber: d.serial || asset.serialNumber,
                site: d.Sitename || d.Location2 || asset.site,
                assetNumber: d.Asset_Number || asset.assetNumber,
                replacementDeviceId: asset.replacementDeviceId ?? null,
              };
            }
          } catch {
            /* ignore */
          }
        })
      );
      if (!cancelled) setAssetDetailsMap(map);
    };

    load();
    return () => { cancelled = true; };
  }, [isOpen, task?.id, task?.assets, task?.taskType]);

  // Fetch replacement device details for MA tasks - รองรับหลายคู่ (แต่ละ asset อาจมี replacementDeviceId)
  useEffect(() => {
    if (!isOpen || !task || task.taskType !== 'MA') {
      setReplacementDevicesMap({});
      return;
    }
    const assets = task.assets || [];
    const repIds = new Set<string | number>();
    assets.forEach((a: Device, i: number) => {
      const rid = a.replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null);
      if (rid != null) repIds.add(rid);
    });
    if (task.replacementDeviceId != null && repIds.size === 0) repIds.add(task.replacementDeviceId);
    if (repIds.size === 0) {
      setReplacementDevicesMap({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      const map: Record<string, Device> = {};
      await Promise.all(
        Array.from(repIds).map(async (rid) => {
          try {
            const res = await apiFetch(apiUrl(`/api/devices/${rid}`));
            const json = await res.json();
            if (!cancelled && res.ok && json.data) {
              const d = json.data;
              map[String(rid)] = {
                id: String(d.Did),
                name: d.model || d.CI_Name || d.Asset_Number || '',
                type: d.model || d.manufacturername || '—',
                role: d.roleName || d.role || undefined,
                serialNumber: d.serial,
                site: DEFAULT_IN_STORE_SITE_NAME,
                assetNumber: d.Asset_Number,
              };
            }
          } catch {
            /* ignore */
          }
        })
      );
      if (!cancelled) setReplacementDevicesMap(map);
    };
    load();
    return () => { cancelled = true; };
  }, [isOpen, task]);

  if (!isOpen || !task) {
    return <>{alertModal}</>;
  }
  const hasReport = !!reportLink;
  /** Done + มี report แล้ว — ห้ามเปลี่ยนสถานะ (และไม่ต้องบันทึกซ้ำ) */
  const isStatusLockedDoneReported =
    String(task.status || '').toLowerCase() === 'done' && hasReport;
  const totalAssets = task.assets?.length || 0;
  const totalAssetPages = Math.max(1, Math.ceil(totalAssets / assetsPerPage));
  const paginatedAssets = task.assets?.slice((assetPage - 1) * assetsPerPage, assetPage * assetsPerPage) || [];

  const handleSave = () => {
    if (isStatusLockedDoneReported) {
      onClose();
      return;
    }
    if (status === 'working') {
      const reason = inProcessReasonDraft.trim().slice(0, IN_PROCESS_REASON_MAX_CHARS);
      if (!reason) {
        showAlert('กรุณากรอกเหตุผลก่อนบันทึกสถานะ In process', 'warning', 'ขาดข้อมูล');
        return;
      }
    }
    const updatedTask: TaskDetail = {
      ...task,
      status,
      notes:
        status === 'working'
          ? inProcessReasonDraft.trim().slice(0, IN_PROCESS_REASON_MAX_CHARS)
          : task.notes,
    };

    onUpdate?.(updatedTask);
    onClose();
  };

  const getDeviceTypeLabel = (device?: Device | null) => {
    if (!device) return '—';
    return device.role || device.type || '—';
  };

  const getDeviceDisplayName = (name?: string | null) => {
    if (!name) return '';
    return name.split(' / ')[0]?.trim() || name;
  };

  const getResolvedAsset = (asset?: Device | null) => {
    if (!asset) return null;
    return assetDetailsMap[String(asset.id)] || asset;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const downloadAssetsList = async () => {
    if (!task?.assets || task.assets.length === 0) return;
    
    // สร้าง workbook ใหม่
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Assets');
    
    // กำหนด headers (ตัวพิมพ์ใหญ่)
    const headers = ['DEVICE NAME', 'TYPE', 'SERIAL NUMBER', 'SITE', 'ASSET NUMBER'];
    
    // สร้าง header row พร้อม styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' } // สีเทาอ่อน
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
    
    // เพิ่ม borders ให้ header
    headers.forEach((_, colIndex) => {
      const cell = headerRow.getCell(colIndex + 1);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    // เพิ่มข้อมูล
    task.assets.forEach(asset => {
      const resolvedAsset = getResolvedAsset(asset) || asset;
      const row = worksheet.addRow([
        getDeviceDisplayName(resolvedAsset.name),
        getDeviceTypeLabel(resolvedAsset),
        resolvedAsset.serialNumber || '',
        resolvedAsset.site || '',
        resolvedAsset.assetNumber || ''
      ]);
      
      // เพิ่ม borders ให้ทุก cell
      headers.forEach((_, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    });
    
    // ตั้งความกว้างของคอลัมน์ให้พอดีกับข้อมูล
    worksheet.columns.forEach((column, index) => {
      let maxLength = headers[index].length;
      worksheet.getColumn(index + 1).eachCell({ includeEmpty: false }, (cell) => {
        const cellValue = String(cell.value || '');
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      // ตั้งความกว้าง (เพิ่ม padding เล็กน้อย)
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    });
    
    // สร้างชื่อไฟล์จาก site - location
    const siteName = task.Sname || 'Unknown';
    const location = task.location || '';
    const fileName = location 
      ? `${siteName} - ${location}.xlsx`
      : `${siteName}.xlsx`;
    
    // ทำความสะอาดชื่อไฟล์ (ลบอักขระพิเศษที่ใช้ไม่ได้ในชื่อไฟล์)
    const cleanFileName = fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
    
    // Export file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFileName;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      {alertModal}
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-card rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Task Details</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {task.taskType === 'MA' ? 'Maintenance Agreement' : 'Preventive Maintenance'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-card rounded-full hover:bg-muted transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Basic Information */}
          <div className="bg-muted rounded-xl p-4 border border-border">
            <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Task Type</label>
                <p className="text-sm font-medium text-foreground mt-1">
                  {task.taskType === 'MA' ? 'Maintenance Agreement (MA)' : 'Preventive Maintenance (PM)'}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Title</label>
                <p className="text-sm font-medium text-foreground mt-1">{task.title || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Site</label>
                <p className="text-sm font-bold text-foreground mt-1">{task.Sname || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Location</label>
                <p className="text-sm font-bold text-foreground mt-1">{task.location || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Start Date</label>
                <p className="text-sm font-medium text-foreground mt-1">{task.startDate ? formatDate(task.startDate) : '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">End Date</label>
                <p className="text-sm font-medium text-foreground mt-1">{task.endDate ? formatDate(task.endDate) : '—'}</p>
              </div>
              {task.status === 'done' && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Report</label>
                  <p className={`text-sm font-bold mt-1 ${hasReport ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {hasReport ? 'Reported' : 'Not reported'}
                  </p>
                </div>
              )}
              {task.coverageScope != null && String(task.coverageScope).trim() !== '' && (
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Coverage Scope</label>
                  <p className="text-sm font-medium text-foreground mt-1">{task.coverageScope}</p>
                </div>
              )}
              {task.taskType === 'MA' && (
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Assigned Service</label>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {String(
                      task.assignedService ??
                        (task as { assigned_service?: string | null }).assigned_service ??
                        ''
                    ).trim() || '—'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Engineers — แสดงรูปและชื่อแนวตั้ง */}
          {(task.Eng_ids && task.Eng_ids.length > 0) || task.engineer ? (
            <div className="bg-muted rounded-xl p-4 border border-border">
              <h3 className="text-sm font-bold text-muted-foreground mb-3">Assigned Engineers</h3>
              <div className="flex flex-col gap-1">
                {task.Eng_ids?.map((eng) => (
                  <div key={eng.id} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 rounded-full overflow-hidden border border-border bg-muted">
                      {eng.photo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={eng.photo.startsWith('http') ? eng.photo : apiUrl(eng.photo)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                          {(eng.name?.[0] || eng.id?.[0] || '?').toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {eng.name}{eng.lastName ? ' ' + eng.lastName : ''}
                    </span>
                  </div>
                ))}
                {!task.Eng_ids && task.engineer && (
                  <div className="text-sm font-medium text-foreground">
                    {task.engineer}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* MA: Asset Binding (Contract & Client removed) */}
          {task.taskType === 'MA' && task.assetBinding && (
            <div className="bg-muted rounded-xl p-4 border border-border">
              <h3 className="text-sm font-bold text-muted-foreground mb-3">Asset Binding</h3>
              <p className="text-sm font-medium text-foreground mt-1">{task.assetBinding}</p>
            </div>
          )}

          {/* Assets / MA: อุปกรณ์ที่เสีย → เปลี่ยนเป็น อุปกรณ์ที่เอาไปเปลี่ยน (แสดงครบทุกคู่) */}
          {(task.assets && task.assets.length > 0) || (task.taskType === 'MA' && task.replacementDeviceId) ? (
            <div className="bg-muted rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-muted-foreground">
                  {task.taskType === 'MA' ? `Devices (${totalAssets})` : `Selected Assets (${totalAssets})`}
                </h3>
                {task.assets && task.assets.length > 0 && (
                  <button
                    onClick={downloadAssetsList}
                    className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                    title="Download Assets List"
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {/* MA: แต่ละคู่ อุปกรณ์ที่เสีย ต่อด้วย เปลี่ยนเป็น [replacement] */}
                {task.taskType === 'MA' && task.assets && task.assets.length > 0 && (
                  <>
                    {paginatedAssets.map((asset, pageIndex) => {
                      const index = (assetPage - 1) * assetsPerPage + pageIndex;
                      const resolvedAsset = getResolvedAsset(asset) || asset;
                      const repId = resolvedAsset.replacementDeviceId ?? (index === 0 ? task.replacementDeviceId : null);
                      const replacementDevice = repId != null ? replacementDevicesMap[String(repId)] : null;
                      return (
                        <div key={asset.id} className="flex flex-wrap items-center gap-2">
                          <div className="px-2 py-1.5 bg-card rounded-md border border-border min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-foreground truncate">{getDeviceDisplayName(resolvedAsset.name)}</p>
                            <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                              <span>{getDeviceTypeLabel(resolvedAsset)}</span>
                              {resolvedAsset.serialNumber && <span>| SN: {resolvedAsset.serialNumber}</span>}
                            </div>
                          </div>
                          {repId != null && (
                            <>
                              <span className="text-[9px] font-semibold text-muted-foreground shrink-0">Replace with</span>
                              <div className="px-2 py-1.5 bg-green-50 rounded-md border border-green-200 min-w-0 flex-1">
                                {replacementDevice ? (
                                  <>
                                    <p className="text-[11px] font-medium text-foreground truncate">{getDeviceDisplayName(replacementDevice.name)}</p>
                                    <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                                      <span>{getDeviceTypeLabel(replacementDevice)}</span>
                                      {replacementDevice.serialNumber && <span>| SN: {replacementDevice.serialNumber}</span>}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">Device ID: {repId}</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {/* กรณีมี replacement แต่ไม่มี assets (edge case) */}
                    {(!task.assets || task.assets.length === 0) && task.replacementDeviceId && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-semibold text-muted-foreground">เปลี่ยนเป็น</span>
                        <div className="px-2 py-1.5 bg-green-50 rounded-md border border-green-200">
                          {replacementDevicesMap[String(task.replacementDeviceId)] ? (
                            <p className="text-[11px] font-medium text-foreground">{replacementDevicesMap[String(task.replacementDeviceId)].name}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Device ID: {task.replacementDeviceId}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* PM: Selected Assets */}
                {task.taskType !== 'MA' && task.assets && task.assets.length > 0 && (
                  <div className="space-y-1.5">
                    {paginatedAssets.map((asset) => {
                      const resolvedAsset = getResolvedAsset(asset) || asset;
                      return (
                      <div key={asset.id} className="px-2 py-1.5 bg-card rounded-md border border-border">
                        <p className="text-[11px] font-medium text-foreground truncate">{getDeviceDisplayName(resolvedAsset.name)}</p>
                        <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-0.5 flex-wrap">
                          <span>Type: {getDeviceTypeLabel(resolvedAsset)}</span>
                          {resolvedAsset.serialNumber && <span>| SN: {resolvedAsset.serialNumber}</span>}
                          {resolvedAsset.site && <span>| Site: {resolvedAsset.site}</span>}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
              {totalAssets > assetsPerPage && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <p className="text-[11px] text-muted-foreground">
                    Showing {(assetPage - 1) * assetsPerPage + 1}-{Math.min(assetPage * assetsPerPage, totalAssets)} of {totalAssets} devices
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssetPage((prev) => Math.max(1, prev - 1))}
                      disabled={assetPage === 1}
                      className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Page {assetPage} / {totalAssetPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssetPage((prev) => Math.min(totalAssetPages, prev + 1))}
                      disabled={assetPage === totalAssetPages}
                      className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Coverage Scope - แสดง "—" เมื่อไม่มีค่าหรือเป็นแค่ "-" */}
          <div className="bg-muted rounded-xl p-4 border border-border">
            <h3 className="text-sm font-bold text-muted-foreground mb-3">Coverage Scope</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.coverageScope && task.coverageScope.trim() && task.coverageScope.trim() !== '-'
                ? task.coverageScope
                : '—'}
            </p>
          </div>

          {task.taskType === 'MA' && ((task.rootCause && task.rootCause.trim()) || (task.resolution && task.resolution.trim())) && (
            <div className="bg-muted rounded-xl p-4 border border-border">
              <h3 className="text-sm font-bold text-muted-foreground mb-3">Issue Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Root Cause</label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{task.rootCause?.trim() || '—'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Resolution</label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{task.resolution?.trim() || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {task.taskType === 'MA' && (
            <div className="bg-emerald-50/90 rounded-xl p-4 border border-emerald-200">
              <h3 className="text-sm font-bold text-emerald-900 mb-1 flex items-center gap-2">
                <Calendar size={16} className="shrink-0" aria-hidden />
                Downtime & Uptime
              </h3>
              <p className="text-xs text-emerald-800/90 mb-3">
               Enter uptime date and time on the MA checklist report when you submit it (not set when marking Done).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-emerald-800/80">Downtime date</label>
                  <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
                    {formatDateLocale(maDowntimeDisplay.downtimeDate, 'en-US') || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-emerald-800/80">Downtime time</label>
                  <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
                    {formatTime12h(maDowntimeDisplay.downtimeTime, 'en-US') || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-emerald-800/80">Uptime date</label>
                  <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
                    {formatDateLocale(maDowntimeDisplay.uptimeDate, 'en-US') || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-emerald-800/80">Uptime time</label>
                  <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
                    {formatTime12h(maDowntimeDisplay.uptimeTime, 'en-US') || '—'}
                  </p>
                </div>
                <div className="md:col-span-2 pt-2 border-t border-emerald-200">
                  <label className="text-[10px] font-semibold uppercase text-emerald-800/80">Total downtime</label>
                  <p className="text-sm font-semibold text-emerald-900 mt-1 tabular-nums">
                    {maDowntimeDisplay.downtimeTotalHours != null &&
                    String(maDowntimeDisplay.downtimeTotalHours).trim() !== '' &&
                    !Number.isNaN(Number(maDowntimeDisplay.downtimeTotalHours))
                      ? `${Number(maDowntimeDisplay.downtimeTotalHours)} hrs`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {task.taskType === 'MA' &&
            (() => {
              const repairPaths = parseRepairNoticePaths(task.photos);
              if (repairPaths.length === 0) return null;
              return (
                <div className="bg-muted rounded-xl p-4 border border-border">
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
                    <Paperclip size={16} className="text-muted-foreground shrink-0" aria-hidden />
                    Remark
                  </h3>
                  <ul className="space-y-2">
                    {repairPaths.map((path) => {
                      const name = path.replace(/^.*[/\\]/, '') || path;
                      const href = /^https?:\/\//i.test(path) ? path : apiUrl(path.startsWith('/') ? path : `/${path}`);
                      return (
                        <li key={path}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline break-all"
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
          
          {/* เหตุผลย้ายวัน — เก็บคนละช่องกับ notes (in process) */}
          {task.rescheduleNote && String(task.rescheduleNote).trim() && (() => {
            const raw = String(task.rescheduleNote).trim();
            const parsed = parseRescheduleNoteOrigin(raw);
            return (
              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-blue-600" />
                  <label className="text-[10px] font-bold uppercase text-blue-700">Reschedule Note</label>
                </div>
                {parsed ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-blue-600/90 mb-0.5">
                        Moved from
                      </p>
                      <p className="text-sm font-semibold text-blue-950">{parsed.originLine}</p>
                    </div>
                    {parsed.reasonBody ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-blue-600/90 mb-0.5">
                          Reason
                        </p>
                        <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">
                          {parsed.reasonBody}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">
                    {raw}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Travel Information */}
          {(task.travelMethod || task.travelCost) && (
            <div className="bg-muted rounded-xl p-4 border border-border">
              <h3 className="text-sm font-bold text-muted-foreground mb-3">Travel Information</h3>
              <div className="grid grid-cols-2 gap-3">
                {task.travelMethod && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Travel Method</label>
                    <p className="text-sm font-medium text-foreground mt-1">{task.travelMethod}</p>
                  </div>
                )}
                {task.travelCost && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Travel Cost</label>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {parseFloat(task.travelCost).toLocaleString('en-US')} THB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Task Status Section */}
          <div
            className={`bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 ${
              isStatusLockedDoneReported ? 'opacity-95' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-muted-foreground">Task Status</h3>
              {isStatusLockedDoneReported && (
                <p className="text-xs font-medium text-emerald-800 bg-emerald-100/90 border border-emerald-200 rounded-lg px-2.5 py-1 max-w-[min(100%,20rem)]">
                  Status is locked because the task is already done and has a report.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isStatusLockedDoneReported}
                onClick={() => !isStatusLockedDoneReported && setStatus('done')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'done'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-card text-muted-foreground border-2 border-border hover:border-green-300'
                } ${isStatusLockedDoneReported ? 'cursor-not-allowed opacity-90' : ''}`}
              >
                Done
              </button>
              <button
                type="button"
                disabled={isStatusLockedDoneReported}
                onClick={() => !isStatusLockedDoneReported && setStatus('working')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  status === 'working'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-card text-muted-foreground border-2 border-border hover:border-amber-300'
                } ${isStatusLockedDoneReported ? 'cursor-not-allowed opacity-75' : ''}`}
              >
                <Clock3 size={18} className="shrink-0" strokeWidth={2.25} />
                In Process
              </button>
              <button
                type="button"
                disabled={isStatusLockedDoneReported}
                onClick={() => !isStatusLockedDoneReported && setStatus('not-started')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'not-started' || status === 'stuck'
                    ? 'bg-gray-400 text-white shadow-md'
                    : 'bg-card text-muted-foreground border-2 border-border hover:border-border'
                } ${isStatusLockedDoneReported ? 'cursor-not-allowed opacity-75' : ''}`}
              >
                Pending
              </button>
            </div>
            {status === 'working' && !isStatusLockedDoneReported && (
              <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50/90 p-3">
                <label htmlFor="in-process-reason" className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-amber-900">
                  <Clock3 size={16} className="shrink-0" />
                  Reason for in process
                  <span className="text-red-500">*</span>
                  <span className="ml-auto font-mono font-normal text-[10px] text-amber-800/90 tabular-nums">
                    {inProcessReasonDraft.length}/{IN_PROCESS_REASON_MAX_CHARS}
                  </span>
                </label>
                <p className="mb-1.5 text-[10px] leading-snug text-amber-900/85">
                  Maximum 120 characters.
                </p>
                <textarea
                  id="in-process-reason"
                  value={inProcessReasonDraft}
                  maxLength={IN_PROCESS_REASON_MAX_CHARS}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.length > IN_PROCESS_REASON_MAX_CHARS) {
                      showAlert('Maximum 120 characters.', 'warning', 'Too long');
                      setInProcessReasonDraft(v.slice(0, IN_PROCESS_REASON_MAX_CHARS));
                      return;
                    }
                    setInProcessReasonDraft(v);
                  }}
                  rows={3}
                  placeholder="For example: Waiting for spare parts, Coordinating with customer, Waiting for access..."
                  className="w-full resize-y rounded-lg border border-amber-200 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-3 border-t bg-muted">
          {(onEdit || onDelete || task.taskType === 'MA') && (
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
                <MoreHorizontal size={14} />
                Actions
              </summary>
              <div className="absolute bottom-full right-0 z-20 mb-1 min-w-[11rem] rounded-lg border border-border bg-card py-1 shadow-lg">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (task && onEdit) {
                        const formatDateForInput = (dateString?: string): string => {
                          if (!dateString) return '';
                          const date = new Date(dateString);
                          if (isNaN(date.getTime())) return '';
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        };

                        const taskRec = task as unknown as Record<string, unknown>;
                        const taskToEdit = {
                          ...task,
                          startDate: formatDateForInput(task.startDate),
                          endDate: formatDateForInput(task.endDate),
                          contractId: task.contractId || readString(taskRec, 'contract_id') || undefined,
                          replacementDeviceId:
                            task.replacementDeviceId || readString(taskRec, 'replacement_device_id') || undefined,
                          assets: task.assets || [],
                          vendorName: task.vendorName || readString(taskRec, 'vendor_name') || undefined,
                          assignedService:
                            task.assignedService ?? readString(taskRec, 'assigned_service') ?? undefined,
                          ...(String(task.taskType || readString(taskRec, 'task_type') || '')
                            .toUpperCase() !== 'MA'
                            ? { duration: task.duration || undefined }
                            : {}),
                        };
                        onEdit(taskToEdit);
                      }
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                  >
                    Edit
                  </button>
                )}
                {onDelete && task && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!task || !onDelete) return;
                      showConfirm(
                        'Are you sure you want to delete this task?',
                        () => onDelete(task.id),
                        {
                          title: 'Delete task',
                          confirmText: 'Delete',
                          cancelText: 'Cancel',
                          dangerConfirm: true,
                        }
                      );
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
                {task.taskType === 'MA' && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadMaWorkOrder()}
                    disabled={maWorkOrderDownloading}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    <Download size={14} />
                    {maWorkOrderDownloading ? 'กำลังสร้าง PDF…' : 'ดาวน์โหลดใบแจ้งซ่อม'}
                  </button>
                )}
              </div>
            </details>
          )}
          {reportLink && (
            <Link
              href={reportLink}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-card px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <FileText size={14} />
              Report
            </Link>
          )}
          {!reportLink && task.status === 'done' && createReportLink && (
            <Link
              href={createReportLink}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-card px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
              title="Task is done but report is not created yet"
            >
              <FileText size={14} />
              Create Report
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isStatusLockedDoneReported}
            title={isStatusLockedDoneReported ? 'สถานะล็อกแล้ว (Done + มีรายงาน)' : undefined}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              isStatusLockedDoneReported
                ? 'bg-slate-300 text-muted-foreground cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
