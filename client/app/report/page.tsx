'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

import {
  BarChart,
  Bar,
  LineChart,
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
  MapPin,
  Server,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  Trophy,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Shield,
  ChevronDown,
} from 'lucide-react';
import {
  getMaDashboard,
  getPmDashboard,
  getDeviceRoles,
  getSitesLocation,
  getSiteRegistryCounts,
} from '@/lib/api';
import {
  formatDashboardRangeLabel,
  formatDateISO,
  getDashboardPeriodBounds,
} from '@/lib/dashboardPeriod';
import { OverdueTasksModal,CompletedTasksModal,InprocessTasksModal,PendingTasksModal  } from '@/components/ui/OverdueTasksModal';

type DashboardData = NonNullable<Awaited<ReturnType<typeof getMaDashboard>>['data']>;

const EMPTY: DashboardData = {
  months: 6,
  range: { start: '', endExclusive: '' },
  summary: {
    totalMA: 0,
    totalDone: 0,
    totalInprocess: 0,
    totalFailed: 0,
    totalPassed: 0,
    totalOverdue: 0,
    totalPending: 0,
    completionRate: 0,
    failRate: 0,
    topVendor: 'N/A',
    topVendorCount: 0,
    topEquipment: 'N/A',
    topEquipmentCount: 0,
    topEquipmentBasis: 'none',
  },
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
  Inprocess: '#fb923c',
  Pending: '#facc15',
  Overdue: '#ef4444',
};

const TREND_CHART_TOOLTIP_BOX: CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  color: '#475569',
  padding: '12px 16px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

/** One Bar + custom shape: fixed bar width (band / series count), only draw value > 0; bars touch, zeros do not widen neighbors. */
const MONTHLY_TREND_BAR_SEGMENTS_PM = [
  { key: 'total', fill: '#3b82f6' },
  { key: 'complete', fill: '#10b981' },
  { key: 'overdue', fill: '#ef4444' },
  { key: 'inprocess', fill: '#f97316' },
  { key: 'pending', fill: '#facc15' },
] as const;

const MONTHLY_TREND_BAR_SEGMENTS_MA = [
  { key: 'total', fill: '#3b82f6' },
  { key: 'complete', fill: '#10b981' },
  { key: 'pending', fill: '#facc15' },
  { key: 'inprocess', fill: '#f97316' },
  { key: 'overdue', fill: '#ef4444' },
] as const;

function monthlyTrendBundledBarShape(variant: 'pm' | 'ma') {
  const segments = variant === 'pm' ? MONTHLY_TREND_BAR_SEGMENTS_PM : MONTHLY_TREND_BAR_SEGMENTS_MA;
  // Recharts BarShapeProps — keep loose so custom rects stay compatible across versions
  return (props: any) => {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const height = Number(props.height);
    const payload = props.payload as Record<string, unknown> | undefined;
    const scale = Number(props.value ?? 0);
    if (!payload || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || scale <= 0) {
      return null;
    }
    const baseY = y + height;
    const slotW = width / segments.length;
    const ordered = segments.map((s) => ({
      key: s.key,
      fill: s.fill,
      v: Math.max(0, Number(payload[s.key] ?? 0) || 0),
    }));
    const visible = ordered.filter((p) => p.v > 0);
    if (!visible.length) return null;
    const usedW = visible.length * slotW;
    const startX = x + (width - usedW) / 2;
    const rx = Math.min(2, slotW / 2);
    return (
      <g>
        {visible.map((seg, j) => {
          const h = (seg.v / scale) * height;
          const yi = baseY - h;
          return (
            <rect
              key={seg.key}
              x={startX + j * slotW}
              y={yi}
              width={Math.max(0, slotW)}
              height={Math.max(0, h)}
              fill={seg.fill}
              rx={rx}
              ry={rx}
            />
          );
        })}
      </g>
    );
  };
}

const MONTHLY_TREND_BAR_SHAPE_PM = monthlyTrendBundledBarShape('pm');
const MONTHLY_TREND_BAR_SHAPE_MA = monthlyTrendBundledBarShape('ma');

function MonthlyTrendSummaryBarTooltip({
  active,
  payload,
  label,
  isMa,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Record<string, unknown> }>;
  label?: string | number;
  isMa: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const labelText = label === undefined || label === null ? '' : String(label);
  const items = isMa
    ? (MONTHLY_TREND_BAR_SEGMENTS_MA as readonly { key: string; fill: string }[]).map((s) => ({
        name:
          s.key === 'total'
            ? 'Total'
            : s.key === 'complete'
              ? 'Complete'
              : s.key === 'overdue'
                ? 'Overdue'
                : s.key === 'inprocess'
                  ? 'Inprocess'
                  : 'Pending',
        key: s.key,
        fill: s.fill,
      }))
    : (MONTHLY_TREND_BAR_SEGMENTS_PM as readonly { key: string; fill: string }[]).map((s) => ({
        name:
          s.key === 'total'
            ? 'Total'
            : s.key === 'complete'
              ? 'Complete'
              : s.key === 'overdue'
                ? 'Overdue'
                : s.key === 'inprocess'
                  ? 'Inprocess'
                  : 'Pending',
        key: s.key,
        fill: s.fill,
      }));
  return (
    <div style={TREND_CHART_TOOLTIP_BOX}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{labelText}</div>
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-2 text-sm" style={{ marginTop: 2 }}>
          <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: it.fill }} />
          <span>
            {it.name}: <strong>{Number(row[it.key] ?? 0) || 0}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Display-only: normalize location strings to English in this panel (e.g. Thai floor words → "Floor N").
 * Regex matches Thai source data from the API, not user-facing copy.
 */
function formatLocationLabelEn(s: string): string {
  const t = s.trim();
  if (!t) return '—';
  return t
    .replace(/ชั้น\s*(\d+)/gi, 'Floor $1')
    .replace(/ชั้น/gi, 'Floor')
    .replace(/\s+/g, ' ')
    .trim();
}

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

/** Model column label for equipment ranking rows (fallback to deviceName when model is empty). */
function equipmentRowModelLabel(e: { model?: string | null; deviceName?: string | null }) {
  const m = (e.model ?? '').trim();
  if (m) return m;
  return (e.deviceName ?? '').trim();
}

/** Watch List (MA): group key = model only; strip serial from "Model / Serial" style names. */
function maWatchListModelKey(e: { model?: string | null; deviceName?: string | null }) {
  const m = (e.model ?? '').trim();
  if (m && m !== 'Unknown Model') return m;
  const fallback = (e.deviceName ?? '').trim();
  if (fallback.includes(' / ')) return fallback.split(' / ')[0].trim();
  return fallback || 'Unknown';
}

