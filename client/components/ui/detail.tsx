'use client';

import { X, CheckCircle2, XCircle, Trash2, FileText, Download, Paperclip, Clock3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { useAlertModal } from '@/components/ui/useAlertModal';
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
  rootCause?: string;
  resolution?: string;
  slaTerm?: string;
  duration?: string;
  assetBinding?: string;
  travelMethod?: string;
  travelCost?: string;
  contractId?: string | number;
  replacementDeviceId?: string | number;
  // Status fields
  actuallyWent?: boolean;
  photos?: string[]; // Array of base64 or URLs
  /** เหตุผล / โน้ต ขณะ In process */
  notes?: string;
  /** เหตุผลเมื่อย้ายวันนัด (ลากบนปฏิทิน) */
  rescheduleNote?: string;
  status?: 'done' | 'working' | 'stuck' | 'not-started';
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
            const res = await fetch(apiUrl(`/api/devices/${asset.id}`));
            const json = await res.json();
            if (!cancelled && res.ok && json.data) {
              const d = json.data;
              map[String(asset.id)] = {
                id: String(d.Did ?? asset.id),
                name: task.taskType === 'MA'
                  ? (d.model || d.CI_Name || d.Asset_Number || asset.name || '')
                  : (d.CI_Name || d.Asset_Number || asset.name || ''),
                type: d.model || d.manufacturername || asset.type || '—',
                role: d.roleName || (asset as any).role || undefined,
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
  }, [isOpen, task?.id, task?.assets]);

  // Fetch replacement device details for MA tasks - รองรับหลายคู่ (แต่ละ asset อาจมี replacementDeviceId)
  useEffect(() => {
    if (!isOpen || !task || task.taskType !== 'MA') {
      setReplacementDevicesMap({});
      return;
    }
    const assets = task.assets || [];
    const repIds = new Set<string | number>();
    assets.forEach((a: Device, i: number) => {
      const rid = (a as any).replacementDeviceId ?? (i === 0 ? task.replacementDeviceId : null);
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
            const res = await fetch(apiUrl(`/api/devices/${rid}`));
            const json = await res.json();
            if (!cancelled && res.ok && json.data) {
              const d = json.data;
              map[String(rid)] = {
                id: String(d.Did),
                name: d.model || d.CI_Name || d.Asset_Number || '',
                type: d.model || d.manufacturername || '—',
                role: d.roleName || d.role || undefined,
                serialNumber: d.serial,
                site: d.Sitename || d.Location2,
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
  }, [isOpen, task?.id, task?.taskType, task?.replacementDeviceId, task?.assets]);

  if (!isOpen || !task) {
    return <>{alertModal}</>;
  }
  const hasReport = !!reportLink;
  const totalAssets = task.assets?.length || 0;
  const totalAssetPages = Math.max(1, Math.ceil(totalAssets / assetsPerPage));
  const paginatedAssets = task.assets?.slice((assetPage - 1) * assetsPerPage, assetPage * assetsPerPage) || [];

  const handleSave = () => {
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
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Task Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {task.taskType === 'MA' ? 'Maintenance Agreement' : 'Preventive Maintenance'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white rounded-full hover:bg-slate-100 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Basic Information */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Task Type</label>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {task.taskType === 'MA' ? 'Maintenance Agreement (MA)' : 'Preventive Maintenance (PM)'}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Title</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{task.title || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Site</label>
                <p className="text-sm font-bold text-slate-800 mt-1">{task.Sname || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Location</label>
                <p className="text-sm font-bold text-slate-800 mt-1">{task.location || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Start Date</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{task.startDate ? formatDate(task.startDate) : '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">End Date</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{task.endDate ? formatDate(task.endDate) : '—'}</p>
              </div>
              {task.status === 'done' && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Report</label>
                  <p className={`text-sm font-bold mt-1 ${hasReport ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {hasReport ? 'Reported' : 'Not reported'}
                  </p>
                </div>
              )}
              {task.coverageScope != null && String(task.coverageScope).trim() !== '' && (
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Coverage Scope</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{task.coverageScope}</p>
                </div>
              )}
            </div>
          </div>

          {/* Engineers — แสดงรูปและชื่อแนวตั้ง */}
          {(task.Eng_ids && task.Eng_ids.length > 0) || task.engineer ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Assigned Engineers</h3>
              <div className="flex flex-col gap-1">
                {task.Eng_ids?.map((eng) => (
                  <div key={eng.id} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-100">
                      {eng.photo ? (
                        <img src={eng.photo.startsWith('http') ? eng.photo : apiUrl(eng.photo)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                          {(eng.name?.[0] || eng.id?.[0] || '?').toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {eng.name}{eng.lastName ? ' ' + eng.lastName : ''}
                    </span>
                  </div>
                ))}
                {!task.Eng_ids && task.engineer && (
                  <div className="text-sm font-medium text-slate-800">
                    {task.engineer}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* MA: Asset Binding (Contract & Client removed) */}
          {task.taskType === 'MA' && task.assetBinding && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Asset Binding</h3>
              <p className="text-sm font-medium text-slate-800 mt-1">{task.assetBinding}</p>
            </div>
          )}

          {/* Assets / MA: อุปกรณ์ที่เสีย → เปลี่ยนเป็น อุปกรณ์ที่เอาไปเปลี่ยน (แสดงครบทุกคู่) */}
          {(task.assets && task.assets.length > 0) || (task.taskType === 'MA' && task.replacementDeviceId) ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700">
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
                      const repId = (resolvedAsset as any).replacementDeviceId ?? (index === 0 ? task.replacementDeviceId : null);
                      const replacementDevice = repId != null ? replacementDevicesMap[String(repId)] : null;
                      return (
                        <div key={asset.id} className="flex flex-wrap items-center gap-2">
                          <div className="px-2 py-1.5 bg-white rounded-md border border-slate-200 min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-slate-800 truncate">{getDeviceDisplayName(resolvedAsset.name)}</p>
                            <div className="flex gap-1.5 text-[9px] text-slate-500 mt-0.5">
                              <span>{getDeviceTypeLabel(resolvedAsset)}</span>
                              {resolvedAsset.serialNumber && <span>| SN: {resolvedAsset.serialNumber}</span>}
                            </div>
                          </div>
                          {repId != null && (
                            <>
                              <span className="text-[9px] font-semibold text-slate-500 shrink-0">Replace with</span>
                              <div className="px-2 py-1.5 bg-green-50 rounded-md border border-green-200 min-w-0 flex-1">
                                {replacementDevice ? (
                                  <>
                                    <p className="text-[11px] font-medium text-slate-800 truncate">{getDeviceDisplayName(replacementDevice.name)}</p>
                                    <div className="flex gap-1.5 text-[9px] text-slate-500 mt-0.5">
                                      <span>{getDeviceTypeLabel(replacementDevice)}</span>
                                      {replacementDevice.serialNumber && <span>| SN: {replacementDevice.serialNumber}</span>}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-slate-500">Device ID: {repId}</p>
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
                        <span className="text-[9px] font-semibold text-slate-500">เปลี่ยนเป็น</span>
                        <div className="px-2 py-1.5 bg-green-50 rounded-md border border-green-200">
                          {replacementDevicesMap[String(task.replacementDeviceId)] ? (
                            <p className="text-[11px] font-medium text-slate-800">{replacementDevicesMap[String(task.replacementDeviceId)].name}</p>
                          ) : (
                            <p className="text-[10px] text-slate-500">Device ID: {task.replacementDeviceId}</p>
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
                      <div key={asset.id} className="px-2 py-1.5 bg-white rounded-md border border-slate-200">
                        <p className="text-[11px] font-medium text-slate-800 truncate">{getDeviceDisplayName(resolvedAsset.name)}</p>
                        <div className="flex gap-1.5 text-[9px] text-slate-500 mt-0.5 flex-wrap">
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
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <p className="text-[11px] text-slate-500">
                    Showing {(assetPage - 1) * assetsPerPage + 1}-{Math.min(assetPage * assetsPerPage, totalAssets)} of {totalAssets} devices
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssetPage((prev) => Math.max(1, prev - 1))}
                      disabled={assetPage === 1}
                      className="px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-[11px] font-medium text-slate-600">
                      Page {assetPage} / {totalAssetPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssetPage((prev) => Math.min(totalAssetPages, prev + 1))}
                      disabled={assetPage === totalAssetPages}
                      className="px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Coverage Scope - แสดง "—" เมื่อไม่มีค่าหรือเป็นแค่ "-" */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Coverage Scope</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {task.coverageScope && task.coverageScope.trim() && task.coverageScope.trim() !== '-'
                ? task.coverageScope
                : '—'}
            </p>
          </div>

          {task.taskType === 'MA' && ((task.rootCause && task.rootCause.trim()) || (task.resolution && task.resolution.trim())) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Issue Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Root Cause</label>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{task.rootCause?.trim() || '—'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Resolution</label>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{task.resolution?.trim() || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {task.taskType === 'MA' &&
            (() => {
              const repairPaths = parseRepairNoticePaths(task.photos);
              if (repairPaths.length === 0) return null;
              return (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Paperclip size={16} className="text-slate-500 shrink-0" aria-hidden />
                    Repair notice
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
          {task.rescheduleNote && String(task.rescheduleNote).trim() && (
            <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText size={14} className="text-blue-600" />
                <label className="text-[10px] font-bold uppercase text-blue-700">Reschedule Note</label>
              </div>
              <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">
                {String(task.rescheduleNote).trim()}
              </p>
            </div>
          )}

          {/* Travel Information */}
          {(task.travelMethod || task.travelCost) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Travel Information</h3>
              <div className="grid grid-cols-2 gap-3">
                {task.travelMethod && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Travel Method</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{task.travelMethod}</p>
                  </div>
                )}
                {task.travelCost && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Travel Cost</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">
                      {parseFloat(task.travelCost).toLocaleString('en-US')} THB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Task Status Section */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Task Status</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('done')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'done'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-green-300'
                }`}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setStatus('working')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  status === 'working'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-amber-300'
                }`}
              >
                <Clock3 size={18} className="shrink-0" strokeWidth={2.25} />
                In Process
              </button>
              <button
                type="button"
                onClick={() => setStatus('not-started')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'not-started' || status === 'stuck'
                    ? 'bg-gray-400 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-gray-300'
                }`}
              >
                Pending
              </button>
            </div>
            {status === 'working' && (
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
                  className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 px-6 py-4 border-t bg-slate-50">
          <div className="flex gap-3">
            {onEdit && (
              <button
                onClick={() => {
                  if (task && onEdit) {
                    // Ensure dates are in YYYY-MM-DD format for date inputs
                    const formatDateForInput = (dateString?: string): string => {
                      if (!dateString) return '';
                      const date = new Date(dateString);
                      if (isNaN(date.getTime())) return '';
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    };

                    const taskToEdit = {
                      ...task,
                      startDate: formatDateForInput(task.startDate),
                      endDate: formatDateForInput(task.endDate),
                      // Ensure contractId is included (check multiple possible field names)
                      contractId: task.contractId || (task as any).contract_id || undefined,
                      // Ensure replacementDeviceId is included
                      replacementDeviceId: task.replacementDeviceId || (task as any).replacement_device_id || undefined,
                      // Ensure assets are included
                      assets: task.assets || [],
                      // Ensure SLA term is included for MA tasks
                      vendorName: task.vendorName || (task as any).vendor_name || undefined,
                      // Ensure duration is included for MA tasks
                      duration: task.duration || undefined,
                    };
                    onEdit(taskToEdit);
                  }
                }}
                className="px-6 py-2.5 bg-purple-500 text-white rounded-xl font-semibold text-sm hover:bg-purple-600 transition-colors shadow-md"
              >
                Edit
              </button>
            )}
            {onDelete && task && (
              <button
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
                className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors shadow-md flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3 ml-auto">
            {reportLink && (
              <Link
                href={reportLink}
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 transition-colors shadow-md"
              >
                <FileText size={16} />
                Report
              </Link>
            )}
            {!reportLink && task.status === 'done' && createReportLink && (
              <Link
                href={createReportLink}
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-xl font-semibold text-sm hover:bg-rose-600 transition-colors shadow-md"
                title="Task is done but report is not created yet"
              >
                <FileText size={16} />
                Create Report
              </Link>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition-colors shadow-md"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
