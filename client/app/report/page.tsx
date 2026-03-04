'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  CheckCircle2,
  Trophy,
  ArrowUpRight,
  ChevronRight,
  Activity,
  BarChart3,
  Shield,
} from 'lucide-react';
import { getMaDashboard, getPmDashboard } from '@/lib/api';

type DashboardData = NonNullable<Awaited<ReturnType<typeof getMaDashboard>>['data']>;

const EMPTY: DashboardData = {
  months: 6,
  range: { start: '', endExclusive: '' },
  summary: { totalMA: 0, totalDone: 0, totalFailed: 0, totalPassed: 0, totalOverdue: 0, totalPending: 0, completionRate: 0, failRate: 0, topVendor: 'N/A', topVendorCount: 0, topEquipment: 'N/A', topEquipmentCount: 0 },
  monthlyMA: [],
  vendorRanking: [],
  siteRanking: [],
  equipmentRanking: [],
  vendorMonthly: [],
  vendorReportStats: [],
};

const PIE_COLOR_BY_NAME: Record<string, string> = {
  Pass: '#4ade80',
  Fail: '#f87171',
  Overdue: '#fbbf24',
  Pending: '#facc15',
  Done: '#10b981',
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
  const [reportType, setReportType] = useState<ReportType>('ma');
  const [timeFilter, setTimeFilter] = useState('6 Months');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [activeTab, setActiveTab] = useState<'vendor' | 'equipment' | 'site'>('vendor');

  const months = useMemo(() => {
    if (timeFilter === '1 Month') return 1;
    if (timeFilter === '3 Months') return 3;
    if (timeFilter === '6 Months') return 6;
    if (timeFilter === '1 Year') return 12;
    if (timeFilter === 'All Time') return 24;
    return 6;
  }, [timeFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = reportType === 'pm' ? await getPmDashboard({ months }) : await getMaDashboard({ months });
        if (!cancelled && res?.success && res.data) {
          setData(res.data);
        } else if (!cancelled) {
          setData(EMPTY);
          setError(res?.message || res?.error || 'Failed to load data');
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
  }, [months, reportType]);

  const { summary, monthlyMA, vendorRanking, siteRanking, equipmentRanking, vendorReportStats } = data;
  const taskLabel = reportType === 'ma' ? 'MA' : 'PM';
  const equipmentLabel = reportType === 'ma' ? 'Most Repaired Equipment' : 'Most Serviced Equipment';

  const pieData = reportType === 'pm'
    ? [
        { name: 'Done', value: summary.totalDone },
        { name: 'Pending', value: Math.max(0, summary.totalPending - summary.totalOverdue) },
        { name: 'Overdue', value: summary.totalOverdue },
      ].filter(d => d.value > 0)
    : [
        { name: 'Pass', value: summary.totalPassed },
        { name: 'Fail', value: summary.totalFailed },
        { name: 'Overdue', value: summary.totalOverdue },
        { name: 'Pending', value: Math.max(0, summary.totalPending - summary.totalOverdue) },
      ].filter(d => d.value > 0);

  const maxVendorTotal = vendorRanking.length > 0 ? vendorRanking[0].total : 1;
  const maxSiteTotal = siteRanking.length > 0 ? siteRanking[0].total : 1;
  const maxEquipTotal = equipmentRanking.length > 0 ? equipmentRanking[0].total : 1;

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const handleExport = () => {
    const lines: string[] = [];
    const nl = () => lines.push('');
    const row = (arr: string[]) => lines.push(arr.map(escape).join(','));

    const gen = new Date().toISOString().slice(0, 19).replace('T', ' ');
    lines.push(escape(`${taskLabel} Dashboard Report - Detailed Export (Generated: ${gen})`));
    lines.push(escape(`Period: ${timeFilter}`));
    nl();

    // 1) Summary
    lines.push(escape('SECTION: Summary'));
    row(['Metric', 'Value']);
    row([`Total ${taskLabel} Tasks`, String(summary.totalMA)]);
    row(['Total Done', String(summary.totalDone)]);
    row(['Total Pass (Report)', String(summary.totalPassed)]);
    if (reportType === 'ma') row(['Total Fail (Report)', String(summary.totalFailed)]);
    row(['Total Overdue', String(summary.totalOverdue)]);
    row(['Total Pending', String(summary.totalPending)]);
    row(['Completion Rate (%)', String(summary.completionRate)]);
    if (reportType === 'ma') row(['Fail Rate (%)', String(summary.failRate)]);
    row(['Top MA Vendor', summary.topVendor]);
    row(['Top Vendor MA Count', String(summary.topVendorCount)]);
    row([equipmentLabel, summary.topEquipment]);
    row(['Top Equipment MA Count', String(summary.topEquipmentCount)]);
    nl();

    // 2) Monthly Trend
    lines.push(escape(`SECTION: Monthly ${taskLabel} Trend`));
    if (reportType === 'pm') {
      row(['Month', 'Total', 'Done', 'Pass', 'Overdue', 'Pending']);
      monthlyMA.forEach((m) => {
        row([m.month, String(m.total), String(m.done), String(m.reportPass), String(m.overdue), String(m.total - m.done)]);
      });
    } else {
      row(['Month', 'Total', 'Done', 'Pass', 'Fail', 'Overdue', 'Pending']);
      monthlyMA.forEach((m) => {
        row([m.month, String(m.total), String(m.done), String(m.reportPass), String(m.reportFail), String(m.overdue), String(m.total - m.done)]);
      });
    }
    nl();

    // 3) Result Breakdown
    lines.push(escape(`SECTION: ${taskLabel} Result Breakdown`));
    if (reportType === 'pm') {
      row(['Done', 'Pending', 'Overdue']);
      row([String(summary.totalDone), String(Math.max(0, summary.totalPending - summary.totalOverdue)), String(summary.totalOverdue)]);
    } else {
      row(['Pass', 'Fail', 'Overdue', 'Pending']);
      row([String(summary.totalPassed), String(summary.totalFailed), String(summary.totalOverdue), String(Math.max(0, summary.totalPending - summary.totalOverdue))]);
    }
    nl();

    // 4) Vendor Ranking
    lines.push(escape(`SECTION: Vendor Ranking (Top ${taskLabel} Vendors)`));
    if (reportType === 'pm') {
      row(['Rank', 'Vendor', 'Total', 'Done', 'Pass', 'Overdue', 'Completion Rate (%)']);
      vendorRanking.forEach((v, i) => {
        row([String(i + 1), v.vendor, String(v.total), String(v.done), String(v.reportPass), String(v.overdue), String(v.completionRate)]);
      });
    } else {
      row(['Rank', 'Vendor', 'Total', 'Done', 'Pass', 'Fail', 'Overdue', 'Completion Rate (%)']);
      vendorRanking.forEach((v, i) => {
        row([String(i + 1), v.vendor, String(v.total), String(v.done), String(v.reportPass), String(v.reportFail), String(v.overdue), String(v.completionRate)]);
      });
    }
    nl();

    // 5) Site Ranking
    lines.push(escape(`SECTION: Site Ranking (Top ${taskLabel} Sites)`));
    if (reportType === 'pm') {
      row(['Rank', 'Site', 'Total', 'Done', 'Pass', 'Overdue', 'Completion Rate (%)']);
      siteRanking.forEach((s, i) => {
        row([String(i + 1), s.site, String(s.total), String(s.done), String(s.reportPass), String(s.overdue), String(s.completionRate)]);
      });
    } else {
      row(['Rank', 'Site', 'Total', 'Done', 'Pass', 'Fail', 'Overdue', 'Completion Rate (%)']);
      siteRanking.forEach((s, i) => {
        row([String(i + 1), s.site, String(s.total), String(s.done), String(s.reportPass), String(s.reportFail), String(s.overdue), String(s.completionRate)]);
      });
    }
    nl();

    // 6) Equipment Ranking (Most Repaired)
    lines.push(escape(`SECTION: ${equipmentLabel} (Top 15)`));
    if (reportType === 'pm') {
      row(['Rank', 'Device Name', 'Model', 'Serial', 'Vendor', 'Site', `Total ${taskLabel}`, 'Done', 'Pass']);
      equipmentRanking.forEach((e, i) => {
        row([String(i + 1), e.deviceName, e.model || '-', e.serial || '-', e.vendor || '-', e.site || '-', String(e.total), String(e.done), String(e.reportPass)]);
      });
    } else {
      row(['Rank', 'Device Name', 'Model', 'Serial', 'Vendor', 'Site', `Total ${taskLabel}`, 'Done', 'Pass', 'Fail']);
      equipmentRanking.forEach((e, i) => {
        row([String(i + 1), e.deviceName, e.model || '-', e.serial || '-', e.vendor || '-', e.site || '-', String(e.total), String(e.done), String(e.reportPass), String(e.reportFail)]);
      });
    }
    nl();

    // 7) Vendor SLA Report (Pass/Fail Rate) - เฉพาะ MA
    if (reportType === 'ma' && vendorReportStats.length > 0) {
      lines.push(escape('SECTION: Vendor SLA Report (Pass/Fail Rate)'));
      row(['Vendor', 'Total Reports', 'Pass', 'Fail', 'Pass Rate (%)']);
      vendorReportStats.forEach((v) => {
        row([v.vendor, String(v.totalReports), String(v.passReports), String(v.failReports), String(v.passRate)]);
      });
      nl();
    }

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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-black via-gray-800 to-black text-transparent bg-clip-text">
                Report Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {reportType === 'ma' ? 'MA: Most repaired equipment, Top MA vendors' : 'PM: Preventive maintenance overview, Top PM vendors'}
              </p>
            </div>

            <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-0 shadow-sm">
              <Calendar size={16} className="text-slate-400" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="border-none outline-none text-sm font-medium text-slate-700 bg-transparent cursor-pointer"
              >
                <option>1 Month</option>
                <option>3 Months</option>
                <option>6 Months</option>
                <option>1 Year</option>
                <option>All Time</option>
              </select>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-blue-50/80 border border-blue-100 rounded-[2rem] shadow-sm p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Total {taskLabel} Tasks</span>
              <Wrench size={16} className="text-blue-400" />
            </div>
            <p className="text-3xl font-black text-blue-700">{summary.totalMA.toLocaleString()}</p>
            <p className="text-xs text-blue-400">Last {timeFilter}</p>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-100 rounded-[2rem] shadow-sm p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Done</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-700">{summary.totalDone.toLocaleString()}</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <ArrowUpRight size={12} />
              <span>{summary.completionRate}% completion</span>
            </div>
          </div>

          {reportType === 'pm' ? (
            <div className="bg-red-50/80 border border-red-100 rounded-[2rem] shadow-sm p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Overdue</span>
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <p className="text-3xl font-black text-red-700">{summary.totalOverdue.toLocaleString()}</p>
              <div className="flex items-center gap-2 text-xs text-red-600">
                <span>Overdue</span>
                <span className="text-emerald-600">Done {summary.totalDone}</span>
              </div>
            </div>
          ) : (
            <div className="bg-red-50/80 border border-red-100 rounded-[2rem] shadow-sm p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Fail</span>
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-red-600">{summary.totalFailed.toLocaleString()}</p>
                {summary.totalOverdue > 0 && (
                  <p className="text-base font-bold text-amber-600">+{summary.totalOverdue} <span className="text-xs font-normal">overdue</span></p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-500">Fail rate {summary.failRate}%</span>
                <span className="text-emerald-600">Pass {summary.totalPassed}</span>
              </div>
            </div>
          )}

          <div className="bg-violet-50/80 border border-violet-100 rounded-[2rem] shadow-sm p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Top {taskLabel} Vendor</span>
              <Trophy size={16} className="text-violet-400" />
            </div>
            <p className="text-lg font-black text-violet-700 truncate">{summary.topVendor}</p>
            <p className="text-xs text-violet-400">{summary.topVendorCount} {taskLabel} tasks</p>
          </div>

          <div className="bg-amber-50/80 border border-amber-100 rounded-[2rem] shadow-sm p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wide">{equipmentLabel}</span>
              <Server size={16} className="text-amber-400" />
            </div>
            <p className="text-base font-black text-amber-700 break-words min-h-[2.5rem]" title={summary.topEquipment} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{summary.topEquipment}</p>
            <p className="text-xs text-amber-400">{summary.topEquipmentCount} {taskLabel} tasks</p>
          </div>
        </div>

        {/* Row 2: Monthly Trend + Pie */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-600 text-lg flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-400" />
                Monthly {taskLabel} Trend
              </h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Total</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Done</span>
                {reportType === 'ma' && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Fail</span>}
                <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${reportType === 'pm' ? 'bg-red-400' : 'bg-amber-400'}`} /> Overdue</span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyMA} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                  />
                  <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="done" fill="#10b981" name="Done" radius={[6, 6, 0, 0]} barSize={20} />
                  {reportType === 'ma' && <Bar dataKey="reportFail" fill="#ef4444" name="Fail" radius={[6, 6, 0, 0]} barSize={20} />}
                  <Bar dataKey="overdue" fill={reportType === 'pm' ? '#ef4444' : '#f59e0b'} name="Overdue" radius={[6, 6, 0, 0]} barSize={20} />
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
                        <span className="text-emerald-600">Done {v.done}</span>
                        {reportType === 'ma' && v.reportFail > 0 && <span className="text-red-500">Fail {v.reportFail}</span>}
                        {v.reportPass > 0 && <span className="text-emerald-500">Pass {v.reportPass}</span>}
                        {v.overdue > 0 && <span className={reportType === 'pm' ? 'text-red-500' : 'text-amber-600'}>Overdue {v.overdue}</span>}
                        <span>{v.completionRate}%</span>
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">Rank</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Device Name</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Model</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Serial</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Vendor</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Site</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total {taskLabel}</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Done</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Pass</th>
                    {reportType === 'ma' && <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fail</th>}
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRanking.map((e, i) => (
                    <tr key={e.deviceId + i} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i < 3 ? 'bg-red-50/30' : ''}`}>
                      <td className="py-3 px-3"><RankBadge rank={i + 1} /></td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-sm text-slate-700">{e.deviceName}</span>
                      </td>
                      <td className="py-3 px-3 text-sm text-slate-400">{e.model || '-'}</td>
                      <td className="py-3 px-3 text-sm text-slate-400 font-mono text-xs">{e.serial || '-'}</td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">{e.vendor || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-sm text-slate-400">{e.site || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm font-bold text-slate-600 bg-blue-50 px-2 py-0.5 rounded-lg">{e.total}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-sm font-medium text-slate-500">{e.done}</td>
                      <td className="py-3 px-3 text-center text-sm font-medium text-emerald-600">{e.reportPass}</td>
                      {reportType === 'ma' && <td className="py-3 px-3 text-center text-sm font-medium text-red-500">{e.reportFail}</td>}
                      <td className="py-3 px-3">
                        <ProgressBar value={e.total} max={maxEquipTotal} color={i < 3 ? 'bg-red-400' : 'bg-blue-300'} />
                      </td>
                    </tr>
                  ))}
                  {equipmentRanking.length === 0 && (
                    <tr><td colSpan={reportType === 'pm' ? 10 : 11} className="text-center py-8 text-sm text-slate-400">No data available</td></tr>
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
                        <span className="text-emerald-600">Done {s.done}</span>
                        {reportType === 'ma' && s.reportFail > 0 && <span className="text-red-500">Fail {s.reportFail}</span>}
                        {s.reportPass > 0 && <span className="text-emerald-500">Pass {s.reportPass}</span>}
                        {s.overdue > 0 && <span className={reportType === 'pm' ? 'text-red-500' : 'text-amber-600'}>Overdue {s.overdue}</span>}
                        <span>{s.completionRate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                {siteRanking.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No data available</p>}
              </div>
            </div>
          </div>
        )}

        {/* Vendor SLA Report - เฉพาะ MA (PM ไม่มี SLA) */}
        {reportType === 'ma' && vendorReportStats.length > 0 && (
          <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
              <Shield size={18} className="text-slate-400" />
              Vendor SLA Report - Pass/Fail Rate
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorReportStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="vendor" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#b0b8c4' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#b0b8c4' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                    <Legend />
                    <Bar dataKey="passReports" fill="#10b981" name="Pass" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="failReports" fill="#ef4444" name="Fail" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {vendorReportStats.map((v) => (
                  <div key={v.vendor} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-slate-700">{v.vendor}</span>
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${v.passRate >= 80 ? 'bg-emerald-100 text-emerald-700' : v.passRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          {v.passRate}% Pass
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${v.passRate}%` }} />
                        <div className="h-full bg-red-400 transition-all" style={{ width: `${100 - v.passRate}%` }} />
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-slate-400">
                        <span>Reports: {v.totalReports}</span>
                        <span className="text-emerald-600">Pass: {v.passReports}</span>
                        <span className="text-red-500">Fail: {v.failReports}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                  <span><strong className="text-amber-700">{e.deviceName}</strong> - {e.total} {taskLabel} times {reportType === 'ma' && e.reportFail > 0 && <span className="text-red-500">(Fail {e.reportFail})</span>}</span>
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
                <span>Follow up with vendors that have high fail rates to improve SLA</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>Plan preventive PM for sites with high MA volume</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
