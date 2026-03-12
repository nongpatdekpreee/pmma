'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import {
  TrendingUp,
  Download,
  Upload,
  Calendar,
  Wrench,
  Building2,
  Server,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  Trophy,
  ArrowUpRight,
  ChevronRight,
  BarChart3,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { getMaDashboard, getPmDashboard, getDeviceRoles, getDeviceTypes, getSitesLocation } from '@/lib/api';
import { OverdueTasksModal,CompletedTasksModal,InprocessTasksModal,PendingTasksModal  } from '@/components/ui/OverdueTasksModal';

type DashboardData = NonNullable<Awaited<ReturnType<typeof getMaDashboard>>['data']>;

const EMPTY: DashboardData = {
  months: 6,
  range: { start: '', endExclusive: '' },
  summary: { totalMA: 0, totalDone: 0, totalInprocess: 0, totalFailed: 0, totalPassed: 0, totalOverdue: 0, totalPending: 0, completionRate: 0, failRate: 0, topVendor: 'N/A', topVendorCount: 0, topEquipment: 'N/A', topEquipmentCount: 0 },
  monthlyMA: [],
  vendorRanking: [],
  siteRanking: [],
  equipmentRanking: [],
  vendorMonthly: [],
  vendorReportStats: [],
};

const PIE_COLOR_BY_NAME: Record<string, string> = {
  Inprocess: '#fb923c',
  Pending: '#facc15',
  Done: '#10b981',
  Complete: '#10b981',
  Overdue: '#ef4444',
};
const PIE_COLOR_PM: Record<string, string> = {
  Done: '#10b981',
  Pending: '#facc15',
  Overdue: '#ef4444',
};
const VENDOR_COLORS = ['#60a5fa', '#f87171', '#fbbf24', '#34d399', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c', '#38bdf8', '#a3e635'];

function RankBadge({ rank }: { rank: number }) {
  const colors = rank === 1 ? 'bg-red-100 text-red-600 border-red-200' : rank === 2 ? 'bg-orange-100 text-orange-600 border-orange-200' : rank === 3 ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${colors}`}>
      {rank}
    </span>
  );
}

function ProgressBar({ value, max, color = 'bg-slate-300' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type ReportType = 'ma' | 'pm';

export default function ReportPage() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>('ma');
  const [timeFilter, setTimeFilter] = useState('6 Months');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [activeTab, setActiveTab] = useState<'vendor' | 'equipment' | 'site'>('vendor');
  const [equipmentRoleFilter, setEquipmentRoleFilter] = useState<string | null>(null);
  const [equipmentModelFilter, setEquipmentModelFilter] = useState<string | null>(null);
  const [equipmentSiteFilter, setEquipmentSiteFilter] = useState<string | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const siteDropdownRef = useRef<HTMLDivElement>(null);
  const [equipmentOrderBy, setEquipmentOrderBy] = useState<'total' | 'vendor'>('total');
  const [deviceRolesList, setDeviceRolesList] = useState<{ DeRoleid: number; name: string }[]>([]);
  const [deviceModelsList, setDeviceModelsList] = useState<{ Dtypeid: number; model: string }[]>([]);
  const [sitesList, setSitesList] = useState<{ SLid: number; SiteName: string }[]>([]);
  const [overdueModalOpen, setOverdueModalOpen] = useState(false);
  const [maTrendView, setMaTrendView] = useState<'summary' | 'top-model'>('summary');
  const [maTrendRoleFilterId, setMaTrendRoleFilterId] = useState<number | null>(null);
  const [maTrendSiteFilterId, setMaTrendSiteFilterId] = useState<number | null>(null);
  const [completedModalOpen, setCompletedModalOpen] = useState(false);
  const [inprocessModalOpen, setInprocessModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const summaryCardsScrollRef = useRef<HTMLDivElement>(null);
  const summaryCardsSetRef = useRef<HTMLDivElement>(null);
  const [summaryCardsDotIndex, setSummaryCardsDotIndex] = useState(0);
  const dragRef = useRef({ isDragging: false, startX: 0, scrollLeftStart: 0 });

  useEffect(() => {
    let cancelled = false;
    getDeviceRoles().then((res) => {
      if (!cancelled && res?.success && Array.isArray(res.data)) setDeviceRolesList(res.data);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    getDeviceTypes().then((res) => {
      if (!cancelled && res?.success && Array.isArray(res.data)) setDeviceModelsList(res.data);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    getSitesLocation().then((res) => {
      if (!cancelled && res?.success && Array.isArray(res.data)) setSitesList(res.data);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const el = summaryCardsScrollRef.current;
    const setEl = summaryCardsSetRef.current;
    if (!el || !setEl) return;
    const oneSetWidth = setEl.offsetWidth;
    const setStep = oneSetWidth + 16;
    if (oneSetWidth > 0) el.scrollLeft = setStep;
  }, [data]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      const el = summaryCardsScrollRef.current;
      if (!el) return;
      const dx = e.clientX - dragRef.current.startX;
      el.scrollLeft = dragRef.current.scrollLeftStart - dx;
    };
    const onMouseUp = () => { dragRef.current.isDragging = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const el = summaryCardsScrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current.isDragging || !e.touches[0]) return;
      const container = summaryCardsScrollRef.current;
      if (!container) return;
      const dx = e.touches[0].clientX - dragRef.current.startX;
      container.scrollLeft = dragRef.current.scrollLeftStart - dx;
      e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => {
    if (!roleDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) setRoleDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [roleDropdownOpen]);
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [modelDropdownOpen]);
  useEffect(() => {
    if (!siteDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(e.target as Node)) setSiteDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [siteDropdownOpen]);

  const months = useMemo(() => {
    if (timeFilter === '1 Month') return 1;
    if (timeFilter === '3 Months') return 3;
    if (timeFilter === '6 Months') return 6;
    if (timeFilter === '1 Year') return 12;
    if (timeFilter === '2 Years') return 24;
    if (timeFilter === '3 Years') return 36;
    if (timeFilter === '4 Years') return 48;
    if (timeFilter === '5 Years') return 60;
    if (timeFilter === 'All Time') return 120;
    return 6;
  }, [timeFilter]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const list: { value: string; label: string }[] = [{ value: '', label: ' ' }];
    for (let y = current + 1; y >= 2020; y--) list.push({ value: String(y), label: String(y) });
    return list;
  }, []);

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dashboardParams = useMemo(() => {
    if (selectedYear && selectedYear !== '') {
      const year = parseInt(selectedYear, 10);
      const month = selectedMonth && selectedMonth !== 'all' ? parseInt(selectedMonth, 10) : undefined;
      return { year, month };
    }
    return null;
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (dashboardParams) {
          const res =
            reportType === 'pm'
              ? await getPmDashboard(dashboardParams)
              : await getMaDashboard({
                  ...dashboardParams,
                  roleId: maTrendRoleFilterId != null ? maTrendRoleFilterId : undefined,
                  slId: maTrendSiteFilterId != null ? maTrendSiteFilterId : undefined,
                });
          if (!cancelled && res?.success && res.data) {
            setData(res.data);
          } else if (!cancelled) {
            setData(EMPTY);
            setError(res?.message || res?.error || 'Failed to load data');
          }
        } else {
          const res =
            reportType === 'pm'
              ? await getPmDashboard({ months })
              : await getMaDashboard({
                  months,
                  roleId: maTrendRoleFilterId != null ? maTrendRoleFilterId : undefined,
                  slId: maTrendSiteFilterId != null ? maTrendSiteFilterId : undefined,
                });
          if (!cancelled && res?.success && res.data) {
            setData(res.data);
          } else if (!cancelled) {
            setData(EMPTY);
            setError(res?.message || res?.error || 'Failed to load data');
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setData(EMPTY);
          setError(e?.message || 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [months, reportType, maTrendRoleFilterId, maTrendSiteFilterId, dashboardParams]);

  const { summary, monthlyMA, vendorRanking, siteRanking, equipmentRanking, range, months: dataMonths } = data;
  const isMa = reportType === 'ma';
  const taskLabel = reportType === 'ma' ? 'MA' : 'PM';
  const equipmentLabel = reportType === 'ma' ? 'Most Repaired Equipment' : 'Most Serviced Equipment';
  const maCompleteCount = Number(summary.totalPassed || 0) + Number(summary.totalFailed || 0);

  const rangeLabel = useMemo(() => {
    if (!range?.start || !range?.endExclusive) return null;
    const startStr = range.start.split('T')[0];
    const endStr = range.endExclusive.split('T')[0];
    const [sy, sm] = startStr.split('-').map(Number);
    const [ey, em] = endStr.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, 1);
    const endDate = new Date(ey, em, 0);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const n = dataMonths ?? 0;
    const monthText = n === 1 ? '1 month' : `${n} months`;
    return `${fmt(startDate)} - ${fmt(endDate)} `;
  }, [range?.start, range?.endExclusive, dataMonths]);

  const monthlyTrendData = monthlyMA.map((item) => ({
    ...item,
    complete: Number(item.reportPass || 0) + Number(item.reportFail || 0),
  }));

  // Top-model trend line (MA only)
  const topModelTrendData = useMemo(() => {
    if (!isMa || !data?.topModelTrend || !data.topModelTrend.model || !Array.isArray(data.topModelTrend.points)) {
      return null;
    }
    const byMonth: Record<string, number> = {};
    for (const p of data.topModelTrend.points) {
      if (!p || !p.month_start) continue;
      byMonth[p.month_start] = (byMonth[p.month_start] || 0) + Number(p.total || 0);
    }
    return monthlyTrendData.map((m) => ({
      month: m.month,
      monthKey: m.monthKey,
      total: m.total,
      complete: m.complete,
      inprocess: m.inprocess,
      overdue: m.overdue,
      pending: m.pending,
      topModelCount: byMonth[m.monthKey] || 0,
    }));
  }, [isMa, data?.topModelTrend, monthlyTrendData]);

  const pieData = reportType === 'pm'
    ? [
        { name: 'Done', value: summary.totalDone },
        { name: 'Pending', value: Math.max(0, summary.totalPending - summary.totalOverdue) },
        { name: 'Overdue', value: summary.totalOverdue },
      ].filter(d => d.value > 0)
    : [
        { name: 'Complete', value: maCompleteCount },
        { name: 'Inprocess', value: summary.totalInprocess },
        { name: 'Pending', value: Math.max(0, summary.totalPending - summary.totalOverdue) },
        { name: 'Overdue', value: summary.totalOverdue },
      ].filter(d => d.value > 0);

  /** รายการ Role จาก DB (device_role) สำหรับ dropdown */
  const equipmentRoles = useMemo(() => deviceRolesList.map((r) => r.name).filter(Boolean), [deviceRolesList]);
  /** รายการ Model จาก DB (device_type) สำหรับ dropdown */
  const equipmentModels = useMemo(() => deviceModelsList.map((m) => m.model).filter(Boolean), [deviceModelsList]);
  /** รายการ Site จาก DB (sites/locations) - distinct SiteName */
  const equipmentSites = useMemo(() => [...new Set(sitesList.map((s) => s.SiteName))].filter(Boolean).sort((a, b) => a.localeCompare(b)), [sitesList]);

  const filteredEquipmentRanking = useMemo(() => {
    let list = equipmentRanking;
    if (equipmentRoleFilter) {
      const want = equipmentRoleFilter.toLowerCase();
      list = list.filter((e) => (e.role ?? '').toLowerCase() === want);
    }
    if (equipmentModelFilter) {
      const want = equipmentModelFilter.toLowerCase();
      list = list.filter((e) => (e.model ?? '').toLowerCase() === want);
    }
    if (equipmentSiteFilter) {
      const want = equipmentSiteFilter.toLowerCase();
      list = list.filter((e) => (e.site ?? '').toLowerCase() === want);
    }
    if (equipmentOrderBy === 'total') return list;
    const key = equipmentOrderBy;
    return [...list].sort((a, b) => {
      const va = String((a as Record<string, unknown>)[key] ?? '').toLowerCase();
      const vb = String((b as Record<string, unknown>)[key] ?? '').toLowerCase();
      const cmp = va.localeCompare(vb);
      return cmp !== 0 ? cmp : b.total - a.total;
    });
  }, [equipmentRanking, equipmentRoleFilter, equipmentModelFilter, equipmentSiteFilter, equipmentOrderBy]);

  const maxVendorTotal = vendorRanking.length > 0 ? vendorRanking[0].total : 1;
  const maxSiteTotal = siteRanking.length > 0 ? siteRanking[0].total : 1;
  const maxEquipTotal = filteredEquipmentRanking.length > 0 ? Math.max(...filteredEquipmentRanking.map((e) => e.total)) : 1;

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const handleExport = () => {
    const lines: string[] = [];
    const nl = () => lines.push('');
    const row = (arr: string[]) => lines.push(arr.map(escape).join(','));

    const gen = new Date().toISOString().slice(0, 19).replace('T', ' ');
    lines.push(escape(`${taskLabel} Dashboard Report - Detailed Export (Generated: ${gen})`));
    lines.push(escape(`Period: ${rangeLabel ?? timeFilter}`));
    nl();

    // 1) Summary
    lines.push(escape('SECTION: Summary'));
    row(['Metric', 'Value']);
    row([`Total ${taskLabel} Tasks`, String(summary.totalMA)]);
    row(['Total Done', String(summary.totalDone)]);
    if (isMa) {
      row(['Total Inprocess', String(summary.totalInprocess)]);
      row(['Total Pending', String(summary.totalPending)]);
    } else {
      row(['Total Pass (Report)', String(summary.totalPassed)]);
      row(['Total Overdue', String(summary.totalOverdue)]);
      row(['Total Pending', String(summary.totalPending)]);
    }
    row(['Completion Rate (%)', String(summary.completionRate)]);
    row(['Top MA Vendor', summary.topVendor]);
    row(['Top Vendor MA Count', String(summary.topVendorCount)]);
    row([equipmentLabel, summary.topEquipment]);
    row(['Top Equipment MA Count', String(summary.topEquipmentCount)]);
    nl();

    // 2) Monthly Trend
    lines.push(escape(`SECTION: Monthly ${taskLabel} Trend`));
    if (!isMa) {
      row(['Month', 'Total', 'Done', 'Pass', 'Overdue', 'Pending']);
      monthlyMA.forEach((m) => {
        row([m.month, String(m.total), String(m.done), String(m.reportPass), String(m.overdue), String(m.total - m.done)]);
      });
    } else {
      row(['Month', 'Total', 'Done', 'Inprocess', 'Pending']);
      monthlyMA.forEach((m) => {
        row([m.month, String(m.total), String(m.done), String(m.inprocess), String(m.pending)]);
      });
    }
    nl();

    // 3) Result Breakdown
    lines.push(escape(`SECTION: ${taskLabel} Result Breakdown`));
    if (!isMa) {
      row(['Done', 'Pending', 'Overdue']);
      row([String(summary.totalDone), String(Math.max(0, summary.totalPending - summary.totalOverdue)), String(summary.totalOverdue)]);
    } else {
      row(['Complete', 'Inprocess', 'Pending', 'Overdue']);
      row([String(maCompleteCount), String(summary.totalInprocess), String(Math.max(0, summary.totalPending - summary.totalOverdue)), String(summary.totalOverdue)]);
    }
    nl();

    // 4) Vendor Ranking
    lines.push(escape(`SECTION: Vendor Ranking (Top ${taskLabel} Vendors)`));
    if (!isMa) {
      row(['Rank', 'Vendor', 'Total', 'Done', 'Pass', 'Overdue', 'Completion Rate (%)']);
      vendorRanking.forEach((v, i) => {
        row([String(i + 1), v.vendor, String(v.total), String(v.done), String(v.reportPass), String(v.overdue), String(v.completionRate)]);
      });
    } else {
      row(['Rank', 'Vendor', 'Total', 'Done', 'Inprocess', 'Pending', 'Completion Rate (%)']);
      vendorRanking.forEach((v, i) => {
        row([String(i + 1), v.vendor, String(v.total), String(v.done), String(v.inprocess), String(v.pending), String(v.completionRate)]);
      });
    }
    nl();

    // 5) Site Ranking
    lines.push(escape(`SECTION: Site Ranking (Top ${taskLabel} Sites)`));
    if (!isMa) {
      row(['Rank', 'Site', 'Total', 'Done', 'Pass', 'Overdue', 'Completion Rate (%)']);
      siteRanking.forEach((s, i) => {
        row([String(i + 1), s.site, String(s.total), String(s.done), String(s.reportPass), String(s.overdue), String(s.completionRate)]);
      });
    } else {
      row(['Rank', 'Site', 'Total', 'Done', 'Inprocess', 'Pending', 'Completion Rate (%)']);
      siteRanking.forEach((s, i) => {
        row([String(i + 1), s.site, String(s.total), String(s.done), String(s.inprocess), String(s.pending), String(s.completionRate)]);
      });
    }
    nl();

    // 6) Equipment Ranking (Most Repaired) — respects Role filter
    const exportEquipment = filteredEquipmentRanking.slice(0, 15);
    const filterParts = [equipmentRoleFilter && `Role: ${equipmentRoleFilter}`, equipmentModelFilter && `Model: ${equipmentModelFilter}`, equipmentSiteFilter && `Site: ${equipmentSiteFilter}`].filter(Boolean);
    lines.push(escape(`SECTION: ${equipmentLabel} (Top 15)${filterParts.length ? ` - ${filterParts.join(', ')}` : ''}`));
    if (!isMa) {
      row(['Rank', 'Model', 'Vendor', 'Site', `Total ${taskLabel}`, 'Done', 'Pass']);
      exportEquipment.forEach((e, i) => {
        row([String(i + 1), e.model || '-', e.vendor || '-', e.site || '-', String(e.total), String(e.done), String(e.reportPass)]);
      });
    } else {
      row(['Rank', 'Model', 'Role', 'Vendor', 'Site', `Total ${taskLabel}`, 'Done', 'Inprocess', 'Pending']);
      exportEquipment.forEach((e, i) => {
        row([String(i + 1), e.model || '-', e.role ?? '-', e.vendor || '-', e.site || '-', String(e.total), String(e.done), String(e.inprocess), String(e.pending)]);
      });
    }
    nl();

    const csv = lines.join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskLabel}_Dashboard_Report_Detailed_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SidebarLayout>
      <DashboardHeader />

      <div className="flex flex-col p-6 pt-0 gap-6 bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-nowrap items-center justify-between gap-4 min-w-0 overflow-x-auto pb-1">
            <div className="min-w-0 shrink-0">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-black via-gray-800 to-black text-transparent bg-clip-text truncate">
                Report Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {reportType === 'ma' ? 'MA: Most repaired equipment, Top MA vendors' : 'PM: Preventive maintenance overview, Top PM vendors'}
              </p>
            </div>

            <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-0 shadow-sm">
                <Calendar size={16} className="text-slate-400" />
                <select
                  value={timeFilter}
                  onChange={(e) => { setTimeFilter(e.target.value); if (e.target.value) setSelectedYear(''); }}
                  disabled={!!selectedYear}
                  className="border-none outline-none text-sm font-medium bg-transparent cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-slate-700"
                  title={selectedYear ? 'ล้างปีที่เลือกเพื่อใช้ช่วง' : undefined}
                >
                  <option>1 Month</option>
                  <option>3 Months</option>
                  <option>6 Months</option>
                  <option>1 Year</option>
                  <option>2 Years</option>
                  <option>3 Years</option>
                  <option>4 Years</option>
                  <option>5 Years</option>
                  <option>All Time</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-0 shadow-sm">
                <span className="text-slate-400 text-sm">Year</span>
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(e.target.value); if (!e.target.value) setSelectedMonth('all'); }}
                  className="border-none outline-none text-sm font-medium text-slate-700 bg-transparent cursor-pointer min-w-[72px]"
                >
                  {yearOptions.map((o) => (
                    <option key={o.value || 'x'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {selectedYear && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-0 shadow-sm">
                    <span className="text-slate-400 text-sm">Month</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border-none outline-none text-sm font-medium text-slate-700 bg-transparent cursor-pointer min-w-[80px]"
                  >
                    <option value="all">All</option>
                    {MONTH_LABELS.map((label, i) => (
                      <option key={i} value={String(i + 1)}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
              {rangeLabel && (
                <div className="bg-white px-4 py-2 rounded-xl border-0 shadow-sm text-sm text-slate-600">
                  {rangeLabel}
                </div>
              )}
            </div>
            <button
              onClick={handleExport}
              className="bg-slate-800 text-white px-5 py-2 rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm text-sm"
            >
              <Upload size={16} />
              Export CSV
            </button>
          </div>
          </div>
            {/* Bottom Insights */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-blue-50/70 border border-blue-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
              <TrendingUp size={16} className="text-blue-500" />
              Overview
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>Total {taskLabel} tasks: <strong className="text-blue-600">{summary.totalMA}</strong>, completion rate <strong className="text-emerald-600">{summary.completionRate}%</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>Top {taskLabel} vendor: <strong className="text-violet-600">{summary.topVendor}</strong> ({summary.topVendorCount} tasks)</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>{reportType === 'ma' ? 'Most repaired' : 'Most serviced'}: <strong className="text-red-500">{summary.topEquipment}</strong> ({summary.topEquipmentCount} times)</span>
              </li>
            </ul>
          </div>

          <div className="bg-amber-50/70 border border-amber-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-amber-500" />
              Watch List
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {equipmentRanking.slice(0, 3).map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-amber-700">{e.deviceName}</strong> - {e.total} {taskLabel} times
                    {isMa && (e.inprocess > 0 || e.pending > 0) && <span className="text-orange-500"> (Inprocess {e.inprocess}, Pending {e.pending})</span>}
                  </span>
                </li>
              ))}
              {equipmentRanking.length === 0 && <li className="text-slate-400">No data available</li>}
            </ul>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Recommendations
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>Review equipment with more than 3 MA occurrences for replacement</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>{isMa ? 'Follow up MA tasks that remain in Inprocess or Pending for too long' : 'Follow up with vendors that have high fail rates to improve SLA'}</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>Plan preventive PM for sites with high MA volume</span>
              </li>
            </ul>
          </div>
        </div>

          {/* MA / PM Tab */}
          <div className="flex gap-1 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setReportType('ma')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${reportType === 'ma' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              MA Report
            </button>
            <button
              type="button"
              onClick={() => setReportType('pm')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${reportType === 'pm' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              PM Report
            </button>
          </div>
        </div>

        {(loading || error) && (
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
            {loading ? 'Loading data...' : error}
          </div>
        )}
        

        {/* Summary Cards - Manual infinite carousel: 7 cards, 5 visible, 2 slides, dot + drag + swipe */}
        <div className="relative w-full overflow-hidden pb-1">
          <div
            ref={summaryCardsScrollRef}
            onScroll={() => {
              const el = summaryCardsScrollRef.current;
              const setEl = summaryCardsSetRef.current;
              if (!el || !setEl) return;
              const oneSetWidth = setEl.offsetWidth;
              const gapPx = 16;
              const setStep = oneSetWidth + gapPx;
              let { scrollLeft } = el;
              if (scrollLeft >= 2 * setStep) {
                el.scrollLeft = scrollLeft - setStep;
                scrollLeft = el.scrollLeft;
              } else if (scrollLeft <= 0) {
                el.scrollLeft = scrollLeft + setStep;
                scrollLeft = el.scrollLeft;
              }
              const pos = Math.min(6, Math.round(((scrollLeft - setStep) / oneSetWidth) * 7) % 7);
              setSummaryCardsDotIndex(pos >= 3 ? 1 : 0);
            }}
            onMouseDown={(e) => {
              const el = summaryCardsScrollRef.current;
              if (!el) return;
              dragRef.current = { isDragging: true, startX: e.clientX, scrollLeftStart: el.scrollLeft };
            }}
            onTouchStart={(e) => {
              const el = summaryCardsScrollRef.current;
              if (!el || !e.touches[0]) return;
              dragRef.current = { isDragging: true, startX: e.touches[0].clientX, scrollLeftStart: el.scrollLeft };
            }}
            onTouchEnd={() => { dragRef.current.isDragging = false; }}
            onTouchCancel={() => { dragRef.current.isDragging = false; }}
            className="flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth touch-pan-x select-none cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {[1, 2, 3].map((set) => (
              <div key={set} ref={set === 1 ? summaryCardsSetRef : undefined} className="flex gap-4 shrink-0">
                <div className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-blue-50/80 border border-blue-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5">
                  <div className="relative flex items-center">
                    <span className="flex-1 text-xs text-center font-semibold text-blue-500 uppercase tracking-wide">Total {taskLabel} Tasks</span>
                    <Wrench size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-400 shrink-0" />
                  </div>
                  <p className="text-2xl pt-3 text-center font-black text-blue-700">{summary.totalMA.toLocaleString()}</p>
                  <p className="text-xs pt-6  text-blue-400">Last {timeFilter}</p>
                </div>
                <button type="button" onClick={() => setCompletedModalOpen(true)} className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-emerald-50/80 border border-emerald-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5">
                  <div className="relative flex items-center">
                    <span className="flex-1 text-xs text-center font-semibold text-emerald-500 uppercase tracking-wide">Complete</span>
                    <CheckCircle2 size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-2xl pt-3 text-center font-black text-emerald-700">{summary.totalDone.toLocaleString()}</p>
                  <div className="flex items-center pt-6 gap-1 text-xs text-emerald-600">
                    <ArrowUpRight size={12} />
                    <span >{summary.completionRate}% completion</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setOverdueModalOpen(true)}
                  className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-red-50/80 border border-red-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5 text-left hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-200"
                  title="View overdue tasks in calendar"
                >
                  <div className="relative flex items-center">
                    <span className="flex-1 text-xs text-center font-semibold text-red-600 uppercase tracking-wide">Overdue</span>
                    <AlertTriangle size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-red-500 shrink-0" />
                  </div>
                  <p className="text-2xl pt-3 text-center font-black text-red-700">{summary.totalOverdue.toLocaleString()}</p>
                  <div className="flex items-center pt-6 gap-2 text-xs text-red-600">
                    <span>Past due tasks</span>
                    <ChevronRight size={14} className="text-red-500 shrink-0" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setInprocessModalOpen(true)}
                  className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-orange-50/80 border border-orange-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5 text-left hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-200"
                  title="View in process tasks in calendar"
                >
                  <div className="relative flex items-center">
                    <span className="flex-1 text-xs text-center font-semibold text-orange-600 uppercase tracking-wide">In Process</span>
                    <RefreshCw  size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-orange-500 shrink-0" />
                  </div>
                  <p className="text-2xl text-center pt-3 font-black text-orange-700">{summary.totalInprocess.toLocaleString()}</p>
                  <div className="flex items-center pt-6 gap-1 text-xs text-orange-600">
                    <span >Currently being worked on</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingModalOpen(true)}
                  className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-yellow-50/80 border border-yellow-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5 text-left hover:bg-yellow-50 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  title="View pending tasks in calendar"
                >
                    <div className="relative flex items-center">
                      <span className="flex-1 text-xs text-center font-semibold text-yellow-600 uppercase tracking-wide">Pending</span>
                      <Clock  size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-yellow-500 shrink-0" />
                    </div>
                  <p className="text-2xl pt-3 text-center font-black text-yellow-700">{summary.totalPending.toLocaleString()}</p>
                  <div className="flex items-center pt-6 gap-1 text-xs text-yellow-600">
                    <span >Waiting to be assigned</span>
                  </div>
                </button>
                <div className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-violet-50/80 border border-violet-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Top {taskLabel} Vendor</span>
                    <Trophy size={16} className="text-violet-400 shrink-0" />
                  </div>
                  <p className="text-lg text-center pt-3 font-black text-violet-700 truncate">{summary.topVendor}</p>
                  <p className="text-xs pt-6 text-violet-400">{summary.topVendorCount} {taskLabel} tasks</p>
                </div>
                <div className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-amber-50/80 border border-amber-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-500 uppercase tracking-wide">{equipmentLabel}</span>
                    <Server size={16} className="text-amber-400 shrink-0" />
                  </div>
                  <p className="text-base font-black text-amber-700 break-words min-h-[2rem]" title={summary.topEquipment} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{summary.topEquipment}</p>
                  <p className="text-xs text-amber-400">{summary.topEquipmentCount} {taskLabel} tasks</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center items-center gap-2 py-3">
            {[0, 1].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const el = summaryCardsScrollRef.current;
                  const setEl = summaryCardsSetRef.current;
                  if (!el || !setEl) return;
                  const oneSetWidth = setEl.offsetWidth;
                  const setStep = oneSetWidth + 16;
                  const target = i === 0 ? setStep : setStep + (3 / 7) * oneSetWidth;
                  el.scrollTo({ left: target, behavior: 'smooth' });
                }}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  i === summaryCardsDotIndex
                    ? 'bg-blue-600 ring-4 ring-blue-200 scale-110'
                    : 'bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={i === 0 ? 'Slide 1: Total, Done, Overdue, In Process, Pending' : 'Slide 2: Top Vendor, Most Repaired Equipment'}
              />
            ))}
          </div>
        </div>

        <OverdueTasksModal
          isOpen={overdueModalOpen}
          onClose={() => setOverdueModalOpen(false)}
          taskTypeFilter={taskLabel as 'PM' | 'MA'}
          onSelectTask={(taskId) => {
            setOverdueModalOpen(false);
            router.push(`/calendar?taskId=${encodeURIComponent(taskId)}`);
          }}
        />
        <CompletedTasksModal
          isOpen={completedModalOpen}
          onClose={() => setCompletedModalOpen(false)}
          taskTypeFilter={taskLabel as 'PM' | 'MA'}
          onSelectTask={(taskId) => {
            setCompletedModalOpen(false);
            router.push(`/calendar?taskId=${encodeURIComponent(taskId)}`);
          }}
        />
        <InprocessTasksModal
          isOpen={inprocessModalOpen}
          onClose={() => setInprocessModalOpen(false)}
          taskTypeFilter={taskLabel as 'PM' | 'MA'}
          onSelectTask={(taskId) => {
            setInprocessModalOpen(false);
            router.push(`/calendar?taskId=${encodeURIComponent(taskId)}`);
          }}
        />
        <PendingTasksModal
          isOpen={pendingModalOpen}
          onClose={() => setPendingModalOpen(false)}
          taskTypeFilter={taskLabel as 'PM' | 'MA'}
          onSelectTask={(taskId) => {
            setPendingModalOpen(false);
            router.push(`/calendar?taskId=${encodeURIComponent(taskId)}`);
          }}
        />

        {/* Row 2: Monthly Trend + Pie */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-600 text-lg flex items-center gap-2">
                  <BarChart3 size={18} className="text-slate-400" />
                  Monthly {taskLabel} Trend
                </h3>
                {isMa && topModelTrendData && (
                  <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-[11px] text-slate-600">
                    <button
                      type="button"
                      onClick={() => setMaTrendView('summary')}
                      className={`px-3 py-1 rounded-full font-semibold transition-all ${
                        maTrendView === 'summary' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaTrendView('top-model')}
                      className={`px-3 py-1 rounded-full font-semibold transition-all ${
                        maTrendView === 'top-model' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500'
                      }`}
                    >
                      Top model trend
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {isMa ? (
                  maTrendView === 'summary' ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Total
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Complete
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Inprocess
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Pending
                      </span>
                    </>
                  ) : (
                    topModelTrendData && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Top model
                      </span>
                    )
                  )
                ) : (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Total
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Complete
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Pending
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Overdue
                    </span>
                  </>
                )}
              </div>
            </div>
            {isMa && maTrendView === 'top-model' && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-500">Role:</label>
                  <select
                    className="border border-slate-200 rounded-full px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={maTrendRoleFilterId != null ? String(maTrendRoleFilterId) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMaTrendRoleFilterId(v ? Number(v) : null);
                    }}
                  >
                    <option value="">All</option>
                    {deviceRolesList.map((r) => (
                      <option key={r.DeRoleid} value={r.DeRoleid}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-500">Site:</label>
                  <select
                    className="border border-slate-200 rounded-full px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[160px]"
                    value={maTrendSiteFilterId != null ? String(maTrendSiteFilterId) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMaTrendSiteFilterId(v ? Number(v) : null);
                    }}
                  >
                    <option value="">All</option>
                    {sitesList.map((s) => (
                      <option key={s.SLid} value={s.SLid}>
                        {s.SiteName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={isMa && maTrendView === 'top-model' && topModelTrendData ? topModelTrendData : monthlyTrendData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                  />
                  {isMa ? (
                    <>
                      {maTrendView === 'summary' && (
                        <>
                          <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[6, 6, 0, 0]} barSize={20} />
                          <Bar dataKey="complete" fill="#10b981" name="Complete" radius={[6, 6, 0, 0]} barSize={20} />
                          <Bar dataKey="inprocess" fill="#f97316" name="Inprocess" radius={[6, 6, 0, 0]} barSize={20} />
                          <Bar dataKey="pending" fill="#facc15" name="Pending" radius={[6, 6, 0, 0]} barSize={20} />
                        </>
                      )}
                      {maTrendView === 'top-model' && topModelTrendData && (
                        <Line
                          type="monotone"
                          dataKey="topModelCount"
                          name={data?.topModelTrend?.model || 'Top model'}
                          stroke="#ec4899"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          yAxisId={0}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[6, 6, 0, 0]} barSize={20} />
                      <Bar dataKey="complete" fill="#10b981" name="Complete" radius={[6, 6, 0, 0]} barSize={20} />
                      <Bar dataKey="pending" fill="#facc15" name="Pending" radius={[6, 6, 0, 0]} barSize={20} />
                      <Bar dataKey="overdue" fill="#ef4444" name="Overdue" radius={[6, 6, 0, 0]} barSize={20} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-600 text-lg mb-4 flex items-center gap-2">
              <Shield size={18} className="text-slate-400" />
              {taskLabel} Result Breakdown
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={3}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={(reportType === 'pm' ? PIE_COLOR_PM : PIE_COLOR_BY_NAME)[d.name] ?? '#a5b4c4'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const total = pieData.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 && typeof value === 'number' ? Math.round((value / total) * 100) : 0;
                      return [`${value} (${pct}%)`, name];
                    }}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-3">
              {pieData.map((d, i) => {
                const total = pieData.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: (reportType === 'pm' ? PIE_COLOR_PM : PIE_COLOR_BY_NAME)[d.name] ?? '#a5b4c4' }} />
                    <span><strong className="text-slate-700">{d.name}</strong>: {d.value} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl w-fit shadow-sm">
          {([
            { key: 'vendor' as const, label: `Top ${taskLabel} Vendors`, icon: Building2 },
            { key: 'equipment' as const, label: equipmentLabel, icon: Server },
            { key: 'site' as const, label: `Top ${taskLabel} Sites`, icon: Building2 },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                activeTab === key
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Vendor Tab */}
        {activeTab === 'vendor' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-400" />
                MA Tasks by Vendor
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorRanking} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#b0b8c4' }} />
                    <YAxis dataKey="vendor" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                    <Bar dataKey="total" name="MA Tasks" radius={[0, 8, 8, 0]} barSize={20}>
                      {vendorRanking.map((_, i) => (
                        <Cell key={i} fill={VENDOR_COLORS[i % VENDOR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                Vendor Ranking
              </h3>
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2">
                {vendorRanking.map((v, i) => (
                  <div key={v.vendor} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                    <RankBadge rank={i + 1} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-slate-700 truncate">{v.vendor}</span>
                        <span className="text-sm font-bold text-slate-600">{v.total} <span className="text-xs font-normal text-slate-400">tasks</span></span>
                      </div>
                      <ProgressBar value={v.total} max={maxVendorTotal} color={i === 0 ? 'bg-red-400' : i === 1 ? 'bg-amber-400' : i === 2 ? 'bg-yellow-400' : 'bg-blue-300'} />
                      <div className="flex gap-3 mt-1.5 text-xs text-slate-400">
                        <span className="text-emerald-600">Complete {v.done}</span>
                        <span>{v.completionRate}%</span>
                        {isMa ? (
                          <>
                            <span className="text-orange-500">Inprocess {v.inprocess}</span>
                            <span className="text-yellow-600">Pending {v.pending}</span>
                          </>
                        ) : (
                          <>
                            {v.reportPass > 0 && <span className="text-emerald-500">Pass {v.reportPass}</span>}
                            {v.overdue > 0 && <span className="text-red-500">Overdue {v.overdue}</span>}
                          </>
                        )}
                      
                      </div>
                    </div>
                  </div>
                ))}
                {vendorRanking.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No data available</p>}
              </div>
            </div>
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
              <Server size={18} className="text-slate-400" />
              {equipmentLabel} (Top 15)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-14 align-middle">Rank</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider align-middle min-w-[180px]">
                      <div className="relative flex justify-center" ref={modelDropdownRef}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setModelDropdownOpen((o) => !o); }}
                          className="flex items-center gap-0.5 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 py-0.5"
                        >
                          Model <ChevronDown className={`w-3.5 h-3.5 text-slate-400 inline transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                        </button>
                        {modelDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 z-10 min-w-[140px] max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                            <button
                              type="button"
                              onClick={() => { setEquipmentModelFilter(null); setModelDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${!equipmentModelFilter ? 'bg-slate-100 text-slate-700 font-medium' : 'text-slate-600'}`}
                            >
                              All
                            </button>
                            {equipmentModels.map((model) => (
                              <button
                                key={model}
                                type="button"
                                onClick={() => { setEquipmentModelFilter(model); setModelDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 truncate ${equipmentModelFilter === model ? 'bg-slate-100 text-slate-700 font-medium' : 'text-slate-600'}`}
                              >
                                {model}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider align-middle min-w-[90px]">
                      <div className="relative flex justify-center" ref={roleDropdownRef}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setRoleDropdownOpen((o) => !o); }}
                          className="flex items-center gap-0.5 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 py-0.5"
                        >
                          Role <ChevronDown className={`w-3.5 h-3.5 text-slate-400 inline transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                        </button>
                        {roleDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 z-10 min-w-[120px] bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                            <button
                              type="button"
                              onClick={() => { setEquipmentRoleFilter(null); setRoleDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${!equipmentRoleFilter ? 'bg-slate-100 text-slate-700 font-medium' : 'text-slate-600'}`}
                            >
                              All
                            </button>
                            {equipmentRoles.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => { setEquipmentRoleFilter(role); setRoleDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 capitalize ${equipmentRoleFilter === role ? 'bg-slate-100 text-slate-700 font-medium' : 'text-slate-600'}`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 min-w-[160px] align-middle"
                      onClick={() => setEquipmentOrderBy(equipmentOrderBy === 'vendor' ? 'total' : 'vendor')}
                    >
                      Vendor
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider align-middle min-w-[220px]">
                      <div className="relative flex justify-center" ref={siteDropdownRef}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSiteDropdownOpen((o) => !o); }}
                          className="flex items-center gap-0.5 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 py-0.5"
                        >
                          Site <ChevronDown className={`w-3.5 h-3.5 text-slate-400 inline transition-transform ${siteDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                        </button>
                        {siteDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 z-10 min-w-[140px] max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                            <button
                              type="button"
                              onClick={() => { setEquipmentSiteFilter(null); setSiteDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${!equipmentSiteFilter ? 'bg-slate-100 text-slate-700 font-medium' : 'text-slate-600'}`}
                            >
                              All
                            </button>
                            {equipmentSites.map((site) => (
                              <button
                                key={site}
                                type="button"
                                onClick={() => { setEquipmentSiteFilter(site); setSiteDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 truncate ${equipmentSiteFilter === site ? 'bg-slate-100 text-slate-700 font-medium' : 'text-slate-600'}`}
                              >
                                {site}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 w-16 align-middle"
                      onClick={() => setEquipmentOrderBy('total')}
                    >
                      Total {taskLabel}
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10 align-middle">Complete</th>
                    {isMa ? (
                      <>
                        <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-14 align-middle">Inprocess</th>
                        <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12 align-middle">Pending</th>
                      </>
                    ) : (
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10 align-middle">Pass</th>
                    )}
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-24 align-middle">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipmentRanking.slice(0, 15).map((e, i) => (
                    <tr key={e.deviceId + i} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i < 3 ? 'bg-red-50/30' : ''}`}>
                      <td className="py-3 px-3 w-14 text-center"><RankBadge rank={i + 1} /></td>
                      <td className="py-3 px-3 text-sm text-slate-400 whitespace-nowrap text-center" title={e.model || undefined}>{e.model || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm text-slate-600 capitalize">{e.role ?? '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">{e.vendor || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-sm text-slate-400 text-center" title={e.site || undefined}>{e.site || '-'}</td>
                      <td className="py-3 px-2 text-center w-16">
                        <span className="text-sm font-bold text-slate-600 bg-blue-50 px-1.5 py-0.5 rounded-lg">{e.total}</span>
                      </td>
                      <td className="py-3 px-2 text-center text-sm font-medium text-slate-500 w-10">{e.done}</td>
                      {isMa ? (
                        <>
                          <td className="py-3 px-2 text-center text-sm font-medium text-orange-500 w-14">{e.inprocess}</td>
                          <td className="py-3 px-2 text-center text-sm font-medium text-yellow-600 w-12">{e.pending}</td>
                        </>
                      ) : (
                        <td className="py-3 px-2 text-center text-sm font-medium text-emerald-600 w-10">{e.reportPass}</td>
                      )}
                      <td className="py-3 px-2 w-24 text-center">
                        <ProgressBar value={e.total} max={maxEquipTotal} color={i < 3 ? 'bg-red-400' : 'bg-blue-300'} />
                      </td>
                    </tr>
                  ))}
                  {filteredEquipmentRanking.length === 0 && (
                    <tr><td colSpan={isMa ? 10 : 9} className="text-center py-8 text-sm text-slate-400">No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Site Tab */}
        {activeTab === 'site' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-400" />
                {taskLabel} Tasks by Site
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteRanking} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#b0b8c4' }} />
                    <YAxis dataKey="site" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                    <Bar dataKey="total" name="MA Tasks" radius={[0, 8, 8, 0]} barSize={20}>
                      {siteRanking.map((_, i) => (
                        <Cell key={i} fill={VENDOR_COLORS[i % VENDOR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                Site Ranking
              </h3>
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2">
                {siteRanking.map((s, i) => (
                  <div key={s.site} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                    <RankBadge rank={i + 1} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-slate-700 truncate">{s.site}</span>
                        <span className="text-sm font-bold text-slate-600">{s.total} <span className="text-xs font-normal text-slate-400">tasks</span></span>
                      </div>
                      <ProgressBar value={s.total} max={maxSiteTotal} color={i === 0 ? 'bg-red-400' : i === 1 ? 'bg-amber-400' : i === 2 ? 'bg-yellow-400' : 'bg-teal-300'} />
                      <div className="flex gap-3 mt-1.5 text-xs text-slate-400">
                        <span className="text-emerald-600">Complete {s.done}</span>
                        <span>{s.completionRate}%</span>
                        {isMa ? (
                          <>
                            <span className="text-orange-500">Inprocess {s.inprocess}</span>
                            <span className="text-yellow-600">Pending {s.pending}</span>
                          </>
                        ) : (
                          <>
                            {s.reportPass > 0 && <span className="text-emerald-500">Pass {s.reportPass}</span>}
                            {s.overdue > 0 && <span className="text-red-500">Overdue {s.overdue}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {siteRanking.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No data available</p>}
              </div>
            </div>
          </div>
        )}

      
      </div>
    </SidebarLayout>
  );
}
