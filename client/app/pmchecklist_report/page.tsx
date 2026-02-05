'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { getPmReports, getMaReports, getTasks, apiUrl } from '@/lib/api';
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Search,
  Calendar,
  User,
  ChevronDown,
  X,
  ClipboardList,
  MessageSquare,
  MapPin,
  Cpu,
  Building2,
  Hash,
  Clock,
} from 'lucide-react';

type ReportTab = 'pm' | 'ma';

interface PMReport {
  id: string;
  taskId?: number;
  deviceId: string;
  device?: {
    Did?: number;
    CI_Name?: string;
    Asset_Number?: string;
    serial?: string;
    Sitename?: string;
  };
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  pmResult: 'pass' | 'warning' | 'fail';
  sla_result?: number;
  technicianName?: string;
  pmDate?: string;
  comment?: string;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  createdAt?: string;
}

interface MAReport {
  id: string;
  taskId?: number;
  deviceId: string;
  device?: {
    Did?: number;
    CI_Name?: string;
    Asset_Number?: string;
    serial?: string;
    Sitename?: string;
  };
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  maResult: 'pass' | 'warning' | 'fail';
  sla_result?: number;
  technicianName?: string;
  maDate?: string;
  comment?: string;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  createdAt?: string;
}

const ITEMS_PER_PAGE = 10;

