'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { getPmReports, getMaReports, getTasks, apiUrl, taskMaNoticeUrl, absoluteUrlForHyperlink } from '@/lib/api';
import JSZip from 'jszip';
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Search,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ClipboardList,
  MessageSquare,
  MapPin,
  Cpu,
  Building2,
  Hash,
  Clock,
  Replace,
  Download,
  Upload,
  Image,
  Loader2,
  Paperclip,
} from 'lucide-react';

/** Paths จาก task.photos / report.repairNoticePaths สำหรับลิงก์ Repair notice */
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

type ReportTab = 'pm' | 'ma';

interface PMReport {
  id: string;
  taskId?: number;
  deviceId: string;
  engineers?: Array<{ id?: string; name?: string; lastName?: string; last_name?: string }>;
  device?: {
    Did?: number;
    CI_Name?: string;
    Asset_Number?: string;
    serial?: string;
    Sitename?: string;
    Location2?: string;
    Refer_SOF?: string;
  };
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  pmResult: 'pass' | 'warning' | 'fail';
  assets?: any[];
  sla_result?: number;
  technicianName?: string;
  pmDate?: string;
  comment?: string;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  createdAt?: string;
  site_name?: string;
}

interface MAReport {
  id: string;
  taskId?: number;
  deviceId: string;
  engineers?: Array<{ id?: string; name?: string; lastName?: string; last_name?: string }>;
  device?: {
    Did?: number;
    CI_Name?: string;
    Asset_Number?: string;
    serial?: string;
    Sitename?: string;
    Location2?: string;
    Refer_SOF?: string;
  };
  checklistItems: Array<{ id: string; task: string; status: string; notes?: string }>;
  maResult: 'pass' | 'warning' | 'fail';
  assets?: any[];
  sla_result?: number;
  technicianName?: string;
  maDate?: string;
  comment?: string;
  uploadedFiles?: Array<{ name: string; type: string; path?: string }>;
  createdAt?: string;
  vendorName?: string;
  vendorTel?: string;
  reporterName?: string;
  reporterTel?: string;
  ticket?: string;
  site_name?: string;
  /** paths สำหรับ Repair notice (export CSV / ZIP) */
  repairNoticePaths?: string[];
}

const ITEMS_PER_PAGE = 5;
const DOWNLOAD_MODAL_PAGE_SIZE = 8;

function ReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, removeToast, error: toastError, warning: toastWarning } = useToast();
  const tabFromUrl = searchParams.get('tab') as ReportTab | null;
  const [tab, setTab] = useState<ReportTab>(tabFromUrl === 'ma' ? 'ma' : 'pm');

  const [pmReports, setPmReports] = useState<PMReport[]>([]);
  const [maReports, setMaReports] = useState<MAReport[]>([]);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingMa, setLoadingMa] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [isDownloadFilesModalOpen, setIsDownloadFilesModalOpen] = useState(false);
  const [downloadSiteSelected, setDownloadSiteSelected] = useState<Set<string>>(new Set());
  const [downloadSiteSearch, setDownloadSiteSearch] = useState('');
  const [downloadSofFilter, setDownloadSofFilter] = useState('');
  const [downloadLocationFilter, setDownloadLocationFilter] = useState('');
  const [downloadModalPage, setDownloadModalPage] = useState(1);
  const [pmMaTasks, setPmMaTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PMReport | MAReport | null>(null);
  const [replacementDevicesMap, setReplacementDevicesMap] = useState<Record<string, {
    id: string;
    name: string;
    type?: string;
    serialNumber?: string;
    site?: string;
    assetNumber?: string;
  }>>({});

  const getEngineerDisplay = (r: PMReport | MAReport): string => {
    const engineers = Array.isArray(r.engineers) ? r.engineers : [];
    const nbsp = '\u00A0'; // non-breaking space ให้ชื่อ-นามสกุลอยู่บรรทัดเดียวกัน
    const names = engineers
      .map((e) => {
        const first = (e?.name ?? e?.id ?? '').toString().trim();
        const last = (e?.lastName ?? e?.last_name ?? '').toString().trim();
        return `${first}${last ? `${nbsp}${last}` : ''}`.trim();
      })
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : (r.technicianName || '-');
  };

  // Sync tab with URL
  useEffect(() => {
    if (tabFromUrl === 'ma' || tabFromUrl === 'pm') setTab(tabFromUrl);
  }, [tabFromUrl]);

  // เมื่อเปิดจาก Calendar ด้วย taskId ใน URL — เลือก tab ที่ตรงและเปิด report นั้น (ทำครั้งเดียวต่อ taskId)
  const taskIdFromUrl = searchParams.get('taskId');
  const appliedTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!taskIdFromUrl || loadingPm || loadingMa) return;
    if (appliedTaskIdRef.current === taskIdFromUrl) return;
    const tid = Number(taskIdFromUrl);
    if (Number.isNaN(tid)) return;
    const pmReport = pmReports.find((r) => Number(r.taskId) === tid);
    const maReport = maReports.find((r) => Number(r.taskId) === tid);
    if (pmReport) {
      appliedTaskIdRef.current = taskIdFromUrl;
      setTab('pm');
      router.replace('/pmchecklist_report?tab=pm&taskId=' + taskIdFromUrl, { scroll: false });
      setSelectedReport(pmReport);
      const idx = pmReports.indexOf(pmReport);
      if (idx >= 0) setCurrentPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);
    } else if (maReport) {
      appliedTaskIdRef.current = taskIdFromUrl;
      setTab('ma');
      router.replace('/pmchecklist_report?tab=ma&taskId=' + taskIdFromUrl, { scroll: false });
      setSelectedReport(maReport);
      const idx = maReports.indexOf(maReport);
      if (idx >= 0) setCurrentPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);
    }
  }, [taskIdFromUrl, loadingPm, loadingMa, pmReports, maReports, router]);
  useEffect(() => {
    if (!taskIdFromUrl) appliedTaskIdRef.current = null;
  }, [taskIdFromUrl]);

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

  // Fetch PM/MA tasks (ทุก status — ใช้ export; ปุ่มสร้าง report ยังใช้เฉพาะ done)
  useEffect(() => {
    const fetchPmMaTasks = async () => {
      setLoadingTasks(true);
      try {
        const res = await getTasks();
        if (res.success && res.data) {
          const list = res.data.filter(
            (task: any) => task.taskType === 'PM' || task.taskType === 'MA'
          );
          setPmMaTasks(list);
        }
      } catch (e) {
        console.error('Error fetching PM/MA tasks:', e);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchPmMaTasks();
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

  /** กรอง PM/MA task (ยังไม่มี report) ตามช่องค้นหา — สอดคล้องกับ filteredReports */
  const pmMaTaskWithoutReportMatchesSearch = (task: any, term: string) => {
    const t = term.trim();
    if (!t) return true;
    const q = t.toLowerCase();
    const assets: any[] = Array.isArray(task?.assets) ? task.assets : [];
    for (const a of assets) {
      const deviceName = String(a?.CI_Name ?? a?.name ?? a?.Asset_Number ?? a?.serial ?? '').toLowerCase();
      const deviceId = String(a?.Asset_Number ?? a?.assetNumber ?? a?.Did ?? '').toLowerCase();
      if (deviceName.includes(q) || deviceId.includes(q)) return true;
    }
    const technician = getEngineerDisplay({
      engineers: task?.engineers,
      technicianName: task?.technicianName,
    } as PMReport).toLowerCase();
    const dateVal = task?.endDate || task?.startDate;
    const dateStr = typeof dateVal === 'string' ? dateVal.toLowerCase() : '';
    const siteStr = String(task?.siteName ?? '').toLowerCase();
    const statusStr = String(task?.status ?? '').toLowerCase();
    return (
      technician.includes(q) ||
      siteStr.includes(q) ||
      String(task?.id ?? '').includes(q) ||
      dateStr.includes(q) ||
      statusStr.includes(q)
    );
  };

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const selectedReportsArray = useMemo(
    () => filteredReports.filter((r) => selectedReportIds.has(String(r.id))),
    [filteredReports, selectedReportIds]
  );
  const downloadSourceReports = useMemo(
    () => (selectedReportsArray.length > 0 ? selectedReportsArray : filteredReports),
    [selectedReportsArray, filteredReports]
  );

  // Load replacement devices for MA reports (from task.assets replacementDeviceId)
  useEffect(() => {
    if (!selectedReport || tab !== 'ma') {
      setReplacementDevicesMap({});
      return;
    }
    const rawAssets: any[] = Array.isArray((selectedReport as any).assets)
      ? (selectedReport as any).assets
      : [];
    const repIds = new Set<string>();
    rawAssets.forEach((a: any) => {
      if (!a) return;
      const rid = a.replacementDeviceId ?? a.replacement_device_id;
      if (rid != null && String(rid).trim() !== '') {
        repIds.add(String(rid));
      }
    });
    if (repIds.size === 0) {
      setReplacementDevicesMap({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      const map: Record<string, {
        id: string;
        name: string;
        type?: string;
        serialNumber?: string;
        site?: string;
        assetNumber?: string;
      }> = {};
      await Promise.all(
        Array.from(repIds).map(async (rid) => {
          try {
            const res = await fetch(apiUrl(`/api/devices/${rid}`));
            const json = await res.json();
            if (!cancelled && res.ok && json.data) {
              const d = json.data;
              map[String(rid)] = {
                id: String(d.Did),
                name: d.CI_Name || d.Asset_Number || '',
                type: d.model || d.Manufacturername || d.manufacturername || undefined,
                serialNumber: d.serial,
                site: d.Sitename || d.Location2,
                assetNumber: d.Asset_Number,
              };
            }
          } catch {
            // ignore error for individual device
          }
        })
      );
      if (!cancelled) setReplacementDevicesMap(map);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedReport, tab]);

  // Pair original assets with replacement devices (for MA)
  const assetPairs = useMemo(() => {
    if (!selectedReport || tab !== 'ma') return [];
    const rawAssets: any[] = Array.isArray((selectedReport as any).assets)
      ? (selectedReport as any).assets
      : [];
    return rawAssets.map((a: any) => {
      const original = {
        name: a?.name ?? a?.CI_Name ?? a?.Asset_Number ?? '',
        assetNumber: a?.assetNumber ?? a?.Asset_Number,
        serial: a?.serialNumber ?? a?.serial,
        model: a?.model,
        site: a?.site ?? a?.Sitename,
      };
      const rid = a?.replacementDeviceId ?? a?.replacement_device_id;
      const replacement = rid != null ? replacementDevicesMap[String(rid)] : undefined;
      return { original, replacement };
    });
  }, [selectedReport, tab, replacementDevicesMap]);

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
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // รายการ devices ทั้งหมดที่ไปทำ PM/MA ครั้งนั้น (จาก assets หรือ device เดียว)
  const getReportDevices = (report: PMReport | MAReport): Array<{ CI_Name?: string; name?: string; Asset_Number?: string; serial?: string; Sitename?: string; Location2?: string; Refer_SOF?: string; model?: string; [k: string]: any }> => {
    const assets = report.assets;
    if (Array.isArray(assets) && assets.length > 0) {
      return assets.map((a: any) => ({
        CI_Name: a.CI_Name ?? a.name,
        name: a.name ?? a.CI_Name,
        Asset_Number: a.Asset_Number ?? a.assetNumber,
        serial: a.serial ?? a.serialNumber,
        Sitename: a.Sitename ?? a.site,
        Location2: a.Location2 ?? a.location,
        Refer_SOF: a.Refer_SOF ?? a.refer_sof ?? (report.device as any)?.Refer_SOF,
        model: a.model ?? a.Model ?? a.Manufacturername ?? a.manufacturername ?? (report.device as any)?.model,
        Vendor: a.Vendor ?? a.vendor ?? (report.device as any)?.Vendor,
      }));
    }
    if (report.device) {
      const d = report.device as any;
      return [{
        ...d,
        Refer_SOF: d.Refer_SOF ?? d.refer_sof,
        model: d.model ?? d.Model ?? d.Manufacturername ?? d.manufacturername,
        Vendor: d.Vendor ?? d.vendor,
      }];
    }
    return [{ CI_Name: `Device ${report.deviceId}`, name: `Device ${report.deviceId}` }];
  };

  // Tasks without Report (remaining)
  const reportedPMTaskIds = useMemo(
    () => new Set(pmReports.map((r) => Number(r.taskId)).filter((n) => !Number.isNaN(n))),
    [pmReports]
  );
  const reportedMATaskIds = useMemo(
    () => new Set(maReports.map((r) => Number(r.taskId)).filter((n) => !Number.isNaN(n))),
    [maReports]
  );
  /** done แล้วแต่ยังไม่มี report — ใช้ปุ่ม Create / เลือกประเภท report */
  const remainingPMTasks = useMemo(
    () =>
      pmMaTasks.filter(
        (t) => t.taskType === 'PM' && t.status === 'done' && !reportedPMTaskIds.has(Number(t.id))
      ),
    [pmMaTasks, reportedPMTaskIds]
  );
  const remainingMATasks = useMemo(
    () =>
      pmMaTasks.filter(
        (t) => t.taskType === 'MA' && t.status === 'done' && !reportedMATaskIds.has(Number(t.id))
      ),
    [pmMaTasks, reportedMATaskIds]
  );
  /** ทุก status ที่ยังไม่มี report — ใช้ต่อท้าย CSV */
  const remainingPMWithoutReport = useMemo(
    () => pmMaTasks.filter((t) => t.taskType === 'PM' && !reportedPMTaskIds.has(Number(t.id))),
    [pmMaTasks, reportedPMTaskIds]
  );
  const remainingMAWithoutReport = useMemo(
    () => pmMaTasks.filter((t) => t.taskType === 'MA' && !reportedMATaskIds.has(Number(t.id))),
    [pmMaTasks, reportedMATaskIds]
  );
  const exportablePendingCount = tab === 'pm' ? remainingPMWithoutReport.length : remainingMAWithoutReport.length;

  const handleCreatePM = () => {
    setShowCreateMenu(false);
    if (remainingPMTasks.length === 0) {
      toastWarning('No PM tasks available to create a report.');
      return;
    }
    router.push('/pmchecklist_report/add');
  };

  const handleCreateMA = () => {
    setShowCreateMenu(false);
    if (remainingMATasks.length === 0) {
      toastWarning('No MA tasks available to create a report.');
      return;
    }
    router.push('/machecklist_report/add');
  };

  // CSV helpers — quote only when needed (match sample exports)
  const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  /**
   * แยกคอลัมน์ Site / Location: ข้อความจาก DB/UI มักเป็น "ชื่อไซต์ - สถานที่" รวมในฟิลด์เดียว
   * ถ้ามี Location จาก device/asset ให้ใช้เป็นคอลัมน์ Location ก่อน (ข้อมูลจากอุปกรณ์)
   */
  const exportSiteAndLocation = (siteLabel: unknown, explicitLocation: unknown): { site: string; location: string } => {
    const raw = String(siteLabel ?? '').trim();
    const exp = String(explicitLocation ?? '').trim();
    const m = raw.match(/^(.*?)(\s+[-\u2013\u2014]\s+)(.*)$/);
    const siteOnly = m ? m[1].trim() : raw;
    const fromLabel = m ? m[3].trim() : '';
    if (exp) {
      return { site: siteOnly || raw || '-', location: exp };
    }
    if (fromLabel) {
      return { site: siteOnly || '-', location: fromLabel };
    }
    return { site: raw || '-', location: '-' };
  };

  /** Excel/LibreOffice: HYPERLINK formula; multiple files joined with line breaks in one cell */
  const escapeExcelStr = (s: string) => s.replace(/"/g, '""');
  /** Thai Excel uses ";" between function args; US/UK Excel uses "," — wrong separator breaks HYPERLINK into a bad path (e.g. C:\\api\\...) */
  const excelFormulaArgSep =
    typeof navigator !== 'undefined' && /^th/i.test(navigator.language || '') ? ';' : ',';
  /** ข้อความที่เห็นในเซลล์ — n_ticket_ใบงานซ่อม_site (n = ลำดับทั่วทั้งไฟล์ export 1,2,3,… ไม่รีเซ็ตทุกแถว) */
  const buildMaRepairNoticeExcelLinkLabel = (
    ordinal: number,
    ticket: string | undefined,
    site: string | undefined
  ) => {
    const clean = (v: string) => String(v ?? '').trim().replace(/[\r\n"]/g, ' ');
    const t = clean(ticket ?? '') || 'xxxx';
    const s = clean(site ?? '') || '-';
    return `${ordinal}_${t}_ใบงานซ่อม_${s}`;
  };
  const buildRepairNoticeCsvCell = (
    report: MAReport,
    opts?: { ticket?: string; site?: string },
    /** ถ้ามี จะใช้เลขลำดับต่อเนื่องทั้ง export (และหลายไฟล์ในเซลล์เดียว = n, n+1, …) */
    excelSeq?: { n: number }
  ): string => {
    const paths = report.repairNoticePaths || [];
    const tid = report.taskId;
    if (paths.length === 0) return '';

    const segments: string[] = [];
    let localOrdinal = 0;
    for (const raw of paths) {
      const trimmed = String(raw).trim();
      if (!trimmed) continue;
      const ordinal = excelSeq ? (excelSeq.n += 1) : (localOrdinal += 1);
      const basename = trimmed.split('/').filter(Boolean).pop() || trimmed;
      let url: string;
      if (/^https?:\/\//i.test(trimmed)) {
        url = trimmed;
      } else if (tid != null && String(tid).trim() !== '' && basename) {
        url = taskMaNoticeUrl(tid, basename);
      } else {
        url = apiUrl(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
      }
      url = absoluteUrlForHyperlink(url);
      const linkLabel = buildMaRepairNoticeExcelLinkLabel(ordinal, opts?.ticket, opts?.site);
      segments.push(
        `HYPERLINK("${escapeExcelStr(url)}"${excelFormulaArgSep}"${escapeExcelStr(linkLabel)}")`
      );
    }
    if (segments.length === 0) return '';
    return `=${segments.join('&CHAR(10)&')}`;
  };
  const formatExportDate = (v: unknown) => {
    if (!v) return '';
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('en-US'); // M/D/YYYY
  };
  const formatTaskStatusForCsv = (status: unknown) => {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'done') return 'Done';
    if (s === 'not-started') return 'Not started';
    if (s === 'working') return 'Working';
    if (s === 'stuck') return 'Stuck';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '-';
  };
  // Export CSV — ใช้กับทั้ง PM และ MA ตาม tab ปัจจุบัน
  const handleExport = async () => {
    const taskLabel = tab === 'pm' ? 'PM' : 'MA';
    const isFullExport = selectedReportsArray.length === 0;
    const sourceReports =
      selectedReportsArray.length > 0 ? selectedReportsArray : filteredReports;
    const pendingPool = tab === 'pm' ? remainingPMWithoutReport : remainingMAWithoutReport;
    const pendingExport = isFullExport
      ? pendingPool.filter((t) => pmMaTaskWithoutReportMatchesSearch(t, searchTerm))
      : [];
    if (sourceReports.length === 0 && pendingExport.length === 0) return;

    // สำหรับ MA: ดึง replacement device (serial, model, asset #, location, site)
    type ReplacementInfo = {
      serial: string;
      model: string;
      assetNumber: string;
      location: string;
      site: string;
    };
    let replacementPlaceMap: Record<string, ReplacementInfo> = {};
    const addReplacementIdsFromRow = (row: any, repIds: Set<string>) => {
      const assets: any[] = Array.isArray(row?.assets) ? row.assets : [];
      assets.forEach((a: any) => {
        const rid = a?.replacementDeviceId ?? a?.replacement_device_id;
        if (rid != null && String(rid).trim() !== '') repIds.add(String(rid));
      });
      const taskRepId = row?.replacementDeviceId ?? row?.replacement_device_id;
      if (taskRepId != null && String(taskRepId).trim() !== '') repIds.add(String(taskRepId));
    };
    if (tab === 'ma') {
      const repIds = new Set<string>();
      sourceReports.forEach((r: PMReport | MAReport) => addReplacementIdsFromRow(r, repIds));
      pendingExport.forEach((t) => addReplacementIdsFromRow(t, repIds));
      await Promise.all(
        Array.from(repIds).map(async (rid) => {
          try {
            const res = await fetch(apiUrl(`/api/devices/${rid}`));
            const json = await res.json();
            if (res.ok && json.data) {
              const d = json.data as Record<string, unknown>;
              const serial = (d.serial ?? (d as any).serialNumber ?? '') as string;
              const model = (d.model ?? (d as any).type ?? '') as string;
              const assetNum = (d.Asset_Number ?? (d as any).assetNumber ?? '') as string;
              const location = (d.Location2 ?? d.location2 ?? '') as string;
              const site = (d.Sitename ?? d.site ?? '') as string;
              replacementPlaceMap[rid] = {
                serial: String(serial || '').trim() || '-',
                model: String(model || '').trim() || '-',
                assetNumber: String(assetNum || '').trim() || '-',
                location: String(location || '').trim() || '-',
                site: String(site || '').trim() || '-',
              };
            } else {
              replacementPlaceMap[rid] = {
                serial: '-',
                model: '-',
                assetNumber: '-',
                location: '-',
                site: '-',
              };
            }
          } catch {
            replacementPlaceMap[rid] = {
              serial: '-',
              model: '-',
              assetNumber: '-',
              location: '-',
              site: '-',
            };
          }
        })
      );
    }

    const taskById = new Map<number, { startDate?: string; endDate?: string }>();
    pmMaTasks.forEach((t: { id?: number; startDate?: string; endDate?: string }) => {
      if (t?.id != null && !Number.isNaN(Number(t.id))) taskById.set(Number(t.id), { startDate: t.startDate, endDate: t.endDate });
    });
    const taskWindowDates = (taskId: unknown) => {
      if (taskId == null || taskId === '') return { start: '', end: '' };
      const t = taskById.get(Number(taskId));
      return {
        start: formatExportDate(t?.startDate),
        end: formatExportDate(t?.endDate),
      };
    };

    const lines: string[] = [];
    const row = (arr: unknown[]) => lines.push(arr.map(csvCell).join(','));
    const gen = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const pmHeaders = [
      'Total devices',
      'Site',
      'Location',
      'Technician',
      'start_date',
      'end_date',
      'Status',
      'Report status',
      'Comment',
    ];
    const maHeaders = [
      'Serial',
      'Model',
      'Asset number',
      'Site',
      'Location',
      'Technician',
      'start_date',
      'end_date',
      'Replace Device (serial)',
      'Model',
      'Asset number',
      'New Site',
      'New Location',
      'Third Party Vendor name',
      'Third Party Vendor phone',
      'Reporter name',
      'Reporter phone',
      'Ticket',
      'Status',
      'Report status',
      'Repair notice',
      'comment',
    ];

    const getMaExportRepairPaths = (ma: MAReport): string[] => {
      const fromReport = Array.isArray(ma.repairNoticePaths)
        ? ma.repairNoticePaths.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
        : [];
      if (fromReport.length > 0) return fromReport;
      const tid = ma.taskId;
      if (tid == null) return [];
      const linked = pmMaTasks.find((t: { id?: number }) => Number(t?.id) === Number(tid));
      return normalizeRepairPathsFromPhotos(linked?.photos);
    };
    const headers = tab === 'ma' ? maHeaders : pmHeaders;
    row([`${taskLabel} Checklist Report - Export (Generated: ${gen})`, ...Array(headers.length - 1).fill('')]);
    row(Array(headers.length).fill(''));
    row(headers);
    const repairNoticeExcelSeq = tab === 'ma' ? { n: 0 } : undefined;
    sourceReports.forEach((r: PMReport | MAReport) => {
      const dev = r.device as Record<string, unknown> | undefined;
      const rSite = (r as PMReport).site_name ?? (r as MAReport).site_name;
      const rawSite =
        dev?.Sitename != null && String(dev.Sitename).trim() !== ''
          ? String(dev.Sitename)
          : rSite != null && String(rSite).trim() !== ''
            ? String(rSite)
            : '';
      const explicitLoc = dev?.Location2 != null ? String(dev.Location2) : '';
      const { site, location } = exportSiteAndLocation(rawSite, explicitLoc);
      const reportStatus = (r.uploadedFiles || []).length > 0 ? 'Reported' : 'Not yet';
      const { start: winStart, end: winEnd } = taskWindowDates(r.taskId);
      if (tab === 'pm') {
        const assets = Array.isArray((r as any).assets) ? (r as any).assets : [];
        const totalDevicesThisReport = assets.length > 0 ? assets.length : 1;
        row([
          String(totalDevicesThisReport),
          site,
          location,
          getEngineerDisplay(r),
          winStart,
          winEnd,
          'Done',
          reportStatus,
          (r.comment || '').replace(/\n/g, ' '),
        ]);
        return;
      }
      const assets: any[] = Array.isArray((r as any).assets) ? (r as any).assets : [];
      const taskRepId = (r as any).replacementDeviceId ?? (r as any).replacement_device_id;
      const origNames: string[] = [];
      const origAssets: string[] = [];
      const origSerials: string[] = [];
      const origModels: string[] = [];
      const repSerials: string[] = [];
      const repModels: string[] = [];
      const repAssetNums: string[] = [];
      const newSites: string[] = [];
      const newLocations: string[] = [];
      assets.forEach((a: any, i: number) => {
        const origName = a?.name ?? a?.CI_Name ?? a?.Asset_Number ?? a?.serial ?? '';
        const origAsset = a?.Asset_Number ?? a?.assetNumber ?? '';
        const origSerial = a?.serial ?? a?.serialNumber ?? '';
        const origModel = (a?.model ?? a?.type ?? '').toString().trim();
        if (origName) origNames.push(origName);
        if (origAsset) origAssets.push(origAsset);
        if (origSerial) origSerials.push(origSerial);
        if (origModel) origModels.push(origModel);
        const rid = a?.replacementDeviceId ?? a?.replacement_device_id ?? (i === 0 ? taskRepId : null);
        const repInfo = rid != null ? replacementPlaceMap[String(rid)] : null;
        if (rid != null && repInfo) {
          repSerials.push(repInfo.serial);
          repModels.push(repInfo.model);
          repAssetNums.push(repInfo.assetNumber);
          newSites.push(repInfo.site);
          newLocations.push(repInfo.location);
        }
      });
      if (repSerials.length === 0 && taskRepId != null && replacementPlaceMap[String(taskRepId)]) {
        const p = replacementPlaceMap[String(taskRepId)];
        repSerials.push(p.serial);
        repModels.push(p.model);
        repAssetNums.push(p.assetNumber);
        newSites.push(p.site);
        newLocations.push(p.location);
      }
      const assetStr = origAssets.length > 0 ? origAssets.join('; ') : String(dev?.Asset_Number ?? r.device?.Asset_Number ?? '-');
      const serialStr = origSerials.length > 0 ? origSerials.join('; ') : String(dev?.serial ?? r.device?.serial ?? '-');
      const modelStr =
        origModels.length > 0
          ? origModels.join('; ')
          : String((dev as Record<string, unknown> | undefined)?.model ?? (r.device as { model?: string } | undefined)?.model ?? '').trim() || '-';
      const replaceDeviceStr = repSerials.length > 0 ? repSerials.join('; ') : '-';
      const replaceModelStr = repModels.length > 0 ? repModels.join('; ') : '-';
      const replaceAssetStr = repAssetNums.length > 0 ? repAssetNums.join('; ') : '-';
      const newSiteStr = newSites.length > 0 ? newSites.join('; ') : '-';
      const newLocationStr = newLocations.length > 0 ? newLocations.join('; ') : '-';
      const maR = r as MAReport;
      const repairCell = buildRepairNoticeCsvCell(
        {
          taskId: maR.taskId,
          repairNoticePaths: getMaExportRepairPaths(maR),
        } as MAReport,
        { ticket: maR.ticket != null ? String(maR.ticket) : '', site },
        repairNoticeExcelSeq
      );
      row([
        serialStr,
        modelStr,
        assetStr,
        site,
        location,
        getEngineerDisplay(r),
        winStart,
        winEnd,
        replaceDeviceStr,
        replaceModelStr,
        replaceAssetStr,
        newSiteStr,
        newLocationStr,
        maR.vendorName ?? '',
        maR.vendorTel ?? '',
        maR.reporterName ?? '',
        maR.reporterTel ?? '',
        maR.ticket ?? '',
        'Done',
        reportStatus,
        repairCell,
        (r.comment || '').replace(/\n/g, ' '),
      ]);
    });

    pendingExport.forEach((task: any) => {
      const assets: any[] = Array.isArray(task?.assets) ? task.assets : [];
      const first = assets[0];
      const rawSiteLabel =
        task?.siteName != null && String(task.siteName).trim() !== ''
          ? String(task.siteName)
          : first?.Sitename != null
            ? String(first.Sitename)
            : '';
      const explicitLocFromAsset =
        first?.Location2 != null
          ? String(first.Location2)
          : first?.location != null
            ? String(first.location)
            : '';
      const { site: siteFromTask, location: locationFromTask } = exportSiteAndLocation(
        rawSiteLabel,
        explicitLocFromAsset
      );
      const engDisplay = getEngineerDisplay({
        engineers: task?.engineers,
        technicianName: task?.technicianName,
      } as PMReport);
      if (tab === 'pm') {
        const totalDevicesThisReport = assets.length > 0 ? assets.length : 1;
        row([
          String(totalDevicesThisReport),
          siteFromTask,
          locationFromTask,
          engDisplay,
          formatExportDate(task?.startDate),
          formatExportDate(task?.endDate),
          formatTaskStatusForCsv(task?.status),
          'Not yet',
          String(task?.notes ?? '')
            .replace(/\n/g, ' '),
        ]);
        return;
      }
      const taskRepId = task?.replacementDeviceId ?? task?.replacement_device_id;
      const origSerials: string[] = [];
      const origModels: string[] = [];
      const origAssetNums: string[] = [];
      const repSerials: string[] = [];
      const repModels: string[] = [];
      const repAssetNumsRepl: string[] = [];
      const newSites: string[] = [];
      const newLocations: string[] = [];
      assets.forEach((a: any, i: number) => {
        const origSerial = a?.serial ?? a?.serialNumber ?? '';
        if (origSerial) origSerials.push(origSerial);
        const om = (a?.model ?? a?.type ?? '').toString().trim();
        if (om) origModels.push(om);
        const an = (a?.Asset_Number ?? a?.assetNumber ?? '').toString().trim();
        if (an) origAssetNums.push(an);
        const rid = a?.replacementDeviceId ?? a?.replacement_device_id ?? (i === 0 ? taskRepId : null);
        const repInfo = rid != null ? replacementPlaceMap[String(rid)] : null;
        if (rid != null && repInfo) {
          repSerials.push(repInfo.serial);
          repModels.push(repInfo.model);
          repAssetNumsRepl.push(repInfo.assetNumber);
          newSites.push(repInfo.site);
          newLocations.push(repInfo.location);
        }
      });
      if (repSerials.length === 0 && taskRepId != null && replacementPlaceMap[String(taskRepId)]) {
        const p = replacementPlaceMap[String(taskRepId)];
        repSerials.push(p.serial);
        repModels.push(p.model);
        repAssetNumsRepl.push(p.assetNumber);
        newSites.push(p.site);
        newLocations.push(p.location);
      }
      const serialStr = origSerials.length > 0 ? origSerials.join('; ') : '-';
      const modelStr = origModels.length > 0 ? origModels.join('; ') : '-';
      const assetNumStr =
        origAssetNums.length > 0
          ? origAssetNums.join('; ')
          : String(first?.Asset_Number ?? first?.assetNumber ?? '-');
      const replaceDeviceStr = repSerials.length > 0 ? repSerials.join('; ') : '-';
      const replaceModelStr = repModels.length > 0 ? repModels.join('; ') : '-';
      const replaceAssetStr = repAssetNumsRepl.length > 0 ? repAssetNumsRepl.join('; ') : '-';
      const newSiteStr = newSites.length > 0 ? newSites.join('; ') : '-';
      const newLocationStr = newLocations.length > 0 ? newLocations.join('; ') : '-';
      const photosArr = normalizeRepairPathsFromPhotos(task?.photos);
      const repairCell = buildRepairNoticeCsvCell(
        {
          taskId: task?.id,
          repairNoticePaths: photosArr,
        } as MAReport,
        {
          ticket: task?.ticket != null ? String(task.ticket) : '',
          site: siteFromTask,
        },
        repairNoticeExcelSeq
      );
      row([
        serialStr,
        modelStr,
        assetNumStr,
        siteFromTask,
        locationFromTask,
        engDisplay,
        formatExportDate(task?.startDate),
        formatExportDate(task?.endDate),
        replaceDeviceStr,
        replaceModelStr,
        replaceAssetStr,
        newSiteStr,
        newLocationStr,
        task?.vendorName ?? '',
        task?.vendorTel ?? '',
        task?.reporterName ?? '',
        task?.reporterTel ?? '',
        task?.ticket ?? '',
        formatTaskStatusForCsv(task?.status),
        'Not yet',
        repairCell,
        String(task?.notes ?? '')
          .replace(/\n/g, ' '),
      ]);
    });

    const csv = lines.join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskLabel}_Checklist_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [downloadingImages, setDownloadingImages] = useState(false);
  const [showSiteImageMenu, setShowSiteImageMenu] = useState(false);
  const getVisitDate = (r: PMReport | MAReport) => {
    const d = r[dateKey as keyof typeof r];
    return d && typeof d === 'string' ? d.slice(0, 10) : '';
  };

  const buildFilesBySiteMap = (sourceReports: (PMReport | MAReport)[]) => {
    const bySite = new Map<string, Array<{ path: string; name: string; siteLocation: string; location: string; visitRound: string; type?: string }>>();
    sourceReports.forEach((r: PMReport | MAReport) => {
      const siteLocation = (r.device?.Sitename ?? '').toString().trim() || 'Unknown';
      const d = r.device as { Location2?: string; location2?: string } | undefined;
      const location = (d?.Location2 ?? d?.location2 ?? '').toString().trim() || 'Unknown';
      const visitRound = getVisitDate(r) || 'Unknown';
      (r.uploadedFiles || []).forEach((f) => {
        const path = typeof f === 'string' ? f : f?.path;
        const name = typeof f === 'object' && f?.name ? f.name : path?.split('/').pop() || 'file';
        const fileType = typeof f === 'object' ? f?.type : undefined;
        if (path) {
          const list = bySite.get(siteLocation) ?? [];
          list.push({ path, name, siteLocation, location, visitRound, type: fileType });
          bySite.set(siteLocation, list);
        }
      });
    });
    return bySite;
  };

  const getDownloadLocationKey = (siteName: string, location: string) => `${siteName}|||${location}`;

  const safeZipEntryPart = (s: string) =>
    (s || '')
      .normalize('NFC')
      .replace(/[\u0000-\u001f]/g, '_')
      .replace(/[/\\?*|"<>:]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Unknown';

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const getNormalizedVisitDate = (visitRound: string, fallbackYear?: string) =>
    (visitRound && /^\d{4}-\d{2}-\d{2}$/.test(visitRound))
      ? visitRound
      : `${fallbackYear || String(new Date().getFullYear())}-01-01`;

  const getRoundMapBySiteLocationDate = <T extends { siteLocation: string; location: string; visitRound: string; name?: string; path?: string }>(
    files: T[],
    fallbackYear?: string
  ) => {
    const filesByPair = new Map<string, T[]>();
    files.forEach((file) => {
      const pairKey = getDownloadLocationKey(file.siteLocation, file.location);
      const existing = filesByPair.get(pairKey) ?? [];
      existing.push(file);
      filesByPair.set(pairKey, existing);
    });

    const roundMap = new Map<T, number>();
    filesByPair.forEach((pairFiles) => {
      [...pairFiles]
        .sort((a, b) =>
          getNormalizedVisitDate(a.visitRound, fallbackYear).localeCompare(getNormalizedVisitDate(b.visitRound, fallbackYear))
          || String(a.name || '').localeCompare(String(b.name || ''))
          || String(a.path || '').localeCompare(String(b.path || ''))
        )
        .forEach((file, index) => {
          roundMap.set(file, index + 1);
        });
    });
    return roundMap;
  };

  const getFilesFromReports = (sourceReports: (PMReport | MAReport)[]) => {
    const files: Array<{ path: string; name: string; siteLocation: string; location: string; visitRound: string; type?: string }> = [];
    sourceReports.forEach((r: PMReport | MAReport) => {
      const siteLocation = (r.device?.Sitename ?? '').toString().trim() || 'Unknown';
      const d = r.device as { Location2?: string; location2?: string } | undefined;
      const location = (d?.Location2 ?? d?.location2 ?? '').toString().trim() || 'Unknown';
      const visitRound = getVisitDate(r) || 'Unknown';
      (r.uploadedFiles || []).forEach((f) => {
        const path = typeof f === 'string' ? f : f?.path;
        const name = typeof f === 'object' && f?.name ? f.name : path?.split('/').pop() || 'file';
        const fileType = typeof f === 'object' ? f?.type : undefined;
        if (path) {
          files.push({ path, name, siteLocation, location, visitRound, type: fileType });
        }
      });
    });
    return files;
  };

  const downloadZipForSOF = async (sofName: string, sourceReports: (PMReport | MAReport)[]) => {
    const sofReports = sourceReports.filter(
      (r: PMReport | MAReport) =>
        (r.device?.Refer_SOF ?? '').toString().trim() === sofName ||
        (sofName === 'Unknown SOF' && !(r.device?.Refer_SOF ?? '').toString().trim())
    );
    const bySite = buildFilesBySiteMap(sofReports);
    if (bySite.size === 0) {
      toastWarning(`No files (images/PDFs) for SOF: ${sofName}`);
      return;
    }
    const taskLabel = tab === 'pm' ? 'PM' : 'MA';
    const safe = (s: string) => s.replace(/[/\\?*|"<>:]/g, '_').replace(/\s+/g, '_') || 'Unknown';
    const getExt = (name: string, type?: string) => name?.match(/\.\w+$/)?.[0] || (type === 'pdf' ? '.pdf' : '.jpg');
    const yearDefault = String(new Date().getFullYear());

    for (const [siteName, allFiles] of bySite.entries()) {
      const siteReports = sofReports.filter(
        (r) => ((r.device?.Sitename ?? '').toString().trim() || 'Unknown') === siteName
      );
      const year = (() => {
        const dates = siteReports.map((r) => getVisitDate(r)).filter(Boolean);
        if (dates.length > 0) return dates[0].slice(0, 4);
        return yearDefault;
      })();
      const roundCount = (() => {
        const yearDates = new Set(
          siteReports.map((r) => getVisitDate(r)).filter((d) => d && d.startsWith(year))
        );
        return yearDates.size || 1;
      })();
      const locationName = (() => {
        const d = siteReports[0]?.device as { Location2?: string; location2?: string } | undefined;
        const loc = d?.Location2 ?? d?.location2 ?? '';
        return (loc && typeof loc === 'string' ? loc : String(loc || '')).trim() || 'Unknown';
      })();

      const roundMap = getRoundMapBySiteLocationDate(allFiles, year);
      const zip = new JSZip();
      const sofFolder = zip.folder(sofName.replace(/[/\\?*|"<>]/g, '_') || 'Unknown_SOF');
      if (!sofFolder) continue;
      for (let i = 0; i < allFiles.length; i++) {
        const f = allFiles[i];
        const visitDate = getNormalizedVisitDate(f.visitRound, year);
        const n = roundMap.get(f) ?? 1;
        try {
          const res = await fetch(apiUrl(f.path));
          if (res.ok) {
            const blob = await res.blob();
            const ext = getExt(f.name, f.type);
            const safeFileName = `${safe(f.siteLocation)}_${safe(f.location)}_${safe(f.visitRound)}_รอบที่${n}${ext}`;
            sofFolder.file(safeFileName, blob);
          }
        } catch {
          // skip failed fetch
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, `${taskLabel}_${year}_SOF_${safe(sofName)}_Site_${safe(siteName)}_Location_${safe(locationName)}_รอบที่${roundCount}.zip`);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const downloadZipForSite = async (siteName: string, sourceReports: (PMReport | MAReport)[], locationFilter?: string) => {
    const siteReports = sourceReports.filter(
      (r: PMReport | MAReport) => {
        const reportSite = ((r.device?.Sitename ?? '').toString().trim() || 'Unknown');
        const reportLocation = (((r.device as { Location2?: string; location2?: string } | undefined)?.Location2
          ?? (r.device as { Location2?: string; location2?: string } | undefined)?.location2
          ?? '').toString().trim() || 'Unknown');
        return reportSite === siteName && (!locationFilter || reportLocation === locationFilter);
      }
    );
    const allFiles = getFilesFromReports(siteReports);
    if (allFiles.length === 0) {
      toastWarning(
        locationFilter
          ? `No files (images/PDFs) for Site: ${siteName} / Location: ${locationFilter}`
          : `No files (images/PDFs) for Site: ${siteName}`
      );
      return;
    }
    const taskLabel = tab === 'pm' ? 'PM' : 'MA';
    const safe = (s: string) => s.replace(/[/\\?*|"<>:]/g, '_').replace(/\s+/g, '_') || 'Unknown';
    const getExt = (name: string, type?: string) => name?.match(/\.\w+$/)?.[0] || (type === 'pdf' ? '.pdf' : '.jpg');
    const year = (() => {
      const dates = siteReports.map((r) => getVisitDate(r)).filter(Boolean);
      return dates.length > 0 ? dates[0].slice(0, 4) : String(new Date().getFullYear());
    })();
    const roundCount = (() => {
      const yearDates = new Set(siteReports.map((r) => getVisitDate(r)).filter((d) => d && d.startsWith(year)));
      return yearDates.size || 1;
    })();
    const locationName = locationFilter || (() => {
      const d = siteReports[0]?.device as { Location2?: string; location2?: string } | undefined;
      const loc = d?.Location2 ?? d?.location2 ?? '';
      return (loc && typeof loc === 'string' ? loc : String(loc || '')).trim() || 'Unknown';
    })();

    const roundMap = getRoundMapBySiteLocationDate(allFiles, year);
    const zip = new JSZip();
    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      const visitDate = getNormalizedVisitDate(f.visitRound, year);
      const n = roundMap.get(f) ?? 1;
      try {
        const res = await fetch(apiUrl(f.path));
        if (res.ok) {
          const blob = await res.blob();
          const ext = getExt(f.name, f.type);
          const safeFileName = `${safe(f.siteLocation)}_${safe(f.location)}_${safe(f.visitRound)}_รอบที่${n}${ext}`;
          zip.file(safeFileName, blob);
        }
      } catch {
        // skip failed fetch
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(zipBlob, `${taskLabel}_${year}_Site_${safe(siteName)}_Location_${safe(locationName)}_รอบที่${roundCount}.zip`);
  };

  const downloadZipForSelectedLocations = async (
    selections: Array<{ siteName: string; location: string }>,
    sourceReports: (PMReport | MAReport)[]
  ) => {
    if (selections.length === 0) {
      toastWarning('No locations selected for download');
      return;
    }

    const taskLabel = tab === 'pm' ? 'PM' : 'MA';
    const safe = (s: string) => s.replace(/[/\\?*|"<>:]/g, '_').replace(/\s+/g, '_') || 'Unknown';
    const getExt = (name: string, type?: string) => name?.match(/\.\w+$/)?.[0] || (type === 'pdf' ? '.pdf' : '.jpg');
    const zip = new JSZip();
    let addedFiles = 0;

    for (const selection of selections) {
      const locationReports = sourceReports.filter((r: PMReport | MAReport) => {
        const reportSite = ((r.device?.Sitename ?? '').toString().trim() || 'Unknown');
        const reportLocation = (((r.device as { Location2?: string; location2?: string } | undefined)?.Location2
          ?? (r.device as { Location2?: string; location2?: string } | undefined)?.location2
          ?? '').toString().trim() || 'Unknown');
        return reportSite === selection.siteName && reportLocation === selection.location;
      });

      const allFiles = getFilesFromReports(locationReports);
      if (allFiles.length === 0) continue;

      const year = (() => {
        const dates = locationReports.map((r) => getVisitDate(r)).filter(Boolean).sort((a, b) => a.localeCompare(b));
        return dates.length > 0 ? dates[0].slice(0, 4) : String(new Date().getFullYear());
      })();
      const roundMap = getRoundMapBySiteLocationDate(allFiles, year);

      for (const f of allFiles) {
        const visitDate = getNormalizedVisitDate(f.visitRound, year);
        const n = roundMap.get(f) ?? 1;
        try {
          const res = await fetch(apiUrl(f.path));
          if (res.ok) {
            const blob = await res.blob();
            const ext = getExt(f.name, f.type);
            const baseEntryName = `${safeZipEntryPart(selection.siteName)}_${safeZipEntryPart(selection.location)}_${visitDate}_round${n}${ext}`;
            zip.file(baseEntryName, blob, { binary: true });
            addedFiles += 1;
          }
        } catch {
          // skip failed fetch
        }
      }
    }

    if (addedFiles === 0) {
      toastWarning('No files found for selected locations');
      return;
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const zipBuffer = Uint8Array.from(zipBytes);
    triggerBlobDownload(
      new Blob([zipBuffer], { type: 'application/zip' }),
      `${taskLabel}_Selected_Locations_${new Date().toISOString().slice(0, 10)}.zip`
    );
  };

  // ดาวน์โหลดไฟล์ (รูป/PDF) แยกตาม SOF → แยก zip ต่อ Site; รอบที่ X ต่อ SOF+Site; ใช้กับทั้ง PM และ MA ตาม tab ปัจจุบัน
  const handleDownloadImagesBySOF = async (sofName: string) => {
    setDownloadingImages(true);
    setShowSiteImageMenu(false);
    setIsDownloadFilesModalOpen(false);
    try {
      await downloadZipForSOF(sofName, downloadSourceReports);
    } catch (e) {
      console.error(e);
      toastError('Error downloading images');
    } finally {
      setDownloadingImages(false);
    }
  };

  const handleDownloadImagesBySite = async (siteName: string) => {
    setDownloadingImages(true);
    setShowSiteImageMenu(false);
    setIsDownloadFilesModalOpen(false);
    try {
      await downloadZipForSite(siteName, downloadSourceReports);
    } catch (e) {
      console.error(e);
      toastError('Error downloading images');
    } finally {
      setDownloadingImages(false);
    }
  };

  const sofsWithImages = useMemo(() => {
    const map = new Map<string, { count: number; items: Array<{ siteName: string; visitDate: string }> }>();
    downloadSourceReports.forEach((r: PMReport | MAReport) => {
      const sof = (r.device?.Refer_SOF ?? '').toString().trim() || 'Unknown SOF';
      const fileCount = (r.uploadedFiles || []).filter((f) => {
        const path = typeof f === 'string' ? f : f?.path;
        return !!path;
      }).length;
      if (fileCount > 0) {
        const siteName = r.device?.Sitename || 'Unknown';
        const visitDate = getVisitDate(r);
        const existing = map.get(sof);
        if (!existing) {
          map.set(sof, { count: fileCount, items: [{ siteName, visitDate }] });
        } else {
          existing.count += fileCount;
          if (!existing.items.some((i) => i.siteName === siteName && i.visitDate === visitDate)) {
            existing.items.push({ siteName, visitDate });
          }
        }
      }
    });
    return Array.from(map.entries())
      .map(([sofName, { count, items }]) => ({ sofName, count, items }))
      .sort((a, b) => b.count - a.count);
  }, [downloadSourceReports, tab]);

  const sitesWithImages = useMemo(() => {
    const map = new Map<string, { count: number; items: Array<{ sofName: string; visitDate: string }> }>();
    downloadSourceReports.forEach((r: PMReport | MAReport) => {
      const siteName = (r.device?.Sitename ?? '').toString().trim() || 'Unknown';
      const sofName = (r.device?.Refer_SOF ?? '').toString().trim() || 'Unknown SOF';
      const fileCount = (r.uploadedFiles || []).filter((f) => {
        const path = typeof f === 'string' ? f : f?.path;
        return !!path;
      }).length;
      if (fileCount > 0) {
        const visitDate = getVisitDate(r);
        const existing = map.get(siteName);
        if (!existing) {
          map.set(siteName, { count: fileCount, items: [{ sofName, visitDate }] });
        } else {
          existing.count += fileCount;
          if (!existing.items.some((i) => i.sofName === sofName && i.visitDate === visitDate)) {
            existing.items.push({ sofName, visitDate });
          }
        }
      }
    });
    return Array.from(map.entries())
      .map(([siteName, { count, items }]) => ({ siteName, count, items }))
      .sort((a, b) => b.count - a.count);
  }, [downloadSourceReports, tab]);

  const downloadModalSites = useMemo(() => {
    const locationMap = new Map<string, {
      key: string;
      siteName: string;
      location: string;
      fileCount: number;
      sofNames: Set<string>;
      visitDates: Set<string>;
    }>();
    downloadSourceReports.forEach((r: PMReport | MAReport) => {
      const siteName = (r.device?.Sitename ?? '').toString().trim() || 'Unknown';
      const location = ((r.device as { Location2?: string; location2?: string } | undefined)?.Location2
        ?? (r.device as { Location2?: string; location2?: string } | undefined)?.location2
        ?? '').toString().trim() || 'Unknown';
      const sofName = (r.device?.Refer_SOF ?? '').toString().trim() || 'Unknown SOF';
      const fileCount = (r.uploadedFiles || []).filter((f) => {
        const path = typeof f === 'string' ? f : f?.path;
        return !!path;
      }).length;
      if (fileCount <= 0) return;
      const visitDate = getVisitDate(r) || '-';
      const key = getDownloadLocationKey(siteName, location);
      const existing = locationMap.get(key) ?? {
        key,
        siteName,
        location,
        fileCount: 0,
        sofNames: new Set<string>(),
        visitDates: new Set<string>(),
      };
      existing.fileCount += fileCount;
      existing.sofNames.add(sofName);
      existing.visitDates.add(visitDate);
      locationMap.set(key, existing);
    });

    const q = downloadSiteSearch.trim().toLowerCase();
    let list = Array.from(locationMap.values());
    if (q) {
      list = list.filter((row) =>
        row.siteName.toLowerCase().includes(q) || row.location.toLowerCase().includes(q)
      );
    }
    if (downloadLocationFilter) {
      list = list.filter((row) => row.location === downloadLocationFilter);
    }
    if (downloadSofFilter) {
      const selectedSof = downloadSofFilter.trim();
      list = list.filter((row) => row.sofNames.has(selectedSof));
    }
    return list
      .map((row) => ({
        key: row.key,
        siteName: row.siteName,
        location: row.location,
        fileCount: row.fileCount,
        sofCount: row.sofNames.size,
        visitCount: Array.from(row.visitDates).filter((v) => v && v !== '-').length,
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName) || a.location.localeCompare(b.location));
  }, [downloadSourceReports, downloadSiteSearch, downloadLocationFilter, downloadSofFilter, dateKey]);

  const downloadLocationOptions = useMemo(
    () => Array.from(new Set(downloadSourceReports.map((r) => (((r.device as { Location2?: string; location2?: string } | undefined)?.Location2
      ?? (r.device as { Location2?: string; location2?: string } | undefined)?.location2
      ?? '').toString().trim() || 'Unknown')))).sort((a, b) => a.localeCompare(b)),
    [downloadSourceReports]
  );
  const downloadSofOptions = useMemo(
    () => Array.from(new Set(downloadSourceReports.map((r) => ((r.device?.Refer_SOF ?? '').toString().trim() || 'Unknown SOF'))))
      .sort((a, b) => a.localeCompare(b)),
    [downloadSourceReports]
  );

  const downloadModalTotal = downloadModalSites.length;
  const downloadModalTotalPages = Math.max(1, Math.ceil(downloadModalTotal / DOWNLOAD_MODAL_PAGE_SIZE));
  const downloadModalCurrentPage = Math.min(downloadModalPage, downloadModalTotalPages);
  const downloadModalSitePageItems = downloadModalSites.slice(
    (downloadModalCurrentPage - 1) * DOWNLOAD_MODAL_PAGE_SIZE,
    downloadModalCurrentPage * DOWNLOAD_MODAL_PAGE_SIZE
  );
  const downloadModalSitePageGroups = downloadModalSitePageItems.reduce<Array<{
    siteName: string;
    rows: typeof downloadModalSitePageItems;
  }>>((groups, row) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.siteName === row.siteName) {
      lastGroup.rows.push(row);
    } else {
      groups.push({ siteName: row.siteName, rows: [row] });
    }
    return groups;
  }, []);
  const downloadModalLocationRows = downloadModalSites;
  const downloadModalSelectedCount = downloadModalLocationRows.reduce((n, row) => n + (downloadSiteSelected.has(row.key) ? 1 : 0), 0);
  const downloadModalAllPageSelected =
    downloadModalSitePageItems.length > 0 && downloadModalSitePageItems.every((row) => downloadSiteSelected.has(row.key));

  const openDownloadFilesModal = () => {
    setDownloadSiteSearch('');
    setDownloadSofFilter('');
    setDownloadLocationFilter('');
    setDownloadModalPage(1);
    setDownloadSiteSelected(new Set(downloadModalSites.map((row) => row.key)));
    setIsDownloadFilesModalOpen(true);
  };

  const getDownloadLocationKeysBySite = (siteName: string) =>
    downloadModalSites
      .filter((row) => row.siteName === siteName)
      .map((row) => row.key);

  const toggleDownloadSiteGroup = (siteName: string) => {
    const siteKeys = getDownloadLocationKeysBySite(siteName);
    setDownloadSiteSelected((prev) => {
      const next = new Set(prev);
      const allSelected = siteKeys.length > 0 && siteKeys.every((key) => next.has(key));
      for (const key of siteKeys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const toggleDownloadLocation = (locationKey: string) => {
    setDownloadSiteSelected((prev) => {
      const next = new Set(prev);
      if (next.has(locationKey)) next.delete(locationKey);
      else next.add(locationKey);
      return next;
    });
  };

  const toggleDownloadSitePage = (checked: boolean) => {
    setDownloadSiteSelected((prev) => {
      const next = new Set(prev);
      for (const row of downloadModalSitePageItems) {
        if (checked) next.add(row.key);
        else next.delete(row.key);
      }
      return next;
    });
  };

  const handleDownloadSelectedSites = async () => {
    const selectedInFilter = downloadModalSites.filter((row) => downloadSiteSelected.has(row.key));
    const toDownload = selectedInFilter.length > 0
      ? selectedInFilter
      : downloadModalSites;
    if (toDownload.length === 0) {
      toastWarning('No sites or locations to download for current filter');
      return;
    }
    setDownloadingImages(true);
    setIsDownloadFilesModalOpen(false);
    try {
      await downloadZipForSelectedLocations(
        toDownload.map((row) => ({ siteName: row.siteName, location: row.location })),
        downloadSourceReports
      );
    } catch (e) {
      console.error(e);
      toastError('Error downloading images');
    } finally {
      setDownloadingImages(false);
    }
  };

  useEffect(() => {
    if (!isDownloadFilesModalOpen) return;
    setDownloadModalPage(1);
  }, [downloadSiteSearch, downloadLocationFilter, downloadSofFilter, isDownloadFilesModalOpen]);

  // ดาวน์โหลดทั้งหมด — zip เดียว ข้างในโครงสร้าง SOF / Site / file_วันที่ไป_รอบที่X (รอบที่ของ site นั้นๆ)
  const handleDownloadAllSites1Site1SOF = async () => {
    setDownloadingImages(true);
    setShowSiteImageMenu(false);
    try {
      const taskLabel = tab === 'pm' ? 'PM' : 'MA';
      const year = String(new Date().getFullYear());
      const safe = (s: string) => s.replace(/[/\\?*|"<>:]/g, '_').replace(/\s+/g, '_') || 'Unknown';
      const getExt = (name: string, type?: string) => name?.match(/\.\w+$/)?.[0] || (type === 'pdf' ? '.pdf' : '.jpg');

      const zip = new JSZip();

      for (const { sofName } of sofsWithImages) {
        const sofReports = downloadSourceReports.filter(
          (r: PMReport | MAReport) => (r.device?.Refer_SOF ?? '').toString().trim() === sofName || (sofName === 'Unknown SOF' && !(r.device?.Refer_SOF ?? '').toString().trim())
        );
        const bySite = buildFilesBySiteMap(sofReports);

        const sofFolder = zip.folder(safe(sofName) || 'Unknown_SOF');
        if (!sofFolder) continue;

        for (const [siteName, allFiles] of bySite.entries()) {
          const siteReports = sofReports.filter(
            (r) => ((r.device?.Sitename ?? '').toString().trim() || 'Unknown') === siteName
          );
          const roundMap = getRoundMapBySiteLocationDate(allFiles, year);

          const siteFolder = sofFolder.folder(safe(siteName) || 'Unknown_Site');
          if (!siteFolder) continue;

          for (let i = 0; i < allFiles.length; i++) {
            const f = allFiles[i];
            const visitDate = getNormalizedVisitDate(f.visitRound, year);
            const n = roundMap.get(f) ?? 1;
            try {
              const res = await fetch(apiUrl(f.path));
              if (res.ok) {
                const blob = await res.blob();
                const ext = getExt(f.name, f.type);
                const fileName = `${safe(f.siteLocation)}_${safe(f.location)}_${visitDate}_รอบที่${n}${ext}`;
                siteFolder.file(fileName, blob);
              }
            } catch {
              // skip
            }
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, `${taskLabel}_${year}_SOF_All_Site_All_รายการทั้งหมด.zip`);
    } catch (e) {
      console.error(e);
      toastError('Error downloading images');
    } finally {
      setDownloadingImages(false);
    }
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
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
                    ? 'Checking tasks...'
                    : remainingPMTasks.length === 0 && remainingMATasks.length === 0
                    ? 'There are no tasks that do not yet have a report to create.'
                    : ''
                }
              >
                <Plus size={20} />
                Create a Report
                <ChevronDown size={18} className={`transition-transform duration-200 ${showCreateMenu ? 'rotate-180' : ''}`} />
              </button>
              {showCreateMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCreateMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 z-20 overflow-hidden backdrop-blur-sm">
                  <div className="p-2 bg-slate-50/80 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500 px-2">Select report type</p>
                  </div>
                  <button
                    onClick={handleCreatePM}
                    disabled={remainingPMTasks.length === 0}
                    className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                      remainingPMTasks.length === 0
                        ? 'text-slate-400 cursor-not-allowed opacity-60'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    title={remainingPMTasks.length === 0 ? 'No PM tasks available' : ''}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800">Report PM</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {remainingPMTasks.length === 0 ? 'All tasks completed' : 'Preventive Maintenance'}
                      </div>
                    </div>
                    {remainingPMTasks.length > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium shrink-0">
                        {remainingPMTasks.length} tasks remaining
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
                    title={remainingMATasks.length === 0 ? 'No MA tasks available' : ''}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800">Report MA</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {remainingMATasks.length === 0 ? 'All tasks completed' : 'Maintenance Agreement'}
                      </div>
                    </div>
                    {remainingMATasks.length > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium shrink-0">
                        {remainingMATasks.length} tasks remaining
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Tab Buttons + Export CSV + Download files by SOF — แถวเดียวกัน */}
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
          <div className="flex gap-2 p-1.5 bg-white/80 rounded-2xl border border-slate-200/80 shadow-sm w-fit">
            <button
              onClick={() => setTabAndUrl('ma')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 ${
                tab === 'ma'
                  ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-md shadow-blue-400/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Report MA
            </button>
            <button
              onClick={() => setTabAndUrl('pm')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 ${
                tab === 'pm'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Report PM
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              disabled={loading || (filteredReports.length === 0 && exportablePendingCount === 0)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Export data to CSV"
            >
              <Upload size={18} />
              {selectedReportsArray.length > 0
                ? `Export ${selectedReportsArray.length} selected`
                : 'Export CSV'}
            </button>
            <button
              onClick={openDownloadFilesModal}
              disabled={loading || downloadSourceReports.length === 0 || downloadingImages}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Choose locations to download files"
            >
              {downloadingImages && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <Download size={16} />
              Download files
            </button>
          </div>
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

        {/* Report list */}
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
              {searchTerm ? 'Searched item was not found' : ` There are no reports for ${tab === 'pm' ? 'PM' : 'MA'}`}
            </p>
            <p className="text-slate-500 text-sm mb-6">
              {searchTerm ? 'Try different search terms' : 'Click the "Create New Report"'}
            </p>  
            {!searchTerm && (
              <button
                onClick={() => setShowCreateMenu(true)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors shadow-md"
              >
              Create a Report
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Select / Clear for current page */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        paginatedReports.length > 0 &&
                        paginatedReports.every((r) => selectedReportIds.has(String(r.id)))
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedReportIds((prev) => {
                          const next = new Set(prev);
                          paginatedReports.forEach((r) => {
                            const id = String(r.id);
                            if (checked) next.add(id);
                            else next.delete(id);
                          });
                          return next;
                        });
                      }}
                      className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-600">Select all on page</span>
                  </label>
                  {selectedReportsArray.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedReportIds(new Set())}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Clear selection ({selectedReportsArray.length})
                    </button>
                  )}
                </div>
                {selectedReportsArray.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {selectedReportsArray.length} selected
                  </span>
                )}
              </div>

              {paginatedReports.map((report: PMReport | MAReport) => {
                const result = report[resultKey as keyof typeof report] as string;
                const dateVal = report[dateKey as keyof typeof report] as string | undefined;
                const isPM = tab === 'pm';
                const isSelected = selectedReportIds.has(String(report.id));
                return (
                  <div
                    key={report.id}
                    onClick={(e) => {
                      // อย่าทริกเมื่อคลิก checkbox เอง
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      setSelectedReport(report);
                    }}
                    className={`group bg-white/95 backdrop-blur-sm p-4 rounded-xl border shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'border-blue-400 ring-1 ring-blue-200'
                        : 'border-slate-200/80 hover:border-slate-300/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const id = String(report.id);
                              setSelectedReportIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(id);
                                else next.delete(id);
                                return next;
                              });
                            }}
                            className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                              {(() => {
                                if (tab === 'ma' && (report as MAReport).site_name?.trim()) return (report as MAReport).site_name!.trim();
                                const site = report.device?.Sitename || getReportDevices(report)[0]?.Sitename;
                                const loc = (report.device as { Location2?: string })?.Location2 || getReportDevices(report)[0]?.Location2;
                                const fallback = getReportDevices(report).map((d) => (d.CI_Name || d.name || d.Asset_Number || '-')).join(', ') || '-';
                                if (site) return loc ? `${site}, ${loc}` : site;
                                return fallback;
                              })()}
                            </h3>
                            {getReportDevices(report).length > 1 && !(report.device?.Sitename || getReportDevices(report)[0]?.Sitename) && (
                              <p className="text-[10px] text-slate-500 mt-0.5">{getReportDevices(report).length} devices</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                              <User size={12} className="text-slate-500" />
                            </div>
                            <span className="font-medium break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{getEngineerDisplay(report)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                              <Calendar size={12} className="text-slate-500" />
                            </div>
                            <span className="font-medium">{formatDate(dateVal)}</span>
                          </div>
                        {tab === 'ma' && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                              <ClipboardList size={12} className="text-indigo-600" />
                            </div>
                            <span className={`font-bold text-xs px-2 py-1 rounded-md ${
                              result === 'pass'
                                ? 'bg-emerald-50 text-emerald-700'
                                : result === 'warning'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-red-50 text-red-700'
                            }`}>
                              {result === 'pass' ? 'Completed' : result === 'warning' ? 'In Progress' : 'Pending'}
                            </span>
                          </div>
                        )}
                        </div>
                        {/* จำนวนอุปกรณ์ที่ไปทำ และ File ใน card (ไม่โชว์ serial) */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Cpu size={12} className="text-slate-400" />
                            <span>{getReportDevices(report).length} Devices</span>
                          </div>
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
              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  Previous
                </button>
                <span className="px-5 py-2.5 text-sm text-slate-600 font-medium bg-white rounded-xl border border-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {isDownloadFilesModalOpen && (
          <div
            className="fixed inset-0 z-[210] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !downloadingImages) setIsDownloadFilesModalOpen(false);
            }}
          >
            <div className="bg-white w-full max-w-5xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Download Files</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose locations to download files from {selectedReportsArray.length > 0 ? `${selectedReportsArray.length} selected report${selectedReportsArray.length > 1 ? 's' : ''}` : 'current filtered reports'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDownloadFilesModalOpen(false)}
                    disabled={downloadingImages}
                    className="p-2 rounded-full hover:bg-white/70 transition-colors disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {(sofsWithImages.length > 0 || sitesWithImages.length > 0) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadAllSites1Site1SOF}
                      disabled={downloadingImages || downloadSourceReports.length === 0}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Image size={14} />
                      Download all (1 site 1 SOF)
                    </button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Search</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={downloadSiteSearch}
                        onChange={(e) => setDownloadSiteSearch(e.target.value)}
                        placeholder="Search site or location..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-[220px]">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">SOF</label>
                    <div className="relative">
                      <select
                        value={downloadSofFilter}
                        onChange={(e) => setDownloadSofFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                      >
                        <option value="">All SOFs</option>
                        {downloadSofOptions.map((sof) => (
                          <option key={sof} value={sof}>{sof}</option>
                        ))}
                      </select>
                      {downloadSofFilter && (
                        <button
                          type="button"
                          onClick={() => setDownloadSofFilter('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Clear"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full sm:w-[220px]">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Location</label>
                    <div className="relative">
                      <select
                        value={downloadLocationFilter}
                        onChange={(e) => setDownloadLocationFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                      >
                        <option value="">All locations</option>
                        {downloadLocationOptions.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      {downloadLocationFilter && (
                        <button
                          type="button"
                          onClick={() => setDownloadLocationFilter('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Clear"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-full">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Site</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={downloadModalAllPageSelected}
                                onChange={(e) => toggleDownloadSitePage(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span>Location</span>
                            </label>
                          </th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Files</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700">SOFs</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Visits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {downloadModalSitePageGroups.map((group) => {
                          const siteKeys = getDownloadLocationKeysBySite(group.siteName);
                          const allSiteSelected = siteKeys.length > 0 && siteKeys.every((key) => downloadSiteSelected.has(key));
                          return group.rows.map((row, index) => (
                            <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                              {index === 0 && (
                                <td rowSpan={group.rows.length} className="px-3 py-2 font-medium text-slate-800 align-top bg-white">
                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={allSiteSelected}
                                      onChange={() => toggleDownloadSiteGroup(group.siteName)}
                                      className="rounded border-slate-300 mt-0.5"
                                    />
                                    <span>{group.siteName}</span>
                                  </label>
                                </td>
                              )}
                              <td className="px-3 py-2 text-slate-600">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={downloadSiteSelected.has(row.key)}
                                    onChange={() => toggleDownloadLocation(row.key)}
                                    className="rounded border-slate-300"
                                  />
                                  <span>{row.location}</span>
                                </label>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{row.fileCount}</td>
                              <td className="px-3 py-2 text-slate-600">{row.sofCount}</td>
                              <td className="px-3 py-2 text-slate-600">{row.visitCount || '—'}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-slate-600">
                  <span>{downloadModalSelectedCount} of {downloadModalLocationRows.length} locations selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDownloadModalPage((p) => Math.max(1, p - 1))}
                      disabled={downloadModalCurrentPage <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} /> Previous page
                    </button>
                    <span>Page {downloadModalCurrentPage} / {downloadModalTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => setDownloadModalPage((p) => Math.min(downloadModalTotalPages, p + 1))}
                      disabled={downloadModalCurrentPage >= downloadModalTotalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next page <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {downloadModalTotal === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">No locations match the current filter.</p>
                )}

              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
                <button
                  onClick={() => setIsDownloadFilesModalOpen(false)}
                  disabled={downloadingImages}
                  className="px-6 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSelectedSites}
                  disabled={downloadModalSelectedCount === 0 || downloadingImages}
                  className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all flex items-center gap-2 ${
                    downloadModalSelectedCount === 0 || downloadingImages ? 'bg-gray-300 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                >
                  {downloadingImages ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Preparing download...
                    </>
                  ) : (
                    `Download ${downloadModalSelectedCount} selected locations`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report detail modal - Portal above sidebar */}
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
                    {tab === 'ma' && (selectedReport as MAReport).site_name?.trim() && (
                      <p
                        className="text-sm text-slate-500 break-words"
                        style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                      >
                        {(selectedReport as MAReport).site_name!.trim()}
                      </p>
                    )}
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
                {/* Main info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 min-w-0 text-center">
                    <p className="text-xs font-medium text-slate-500 mb-1">Technician</p>
                    <p className="text-sm font-semibold text-slate-800 break-words leading-snug" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{getEngineerDisplay(selectedReport)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <p className="text-xs font-medium text-slate-500 mb-1">{tab === 'pm' ? 'PM Date' : 'MA Date'}</p>
                    <p className="font-semibold text-slate-800">
                      {formatDate(tab === 'pm' ? (selectedReport as PMReport).pmDate : (selectedReport as MAReport).maDate)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <p className="text-xs font-medium text-slate-500 mb-1">Number of Devices</p>
                    <p className="font-semibold text-slate-800">{getReportDevices(selectedReport).length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <p className="text-xs font-medium text-slate-500 mb-1">{tab === 'pm' ? 'Status' : 'Result'}</p>
                    <div className="flex items-center justify-center gap-2">
                      {tab === 'pm' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-emerald-500">
                          Done
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-white ${
                            (selectedReport as MAReport).maResult === 'pass' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        >
                          {(selectedReport as MAReport).maResult === 'pass' ? 'Completed' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* MA: Contract Information */}
                {tab === 'ma' && (() => {
                  const ma = selectedReport as MAReport;
                  const hasContract = ma.vendorName || ma.vendorTel || ma.reporterName || ma.reporterTel || ma.ticket;
                  if (!hasContract) return null;
                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                          <FileText size={20} className="text-slate-600" />
                        </div>
                        <h3 className="font-bold text-slate-800">Contract Information</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ma.vendorName && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Third Party Vendor name</p>
                            <p className="text-sm font-semibold text-slate-800">{ma.vendorName}</p>
                          </div>
                        )}
                        {ma.vendorTel && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Third Party Vendor phone</p>
                            <p className="text-sm font-semibold text-slate-800">{ma.vendorTel}</p>
                          </div>
                        )}
                        {ma.reporterName && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Reporter name</p>
                            <p className="text-sm font-semibold text-slate-800">{ma.reporterName}</p>
                          </div>
                        )}
                        {ma.reporterTel && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Reporter phone</p>
                            <p className="text-sm font-semibold text-slate-800">{ma.reporterTel}</p>
                          </div>
                        )}
                        {ma.ticket && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Ticket</p>
                            <p className="text-sm font-semibold text-slate-800">{ma.ticket}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {tab === 'ma' &&
                  (() => {
                    const ma = selectedReport as MAReport;
                    const fromReport = Array.isArray(ma.repairNoticePaths)
                      ? ma.repairNoticePaths.filter((p): p is string => typeof p === 'string' && !!p.trim())
                      : [];
                    const linkedTask =
                      ma.taskId != null
                        ? pmMaTasks.find((t: { id?: number }) => Number(t?.id) === Number(ma.taskId))
                        : undefined;
                    const fromTask = normalizeRepairPathsFromPhotos(linkedTask?.photos);
                    const repairPaths = fromReport.length > 0 ? fromReport : fromTask;
                    if (repairPaths.length === 0) return null;
                    return (
                      <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                            <Paperclip size={20} className="text-sky-700" />
                          </div>
                          <h3 className="font-bold text-slate-800">Repair notice</h3>
                        </div>
                        <ul className="space-y-2">
                          {repairPaths.map((path) => {
                            const name = path.replace(/^.*[/\\]/, '') || path;
                            const href = /^https?:\/\//i.test(path)
                              ? path
                              : apiUrl(path.startsWith('/') ? path : `/${path}`);
                            return (
                              <li key={path}>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-sky-700 hover:underline break-all"
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

                {/* Device & Replacement Information */}
                {tab === 'ma' && assetPairs.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <FileText size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">Device & Replacement</h3>
                    </div>
                    <div className="space-y-4">
                      {assetPairs.map((pair, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Original Device</p>
                            <p className="text-sm font-semibold text-slate-900 mb-2 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                              {pair.original.name || 'Device'}
                            </p>
                            {pair.original.assetNumber && (
                              <p className="text-xs text-slate-600 mb-1">
                                <span className="font-semibold">Asset:</span> {pair.original.assetNumber}
                              </p>
                            )}
                            {pair.original.serial && (
                              <p className="text-xs text-slate-600 mb-1">
                                <span className="font-semibold">Serial:</span> {pair.original.serial}
                              </p>
                            )}
                            {pair.original.model && (
                              <p className="text-xs text-slate-600 mb-1">
                                <span className="font-semibold">Model:</span> {pair.original.model}
                              </p>
                            )}
                            {pair.original.site && (
                              <p className="text-xs text-slate-600">
                                <span className="font-semibold">Site:</span> {pair.original.site}
                              </p>
                            )}
                          </div>
                          <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/60">
                            <p className="text-xs font-semibold text-emerald-600 mb-1 flex items-center gap-1">
                              <Replace size={14} />
                              Replacement Device
                            </p>
                            {pair.replacement ? (
                              <>
                                <p className="text-sm font-semibold text-slate-900 mb-2 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                  {pair.replacement.name || 'Replacement Device'}
                                </p>
                                {pair.replacement.assetNumber && (
                                  <p className="text-xs text-slate-700 mb-1">
                                    <span className="font-semibold">Asset:</span> {pair.replacement.assetNumber}
                                  </p>
                                )}
                                {pair.replacement.serialNumber && (
                                  <p className="text-xs text-slate-700 mb-1">
                                    <span className="font-semibold">Serial:</span> {pair.replacement.serialNumber}
                                  </p>
                                )}
                                {pair.replacement.type && (
                                  <p className="text-xs text-slate-700 mb-1">
                                    <span className="font-semibold">Model:</span> {pair.replacement.type}
                                  </p>
                                )}
                                {pair.replacement.site && (
                                  <p className="text-xs text-slate-700">
                                    <span className="font-semibold">Site:</span> {pair.replacement.site}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-slate-500">
                                No replacement device linked for this asset.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  selectedReport.device && (() => {
                    const d = selectedReport.device as Record<string, unknown>;
                    const v = (key: string) => (d[key] != null && String(d[key]).trim() !== '' ? String(d[key]) : '—');
                    const fields: { label: string; key: string; icon: React.ReactNode }[] = [
                      { label: 'Site', key: 'Sitename', icon: <MapPin size={12} /> },
                      { label: 'Location', key: 'Location2', icon: <MapPin size={12} /> },
                      { label: 'Refer SOF', key: 'Refer_SOF', icon: <FileText size={12} /> },
                      { label: 'Vendor', key: 'Vendor', icon: <Building2 size={12} /> },
                    ];
                    return (
                      <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <FileText size={20} className="text-indigo-600" />
                          </div>
                          <h3 className="font-bold text-slate-800">Information</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {fields.map(({ label, key, icon }) => (
                            <div key={key}>
                              <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                                {icon}
                                {label}
                              </p>
                              <p className="text-sm font-semibold text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                {v(key)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-sm text-gray-600">กำลังโหลด...</span>
        </div>
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  );
}
