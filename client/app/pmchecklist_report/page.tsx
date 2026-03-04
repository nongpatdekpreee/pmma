'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { getPmReports, getMaReports, getTasks, apiUrl } from '@/lib/api';
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
}

const ITEMS_PER_PAGE = 10;

function ReportPageContent() {
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
  const [replacementDevicesMap, setReplacementDevicesMap] = useState<Record<string, {
    id: string;
    name: string;
    type?: string;
    serialNumber?: string;
    site?: string;
    assetNumber?: string;
  }>>({});

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

  // Fetch tasks with status = 'done'
  useEffect(() => {
    const fetchDoneTasks = async () => {
      setLoadingTasks(true);
      try {
        const res = await getTasks();
        if (res.success && res.data) {
          // Filter tasks with status = 'done' and taskType = 'PM' or 'MA'
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

  const hasDonePMTasks = doneTasks.some((task) => task.taskType === 'PM');
  const hasDoneMATasks = doneTasks.some((task) => task.taskType === 'MA');

  // Tasks without Report (remaining)
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
      alert('No PM tasks available to create a report.');
      return;
    }
    router.push('/pmchecklist_report/add');
  };

  const handleCreateMA = () => {
    setShowCreateMenu(false);
    if (remainingMATasks.length === 0) {
      alert('No MA tasks available to create a report.');
      return;
    }
    router.push('/machecklist_report/add');
  };

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  // Export CSV — ใช้กับทั้ง PM และ MA ตาม tab ปัจจุบัน
  const handleExport = async () => {
    const taskLabel = tab === 'pm' ? 'PM' : 'MA';
    // สำหรับ MA: ดึง replacement device (name, location, site) สำหรับ Replace Device, New Site, New Location
    type ReplacementInfo = { name: string; location: string; site: string };
    let replacementPlaceMap: Record<string, ReplacementInfo> = {};
    if (tab === 'ma') {
      const repIds = new Set<string>();
      filteredReports.forEach((r: PMReport | MAReport) => {
        const assets: any[] = Array.isArray((r as any).assets) ? (r as any).assets : [];
        assets.forEach((a: any) => {
          const rid = a?.replacementDeviceId ?? a?.replacement_device_id;
          if (rid != null && String(rid).trim() !== '') repIds.add(String(rid));
        });
        const taskRepId = (r as any).replacementDeviceId ?? (r as any).replacement_device_id;
        if (taskRepId != null && String(taskRepId).trim() !== '') repIds.add(String(taskRepId));
      });
      await Promise.all(
        Array.from(repIds).map(async (rid) => {
          try {
            const res = await fetch(apiUrl(`/api/devices/${rid}`));
            const json = await res.json();
            if (res.ok && json.data) {
              const d = json.data as Record<string, unknown>;
              const name = (d.CI_Name ?? d.Asset_Number ?? '') as string;
              const location = (d.Location2 ?? d.location2 ?? '') as string;
              const site = (d.Sitename ?? d.site ?? '') as string;
              replacementPlaceMap[rid] = {
                name: String(name || '').trim() || '-',
                location: String(location || '').trim() || '-',
                site: String(site || '').trim() || '-',
              };
            } else {
              replacementPlaceMap[rid] = { name: '-', location: '-', site: '-' };
            }
          } catch {
            replacementPlaceMap[rid] = { name: '-', location: '-', site: '-' };
          }
        })
      );
    }
    const lines: string[] = [];
    const nl = () => lines.push('');
    const row = (arr: string[]) => lines.push(arr.map(escape).join(','));
    const gen = new Date().toISOString().slice(0, 19).replace('T', ' ');
    lines.push(escape(`${taskLabel} Checklist Report - Export (Generated: ${gen})`));
    nl();
    const fileLinksString = (files: PMReport['uploadedFiles']) => {
      if (!files?.length) return '-';
      const urls: string[] = [];
      files.forEach((f: any) => {
        const path = typeof f === 'string' ? f : f?.path;
        if (path) urls.push(apiUrl(path));
      });
      return urls.length > 0 ? urls.join('; ') : '-';
    };
    const pmHeaders = ['Report ID', 'Device', 'Asset Number', 'Site', 'Location', 'Serial', 'Technician', 'PM Date', 'Status', 'Comment', 'Files'];
    const maHeaders = ['Report ID', 'Device', 'Asset Number', 'Site', 'Location', 'Technician', 'MA Date', 'Result', 'Replace Device', 'New Site', 'New Location', 'Third Party Vendor name', 'Third Party Vendor phone', 'Reporter name', 'Reporter phone', 'Ticket', 'Comment', 'Files'];
    const headers = tab === 'ma' ? maHeaders : pmHeaders;
    row(headers);
    filteredReports.forEach((r: PMReport | MAReport) => {
      const dateVal = r[dateKey as keyof typeof r];
      const resultVal = tab === 'pm' ? 'Done' : r[resultKey as keyof typeof r];
      const dev = r.device as Record<string, unknown> | undefined;
      const site = dev?.Sitename != null ? String(dev.Sitename) : '-';
      const location = dev?.Location2 != null ? String(dev.Location2) : '-';
      if (tab === 'pm') {
        row([
          r.id,
          r.device?.CI_Name || r.device?.Asset_Number || '-',
          r.device?.Asset_Number || '-',
          site,
          location,
          r.device?.serial || '-',
          r.technicianName || '-',
          String(dateVal ?? '-'),
          String(resultVal ?? '-'),
          (r.comment || '').replace(/\n/g, ' '),
          fileLinksString(r.uploadedFiles),
        ]);
        return;
      }
      const assets: any[] = Array.isArray((r as any).assets) ? (r as any).assets : [];
      const taskRepId = (r as any).replacementDeviceId ?? (r as any).replacement_device_id;
      const origNames: string[] = [];
      const origAssets: string[] = [];
      const repNames: string[] = [];
      const newSites: string[] = [];
      const newLocations: string[] = [];
      assets.forEach((a: any, i: number) => {
        const origName = a?.name ?? a?.CI_Name ?? a?.Asset_Number ?? a?.serial ?? '';
        const origAsset = a?.Asset_Number ?? a?.assetNumber ?? '';
        if (origName) origNames.push(origName);
        if (origAsset) origAssets.push(origAsset);
        const rid = a?.replacementDeviceId ?? a?.replacement_device_id ?? (i === 0 ? taskRepId : null);
        const repInfo = rid != null ? replacementPlaceMap[String(rid)] : null;
        const repName = repInfo?.name ?? (rid != null ? `Device ${rid}` : '—');
        if (rid != null) {
          repNames.push(repName);
          newSites.push(repInfo?.site ?? '-');
          newLocations.push(repInfo?.location ?? '-');
        }
      });
      if (repNames.length === 0 && taskRepId != null && replacementPlaceMap[String(taskRepId)]) {
        const p = replacementPlaceMap[String(taskRepId)];
        repNames.push(p.name);
        newSites.push(p.site);
        newLocations.push(p.location);
      }
      const deviceStr = origNames.length > 0 ? origNames.join('; ') : (r.device?.CI_Name || r.device?.Asset_Number || '-');
      const assetStr = origAssets.length > 0 ? origAssets.join('; ') : (r.device?.Asset_Number || '-');
      const replaceDeviceStr = repNames.length > 0 ? repNames.join('; ') : '-';
      const newSiteStr = newSites.length > 0 ? newSites.join('; ') : '-';
      const newLocationStr = newLocations.length > 0 ? newLocations.join('; ') : '-';
      const ma = r as MAReport;
      row([
        r.id,
        deviceStr,
        assetStr,
        site,
        location,
        r.technicianName || '-',
        String(dateVal ?? '-'),
        String(resultVal ?? '-'),
        replaceDeviceStr,
        newSiteStr,
        newLocationStr,
        ma.vendorName ?? '',
        ma.vendorTel ?? '',
        ma.reporterName ?? '',
        ma.reporterTel ?? '',
        ma.ticket ?? '',
        (r.comment || '').replace(/\n/g, ' '),
        fileLinksString(r.uploadedFiles),
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

  // ดาวน์โหลดไฟล์ (รูป/PDF) แยกตาม SOF → แยก zip ต่อ Site; รอบที่ X ต่อ SOF+Site; ใช้กับทั้ง PM และ MA ตาม tab ปัจจุบัน
  const handleDownloadImagesBySOF = async (sofName: string) => {
    setDownloadingImages(true);
    setShowSiteImageMenu(false);
    try {
      const sofReports = filteredReports.filter(
        (r: PMReport | MAReport) => (r.device?.Refer_SOF ?? '').toString().trim() === sofName || (sofName === 'Unknown SOF' && !(r.device?.Refer_SOF ?? '').toString().trim())
      );
      const bySite = new Map<string, Array<{ path: string; name: string; siteLocation: string; location: string; visitRound: string; type?: string }>>();
      sofReports.forEach((r: PMReport | MAReport) => {
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
      if (bySite.size === 0) {
        alert(`No files (images/PDFs) for SOF: ${sofName}`);
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

        // เลขรอบต่อเนื่องต่อวันที่ไป: ไฟล์แรกของวัน = รอบที่1, ไฟล์ที่สอง = รอบที่2, ...
        const roundPerDate = new Map<string, number>();

        const zip = new JSZip();
        const sofFolder = zip.folder(sofName.replace(/[/\\?*|"<>]/g, '_') || 'Unknown_SOF');
        if (!sofFolder) continue;
        for (let i = 0; i < allFiles.length; i++) {
          const f = allFiles[i];
          const visitDate = f.visitRound || year + '-01-01';
          const n = (roundPerDate.get(visitDate) ?? 0) + 1;
          roundPerDate.set(visitDate, n);
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
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${taskLabel}_${year}_SOF_${safe(sofName)}_Site_${safe(siteName)}_Location_${safe(locationName)}_รอบที่${roundCount}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      console.error(e);
      alert('Error downloading images');
    } finally {
      setDownloadingImages(false);
    }
  };

  const sofsWithImages = useMemo(() => {
    const map = new Map<string, { count: number; items: Array<{ siteName: string; visitDate: string }> }>();
    filteredReports.forEach((r: PMReport | MAReport) => {
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
  }, [filteredReports, tab]);

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
        const sofReports = filteredReports.filter(
          (r: PMReport | MAReport) => (r.device?.Refer_SOF ?? '').toString().trim() === sofName || (sofName === 'Unknown SOF' && !(r.device?.Refer_SOF ?? '').toString().trim())
        );
        const bySite = new Map<string, Array<{ path: string; name: string; siteLocation: string; location: string; visitRound: string; type?: string }>>();
        sofReports.forEach((r: PMReport | MAReport) => {
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

        const sofFolder = zip.folder(safe(sofName) || 'Unknown_SOF');
        if (!sofFolder) continue;

        for (const [siteName, allFiles] of bySite.entries()) {
          const siteReports = sofReports.filter(
            (r) => ((r.device?.Sitename ?? '').toString().trim() || 'Unknown') === siteName
          );
          // เลขรอบต่อเนื่องต่อวันที่ไป: ไฟล์แรกของวัน = รอบที่1, ไฟล์ที่สอง = รอบที่2, ...
          const roundPerDate = new Map<string, number>();

          const siteFolder = sofFolder.folder(safe(siteName) || 'Unknown_Site');
          if (!siteFolder) continue;

          for (let i = 0; i < allFiles.length; i++) {
            const f = allFiles[i];
            const visitDate = f.visitRound && f.visitRound.startsWith(year) ? f.visitRound : year + '-01-01';
            const n = (roundPerDate.get(visitDate) ?? 0) + 1;
            roundPerDate.set(visitDate, n);
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
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${taskLabel}_${year}_SOF_All_Site_All_รายการทั้งหมด.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error downloading images');
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              disabled={loading || filteredReports.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Export data to CSV"
            >
              <Upload size={18} />
              Export CSV
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSiteImageMenu(!showSiteImageMenu)}
                disabled={loading || sofsWithImages.length === 0 || downloadingImages}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                title="Download files (images + PDFs) by SOF"
              >
                {downloadingImages ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Image size={18} />
                )}
                Download files by SOF
                <ChevronDown size={16} className={`transition-transform ${showSiteImageMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSiteImageMenu && sofsWithImages.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSiteImageMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl z-20 py-2">
                    <button
                      onClick={handleDownloadAllSites1Site1SOF}
                      className="w-full px-4 py-3 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-b border-slate-100"
                    >
                      <Image size={16} />
                      Download all (1 site 1 SOF)
                    </button>
                    <p className="px-4 py-2 text-xs font-semibold text-slate-500">Or select SOF (each row: Site location + Visit round)</p>
                    {sofsWithImages.map(({ sofName, count, items }) => (
                      <button
                        key={sofName}
                        onClick={() => handleDownloadImagesBySOF(sofName)}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 truncate" title={sofName}>SOF: {sofName}</span>
                          <span className="text-xs font-medium text-slate-500 shrink-0">{count} images</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          {items.map(({ siteName, visitDate }, idx) => (
                            <span key={idx} className="truncate" title={`${siteName} | Visit: ${visitDate || '-'}`}>
                              Site: {siteName}{visitDate ? ` | Visit: ${visitDate}` : ''}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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
                              {result === 'pass' ? 'Pass' : result === 'warning' ? 'Warning' : 'Fail'}
                            </span>
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
                {/* Main info */}
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
                    <p className="text-xs font-medium text-slate-500 mb-1">{tab === 'pm' ? 'Status' : 'Result'}</p>
                    <div className="flex items-center gap-2">
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
                          {(selectedReport as MAReport).maResult === 'pass' ? 'Pass' : 'Fail'}
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
                      { label: 'CI Name', key: 'CI_Name', icon: <FileText size={12} /> },
                      { label: 'Asset Number', key: 'Asset_Number', icon: <Hash size={12} /> },
                      { label: 'Serial Number', key: 'serial', icon: <Hash size={12} /> },
                      { label: 'Refer SOF', key: 'Refer_SOF', icon: <FileText size={12} /> },
                      { label: 'Model', key: 'model', icon: <Cpu size={12} /> },
                      { label: 'Vendor', key: 'Vendor', icon: <Building2 size={12} /> },
                      { label: 'Asset State', key: 'Asset_State', icon: <CheckCircle2 size={12} /> },
                    ];
                    return (
                      <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <FileText size={20} className="text-indigo-600" />
                          </div>
                          <h3 className="font-bold text-slate-800">Device Information</h3>
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