export default function ReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as ReportTab | null;
  const [tab, setTab] = useState<ReportTab>(tabFromUrl === 'ma' ? 'ma' : 'pm');

  const [pmReports, setPmReports] = useState<PMReport[]>([]);
  const [maReports, setMaReports] = useState<MAReport[]>([]);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingMa, setLoadingMa] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [doneTasks, setDoneTasks] = useState<Array<{ id: number; taskType: string; status: string }>>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PMReport | MAReport | null>(null);

  // Sync tab with URL
  useEffect(() => {
    if (tabFromUrl === 'ma' || tabFromUrl === 'pm') setTab(tabFromUrl);
  }, [tabFromUrl]);

  const setTabAndUrl = (t: ReportTab) => {
    setTab(t);
    setCurrentPage(1);
    const url = t === 'ma' ? '/pmchecklist_report?tab=ma' : '/pmchecklist_report';
    router.replace(url, { scroll: false });
  };

  // Fetch PM reports
  useEffect(() => {
    const fetchPm = async () => {
      setLoadingPm(true);
      try {
        const res = await getPmReports({ limit: 1000 });
        if (res.success && res.data) setPmReports(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPm(false);
      }
    };
    fetchPm();
  }, []);

  // Fetch MA reports
  useEffect(() => {
    const fetchMa = async () => {
      setLoadingMa(true);
      try {
        const res = await getMaReports({ limit: 1000 });
        if (res.success && res.data) setMaReports(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMa(false);
      }
    };
    fetchMa();
  }, []);

  // Fetch tasks ที่ status = 'done'
  useEffect(() => {
    const fetchDoneTasks = async () => {
      setLoadingTasks(true);
      try {
        const res = await getTasks();
        if (res.success && res.data) {
          // กรองเฉพาะ tasks ที่ status = 'done' และ taskType = 'PM' หรือ 'MA'
          const done = res.data.filter(
            (task: any) => task.status === 'done' && (task.taskType === 'PM' || task.taskType === 'MA')
          );
          setDoneTasks(done);
        }
      } catch (e) {
        console.error('Error fetching done tasks:', e);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchDoneTasks();
  }, []);

  const reports = tab === 'pm' ? pmReports : maReports;
  const loading = tab === 'pm' ? loadingPm : loadingMa;
  const dateKey = tab === 'pm' ? 'pmDate' : 'maDate';
  const resultKey = tab === 'pm' ? 'pmResult' : 'maResult';

  const filteredReports = useMemo(() => {
    if (!searchTerm) return reports;
    const q = searchTerm.toLowerCase();
    return reports.filter((report: PMReport | MAReport) => {
      const deviceName = report.device?.CI_Name || report.device?.Asset_Number || '';
      const technician = report.technicianName || '';
      const deviceId = report.deviceId || '';
      const dateVal = report[dateKey as keyof typeof report];
      return (
        deviceName.toLowerCase().includes(q) ||
        technician.toLowerCase().includes(q) ||
        deviceId.toLowerCase().includes(q) ||
        (typeof dateVal === 'string' && dateVal.toLowerCase().includes(q))
      );
    });
  }, [reports, searchTerm, dateKey]);

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
      case 'pass': return <CheckCircle2 size={20} className="text-white" />;
      case 'warning': return <AlertCircle size={20} className="text-white" />;
      case 'fail': return <XCircle size={20} className="text-white" />;
      default: return null;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const hasDonePMTasks = doneTasks.some((task) => task.taskType === 'PM');
  const hasDoneMATasks = doneTasks.some((task) => task.taskType === 'MA');

  // Task ที่ยังไม่มี Report (เหลืออยู่)
  const reportedPMTaskIds = useMemo(
    () => new Set(pmReports.map((r) => Number(r.taskId)).filter((n) => !Number.isNaN(n))),
    [pmReports]
  );
  const reportedMATaskIds = useMemo(
    () => new Set(maReports.map((r) => Number(r.taskId)).filter((n) => !Number.isNaN(n))),
    [maReports]
  );
  const remainingPMTasks = useMemo(
    () => doneTasks.filter((t) => t.taskType === 'PM' && !reportedPMTaskIds.has(Number(t.id))),
    [doneTasks, reportedPMTaskIds]
  );
  const remainingMATasks = useMemo(
    () => doneTasks.filter((t) => t.taskType === 'MA' && !reportedMATaskIds.has(Number(t.id))),
    [doneTasks, reportedMATaskIds]
  );

  const handleCreatePM = () => {
    setShowCreateMenu(false);
    if (remainingPMTasks.length === 0) {
      alert('ไม่มี Task PM ที่ยังไม่มี Report สำหรับสร้าง');
      return;
    }
    router.push('/pmchecklist_report/add');
  };

  const handleCreateMA = () => {
    setShowCreateMenu(false);
    if (remainingMATasks.length === 0) {
      alert('ไม่มี Task MA ที่ยังไม่มี Report สำหรับสร้าง');
      return;
    }
    router.push('/machecklist_report/add');
  };

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex flex-col p-6 pt-0 gap-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              PM / MA Checklist Report
            </h1>
            <p className="text-sm text-slate-600 mt-1.5">
              Manage and view equipment maintenance reports
            </p>
          </div>
          <div className="relative self-start sm:self-auto">
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              disabled={loadingTasks || (remainingPMTasks.length === 0 && remainingMATasks.length === 0)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                loadingTasks || (remainingPMTasks.length === 0 && remainingMATasks.length === 0)
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5'
              }`}
              title={
                loadingTasks
                  ? 'กำลังตรวจสอบ Tasks...'
                  : remainingPMTasks.length === 0 && remainingMATasks.length === 0
                  ? 'ไม่มี Task ที่ยังไม่มี Report สำหรับสร้าง'
                  : ''
              }
            >
              <Plus size={20} />
              สร้าง Report ใหม่
              <ChevronDown size={18} className={`transition-transform duration-200 ${showCreateMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showCreateMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCreateMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 z-20 overflow-hidden backdrop-blur-sm">
                  <div className="p-2 bg-slate-50/80 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500 px-2">เลือกประเภท Report</p>
                  </div>
                  <button
                    onClick={handleCreatePM}
                    disabled={remainingPMTasks.length === 0}
                    className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                      remainingPMTasks.length === 0
                        ? 'text-slate-400 cursor-not-allowed opacity-60'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    title={remainingPMTasks.length === 0 ? 'ไม่มี Task PM ที่ยังไม่มี Report' : ''}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800">Report PM</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {remainingPMTasks.length === 0 ? 'ครบทุก Task แล้ว' : 'Preventive Maintenance'}
                      </div>
                    </div>
                    {remainingPMTasks.length > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium shrink-0">
                        {remainingPMTasks.length} Task ที่เหลือ
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleCreateMA}
                    disabled={remainingMATasks.length === 0}
                    className={`w-full px-4 py-3.5 text-left transition-all flex items-center gap-3 border-t border-slate-100 ${
                      remainingMATasks.length === 0
                        ? 'text-slate-400 cursor-not-allowed opacity-60'
                        : 'text-slate-700 hover:bg-emerald-50/80'
                    }`}
                    title={remainingMATasks.length === 0 ? 'ไม่มี Task MA ที่ยังไม่มี Report' : ''}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800">Report MA</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {remainingMATasks.length === 0 ? 'ครบทุก Task แล้ว' : 'Maintenance Agreement'}
                      </div>
                    </div>
                    {remainingMATasks.length > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium shrink-0">
                        {remainingMATasks.length} Task ที่เหลือ
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 p-1.5 bg-white/80 rounded-2xl border border-slate-200/80 shadow-sm w-fit">
          <button
            onClick={() => setTabAndUrl('pm')}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 ${
              tab === 'pm'
                ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-md shadow-blue-400/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Report PM
          </button>
          <button
            onClick={() => setTabAndUrl('ma')}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 ${
              tab === 'ma'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Report MA
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Device, Technician, or Date..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 outline-none text-sm transition-all"
            />
          </div>
        </div>

        {/* รายการ Report */}
        {loading ? (
          <div className="bg-white p-16 rounded-lg border border-slate-300 shadow-sm text-center">
            <div className="inline-flex items-center gap-3 text-slate-600">
              <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading reports...</span>
            </div>
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="bg-white p-16 rounded-lg border border-slate-300 shadow-sm text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-lg bg-slate-200 flex items-center justify-center border border-slate-300">
              <FileText size={32} className="text-slate-500" />
            </div>
            <p className="text-slate-700 text-lg font-semibold mb-2">
              {searchTerm ? 'ไม่พบรายการที่ค้นหา' : `ยังไม่มีรายการ Report ${tab === 'pm' ? 'PM' : 'MA'}`}
            </p>
            <p className="text-slate-500 text-sm mb-6">
              {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'กดปุ่ม "สร้าง Report ใหม่" เพื่อเริ่มต้น'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateMenu(true)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors shadow-md"
              >
                สร้าง Report ใหม่
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedReports.map((report: PMReport | MAReport) => {
                const result = report[resultKey as keyof typeof report] as string;
                const dateVal = report[dateKey as keyof typeof report] as string | undefined;
                const isPM = tab === 'pm';
                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="group bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/80 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors break-words inline-flex items-center gap-2 flex-wrap" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                              <span>{report.device?.CI_Name || report.device?.Asset_Number || `Device ${report.deviceId}`}</span>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 shadow-sm flex-shrink-0 ${getStatusColor(result)}`}>
                                {getStatusIcon(result)}
                                {result === 'pass' ? 'Pass' : result === 'warning' ? 'Warning' : 'Fail'}
                              </span>
                            </h3>
                            {report.device?.Asset_Number && report.device?.CI_Name && report.device.CI_Name !== report.device.Asset_Number && (
                              <p className="text-[10px] text-slate-500 mt-0.5 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                {report.device.Asset_Number}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                              <User size={12} className="text-slate-500" />
                            </div>
                            <span className="font-medium">{report.technicianName || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                              <Calendar size={12} className="text-slate-500" />
                            </div>
                            <span className="font-medium">{formatDate(dateVal)}</span>
                          </div>
                          {report.sla_result != null && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                <ClipboardList size={12} className="text-indigo-600" />
                              </div>
                              <span className="font-bold text-indigo-700">Score: {report.sla_result}</span>
                            </div>
                          )}
                        </div>
                        {/* Additional Device Info */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-2">
                          {report.device?.Sitename && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-slate-400" />
                              <span>{report.device.Sitename}</span>
                            </div>
                          )}
                          {report.device?.serial && (
                            <div className="flex items-center gap-1.5">
                              <Hash size={12} className="text-slate-400" />
                              <span className="font-mono">{report.device.serial}</span>
                            </div>
                          )}
                          {report.uploadedFiles && report.uploadedFiles.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <FileText size={12} className="text-slate-400" />
                              <span>{report.uploadedFiles.length} file{report.uploadedFiles.length > 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {report.comment && (
                            <div className="flex items-center gap-1.5">
                              <MessageSquare size={12} className="text-slate-400" />
                              <span className="truncate max-w-[150px]" title={report.comment}>Has comment</span>
                            </div>
                          )}
                        </div>
                        {report.checklistItems && report.checklistItems.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-semibold text-slate-500">Checklist ({report.checklistItems.length})</p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-emerald-600 font-semibold">✓{report.checklistItems.filter(i => i.status === 'pass').length}</span>
                                <span className="text-[10px] text-amber-600 font-semibold">⚠{report.checklistItems.filter(i => i.status === 'warning').length}</span>
                                <span className="text-[10px] text-red-600 font-semibold">✗{report.checklistItems.filter(i => i.status === 'fail').length}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {report.checklistItems.slice(0, 5).map((item) => (
                                <span
                                  key={item.id}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                    item.status === 'pass' ? 'bg-emerald-50 text-emerald-700' :
                                    item.status === 'warning' ? 'bg-amber-50 text-amber-700' :
                                    item.status === 'fail' ? 'bg-red-50 text-red-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}
                                  title={item.notes ? item.notes : undefined}
                                >
                                  {item.task}
                                </span>
                              ))}
                              {report.checklistItems.length > 5 && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                                  +{report.checklistItems.length - 5}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">Created: {formatDate(report.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  ก่อนหน้า
                </button>
                <span className="px-5 py-2.5 text-sm text-slate-600 font-medium bg-white rounded-xl border border-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  ถัดไป
                </button>
              </div>
            )}
          </>
        )}

        {/* Modal รายละเอียด Report - ใช้ Portal ให้อยู่บนสุด ครอบ sidebar */}
        {selectedReport && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSelectedReport(null)}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between px-8 py-6 ${
                tab === 'pm'
                  ? 'bg-gradient-to-r from-blue-500/10 to-blue-600/5 border-b border-slate-200'
                  : 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border-b border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    tab === 'pm' ? 'bg-blue-100' : 'bg-emerald-100'
                  }`}>
                    <FileText size={24} className={tab === 'pm' ? 'text-blue-600' : 'text-emerald-600'} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {tab === 'pm' ? 'PM' : 'MA'} Report Details
                    </h2>
                    <p className="text-sm text-slate-500 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {selectedReport.device?.CI_Name || selectedReport.device?.Asset_Number || `Device ${selectedReport.deviceId}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={22} className="text-slate-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* ข้อมูลหลัก */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Device</p>
                    <p className="font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {selectedReport.device?.CI_Name || selectedReport.device?.Asset_Number || `Device ${selectedReport.deviceId}`}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Technician</p>
                    <p className="font-semibold text-slate-800">{selectedReport.technicianName || '-'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">{tab === 'pm' ? 'PM Date' : 'MA Date'}</p>
                    <p className="font-semibold text-slate-800">
                      {formatDate(tab === 'pm' ? (selectedReport as PMReport).pmDate : (selectedReport as MAReport).maDate)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Result</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-slate-800">{selectedReport.sla_result ?? '-'}</p>
                      {selectedReport.sla_result != null && (
                        selectedReport.sla_result >= 90 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white flex items-center gap-1">
                            
                          </span>
                        ) : selectedReport.sla_result >= 70 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white  flex items-center gap-1">
                           
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white  flex items-center gap-1">
                           
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
                {/* 
                {selectedReport.sla_result != null && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <ClipboardList size={12} />
                            Result Score
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-bold text-slate-800">{selectedReport.sla_result}</p>
                            {selectedReport.sla_result >= 90 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-emerald-500 flex items-center gap-1">
                                <CheckCircle2 size={10} />
                                Pass
                              </span>
                            ) : selectedReport.sla_result >= 70 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-amber-500 flex items-center gap-1">
                                <AlertCircle size={10} />
                                Warning
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-red-500 flex items-center gap-1">
                                <XCircle size={10} />
                                Fail
                              </span>
                            )}
                          </div>
                        </div>
                      )} */}

                {/* Device Information - แสดงทั้งหมด */}
                {selectedReport.device && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <FileText size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">Device Information</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedReport.device.CI_Name && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <FileText size={12} />
                            CI Name
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{selectedReport.device.CI_Name}</p>
                        </div>
                      )}
                      {selectedReport.device.Asset_Number && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <Hash size={12} />
                            Asset Number
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{selectedReport.device.Asset_Number}</p>
                        </div>
                      )}
                      {selectedReport.device.serial && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <Hash size={12} />
                            Serial Number
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words font-mono" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{selectedReport.device.serial}</p>
                        </div>
                      )}
                      {selectedReport.device.Sitename && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <MapPin size={12} />
                            Site
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{selectedReport.device.Sitename}</p>
                        </div>
                      )}
                      {(selectedReport.device as any).model && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <Cpu size={12} />
                            Model
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{(selectedReport.device as any).model}</p>
                        </div>
                      )}
                      {(selectedReport.device as any).Vendor && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <Building2 size={12} />
                            Vendor
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{(selectedReport.device as any).Vendor}</p>
                        </div>
                      )}
                      {(selectedReport.device as any).Location2 && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <MapPin size={12} />
                            Location
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{(selectedReport.device as any).Location2}</p>
                        </div>
                      )}
                      {(selectedReport.device as any).Asset_State && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Asset State
                          </p>
                          <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{(selectedReport.device as any).Asset_State}</p>
                        </div>
                      )}
                      
                    </div>
                  </div>
                )}

                {/* Checklist Items */}
                {selectedReport.checklistItems && selectedReport.checklistItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <ClipboardList size={20} className="text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">Checklist Items</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedReport.checklistItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-xs font-bold text-slate-400 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">{item.task}</p>
                              {item.notes && (
                                <p className="text-xs text-slate-600 mt-1 italic break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              item.status === 'pass' ? 'bg-emerald-100 text-emerald-700' :
                              item.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                              item.status === 'fail' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status === 'pass' ? 'Pass' : item.status === 'warning' ? 'Warning' : item.status === 'fail' ? 'Fail' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Summary */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Pass</p>
                          <p className="text-lg font-bold text-emerald-600">
                            {selectedReport.checklistItems.filter(i => i.status === 'pass').length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Warning</p>
                          <p className="text-lg font-bold text-amber-600">
                            {selectedReport.checklistItems.filter(i => i.status === 'warning').length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Fail</p>
                          <p className="text-lg font-bold text-red-600">
                            {selectedReport.checklistItems.filter(i => i.status === 'fail').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comment */}
                {selectedReport.comment && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <MessageSquare size={20} className="text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">Notes from Technician</h3>
                    </div>
                    <p className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {selectedReport.comment}
                    </p>
                  </div>
                )}

                {/* Uploaded Files */}
                {selectedReport.uploadedFiles && selectedReport.uploadedFiles.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <FileText size={20} className="text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">Uploaded Files</h3>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selectedReport.uploadedFiles.map((f, i) => (
                        f.path ? (
                          <a
                            key={i}
                            href={apiUrl(f.path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 border border-blue-200/50 transition-all hover:shadow-md"
                          >
                            <FileText size={18} />
                            {f.name}
                            <span className="text-blue-500 text-xs">View</span>
                          </a>
                        ) : (
                          <span
                            key={i}
                            className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-600"
                          >
                            {f.name} ({f.type})
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </SidebarLayout>
  );
}