/** Recharts Y-axis tick: line-wrap labels + full name in tooltip to avoid overlapping site/vendor labels */
function RankingBarYAxisTick({
  x,
  y,
  payload,
  labelWidth = 220,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  labelWidth?: number;
}) {
  const xPos = Number(x ?? 0);
  const yPos = Number(y ?? 0);
  const text = (payload?.value ?? '').toString();
  const h = 52;
  return (
    <g transform={`translate(${xPos},${yPos})`}>
      <foreignObject x={-labelWidth - 10} y={-h / 2} width={labelWidth} height={h}>
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <span
            title={text}
            style={{
              maxWidth: '100%',
              fontSize: 10,
              lineHeight: 1.4,
              color: '#475569',
              wordBreak: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              textAlign: 'right',
            }}
          >
            {text}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>('pm');
  const [timeFilter, setTimeFilter] = useState('6 Months');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedEndMonth, setSelectedEndMonth] = useState<string>('all');
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const [periodMenuPos, setPeriodMenuPos] = useState<{ top: number; right: number } | null>(null);
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
  const [sitesList, setSitesList] = useState<{ SLid: number; Sid: number; lid: number; SiteName: string; Location2: string; SOF?: string; Refer_SOF?: string }[]>([]);
  const [overdueModalOpen, setOverdueModalOpen] = useState(false);
  const [maTrendView, setMaTrendView] = useState<'summary' | 'top-model'>('summary');
  const [maTrendRoleFilterId, setMaTrendRoleFilterId] = useState<number | null>(null);
  const [maTrendSiteFilterId, setMaTrendSiteFilterId] = useState<number | null>(null);
  const [maTrendModelFilter, setMaTrendModelFilter] = useState<string | null>(null);
  const [maTrendSidFilter, setMaTrendSidFilter] = useState<string>('');
  const [maTrendLidFilter, setMaTrendLidFilter] = useState<string>('');
  /** Line (default) vs bar for Monthly trend when showing summary-style series (PM or MA summary). */
  const [monthlyTrendChartKind, setMonthlyTrendChartKind] = useState<'line' | 'bar'>('line');
  const [completedModalOpen, setCompletedModalOpen] = useState(false);
  const [inprocessModalOpen, setInprocessModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [siteRegistryCounts, setSiteRegistryCounts] = useState<{ siteCount: number; locationCount: number } | null>(null);
  const [siteRegistryCountsLoading, setSiteRegistryCountsLoading] = useState(false);
  const summaryCardsScrollRef = useRef<HTMLDivElement>(null);
  const [summaryAtScrollStart, setSummaryAtScrollStart] = useState(true);
  const [summaryAtScrollEnd, setSummaryAtScrollEnd] = useState(false);
  const dragRef = useRef({ isDragging: false, startX: 0, scrollLeftStart: 0 });

  const updateSummaryScrollArrows = useCallback(() => {
    const el = summaryCardsScrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const sl = el.scrollLeft;
    setSummaryAtScrollStart(sl <= 2);
    setSummaryAtScrollEnd(maxScroll <= 2 || sl >= maxScroll - 2);
  }, []);

  const scrollSummaryCarousel = useCallback((slideIndex: 0 | 1) => {
    const el = summaryCardsScrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const target = slideIndex === 0 ? 0 : maxScroll;
    el.scrollTo({ left: target, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDeviceRoles().then((res) => {
      if (!cancelled && res?.success && Array.isArray(res.data)) setDeviceRolesList(res.data);
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
    if (reportType !== 'pm') return;
    let cancelled = false;
    setSiteRegistryCountsLoading(true);
    getSiteRegistryCounts()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res.data && typeof res.data.siteCount === 'number' && typeof res.data.locationCount === 'number') {
          setSiteRegistryCounts({
            siteCount: res.data.siteCount,
            locationCount: res.data.locationCount,
          });
        } else {
          setSiteRegistryCounts(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSiteRegistryCounts(null);
      })
      .finally(() => {
        if (!cancelled) setSiteRegistryCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportType]);

  useEffect(() => {
    const el = summaryCardsScrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    requestAnimationFrame(() => updateSummaryScrollArrows());
  }, [data, updateSummaryScrollArrows]);

  useEffect(() => {
    const el = summaryCardsScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateSummaryScrollArrows());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateSummaryScrollArrows]);

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

  /** PM equipment ranking is per-model (aggregated); role/site filters do not apply */
  useEffect(() => {
    if (reportType !== 'pm') return;
    setEquipmentRoleFilter(null);
    setEquipmentSiteFilter(null);
    setEquipmentOrderBy((o) => (o === 'vendor' ? 'total' : o));
  }, [reportType]);

  useEffect(() => {
    if (!periodDropdownOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = periodDropdownRef.current?.contains(target) ?? false;
      const inMenu = periodMenuRef.current?.contains(target) ?? false;
      if (!inButton && !inMenu) setPeriodDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [periodDropdownOpen]);

  useEffect(() => {
    if (!periodDropdownOpen) return;
    const updatePos = () => {
      const root = periodDropdownRef.current;
      const btn = root?.querySelector('button');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      // fixed menu anchored to button's right edge (viewport-based)
      setPeriodMenuPos({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('resize', updatePos);
    };
  }, [periodDropdownOpen]);

  useEffect(() => {
    if (!periodDropdownOpen) return;
    const onScroll = () => setPeriodDropdownOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [periodDropdownOpen]);

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
      if (month == null) return { year };
      const endRaw =
        selectedEndMonth && selectedEndMonth !== 'all' ? parseInt(selectedEndMonth, 10) : month;
      const endMonth =
        !Number.isNaN(endRaw) && endRaw >= 1 && endRaw <= 12 ? Math.max(month, endRaw) : month;
      if (endMonth === month) return { year, month };
      return { year, month, endMonth };
    }
    return null;
  }, [selectedYear, selectedMonth, selectedEndMonth]);

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

  const { summary, monthlyMA, vendorRanking, siteRanking, equipmentRanking, range } = data;
  const isMa = reportType === 'ma';
  const taskLabel = reportType === 'ma' ? 'MA' : 'PM';
  /** Equipment tab / export / Top 15 section — MA uses product wording; PM keeps “Model”. */
  const equipmentLabel = isMa ? 'Most Serviced Equipment' : 'Model';
  const maCompleteCount = Number(summary.totalPassed || 0) + Number(summary.totalFailed || 0);

  /** PM: hide Top Sites tab (many tied rows — low signal) */
  useEffect(() => {
    if (reportType === 'pm' && activeTab === 'site') setActiveTab('vendor');
  }, [reportType, activeTab]);

  const maTrendRoleOptions = useMemo(() => {
    const allow = data?.availableFilters?.roleIds;
    if (!Array.isArray(allow) || allow.length === 0) return deviceRolesList;
    const set = new Set(allow);
    return deviceRolesList.filter((r) => set.has(r.DeRoleid));
  }, [data?.availableFilters?.roleIds, deviceRolesList]);

  const maTrendSiteOptions = useMemo(() => {
    const allow = data?.availableFilters?.siteIds;
    if (!Array.isArray(allow) || allow.length === 0) return sitesList;
    const set = new Set(allow);
    return sitesList.filter((s) => set.has(s.SLid));
  }, [data?.availableFilters?.siteIds, sitesList]);

  // Distinct Site (Sid-level) options for cascaded filter — sites that have MA data in range
  const maTrendSidOptions = useMemo(() => {
    const allow = data?.availableFilters?.siteIds;
    const allowedSlids = Array.isArray(allow) && allow.length > 0 ? new Set(allow) : null;
    const map = new Map<number, string>();
    for (const s of sitesList) {
      if (allowedSlids && !allowedSlids.has(s.SLid)) continue;
      if (!map.has(s.Sid)) {
        map.set(s.Sid, s.SiteName);
      }
    }
    return Array.from(map.entries())
      .map(([Sid, name]) => ({ Sid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.availableFilters?.siteIds, sitesList]);

  // Distinct Location (lid-level) for selected Sid — locations that have MA data in range
  const maTrendLidOptions = useMemo(() => {
    if (!maTrendSidFilter) return [];
    const sidNum = Number(maTrendSidFilter);
    if (Number.isNaN(sidNum)) return [];
    const allow = data?.availableFilters?.siteIds;
    const allowedSlids = Array.isArray(allow) && allow.length > 0 ? new Set(allow) : null;
    const map = new Map<number, string>();
    for (const s of sitesList) {
      if (s.Sid !== sidNum) continue;
      if (allowedSlids && !allowedSlids.has(s.SLid)) continue;
      const label = s.Location2 || `LID ${s.lid}`;
      if (!map.has(s.lid)) {
        map.set(s.lid, label);
      }
    }
    return Array.from(map.entries())
      .map(([lid, label]) => ({ lid, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [maTrendSidFilter, data?.availableFilters?.siteIds, sitesList]);

  // Model options for MA top-model trend (unique models from topModelTrend / topModelTrendByRole)
  const maTrendModelOptions = useMemo(() => {
    const models = new Set<string>();
    if (data?.topModelTrend?.model) {
      models.add(String(data.topModelTrend.model));
    }
    if (Array.isArray(data?.topModelTrendByRole)) {
      for (const r of data.topModelTrendByRole) {
        if (r?.model) models.add(String(r.model));
      }
    }
    return Array.from(models).sort((a, b) => a.localeCompare(b));
  }, [data?.topModelTrend?.model, data?.topModelTrendByRole]);

  const rangeLabel = useMemo(() => {
    if (dashboardParams != null) {
      const b = getDashboardPeriodBounds(months, dashboardParams);
      return formatDashboardRangeLabel(b, MONTH_LABELS);
    }
    if (!range?.start || !range?.endExclusive) return null;
    const startStr = range.start.split('T')[0];
    const endStr = range.endExclusive.split('T')[0];
    const [sy, sm] = startStr.split('-').map(Number);
    const [ey, em] = endStr.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, 1);
    const endDate = new Date(ey, em, 0);
    const fmt = (d: Date) => `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    return `${fmt(startDate)} - ${fmt(endDate)}`;
  }, [dashboardParams, months, range?.start, range?.endExclusive]);

  const periodLabel = useMemo(() => {
    if (selectedYear) {
      const y = selectedYear;
      if (selectedMonth && selectedMonth !== 'all') {
        const sm = parseInt(selectedMonth, 10);
        const em =
          selectedEndMonth && selectedEndMonth !== 'all' ? parseInt(selectedEndMonth, 10) : sm;
        const startLabel = sm >= 1 && sm <= 12 ? MONTH_LABELS[sm - 1] : 'All';
        const endLabel = em >= 1 && em <= 12 ? MONTH_LABELS[em - 1] : startLabel;
        if (em !== sm && !Number.isNaN(em) && em >= sm) {
          return `Custom: ${startLabel} – ${endLabel} ${y}`;
        }
        return `Custom: ${startLabel} ${y}`;
      }
      return `Custom: ${y}`;
    }
    return timeFilter;
  }, [selectedYear, selectedMonth, selectedEndMonth, timeFilter, MONTH_LABELS]);

  /** ช่วงสำหรับกราฟรายเดือน — custom ใช้คำนวณจาก UI (range จาก API อาจไม่ใส่ end_month ครบ) */
  const trendRangeForCharts = useMemo(() => {
    if (dashboardParams != null) {
      const b = getDashboardPeriodBounds(months, dashboardParams);
      return {
        start: formatDateISO(b.start),
        endExclusive: formatDateISO(b.endExclusive),
      };
    }
    if (range?.start && range?.endExclusive) return range;
    return null;
  }, [dashboardParams, months, range]);

  const monthlyTrendData = useMemo(() => {
    // Backend may omit months with 0 data; fill missing months in the selected range with zeros.
    if (!trendRangeForCharts?.start || !trendRangeForCharts?.endExclusive) {
      return monthlyMA.map((item) => ({
        ...item,
        complete: Number(item.reportPass || 0) + Number(item.reportFail || 0),
      }));
    }

    const startStr = trendRangeForCharts.start.split('T')[0];
    const endStr = trendRangeForCharts.endExclusive.split('T')[0];
    const [sy, sm] = startStr.split('-').map(Number);
    const [ey, em] = endStr.split('-').map(Number);
    if (!sy || !sm || !ey || !em) {
      return monthlyMA.map((item) => ({
        ...item,
        complete: Number(item.reportPass || 0) + Number(item.reportFail || 0),
      }));
    }

    const byKey = new Map<string, any>();
    for (const it of monthlyMA) {
      if (it?.monthKey) byKey.set(String(it.monthKey), it);
    }

    const result: any[] = [];
    const cur = new Date(sy, sm - 1, 1);
    const endExclusive = new Date(ey, em - 1, 1); // month start of endExclusive
    while (cur < endExclusive) {
      const y = cur.getFullYear();
      const m = cur.getMonth() + 1;
      const mm = String(m).padStart(2, '0');
      const key = `${y}-${mm}-01`;
      const label = MONTH_LABELS[m - 1] ?? `${m}`;
      const found = byKey.get(key);
      const base = found ?? {
        month: label,
        monthKey: key,
        total: 0,
        done: 0,
        reportPass: 0,
        reportFail: 0,
        inprocess: 0,
        overdue: 0,
        pending: 0,
      };
      result.push({
        ...base,
        month: base.month ?? label,
        monthKey: base.monthKey ?? key,
        total: Number(base.total || 0),
        done: Number(base.done || 0),
        reportPass: Number(base.reportPass || 0),
        reportFail: Number(base.reportFail || 0),
        inprocess: Number(base.inprocess || 0),
        overdue: Number(base.overdue || 0),
        pending: Number(base.pending || 0),
        complete: Number(base.reportPass || 0) + Number(base.reportFail || 0),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [monthlyMA, trendRangeForCharts?.start, trendRangeForCharts?.endExclusive, MONTH_LABELS]);

  // Top-model trend line (MA only) – single series when a role is selected
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

  // Top-model trend by role (MA only) – multiple series when Role = All
  const topModelTrendByRoleData = useMemo(() => {
    if (!isMa || !data?.topModelTrendByRole?.length || !monthlyTrendData.length) return null;
    const byRoleByMonth: Record<string, Record<string, number>> = {};
    for (const r of data.topModelTrendByRole) {
      const roleKey = String(r.roleName || r.roleId).trim() || `Role ${r.roleId}`;
      byRoleByMonth[roleKey] = {};
      for (const p of r.points || []) {
        if (!p?.month_start) continue;
        byRoleByMonth[roleKey][p.month_start] = Number(p.total || 0);
      }
    }
    return monthlyTrendData.map((m) => {
      const row: Record<string, unknown> = {
        month: m.month,
        monthKey: m.monthKey,
        total: m.total,
        complete: m.complete,
        inprocess: m.inprocess,
        overdue: m.overdue,
        pending: m.pending,
      };
      for (const roleKey of Object.keys(byRoleByMonth)) {
        row[roleKey] = byRoleByMonth[roleKey][m.monthKey] ?? 0;
      }
      return row;
    });
  }, [isMa, data?.topModelTrendByRole, monthlyTrendData]);

  /** Data for the main monthly trend chart (summary / PM, or MA top-model when that view is active). */
  const monthlyTrendMainChartData = useMemo(() => {
    if (isMa && maTrendView === 'top-model') {
      return (
        (maTrendRoleFilterId == null && topModelTrendByRoleData
          ? topModelTrendByRoleData
          : topModelTrendData) ?? monthlyTrendData
      );
    }
    return monthlyTrendData;
  }, [
    isMa,
    maTrendView,
    maTrendRoleFilterId,
    topModelTrendByRoleData,
    topModelTrendData,
    monthlyTrendData,
  ]);

  /** Drives Y-scale for bundled monthly bars; equals max of stacked metrics that month. */
  const monthlyTrendBarPackData = useMemo(() => {
    return monthlyTrendMainChartData.map((row) => {
      const r = row as Record<string, unknown>;
      const total = Number(r.total ?? 0) || 0;
      const complete = Number(r.complete ?? 0) || 0;
      const inprocess = Number(r.inprocess ?? 0) || 0;
      const pending = Number(r.pending ?? 0) || 0;
      const overdue = Number(r.overdue ?? 0) || 0;
      const scale = isMa
        ? Math.max(total, complete, overdue, inprocess, pending)
        : Math.max(total, complete, overdue, inprocess, pending);
      return { ...row, _groupBarScale: scale };
    });
  }, [monthlyTrendMainChartData, isMa]);

  const topModelRoleColors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  /** Result Breakdown donut — same figures as the summary cards above */
  const pieData = reportType === 'pm'
    ? [
        { name: 'Done', value: summary.totalDone },
        { name: 'Inprocess', value: summary.totalInprocess },
        { name: 'Pending', value: summary.totalPending },
        { name: 'Overdue', value: summary.totalOverdue },
      ].filter((d) => d.value > 0)
    : [
        { name: 'Complete', value: maCompleteCount },
        { name: 'Inprocess', value: summary.totalInprocess },
        { name: 'Pending', value: summary.totalPending },
        { name: 'Overdue', value: summary.totalOverdue },
      ].filter((d) => d.value > 0);

  /** Equipment tab filters: options only from current Top 15 (equipmentRanking), not full DB lists */
  const equipmentModels = useMemo(() => {
    const set = new Set<string>();
    for (const e of equipmentRanking) {
      const label = equipmentRowModelLabel(e);
      if (label) set.add(label);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equipmentRanking]);

  const equipmentRoles = useMemo(() => {
    const set = new Set<string>();
    for (const e of equipmentRanking) {
      const r = (e.role ?? '').trim();
      if (r) set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equipmentRanking]);

  const equipmentSites = useMemo(() => {
    const set = new Set<string>();
    for (const e of equipmentRanking) {
      const s = (e.site ?? '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equipmentRanking]);

  const filteredEquipmentRanking = useMemo(() => {
    let list = equipmentRanking;
    if (isMa && equipmentRoleFilter) {
      const want = equipmentRoleFilter.toLowerCase();
      list = list.filter((e) => (e.role ?? '').toLowerCase() === want);
    }
    if (equipmentModelFilter) {
      const want = equipmentModelFilter.toLowerCase();
      list = list.filter((e) => equipmentRowModelLabel(e).toLowerCase() === want);
    }
    if (isMa && equipmentSiteFilter) {
      const want = equipmentSiteFilter.toLowerCase();
      list = list.filter((e) => (e.site ?? '').toLowerCase() === want);
    }
    const orderKey = !isMa && equipmentOrderBy === 'vendor' ? 'total' : equipmentOrderBy;
    if (orderKey === 'total') return list;
    const key = orderKey;
    return [...list].sort((a, b) => {
      const va = String((a as Record<string, unknown>)[key] ?? '').toLowerCase();
      const vb = String((b as Record<string, unknown>)[key] ?? '').toLowerCase();
      const cmp = va.localeCompare(vb);
      return cmp !== 0 ? cmp : b.total - a.total;
    });
  }, [equipmentRanking, equipmentRoleFilter, equipmentModelFilter, equipmentSiteFilter, equipmentOrderBy, isMa]);

  /** MA Watch List: top models by total MA count (aggregated across sites), no serials. */
  const maWatchListByModel = useMemo(() => {
    const map = new Map<string, { model: string; total: number; inprocess: number; pending: number }>();
    for (const e of equipmentRanking) {
      const model = maWatchListModelKey(e);
      const cur = map.get(model);
      const t = Number(e.total) || 0;
      const ip = Number(e.inprocess) || 0;
      const pend = Number(e.pending) || 0;
      if (!cur) map.set(model, { model, total: t, inprocess: ip, pending: pend });
      else {
        cur.total += t;
        cur.inprocess += ip;
        cur.pending += pend;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [equipmentRanking]);

  /** PM — location rows from /api/sites/locations, sorted by site then location */
  const sitesLocationDetailRows = useMemo(() => {
    return [...sitesList].sort((a, b) => {
      const an = (a.SiteName || '').localeCompare(b.SiteName || '', undefined, { sensitivity: 'base' });
      if (an !== 0) return an;
      return (a.Location2 || '').localeCompare(b.Location2 || '', undefined, { sensitivity: 'base' });
    });
  }, [sitesList]);

  /** PM — group by Site (Sid): organisation on the left, child locations on the right */
  const sitesLocationGroupedBySite = useMemo(() => {
    const map = new Map<
      string,
      { siteName: string; sid: number; locations: { SLid: number; label: string; sof?: string }[] }
    >();
    for (const row of sitesLocationDetailRows) {
      const siteName = row.SiteName?.trim() || '—';
      const key =
        typeof row.Sid === 'number' && row.Sid > 0 ? `sid:${row.Sid}` : `name:${siteName}`;
      const locLabel = row.Location2?.trim() || '—';
      const sof = String(row.SOF ?? row.Refer_SOF ?? '').trim() || undefined;
      const sid = typeof row.Sid === 'number' && row.Sid > 0 ? row.Sid : 0;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { siteName, sid, locations: [{ SLid: row.SLid, label: locLabel, sof }] });
      } else {
        cur.locations.push({ SLid: row.SLid, label: locLabel, sof });
        if (siteName !== '—') cur.siteName = siteName;
        if (sid > 0) cur.sid = sid;
      }
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        locations: [...g.locations].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
        ),
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' }));
  }, [sitesLocationDetailRows]);

  useEffect(() => {
    const models = new Set(equipmentModels.map((m) => m.toLowerCase()));
    if (equipmentModelFilter && !models.has(equipmentModelFilter.toLowerCase())) {
      setEquipmentModelFilter(null);
    }
    const roles = new Set(equipmentRoles.map((r) => r.toLowerCase()));
    if (equipmentRoleFilter && !roles.has(equipmentRoleFilter.toLowerCase())) {
      setEquipmentRoleFilter(null);
    }
    const sites = new Set(equipmentSites.map((s) => s.toLowerCase()));
    if (equipmentSiteFilter && !sites.has(equipmentSiteFilter.toLowerCase())) {
      setEquipmentSiteFilter(null);
    }
  }, [
    equipmentRanking,
    equipmentModels,
    equipmentRoles,
    equipmentSites,
    equipmentModelFilter,
    equipmentRoleFilter,
    equipmentSiteFilter,
  ]);

  const maxVendorTotal = vendorRanking.length > 0 ? vendorRanking[0].total : 1;
  const maxSiteTotal = siteRanking.length > 0 ? siteRanking[0].total : 1;
  const maxEquipRankBar = useMemo(() => {
    if (!filteredEquipmentRanking.length) return 1;
    return Math.max(...filteredEquipmentRanking.map((e) => e.total), 1);
  }, [filteredEquipmentRanking]);

  const rankingBarBandPx = 58;
  const vendorBarChartHeight = useMemo(
    () => Math.min(640, Math.max(300, vendorRanking.length * rankingBarBandPx + 80)),
    [vendorRanking.length]
  );
  const siteBarChartHeight = useMemo(
    () => Math.min(640, Math.max(300, siteRanking.length * rankingBarBandPx + 80)),
    [siteRanking.length]
  );

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
      row(['Total Inprocess', String(summary.totalInprocess)]);
      row(['Total Pass (Report)', String(summary.totalPassed)]);
      row(['Total Overdue', String(summary.totalOverdue)]);
      row(['Total Pending', String(summary.totalPending)]);
    }
    row(['Completion Rate (%)', String(summary.completionRate)]);
    row(['Top MA Vendor', summary.topVendor]);
    row(['Top Vendor MA Count', String(summary.topVendorCount)]);
    row([equipmentLabel, summary.topEquipment]);
    {
      const b = summary.topEquipmentBasis ?? 'none';
      const countLabel = isMa
        ? `${taskLabel} tasks (top model)`
        : b === 'failed_reports'
          ? 'Failed PM reports (top model)'
          : b === 'pm_tasks'
            ? 'PM tasks (top model, no failures in range)'
            : 'PM top model (no equipment rows)';
      row([countLabel, String(summary.topEquipmentCount)]);
    }
    nl();

    // 2) Monthly Trend
    lines.push(escape(`SECTION: Monthly ${taskLabel} Trend`));
    if (!isMa) {
      row(['Month', 'Total', 'Done', 'Inprocess', 'Pass', 'Overdue', 'Pending']);
      monthlyMA.forEach((m) => {
        row([
          m.month,
          String(m.total),
          String(m.done),
          String(m.inprocess ?? 0),
          String(m.reportPass),
          String(m.overdue),
          String(m.pending ?? Math.max(0, Number(m.total) - Number(m.done))),
        ]);
      });
    } else {
      row(['Month', 'Total', 'Done', 'Inprocess', 'Pending', 'Overdue']);
      monthlyMA.forEach((m) => {
        row([
          m.month,
          String(m.total),
          String(m.done),
          String(m.inprocess),
          String(m.pending),
          String(m.overdue ?? 0),
        ]);
      });
    }
    nl();

    // 3) Result Breakdown
    lines.push(escape(`SECTION: ${taskLabel} Result Breakdown`));
    if (!isMa) {
      row(['Done', 'Inprocess', 'Pending', 'Overdue']);
      row([
        String(summary.totalDone),
        String(summary.totalInprocess),
        String(summary.totalPending),
        String(summary.totalOverdue),
      ]);
    } else {
      row(['Complete', 'Inprocess', 'Pending', 'Overdue']);
      row([
        String(maCompleteCount),
        String(summary.totalInprocess),
        String(summary.totalPending),
        String(summary.totalOverdue),
      ]);
    }
    nl();

    // 4) Vendor Ranking
    lines.push(escape(`SECTION: Vendor Ranking (Top ${taskLabel} Vendors)`));
    if (!isMa) {
      row(['Rank', 'Vendor', 'Total', 'Done', 'Inprocess', 'Pass', 'Overdue', 'Completion Rate (%)']);
      vendorRanking.forEach((v, i) => {
        row([
          String(i + 1),
          v.vendor,
          String(v.total),
          String(v.done),
          String(v.inprocess ?? 0),
          String(v.reportPass),
          String(v.overdue),
          String(v.completionRate),
        ]);
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
      row(['Rank', 'Site', 'Total', 'Done', 'Inprocess', 'Pass', 'Overdue', 'Completion Rate (%)']);
      siteRanking.forEach((s, i) => {
        row([
          String(i + 1),
          s.site,
          String(s.total),
          String(s.done),
          String(s.inprocess ?? 0),
          String(s.reportPass),
          String(s.overdue),
          String(s.completionRate),
        ]);
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
    const filterParts = [
      isMa && equipmentRoleFilter && `Role: ${equipmentRoleFilter}`,
      equipmentModelFilter && `Model: ${equipmentModelFilter}`,
      isMa && equipmentSiteFilter && `Site: ${equipmentSiteFilter}`,
    ].filter(Boolean) as string[];
    lines.push(escape(`SECTION: ${equipmentLabel} (Top 15)${filterParts.length ? ` - ${filterParts.join(', ')}` : ''}`));
    if (!isMa) {
      row(['Rank', 'Model', 'Primary site', 'In-use devices']);
      exportEquipment.forEach((e, i) => {
        row([
          String(i + 1),
          equipmentRowModelLabel(e) || '-',
          String(e.site || '—'),
          String(e.total ?? 0),
        ]);
      });
    } else {
      row(['Rank', 'Model', 'Role', 'Vendor', 'Site', `Total ${taskLabel}`, 'Done', 'Inprocess', 'Pending']);
      exportEquipment.forEach((e, i) => {
        row([String(i + 1), equipmentRowModelLabel(e) || '-', e.role ?? '-', e.vendor || '-', e.site || '-', String(e.total), String(e.done), String(e.inprocess), String(e.pending)]);
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
              <div ref={periodDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPeriodDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-0 shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50"
                  aria-haspopup="listbox"
                  aria-expanded={periodDropdownOpen}
                >
                  <Calendar size={16} className="text-slate-400" />
                  <span className="text-slate-500">Period</span>
                  <span className="font-semibold text-slate-800">{periodLabel}</span>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>

                {periodDropdownOpen && periodMenuPos && createPortal(
                  <div
                    ref={periodMenuRef}
                    className="fixed w-max max-w-[calc(100vw-24px)] rounded-xl bg-white shadow-lg border border-slate-100 p-1.5 z-[9999]"
                    style={{ top: periodMenuPos.top, right: periodMenuPos.right }}
                  >
                    <div className="px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Period
                    </div>
                    <div className="grid grid-cols-2 items-start gap-x-2 px-1">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {['3 Months', '6 Months'].map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setTimeFilter(label);
                              setSelectedYear('');
                              setSelectedMonth('all');
                              setSelectedEndMonth('all');
                              setPeriodDropdownOpen(false);
                            }}
                            className={`text-left px-2 py-1 rounded-md text-xs hover:bg-slate-50 ${
                              !selectedYear && timeFilter === label ? 'bg-slate-50 font-semibold text-slate-800' : 'text-slate-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5 border-l border-slate-100 pl-2">
                        {['1 Year', '2 Years', '3 Years', '4 Years', '5 Years'].map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setTimeFilter(label);
                              setSelectedYear('');
                              setSelectedMonth('all');
                              setSelectedEndMonth('all');
                              setPeriodDropdownOpen(false);
                            }}
                            className={`text-left px-2 py-1 rounded-md text-xs hover:bg-slate-50 ${
                              !selectedYear && timeFilter === label ? 'bg-slate-50 font-semibold text-slate-800' : 'text-slate-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="my-0.5 h-px bg-slate-100" />
                    <div className="px-2 pb-1.5 pt-0">
                    <div className="pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Custom
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-nowrap items-end gap-1.5">
                        <div className="shrink-0">
                          <label className="mb-1.5 block text-[10px] font-semibold leading-tight text-slate-500">
                            Year
                          </label>
                          <select
                            aria-label="Year"
                            value={selectedYear}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSelectedYear(v);
                              if (!v) {
                                setSelectedMonth('all');
                                setSelectedEndMonth('all');
                              }
                            }}
                            className="w-[5rem] shrink-0 rounded-md border border-slate-200 bg-white px-1 py-1 text-[11px] tabular-nums leading-tight text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            {yearOptions.map((o) => (
                              <option key={o.value || 'x'} value={o.value}>
                                {o.value ? o.label : '—'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="shrink-0">
                          <label className="mb-1.5 block text-[10px] font-semibold leading-tight text-slate-500">
                            Start Month
                          </label>
                          <select
                            aria-label="Start month"
                            value={selectedMonth}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSelectedMonth(v);
                              if (v === 'all') setSelectedEndMonth('all');
                              else {
                                const sm = parseInt(v, 10);
                                const em =
                                  selectedEndMonth !== 'all'
                                    ? parseInt(selectedEndMonth, 10)
                                    : sm;
                                if (
                                  Number.isNaN(em) ||
                                  selectedEndMonth === 'all' ||
                                  em < sm
                                ) {
                                  setSelectedEndMonth(v);
                                }
                              }
                            }}
                            disabled={!selectedYear}
                            className="w-[4.5rem] shrink-0 rounded-md border border-slate-200 bg-white px-1 py-1 text-[11px] leading-tight text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                          >
                            <option value="all">All</option>
                            {MONTH_LABELS.map((label, i) => (
                              <option key={label} value={String(i + 1)}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="shrink-0">
                          <label className="mb-1.5 block text-[10px] font-semibold leading-tight text-slate-500">
                            End Month
                          </label>
                          <select
                            aria-label="End month"
                            value={
                              selectedMonth === 'all'
                                ? 'all'
                                : selectedEndMonth !== 'all'
                                  ? selectedEndMonth
                                  : selectedMonth
                            }
                            onChange={(e) => setSelectedEndMonth(e.target.value)}
                            disabled={!selectedYear || selectedMonth === 'all'}
                            className="w-[4.5rem] shrink-0 rounded-md border border-slate-200 bg-white px-1 py-1 text-[11px] leading-tight text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                          >
                            {selectedMonth === 'all' && (
                              <option value="all">—</option>
                            )}
                            {MONTH_LABELS.map((label, i) => {
                              const m = i + 1;
                              const sm =
                                selectedMonth !== 'all' ? parseInt(selectedMonth, 10) : 1;
                              if (selectedMonth !== 'all' && m < sm) return null;
                              return (
                                <option key={label} value={String(m)}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedYear('');
                            setSelectedMonth('all');
                            setSelectedEndMonth('all');
                          }}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodDropdownOpen(false)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-white hover:bg-slate-700"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
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
            {/* Bottom Insights — MA only (hidden for PM Report) */}
        {isMa && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50/70 border border-blue-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
              <TrendingUp size={16} className="text-blue-500" />
              Overview
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>
                  Total MA plan:{' '}
                  <strong className="text-blue-600 tabular-nums">{summary.totalMA.toLocaleString()}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>
                  Completion plan:{' '}
                  <strong className="text-emerald-600 tabular-nums">{summary.completionRate}%</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>{reportType === 'ma' ? 'Most repaired' : 'Most serviced'}: <strong className="text-red-500">{summary.topEquipment}</strong> ({summary.topEquipmentCount} times)</span>
              </li>
            </ul>
          </div>

          <div className="bg-amber-50/70 border border-amber-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-amber-500" />
              Watch List
            </h3>
            <p className="text-xs text-amber-800/80 mb-3">
              Models with the highest MA repair frequency (aggregated by model, all sites).
            </p>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {maWatchListByModel.map((row) => (
                <li key={row.model} className="flex items-start gap-2">
                  <ChevronRight size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-amber-700">{row.model}</strong>
                    <span className="text-slate-600"> — {row.total} MA times</span>
                    {(row.inprocess > 0 || row.pending > 0) && (
                      <span className="text-orange-500"> (Inprocess {row.inprocess}, Pending {row.pending})</span>
                    )}
                  </span>
                </li>
              ))}
              {maWatchListByModel.length === 0 && <li className="text-slate-400">No data available</li>}
            </ul>
          </div>
        </div>
        )}

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

        {/* Summary Cards — horizontal scroll (arrows + drag) */}
        <div className="relative w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => scrollSummaryCarousel(0)}
              disabled={summaryAtScrollStart}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-900/10 ring-2 ring-blue-200/70 transition-all hover:bg-blue-100 hover:border-blue-600 hover:text-blue-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-sm disabled:ring-0 disabled:opacity-50"
              title="Scroll left — drag the row to scroll"
              aria-label="Scroll summary cards left"
            >
              <ChevronLeft size={22} strokeWidth={2.5} className="shrink-0" />
            </button>
            <div
              ref={summaryCardsScrollRef}
              onScroll={updateSummaryScrollArrows}
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
              className="flex min-w-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden scroll-smooth touch-pan-x select-none cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
            <div className="flex gap-4 shrink-0">
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
                  <div className="flex items-center justify-between gap-1 min-h-[1.25rem]">
                    <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide min-w-0">Top {taskLabel} Vendor</span>
                    <Trophy size={16} className="text-violet-400 shrink-0" />
                  </div>
                  <p className="mx-auto flex min-h-[2.75rem] w-full max-w-full flex-1 items-center justify-center px-0.5 pt-1 text-center text-[11px] font-bold leading-snug text-violet-700 break-words [overflow-wrap:anywhere]">
                    {summary.topVendor}
                  </p>
                  <p className="mt-auto pt-2 text-xs text-violet-400">{summary.topVendorCount} {taskLabel} tasks</p>
                </div>
                {isMa && (
                  <div className="shrink-0 w-[calc(17vw-0.6rem)] min-w-[120px] bg-amber-50/80 border border-amber-300 rounded-[2rem] shadow-sm p-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-1 min-h-[1.25rem]">
                      <span className="min-w-0 max-w-[calc(100%-1.5rem)] text-[10px] font-semibold leading-tight tracking-wide text-amber-500">
                        {equipmentLabel}
                      </span>
                      <Server size={16} className="text-amber-400 shrink-0" />
                    </div>
                    <p
                      className="mx-auto flex min-h-[2.75rem] w-full max-w-full flex-1 items-center justify-center px-0.5 pt-1 text-center text-[11px] font-bold leading-snug text-amber-700 break-words [overflow-wrap:anywhere]"
                      title={String(summary.topEquipment)}
                    >
                      {summary.topEquipment}
                    </p>
                    <p className="mt-auto pt-2 text-xs text-amber-400">
                      {summary.topEquipmentCount} {taskLabel} tasks
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => scrollSummaryCarousel(1)}
              disabled={summaryAtScrollEnd}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-900/10 ring-2 ring-blue-200/70 transition-all hover:bg-blue-100 hover:border-blue-600 hover:text-blue-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-sm disabled:ring-0 disabled:opacity-50"
              title="Scroll right — drag the row to scroll"
              aria-label="Scroll summary cards right"
            >
              <ChevronRight size={22} strokeWidth={2.5} className="shrink-0" />
            </button>
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

        {/* Row 2: Monthly Trend + Pie (~70% / ~30% on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6">
          <div className="min-w-0 overflow-hidden bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex items-center justify-between mb-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <h3 className="font-bold text-slate-600 text-lg flex items-center gap-2 shrink-0">
                  <BarChart3 size={18} className="text-slate-400" />
                  Monthly {taskLabel} Trend
                </h3>
                {(!isMa || (isMa && maTrendView === 'summary')) && (
                  <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-1 text-[11px] font-semibold text-slate-600 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMonthlyTrendChartKind('line')}
                      className={`rounded-full px-2.5 py-1 transition-all ${
                        monthlyTrendChartKind === 'line'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthlyTrendChartKind('bar')}
                      className={`rounded-full px-2.5 py-1 transition-all ${
                        monthlyTrendChartKind === 'bar'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Bar
                    </button>
                  </div>
                )}
                {isMa && (topModelTrendData || topModelTrendByRoleData) && (
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
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 min-w-0">
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
                        <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Pending
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Inprocess
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Overdue
                      </span>
                    </>
                  ) : maTrendRoleFilterId == null && data?.topModelTrendByRole?.length ? (
                    <>
                      {data.topModelTrendByRole
                        .filter((r) => !maTrendModelFilter || !r?.model || String(r.model) === maTrendModelFilter)
                        .map((r, i) => (
                        <span key={r.roleId} className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: topModelRoleColors[i % topModelRoleColors.length] }}
                          />
                          {r.roleName}
                        </span>
                      ))}
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
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Overdue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Inprocess
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Pending
                    </span>
                  </>
                )}
              </div>
            </div>
            {isMa && maTrendView === 'top-model' && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs min-w-0 overflow-x-auto">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  {/* Cascaded Site filter: select Sid then lid */}
                  <div className="flex items-center gap-2 min-w-0 shrink-0">
                    <label className="text-slate-500 shrink-0">Site:</label>
                    <select
                      className="border border-slate-200 rounded-full px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset min-w-0 max-w-[160px]"
                      value={maTrendSidFilter}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMaTrendSidFilter(v);
                        setMaTrendLidFilter('');
                        // SLid unknown until a location (lid) is selected
                        setMaTrendSiteFilterId(null);
                      }}
                    >
                      <option value="All Sites">All Sites</option>
                      {maTrendSidOptions.map((s) => (
                        <option key={s.Sid} value={s.Sid}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="border border-slate-200 rounded-full px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset min-w-0 max-w-[140px]"
                      value={maTrendLidFilter}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMaTrendLidFilter(v);
                        if (!v || !maTrendSidFilter) {
                          setMaTrendSiteFilterId(null);
                          return;
                        }
                        const sidNum = Number(maTrendSidFilter);
                        const lidNum = Number(v);
                        const found = sitesList.find(
                          (s) => s.Sid === sidNum && s.lid === lidNum
                        );
                        setMaTrendSiteFilterId(found ? found.SLid : null);
                      }}
                      disabled={!maTrendSidFilter}
                    >
                      <option value="">Location</option>
                      {maTrendLidOptions.map((l) => (
                        <option key={l.lid} value={l.lid}>
                          {l.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2 min-w-0 shrink-0">
                    <label className="text-slate-500 shrink-0">Role:</label>
                    <select
                      className="border border-slate-200 rounded-full px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset min-w-0 max-w-[120px]"
                      value={maTrendRoleFilterId != null ? String(maTrendRoleFilterId) : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMaTrendRoleFilterId(v ? Number(v) : null);
                      }}
                    >
                      <option value="">All</option>
                      {maTrendRoleOptions.map((r) => (
                        <option key={r.DeRoleid} value={r.DeRoleid}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model filter (before Site) */}
                  <div className="flex items-center gap-2 min-w-0 shrink-0">
                    <label className="text-slate-500 shrink-0">Model:</label>
                    <select
                      className="border border-slate-200 rounded-full px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset min-w-0 max-w-[160px]"
                      value={maTrendModelFilter ?? ''}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setMaTrendModelFilter(v);
                      }}
                    >
                      <option value="">All</option>
                      {maTrendModelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  </div>
                </div>
              </div>
            )}
            <div className="h-64 sm:h-72 w-full min-w-0 min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                {isMa && maTrendView === 'top-model' ? (
                  <LineChart
                    data={monthlyTrendMainChartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                    />
                    {maTrendRoleFilterId == null && topModelTrendByRoleData && data?.topModelTrendByRole?.length
                      ? data.topModelTrendByRole
                          .filter((r) => !maTrendModelFilter || !r?.model || String(r.model) === maTrendModelFilter)
                          .map((r, i) => {
                            const roleKey = String(r.roleName || r.roleId).trim() || `Role ${r.roleId}`;
                            return (
                              <Line
                                key={r.roleId}
                                type="monotone"
                                dataKey={roleKey}
                                name={`${roleKey} (${r.model})`}
                                stroke={topModelRoleColors[i % topModelRoleColors.length]}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                                yAxisId={0}
                              />
                            );
                          })
                      : topModelTrendData && (
                          <Line
                            type="monotone"
                            dataKey="topModelCount"
                            name={data?.topModelTrend?.model || 'Top model'}
                            stroke="#ec4899"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            yAxisId={0}
                          />
                        )}
                  </LineChart>
                ) : monthlyTrendChartKind === 'line' ? (
                  <LineChart
                    data={monthlyTrendMainChartData}
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
                        <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="complete" name="Complete" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="pending" name="Pending" stroke="#facc15" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="inprocess" name="Inprocess" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="overdue" name="Overdue" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="complete" name="Complete" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="inprocess" name="Inprocess" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="pending" name="Pending" stroke="#facc15" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="overdue" name="Overdue" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </>
                    )}
                  </LineChart>
                ) : (
                  <BarChart
                    data={monthlyTrendBarPackData}
                    margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                    barCategoryGap="12%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#b0b8c4' }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                      content={(tipProps) => (
                        <MonthlyTrendSummaryBarTooltip
                          active={tipProps.active}
                          payload={
                            tipProps.payload as ReadonlyArray<{ payload?: Record<string, unknown> }> | undefined
                          }
                          label={tipProps.label}
                          isMa={isMa}
                        />
                      )}
                    />
                    <Bar
                      dataKey="_groupBarScale"
                      name="Monthly"
                      fill="transparent"
                      isAnimationActive={false}
                      shape={isMa ? MONTHLY_TREND_BAR_SHAPE_MA : MONTHLY_TREND_BAR_SHAPE_PM}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm min-w-0">
            <h3 className="font-bold text-slate-600 text-lg mb-4 flex items-center gap-2">
              <Shield size={18} className="text-slate-400" />
              {taskLabel} Result Breakdown
            </h3>
            <div className="h-64 sm:h-72 w-full min-w-0 min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
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
            ...(isMa ? [{ key: 'site' as const, label: `Top ${taskLabel} Sites`, icon: Building2 }] : []),
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm min-w-0">
              <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-400" />
                {isMa ? 'MA' : 'PM'} Tasks by Vendor
              </h3>
              <div className="w-full min-w-0" style={{ height: vendorBarChartHeight }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                  <BarChart
                    data={vendorRanking}
                    layout="vertical"
                    barCategoryGap="24%"
                    margin={{ top: 12, right: 32, left: 6, bottom: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#b0b8c4' }} />
                    <YAxis
                      dataKey="vendor"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={178}
                      interval={0}
                      tick={(p) => <RankingBarYAxisTick x={p.x} y={p.y} payload={p.payload} labelWidth={168} />}
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                    <Bar dataKey="total" name={`${taskLabel} Tasks`} radius={[0, 8, 8, 0]} barSize={20}>
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
                            {(v.inprocess ?? 0) > 0 && <span className="text-orange-500">Inprocess {v.inprocess}</span>}
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
            <h3 className={`font-bold text-slate-600 text-lg flex items-center gap-2 ${isMa ? 'mb-5' : 'mb-1'}`}>
              <Server size={18} className="text-slate-400" />
              {equipmentLabel} (Top 15)
            </h3>
            {!isMa && (
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                <span className="text-slate-600 font-medium">Inventory-based ranking:</span> count of devices per model with status{' '}
                <span className="font-semibold text-slate-700">In Use</span> (not tied to PM tasks in the selected period).
                <br />
                <span className="text-slate-600 font-medium">Site column:</span> shows the location with the most devices for that model first.
                If the model appears at several sites, the text reads <span className="font-medium text-slate-700">· N more locations</span> — N is the number of <em>other</em> sites (not device count).
              </p>
            )}
            <div className="overflow-x-auto">
              <table className={`w-full ${isMa ? 'min-w-[900px]' : 'min-w-[640px]'}`}>
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
                    {isMa && (
                      <>
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
                      </>
                    )}
                    {!isMa && (
                      <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[160px] align-middle">
                        <span className="normal-case tracking-normal">Primary site</span>
                        <span className="block font-normal text-[10px] text-slate-400 normal-case tracking-normal mt-0.5">(highest count first)</span>
                      </th>
                    )}
                    <th
                      className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 w-16 align-middle"
                      onClick={() => setEquipmentOrderBy('total')}
                    >
                      {isMa ? `Total ${taskLabel}` : (
                        <span className="normal-case tracking-normal">In-use devices</span>
                      )}
                    </th>
                    {isMa && (
                      <>
                        <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10 align-middle">Complete</th>
                        <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-14 align-middle">Inprocess</th>
                        <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12 align-middle">Pending</th>
                      </>
                    )}
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28 align-middle">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipmentRanking.slice(0, 15).map((e, i) => (
                    <tr key={`${String(e.deviceId)}-${i}`} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i < 3 ? 'bg-red-50/30' : ''}`}>
                      <td className="py-3 px-3 w-14 text-center"><RankBadge rank={i + 1} /></td>
                      <td
                        className={
                          isMa
                            ? 'py-3 px-3 text-center text-sm text-slate-400 whitespace-nowrap'
                            : 'py-3 px-3 text-center text-sm text-slate-600 max-w-[220px] break-words [overflow-wrap:anywhere]'
                        }
                        title={equipmentRowModelLabel(e) || undefined}
                      >
                        {equipmentRowModelLabel(e) || '-'}
                      </td>
                      {isMa && (
                        <>
                          <td className="py-3 px-3 text-center">
                            <span className="text-sm text-slate-600 capitalize">{e.role ?? '-'}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-sm text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">{e.vendor || '-'}</span>
                          </td>
                          <td className="py-3 px-3 text-sm text-slate-400 text-center" title={e.site || undefined}>{e.site || '-'}</td>
                        </>
                      )}
                      {!isMa && (
                        <td className="py-3 px-3 text-center text-xs text-slate-500 max-w-[200px] break-words [overflow-wrap:anywhere]" title={e.site || undefined}>
                          {e.site || '—'}
                        </td>
                      )}
                      <td className="py-3 px-2 text-center w-16">
                        <span className="text-sm font-bold text-slate-600 bg-blue-50 px-1.5 py-0.5 rounded-lg">
                          {e.total ?? 0}
                        </span>
                      </td>
                      {isMa && (
                        <>
                          <td className="py-3 px-2 text-center text-sm font-medium text-slate-500 w-10">{e.done}</td>
                          <td className="py-3 px-2 text-center text-sm font-medium text-orange-500 w-14">{e.inprocess}</td>
                          <td className="py-3 px-2 text-center text-sm font-medium text-yellow-600 w-12">{e.pending}</td>
                        </>
                      )}
                      <td className="py-3 px-2 w-28 text-center">
                        <ProgressBar
                          value={e.total ?? 0}
                          max={maxEquipRankBar}
                          color={i < 3 ? 'bg-red-400' : 'bg-blue-300'}
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredEquipmentRanking.length === 0 && (
                    <tr>
                      <td colSpan={isMa ? 10 : 5} className="text-center py-8 text-sm text-slate-400">
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Site tab — MA only (hidden for PM: many tied site ranks) */}
        {activeTab === 'site' && isMa && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm min-w-0">
              <h3 className="font-bold text-slate-600 text-lg mb-5 flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-400" />
                {taskLabel} Tasks by Site
              </h3>
              <div className="w-full min-w-0" style={{ height: siteBarChartHeight }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                  <BarChart
                    data={siteRanking}
                    layout="vertical"
                    barCategoryGap="24%"
                    margin={{ top: 12, right: 32, left: 6, bottom: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#b0b8c4' }} />
                    <YAxis
                      dataKey="site"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={262}
                      interval={0}
                      tick={(p) => <RankingBarYAxisTick x={p.x} y={p.y} payload={p.payload} labelWidth={250} />}
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#475569', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                    <Bar dataKey="total" name={`${taskLabel} Tasks`} radius={[0, 8, 8, 0]} barSize={20}>
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
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm text-slate-700 leading-snug whitespace-normal break-words max-w-[85%]">
                          {s.site}
                        </span>
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
                            {(s.inprocess ?? 0) > 0 && <span className="text-orange-500">Inprocess {s.inprocess}</span>}
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

        {reportType === 'pm' && (
          <section
            id="pm-sites-registry"
            className="w-full scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            aria-labelledby="pm-sites-registry-heading"
          >
            <h2
              id="pm-sites-registry-heading"
              className="mb-1 font-bold text-slate-600 text-base sm:text-lg flex items-center gap-2"
            >
              <Building2 size={18} className="text-blue-500 shrink-0" aria-hidden />
              Sites & locations
            </h2>
            <p className="mb-2 text-[11px] leading-snug text-slate-500">
              Registry totals from <span className="font-medium text-slate-600">sites</span> /{' '}
              <span className="font-medium text-slate-600">sites_location</span>.
            </p>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5 rounded-2xl border border-blue-300 bg-blue-50/80 p-3 shadow-sm">
                <div className="relative flex items-center">
                  <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wide text-blue-500">
                    Sites
                  </span>
                  <Building2
                    size={15}
                    className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0 text-blue-400"
                    aria-hidden
                  />
                </div>
                <p className="pt-1 text-center text-xl font-black text-blue-700 tabular-nums leading-tight">
                  {siteRegistryCountsLoading
                    ? '…'
                    : siteRegistryCounts != null
                      ? siteRegistryCounts.siteCount.toLocaleString()
                      : '—'}
                </p>
                <p className="pt-1 text-center text-[10px] text-blue-400/90">Sites table</p>
              </div>
              <div className="flex flex-col gap-0.5 rounded-2xl border border-sky-300 bg-sky-50/80 p-3 shadow-sm">
                <div className="relative flex items-center">
                  <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wide text-sky-600">
                    Locations
                  </span>
                  <MapPin
                    size={15}
                    className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0 text-sky-500"
                    aria-hidden
                  />
                </div>
                <p className="pt-1 text-center text-xl font-black text-sky-700 tabular-nums leading-tight">
                  {siteRegistryCountsLoading
                    ? '…'
                    : siteRegistryCounts != null
                      ? siteRegistryCounts.locationCount.toLocaleString()
                      : '—'}
                </p>
                <p className="pt-1 text-center text-[10px] text-sky-500">sites_location table</p>
              </div>
            </div>

            <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-slate-700 flex items-center gap-1.5 text-xs sm:text-sm">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" aria-hidden />
                By organisation & locations
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="w-fit rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700 ring-1 ring-blue-100/80">
                  {sitesLocationGroupedBySite.length} sites
                </span>
                <span className="w-fit rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sky-800 ring-1 ring-sky-100/80">
                  {sitesLocationDetailRows.length} locations
                </span>
              </div>
            </div>

            <div className="pm-registry-scroll max-h-[min(28rem,56vh)] space-y-2 overflow-y-auto pr-1">
              {sitesLocationGroupedBySite.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No rows loaded.</p>
              ) : (
                sitesLocationGroupedBySite.map((group, i) => (
                    <div
                      key={group.locations.map((l) => l.SLid).join('-')}
                      className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60"
                    >
                      <div className="flex items-start gap-1.5 border-b border-slate-100 bg-blue-50/25 p-2.5">
                        <RankBadge rank={i + 1} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-600/90">Site</p>
                          <p className="font-semibold text-[12px] leading-tight text-slate-800 break-words">
                            {group.siteName}
                          </p>
                        </div>
                      </div>
                      <div className="min-w-0 bg-white p-2.5 sm:p-3">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700/90">
                          Locations
                        </p>
                        <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3" role="list">
                          {group.locations.map((loc) => (
                            <li
                              key={loc.SLid}
                              className="flex items-start gap-1.5 rounded border border-sky-100/80 bg-sky-50/35 px-2 py-1 text-[11px] leading-snug text-slate-700"
                            >
                              <MapPin
                                className="mt-0.5 h-3 w-3 shrink-0 text-sky-500"
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span className="min-w-0" title={loc.label}>
                                {formatLocationLabelEn(loc.label)}
                                {loc.sof ? (
                                  <span className="mt-0.5 block text-[10px] text-slate-500">SOF: {loc.sof}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>
        )}

      </div>

      {/* MA Top-model advanced filter modal (Site & Model) */}
    </SidebarLayout>
  );
}
