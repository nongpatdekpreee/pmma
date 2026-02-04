'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { getPmReports, getMaReports, getTasks } from '@/lib/api';
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
} from 'lucide-react';

type ReportTab = 'pm' | 'ma';

interface PMReport {
  id: string;
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
  technicianName?: string;
  pmDate?: string;
  createdAt?: string;
}

interface MAReport {
  id: string;
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
  technicianName?: string;
  maDate?: string;
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

  const handleCreatePM = () => {
    setShowCreateMenu(false);
    if (!hasDonePMTasks) {
      alert('ไม่สามารถสร้าง Report PM ได้\nกรุณารอให้ Task PM มีสถานะ "Done" ก่อน');
      return;
    }
    router.push('/pmchecklist_report/add');
  };

  const handleCreateMA = () => {
    setShowCreateMenu(false);
    if (!hasDoneMATasks) {
      alert('ไม่สามารถสร้าง Report MA ได้\nกรุณารอให้ Task MA มีสถานะ "Done" ก่อน');
      return;
    }
    router.push('/machecklist_report/add');
  };

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex flex-col p-6 pt-0 gap-6 bg-slate-50 min-h-screen">
        {/* Header + ปุ่ม Report PM / Report MA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              PM / MA Checklist Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              คลิกปุ่มด้านล่างเพื่อดูรายการ Report PM หรือ Report MA
            </p>
          </div>
          <div className="relative self-start sm:self-auto">
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              disabled={loadingTasks || (!hasDonePMTasks && !hasDoneMATasks)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors shadow-lg ${
                loadingTasks || (!hasDonePMTasks && !hasDoneMATasks)
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-200'
              }`}
              title={
                loadingTasks
                  ? 'กำลังตรวจสอบ Tasks...'
                  : !hasDonePMTasks && !hasDoneMATasks
                  ? 'ไม่มี Task ที่ status = Done สำหรับสร้าง Report'
                  : ''
              }
            >
              <Plus size={20} />
              สร้าง Report ใหม่
              <ChevronDown size={18} className={`transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown Menu */}
            {showCreateMenu && (
              <>
                {/* Overlay to close menu when clicking outside */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCreateMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={handleCreatePM}
                    disabled={!hasDonePMTasks}
                    className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 font-medium border-t border-slate-100 ${
                      !hasDonePMTasks
                        ? 'text-slate-400 cursor-not-allowed opacity-50'
                        : 'text-slate-700 hover:bg-blue-50'
                    }`}
                    title={!hasDonePMTasks ? 'ไม่มี Task PM ที่ status = Done' : ''}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      !hasDonePMTasks ? 'bg-slate-100' : 'bg-blue-100'
                    }`}>
                      <CheckCircle2 size={18} className={!hasDonePMTasks ? 'text-slate-400' : 'text-blue-600'} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">Report PM</div>
                      <div className="text-xs text-slate-500">
                        {!hasDonePMTasks ? 'ไม่มี Task PM ที่ Done' : 'Preventive Maintenance'}
                      </div>
                    </div>
                    {hasDonePMTasks && pmReports.length === 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {doneTasks.filter((t) => t.taskType === 'PM').length} Tasks
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleCreateMA}
                    disabled={!hasDoneMATasks}
                    className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 font-medium border-t border-slate-100 ${
                      !hasDoneMATasks
                        ? 'text-slate-400 cursor-not-allowed opacity-50'
                        : 'text-slate-700 hover:bg-blue-50'
                    }`}
                    title={!hasDoneMATasks ? 'ไม่มี Task MA ที่ status = Done' : ''}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      !hasDoneMATasks ? 'bg-slate-100' : 'bg-green-100'
                    }`}>
                      <AlertCircle size={18} className={!hasDoneMATasks ? 'text-slate-400' : 'text-green-600'} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">Report MA</div>
                      <div className="text-xs text-slate-500">
                        {!hasDoneMATasks ? 'ไม่มี Task MA ที่ Done' : 'Maintenance Agreement'}
                      </div>
                    </div>
                    {hasDoneMATasks && maReports.length === 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {doneTasks.filter((t) => t.taskType === 'MA').length} Tasks
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ปุ่ม Report PM / Report MA */}
        <div className="flex gap-2">
          <button
            onClick={() => setTabAndUrl('pm')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              tab === 'pm'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Report PM
          </button>
          <button
            onClick={() => setTabAndUrl('ma')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              tab === 'ma'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Report MA
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ค้นหา Device, Technician, หรือวันที่..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* รายการ Report ตาม tab */}
        {loading ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500">กำลังโหลด...</p>
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
            <FileText size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg font-medium mb-2">
              {searchTerm ? 'ไม่พบรายการที่ค้นหา' : `ยังไม่มีรายการ Report ${tab === 'pm' ? 'PM' : 'MA'}`}
            </p>
            <p className="text-slate-400 text-sm">
              {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'กดปุ่ม "สร้าง Report ใหม่" เพื่อเริ่มต้น'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedReports.map((report: PMReport | MAReport) => {
                const result = report[resultKey as keyof typeof report] as string;
                const dateVal = report[dateKey as keyof typeof report] as string | undefined;
                return (
                  <div
                    key={report.id}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-bold text-slate-800">
                            {report.device?.CI_Name || report.device?.Asset_Number || `Device ${report.deviceId}`}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 ${getStatusColor(result)}`}>
                            {getStatusIcon(result)}
                            {result === 'pass' ? 'Pass' : result === 'warning' ? 'Warning' : 'Fail'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-slate-400" />
                            <span>{report.technicianName || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-400" />
                            <span>{formatDate(dateVal)}</span>
                          </div>
                        </div>
                        {report.checklistItems && report.checklistItems.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-xs font-bold text-slate-500 mb-2">รายการตรวจสอบ ({report.checklistItems.length} รายการ):</p>
                            <div className="flex flex-wrap gap-2">
                              {report.checklistItems.slice(0, 5).map((item) => (
                                <span
                                  key={item.id}
                                  className={`px-2 py-1 rounded text-xs ${
                                    item.status === 'pass' ? 'bg-green-100 text-green-700' :
                                    item.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                    item.status === 'fail' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {item.task}
                                </span>
                              ))}
                              {report.checklistItems.length > 5 && (
                                <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">
                                  +{report.checklistItems.length - 5} รายการ
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <p>สร้างเมื่อ</p>
                        <p className="font-medium text-slate-600">{formatDate(report.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  ก่อนหน้า
                </button>
                <span className="px-4 py-2 text-sm text-slate-600">
                  หน้า {currentPage} จาก {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  ถัดไป
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
