'use client';

import { createPortal } from 'react-dom';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
import {
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import DashboardHeader from '@/components/ui/Header';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTasks, getTopSitesHeatmap, getEmployees, apiUrl, getPmDashboard, getSitesLocation } from '@/lib/api';
import {
  formatDashboardRangeLabel,
  getDashboardPeriodBounds,
} from '@/lib/dashboardPeriod';
import { TopSitesWidget, type TopSitesHeatmapData } from '@/components/ui/TopSitesWidget';

type EventEngineer = {
  /** Employee id — must match employees API for roster photo */
  id?: string;
  name: string;
  lastName?: string;
};

type EventItem = {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string;
  taskType: 'PM' | 'MA';
  siteName?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  engineers?: EventEngineer[];
  status?: string;
  vendorName?: string;
};

/** Avatar from Employee roster only; initials if no photo or unknown id */
function EngineerRosterAvatar({
  eng,
  employeePhotoById,
  borderClassName = 'border-2 border-white',
}: {
  eng: EventEngineer;
  employeePhotoById: Record<string, string>;
  borderClassName?: string;
}) {
  const eid = eng.id ?? '';
  const url = eid ? employeePhotoById[eid] : undefined;
  const initial = (eng.name?.[0] || eid?.[0] || '?').toUpperCase();
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground shadow-sm ${borderClassName}`}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={`h-8 w-8 shrink-0 rounded-full object-cover bg-muted shadow-sm ${borderClassName}`}
      onError={() => setBroken(true)}
    />
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** แปลง YYYY-MM-DD จาก API เป็นเที่ยงคืน local (หลีกเลี่ยง UTC offset ของ `new Date('YYYY-MM-DD')`) */
function parseISODateLocal(iso: string): Date {
  const datePart = iso.split('T')[0];
  const parts = datePart.split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return startOfDay(new Date(iso));
  return startOfDay(new Date(y, m - 1, d));
}

/** Local calendar date → YYYY-MM-DD (สำหรับ query กรองสัญญาตาม period dashboard) */
function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function taskStartInPeriodBounds(taskStart: Date, bounds: { start: Date; endExclusive: Date }): boolean {
  const t = startOfDay(taskStart).getTime();
  return t >= bounds.start.getTime() && t < bounds.endExclusive.getTime();
}

/** จำนวนวันปฏิทินระหว่าง earlier → later (ทั้งคู่ normalize ที่เที่ยงคืน local) */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = startOfDay(earlier).getTime();
  const b = startOfDay(later).getTime();
  return Math.round((b - a) / 86400000);
}

/** วันเริ่มงานเทียบวันนี้: เฉพาะวันนี้และอนาคต (งานเลยวันเริ่มไม่แสดงใน Incoming — ไปอยู่ Missing Events) */
function formatThaiRelativeToTaskStart(startDateIso: string, todayStart: Date): string | null {
  const start = parseISODateLocal(startDateIso);
  if (Number.isNaN(start.getTime())) return null;
  const n = calendarDaysBetween(todayStart, start);
  if (n < 0) return null;
  if (n === 0) return 'today';
  if (n === 1) return 'Incoming 1 day';
  return `Incoming ${n} days`;
}

/** งานเลยกำหนด (เทียบ endDate กับวันนี้) */
function formatThaiDaysPastDue(endDateIso: string, todayStart: Date): string | null {
  const end = parseISODateLocal(endDateIso);
  if (Number.isNaN(end.getTime())) return null;
  if (end >= todayStart) return null;
  const n = calendarDaysBetween(end, todayStart);
  if (n <= 0) return null;
  if (n === 1) return 'Overdue';
  return `Overdue ${n} days`;
}

function taskStart(t: any): Date | null {
  const s = t.startDate || t.start_date;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function taskEnd(t: any): Date | null {
  const s = t.endDate || t.end_date;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [employeePhotoById, setEmployeePhotoById] = useState<Record<string, string>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [heatmap, setHeatmap] = useState<TopSitesHeatmapData>({
    sites: [],
    contracts: [],
    matrix: [],
    max_value: 1,
  });
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);

  const [pmCardsPage, setPmCardsPage] = useState(1);
  const [nearestEventsPage, setNearestEventsPage] = useState(1);
  const [missingEventsPage, setMissingEventsPage] = useState(1);
  const [hoveredEvent, setHoveredEvent] = useState<EventItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const [timeFilter, setTimeFilter] = useState('6 Months');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedEndMonth, setSelectedEndMonth] = useState('all');
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const [periodMenuPos, setPeriodMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [periodRange, setPeriodRange] = useState<{ start: string; endExclusive: string } | null>(null);
  const [periodMetaLoading, setPeriodMetaLoading] = useState(true);
  const [systemSiteCount, setSystemSiteCount] = useState<number | null>(null);

  const PM_CARDS_PAGE_SIZE = 3;
  const NEAREST_EVENTS_PAGE_SIZE = 3;
  const MISSING_EVENTS_PAGE_SIZE = 3;
  /** Incoming events: วันเริ่มงานภายใน 30 วันนับจากวันนี้ (ยังกรอง periodBounds เหมือนเดิม) */
  const INCOMING_EVENTS_HORIZON_DAYS = 30;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTasks(true);
      setTasksError(null);
      setEmployeesError(null);
      try {
        const [tasksRes, employeesRes] = await Promise.all([getTasks(), getEmployees({ limit: 1000 })]);
        if (cancelled) return;

        if (!tasksRes || tasksRes.success === false) {
          setTasksError(
            (tasksRes as { message?: string })?.message || 'Failed to load tasks'
          );
          setAllTasks([]);
        } else {
          setAllTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
        }

        if (!employeesRes || employeesRes.success === false) {
          setEmployeesError(
            (employeesRes as { message?: string })?.message || 'Failed to load employees'
          );
          setEmployeePhotoById({});
        } else {
          const list = Array.isArray(employeesRes.data) ? employeesRes.data : [];
          const map: Record<string, string> = {};
          list.forEach((emp: { id: string; photo?: string | null }) => {
            const id = String(emp.id ?? '');
            if (id && emp.photo) {
              map[id] = emp.photo.startsWith('http') ? emp.photo : apiUrl(emp.photo);
            }
          });
          setEmployeePhotoById(map);
        }
      } catch (e) {
        if (!cancelled) {
          setTasksError(e instanceof Error ? e.message : 'Could not reach server');
          setAllTasks([]);
        }
      } finally {
        if (!cancelled) setLoadingTasks(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSitesLocation()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.data)) setSystemSiteCount(res.data.length);
      })
      .catch(() => {
        if (!cancelled) setSystemSiteCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayStart = startOfDay(new Date());

  const toEventItem = useCallback((t: any): EventItem => {
    const start = t.startDate || t.start_date;
    const end = t.endDate || t.end_date;
    const d = start ? new Date(start) : new Date();
    const taskType = (String(t.taskType || t.task_type || 'PM').toUpperCase() === 'MA' ? 'MA' : 'PM') as
      | 'PM'
      | 'MA';
    const siteName = t.siteName || t.site_name || t.Sname || '';
    const title =
      taskType === 'MA'
        ? `MA: ${t.vendorName || t.vendor_name || siteName || 'Maintenance Agreement'}`
        : `PM: ${siteName || 'Preventive Maintenance'}`;
    const timeStr = t.time || '09:00';
    const dateStr = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const mapEng = (e: any): EventEngineer => {
      const rawId = e?.id ?? e?.user_id;
      const id =
        rawId !== null && rawId !== undefined && String(rawId).trim() !== '' ? String(rawId) : undefined;
      return {
        id,
        name: e?.name || String(rawId ?? '') || '',
        lastName: e?.lastName || e?.last_name || '',
      };
    };
    const engineers = Array.isArray(t.engineers)
      ? t.engineers.map(mapEng)
      : Array.isArray(t.Eng_ids)
        ? t.Eng_ids.map(mapEng)
        : undefined;
    return {
      id: String(t.id),
      title,
      dateStr,
      timeStr,
      taskType,
      siteName,
      startDate: start || undefined,
      endDate: end || undefined,
      location: t.location || t.Location2 || undefined,
      engineers,
      status: t.status || undefined,
      vendorName: t.vendorName || t.vendor_name || undefined,
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPeriodMetaLoading(true);
      try {
        const res = dashboardParams
          ? await getPmDashboard(dashboardParams)
          : await getPmDashboard({ months });
        if (cancelled) return;
        if (res?.success && res.data?.range) {
          setPeriodRange(res.data.range);
        } else {
          setPeriodRange(null);
        }
      } catch {
        if (!cancelled) setPeriodRange(null);
      } finally {
        if (!cancelled) setPeriodMetaLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [months, dashboardParams]);

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
  }, [selectedYear, selectedMonth, selectedEndMonth, timeFilter]);

  /** ช่วงวันใน pill ขวา — custom ใช้คำนวณจาก UI เหมือน periodBounds (API range ไม่มี end_month ครบได้) */
  const rangeLabel = useMemo(() => {
    if (dashboardParams != null) {
      const b = getDashboardPeriodBounds(months, dashboardParams);
      return formatDashboardRangeLabel(b, MONTH_LABELS);
    }
    if (!periodRange?.start || !periodRange?.endExclusive) return null;
    const startStr = periodRange.start.split('T')[0];
    const endStr = periodRange.endExclusive.split('T')[0];
    const startDate = parseISODateLocal(startStr);
    const endExclusiveDay = parseISODateLocal(endStr);
    const endInclusive = new Date(endExclusiveDay);
    endInclusive.setDate(endInclusive.getDate() - 1);
    const fmt = (d: Date) => `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    return `${fmt(startDate)} - ${fmt(endInclusive)}`;
  }, [dashboardParams, months, periodRange]);

  /** กรองงานให้ตรงกับช่วงที่เลือก (เดียวกับ PM analytics: start_date ∈ [start, endExclusive)) */
  const periodBounds = useMemo(() => {
    // Custom year/month: คำนวณจาก UI ทันที — อย่าใช้ periodRange ค้างจากโหมดก่อน (เช่น 6 เดือนล่าสุด)
    // จนกว่า getPmDashboard จะตอบ ไม่งั้น Top sites / heatmap จะดึงช่วงเดิมตลอด
    if (dashboardParams != null) {
      return getDashboardPeriodBounds(months, dashboardParams);
    }
    if (periodRange?.start && periodRange?.endExclusive) {
      return {
        start: parseISODateLocal(periodRange.start),
        endExclusive: parseISODateLocal(periodRange.endExclusive),
      };
    }
    return getDashboardPeriodBounds(months, null);
  }, [periodRange, months, dashboardParams]);

  useEffect(() => {
    let cancelled = false;
    const loadHeatmap = async () => {
      setLoadingHeatmap(true);
      setHeatmapError(null);
      const period_start = formatDateISO(periodBounds.start);
      const period_end_exclusive = formatDateISO(periodBounds.endExclusive);
      try {
        const res = await getTopSitesHeatmap({
          site_limit: 5,
          contract_limit: 10,
          period_start,
          period_end_exclusive,
        });
        if (cancelled) return;
        if (!res || res.success === false) {
          setHeatmapError((res as { message?: string })?.message || 'Failed to load heatmap');
          setHeatmap({ sites: [], contracts: [], matrix: [], max_value: 1 });
        } else {
          setHeatmap({
            sites: Array.isArray(res.sites) ? res.sites! : [],
            contracts: Array.isArray(res.contracts) ? res.contracts! : [],
            matrix: Array.isArray(res.matrix) ? res.matrix! : [],
            max_value: Math.max(1, Number(res.max_value ?? 1)),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setHeatmapError(e instanceof Error ? e.message : 'Failed to load heatmap');
          setHeatmap({ sites: [], contracts: [], matrix: [], max_value: 1 });
        }
      } finally {
        if (!cancelled) setLoadingHeatmap(false);
      }
    };
    void loadHeatmap();
    return () => {
      cancelled = true;
    };
  }, [periodBounds.start.getTime(), periodBounds.endExclusive.getTime()]);

  const pmCards = useMemo(() => {
    const upcomingPm = allTasks
      .filter((t: any) => String(t.taskType || t.task_type || '').toUpperCase() === 'PM')
      .filter((t: any) => (t.status || '') !== 'done')
      .filter((t: any) => t.startDate || t.start_date)
      .map((t: any) => ({ ...t, _start: taskStart(t)! }))
      .filter(
        (t: any) =>
          !Number.isNaN(t._start.getTime()) && taskStartInPeriodBounds(t._start, periodBounds)
      )
      .sort((a: any, b: any) => a._start.getTime() - b._start.getTime());

    return upcomingPm.map((t: any) => {
      const assets = Array.isArray(t.assets) ? t.assets : [];
      const first = assets[0] || {};
      const serial = first?.serial || first?.Serial || '—';
      const engineers = Array.isArray(t.engineers) ? t.engineers : [];
      const assignees = engineers.slice(0, 4).map((e: any, i: number) => {
        const eid = String(e?.id ?? e?.user_id ?? '');
        const realPhoto = eid ? employeePhotoById[eid] : null;
        if (realPhoto) return realPhoto;
        const seed = (e?.name || e?.id || String(i + 1)).toString();
        return `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;
      });
      return {
        taskId: String(t.id),
        id: `PM-${t.id}`,
        location: String(t.siteName || '—'),
        date: new Date(t.startDate || t.start_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        serial: String(serial),
        count: Number(assets.length || 0),
        assignees: (assignees.length > 0 ? assignees : ['https://i.pravatar.cc/150?u=pm']) as string[],
        status: String(t.status || 'not-started'),
      };
    });
  }, [allTasks, employeePhotoById, periodBounds]);

  const nearestEvents = useMemo(() => {
    const nearest = allTasks
      .filter((t: any) => (t.status || '') !== 'done' && (t.startDate || t.start_date))
      .map((t: any) => ({ ...t, _start: taskStart(t)! }))
      .filter(
        (t: any) =>
          !Number.isNaN(t._start.getTime()) && taskStartInPeriodBounds(t._start, periodBounds)
      )
      .filter((t: any) => {
        const raw = t.startDate || t.start_date;
        const startDay = parseISODateLocal(String(raw));
        if (Number.isNaN(startDay.getTime())) return false;
        const n = calendarDaysBetween(todayStart, startDay);
        return n >= 0 && n <= INCOMING_EVENTS_HORIZON_DAYS;
      })
      .sort((a: any, b: any) => a._start.getTime() - b._start.getTime())
      .slice(0, 80)
      .map(toEventItem);
    return nearest;
  }, [allTasks, periodBounds, todayStart, toEventItem]);

  const missingEvents = useMemo(() => {
    const rows = allTasks
      .filter(
        (t: any) =>
          (t.status || 'not-started') !== 'done' &&
          (t.startDate || t.start_date)
      )
      .map((t: any) => ({
        ...t,
        _end: (t.endDate || t.end_date) && taskEnd(t) ? taskEnd(t)! : null,
        _start: taskStart(t)!,
      }))
      .filter((t: any) => !Number.isNaN(t._start.getTime()) && taskStartInPeriodBounds(t._start, periodBounds))
      .filter((t: any) => {
        const rawStart = t.startDate || t.start_date;
        const startDay = parseISODateLocal(String(rawStart));
        if (Number.isNaN(startDay.getTime())) return false;
        const startPast = calendarDaysBetween(todayStart, startDay) < 0;
        const rawEnd = t.endDate || t.end_date;
        let endPast = false;
        if (rawEnd && t._end && !Number.isNaN(t._end.getTime())) {
          const endDay = parseISODateLocal(String(rawEnd));
          if (!Number.isNaN(endDay.getTime())) endPast = endDay.getTime() < todayStart.getTime();
        }
        return endPast || startPast;
      });

    const endPastRows = rows.filter((t: any) => {
      const rawEnd = t.endDate || t.end_date;
      if (!rawEnd || !t._end || Number.isNaN(t._end.getTime())) return false;
      const endDay = parseISODateLocal(String(rawEnd));
      return !Number.isNaN(endDay.getTime()) && endDay.getTime() < todayStart.getTime();
    });
    const endPastIds = new Set(endPastRows.map((t: any) => String(t.id)));
    const startOnlyPast = rows.filter((t: any) => !endPastIds.has(String(t.id)));

    endPastRows.sort((a: any, b: any) => b._end!.getTime() - a._end!.getTime());
    startOnlyPast.sort((a: any, b: any) => a._start.getTime() - b._start.getTime());

    const missing = [...endPastRows, ...startOnlyPast].slice(0, 80).map(toEventItem);
    return missing;
  }, [allTasks, todayStart, periodBounds, toEventItem]);

  const pmTotalPages = Math.max(1, Math.ceil(pmCards.length / PM_CARDS_PAGE_SIZE));
  const pmPage = Math.min(pmCardsPage, pmTotalPages);
  const paginatedPmCards = pmCards.slice(
    (pmPage - 1) * PM_CARDS_PAGE_SIZE,
    pmPage * PM_CARDS_PAGE_SIZE
  );

  const nearestTotalPages = Math.max(1, Math.ceil(nearestEvents.length / NEAREST_EVENTS_PAGE_SIZE));
  const nearestPage = Math.min(nearestEventsPage, nearestTotalPages);
  const paginatedNearestEvents = nearestEvents.slice(
    (nearestPage - 1) * NEAREST_EVENTS_PAGE_SIZE,
    nearestPage * NEAREST_EVENTS_PAGE_SIZE
  );

  const missingTotalPages = Math.max(1, Math.ceil(missingEvents.length / MISSING_EVENTS_PAGE_SIZE));
  const missingPage = Math.min(missingEventsPage, missingTotalPages);
  const paginatedMissingEvents = missingEvents.slice(
    (missingPage - 1) * MISSING_EVENTS_PAGE_SIZE,
    missingPage * MISSING_EVENTS_PAGE_SIZE
  );

  useEffect(() => {
    setPmCardsPage(1);
  }, [pmCards.length]);

  useEffect(() => {
    setNearestEventsPage(1);
  }, [nearestEvents.length]);

  useEffect(() => {
    setMissingEventsPage(1);
  }, [missingEvents.length]);

  const loadErrors = [tasksError, employeesError, heatmapError].filter(Boolean) as string[];

  return (
    <SidebarLayout>
      <DashboardHeader />

      {loadErrors.length > 0 && (
        <div className="mx-6 mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2 items-start">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold">Data loading issues</p>
            <ul className="mt-1 list-disc list-inside text-red-700">
              {loadErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-4 pb-6 pt-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 md:mt-0 mt-16">
        <div className="flex flex-col gap-4">
          <div className="flex flex-nowrap items-center justify-between gap-4 min-w-0 overflow-x-auto pb-1">
            <Link href="/" className="text-3xl font-bold text-foreground shrink-0 truncate min-w-0">
              Dashboard
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div ref={periodDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setPeriodDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl border-0 shadow-sm text-sm font-medium text-muted-foreground hover:bg-muted"
                    aria-haspopup="listbox"
                    aria-expanded={periodDropdownOpen}
                  >
                    <Calendar size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground hidden sm:inline">Period</span>
                    <span className="font-semibold text-foreground">{periodLabel}</span>
                    <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                  </button>

                  {periodDropdownOpen && periodMenuPos && createPortal(
                    <div
                      ref={periodMenuRef}
                      className="fixed w-max max-w-[calc(100vw-24px)] rounded-xl bg-card shadow-lg border border-border p-1.5 z-[9999]"
                      style={{ top: periodMenuPos.top, right: periodMenuPos.right }}
                    >
                      <div className="px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
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
                              className={`text-left px-2 py-1 rounded-md text-xs hover:bg-muted ${
                                !selectedYear && timeFilter === label
                                  ? 'bg-muted font-semibold text-foreground'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 border-l border-border pl-2">
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
                              className={`text-left px-2 py-1 rounded-md text-xs hover:bg-muted ${
                                !selectedYear && timeFilter === label
                                  ? 'bg-muted font-semibold text-foreground'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="my-0.5 h-px bg-muted" />
                      <div className="px-2 pb-1.5 pt-0">
                      <div className="pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Custom
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-nowrap items-end gap-1.5">
                          <div className="shrink-0">
                            <label className="mb-1.5 block text-[10px] font-semibold leading-tight text-muted-foreground">
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
                              className="w-[5rem] shrink-0 rounded-md border border-border bg-card px-1 py-1 text-[11px] tabular-nums leading-tight text-muted-foreground outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              {yearOptions.map((o) => (
                                <option key={o.value || 'x'} value={o.value}>
                                  {o.value ? o.label : '—'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="shrink-0">
                            <label className="mb-1.5 block text-[10px] font-semibold leading-tight text-muted-foreground">
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
                              className="w-[4.5rem] shrink-0 rounded-md border border-border bg-card px-1 py-1 text-[11px] leading-tight text-muted-foreground outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
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
                            <label className="mb-1.5 block text-[10px] font-semibold leading-tight text-muted-foreground">
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
                              className="w-[4.5rem] shrink-0 rounded-md border border-border bg-card px-1 py-1 text-[11px] leading-tight text-muted-foreground outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
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
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-muted"
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
                {(rangeLabel || periodMetaLoading) && (
                  <div className="bg-card px-4 py-2 rounded-xl border-0 shadow-sm text-sm text-muted-foreground whitespace-nowrap">
                    {periodMetaLoading ? '…' : rangeLabel}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-nowrap gap-6 min-w-0 overflow-x-auto items-start">
          <div className="flex-[2] space-y-6 min-w-0">
          <div>
            <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
              <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-sm">Preventive Maintenance</h3>
              <Link
                href="/report#pm-sites-registry"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-1.5 text-xs text-blue-900 shadow-sm transition-colors hover:bg-blue-100/90 hover:border-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
                title="Open Sites & locations on Report (registry from sites / sites_location)"
              >
                <Building2 size={16} className="text-blue-500 shrink-0" aria-hidden />
                <span>
                  Total <span className="font-bold tabular-nums">{systemSiteCount ?? '—'}</span> sites in the system
                </span>
              </Link>
            </div>
            <div className="space-y-3">
              {loadingTasks ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
              ) : tasksError ? (
                <div className="text-sm text-red-600 py-6 text-center">Unable to load PM tasks</div>
              ) : pmCards.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No PM tasks in this period</div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedPmCards.map((c) => (
                      <MaintenanceCard
                        key={c.id}
                        id={c.id}
                        location={c.location}
                        date={c.date}
                        serial={c.serial}
                        count={c.count}
                        assignees={c.assignees}
                        CI_Name={''}
                        status={c.status}
                        href={`/calendar?taskId=${encodeURIComponent(c.taskId)}`}
                      />
                    ))}
                  </div>
                  {pmCards.length > PM_CARDS_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {(pmPage - 1) * PM_CARDS_PAGE_SIZE + 1}–
                        {Math.min(pmPage * PM_CARDS_PAGE_SIZE, pmCards.length)} of {pmCards.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPmCardsPage((p) => Math.max(1, p - 1))}
                          disabled={pmPage <= 1}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-muted-foreground px-1">
                          Page {pmPage}/{pmTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPmCardsPage((p) => Math.min(pmTotalPages, p + 1))}
                          disabled={pmPage >= pmTotalPages}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-sm">
                Top site contracts
              </h3>
            </div>
            <TopSitesWidget loading={loadingHeatmap} error={heatmapError} data={heatmap} />
          </div>
        </div>

        <div className="flex-1 space-y-6 min-w-0">
          <div>
            <div className="flex justify-between items-center mb-4 gap-2 min-w-0">
              <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-sm truncate">
                Incoming events
              </h3>
              <Link
                href="/schedule_management?view=table"
                className="text-blue-500 text-xs font-medium hover:underline shrink-0"
              >
                View all
              </Link>
            </div>
            {loadingTasks ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
            ) : tasksError ? (
              <div className="text-sm text-red-600 py-6 text-center">Unable to load list</div>
            ) : nearestEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No events in this period</div>
            ) : (
              <div className="bg-card p-5 rounded-[2rem] shadow-sm border border-border">
                <div className="space-y-3">
                  {paginatedNearestEvents.map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/calendar?taskId=${encodeURIComponent(ev.id)}`}
                        onMouseEnter={(e) => {
                          setHoveredEvent(ev);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const tooltipWidth = 320;
                          const tooltipHeight = 400;
                          const padding = 16;
                          const spaceOnRight = window.innerWidth - rect.right;
                          const spaceOnLeft = rect.left;
                          const spaceOnBottom = window.innerHeight - rect.bottom;
                          let x = rect.right + 10;
                          let y = rect.top;
                          if (spaceOnRight < tooltipWidth + 20 && spaceOnLeft >= tooltipWidth + 20)
                            x = rect.left - tooltipWidth - 10;
                          if (spaceOnBottom < tooltipHeight && rect.top > tooltipHeight)
                            y = rect.bottom - tooltipHeight;
                          x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
                          y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));
                          setTooltipPosition({ x, y });
                        }}
                        onMouseLeave={() => {
                          setHoveredEvent(null);
                          setTooltipPosition(null);
                        }}
                        className={`block rounded-2xl border border-border border-l-4 p-4 transition-colors ${
                          ev.taskType === 'MA'
                            ? 'border-l-red-400 bg-red-50/30 hover:bg-red-50/50'
                            : 'border-l-blue-400 bg-blue-50/30 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-muted-foreground leading-tight">{ev.title}</p>
                            <p
                              className={`text-[10px] mt-1 ${ev.taskType === 'MA' ? 'text-red-600' : 'text-muted-foreground'}`}
                            >
                              {ev.dateStr}
                            </p>
                            {ev.startDate &&
                              (() => {
                                const rel = formatThaiRelativeToTaskStart(ev.startDate, todayStart);
                                return rel ? (
                                  <p
                                    className={`text-[10px] mt-0.5 font-medium ${
                                      ev.taskType === 'MA' ? 'text-red-700/90' : 'text-blue-600/90'
                                    }`}
                                  >
                                    {rel}
                                  </p>
                                ) : null;
                              })()}
                          </div>
                          {ev.engineers && ev.engineers.length > 0 && (
                            <div className="flex -space-x-2 shrink-0 pt-0.5" aria-hidden>
                              {ev.engineers.slice(0, 4).map((eng, i) => (
                                <EngineerRosterAvatar
                                  key={eng.id || `${ev.id}-eng-${i}`}
                                  eng={eng}
                                  employeePhotoById={employeePhotoById}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {nearestEvents.length > NEAREST_EVENTS_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {(nearestPage - 1) * NEAREST_EVENTS_PAGE_SIZE + 1}–
                        {Math.min(nearestPage * NEAREST_EVENTS_PAGE_SIZE, nearestEvents.length)} of{' '}
                        {nearestEvents.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNearestEventsPage((p) => Math.max(1, p - 1))}
                          disabled={nearestPage <= 1}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-muted-foreground px-1">
                          Page {nearestPage}/{nearestTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setNearestEventsPage((p) => Math.min(nearestTotalPages, p + 1))}
                          disabled={nearestPage >= nearestTotalPages}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="bg-card p-5 rounded-[2rem] shadow-sm border border-border">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="font-bold text-muted-foreground flex items-center gap-2">
                <CircleAlert size={18} className="text-amber-500" />
                Missing Events
              </h3>
              <Link href="/calendar?status=overdue" className="text-amber-600 text-xs hover:underline">
                View all
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">Overdue tasks</p>
            {loadingTasks ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
            ) : tasksError ? (
              <div className="text-sm text-red-600 py-6 text-center">Unable to load list</div>
            ) : missingEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No overdue tasks in this period</div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedMissingEvents.map((ev) => (
                    <Link
                      key={ev.id}
                      href={`/calendar?taskId=${encodeURIComponent(ev.id)}`}
                      onMouseEnter={(e) => {
                        setHoveredEvent(ev);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tooltipWidth = 320;
                        const tooltipHeight = 400;
                        const padding = 16;
                        const spaceOnRight = window.innerWidth - rect.right;
                        const spaceOnLeft = rect.left;
                        const spaceOnBottom = window.innerHeight - rect.bottom;
                        let x = rect.right + 10;
                        let y = rect.top;
                        if (spaceOnRight < tooltipWidth + 20 && spaceOnLeft >= tooltipWidth + 20)
                          x = rect.left - tooltipWidth - 10;
                        if (spaceOnBottom < tooltipHeight && rect.top > tooltipHeight)
                          y = rect.bottom - tooltipHeight;
                        x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
                        y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));
                        setTooltipPosition({ x, y });
                      }}
                      onMouseLeave={() => {
                        setHoveredEvent(null);
                        setTooltipPosition(null);
                      }}
                      className="block rounded-2xl border border-border border-l-4 border-l-amber-400 p-4 bg-amber-50/30 hover:bg-amber-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-muted-foreground leading-tight">{ev.title}</p>
                          <p className="text-[10px] text-amber-600 mt-1">From {ev.dateStr}</p>
                          {ev.endDate &&
                            (() => {
                              const overdue = formatThaiDaysPastDue(ev.endDate, todayStart);
                              return overdue ? (
                                <p className="text-[10px] text-amber-800 font-semibold mt-0.5">{overdue}</p>
                              ) : null;
                            })()}
                        </div>
                        {ev.engineers && ev.engineers.length > 0 && (
                          <div className="flex -space-x-2 shrink-0 pt-0.5" aria-hidden>
                            {ev.engineers.slice(0, 4).map((eng, i) => (
                              <EngineerRosterAvatar
                                key={eng.id || `${ev.id}-eng-${i}`}
                                eng={eng}
                                employeePhotoById={employeePhotoById}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {missingEvents.length > MISSING_EVENTS_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {(missingPage - 1) * MISSING_EVENTS_PAGE_SIZE + 1}–
                      {Math.min(missingPage * MISSING_EVENTS_PAGE_SIZE, missingEvents.length)} of{' '}
                      {missingEvents.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMissingEventsPage((p) => Math.max(1, p - 1))}
                        disabled={missingPage <= 1}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-muted-foreground px-1">
                        Page {missingPage}/{missingTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMissingEventsPage((p) => Math.min(missingTotalPages, p + 1))}
                        disabled={missingPage >= missingTotalPages}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </div>
      </main>

      {hoveredEvent && tooltipPosition && (
        <div
          className="fixed z-[300] bg-card rounded-lg shadow-2xl border border-border p-4 max-w-sm pointer-events-none max-h-[calc(100vh-32px)] overflow-y-auto"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(0)',
            maxWidth: 'min(320px, calc(100vw - 32px))',
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  hoveredEvent.taskType === 'MA'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {hoveredEvent.taskType || 'PM'}
              </span>
              {hoveredEvent.status && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    hoveredEvent.status === 'done'
                      ? 'bg-green-100 text-green-700'
                      : hoveredEvent.status === 'working'
                        ? 'bg-orange-100 text-orange-700'
                        : hoveredEvent.status === 'stuck'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {hoveredEvent.status === 'done'
                    ? 'Done'
                    : hoveredEvent.status === 'working'
                      ? 'In progress'
                      : hoveredEvent.status === 'stuck'
                        ? 'Stuck'
                        : 'Not Started'}
                </span>
              )}
            </div>

            {hoveredEvent.location && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Location</p>
                <p className="text-sm font-bold text-foreground">{hoveredEvent.location}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Site</p>
              <p className="text-sm font-bold text-foreground">
                {hoveredEvent.siteName || hoveredEvent.title || '-'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {hoveredEvent.startDate && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">Start Date (mm/dd/yyyy)</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(hoveredEvent.startDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {hoveredEvent.endDate && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">End Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(hoveredEvent.endDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {hoveredEvent.engineers && hoveredEvent.engineers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Engineers</p>
                <div className="flex flex-col gap-1.5">
                  {hoveredEvent.engineers.map((eng, idx) => (
                    <div key={eng.id || idx} className="flex items-center gap-2">
                      <EngineerRosterAvatar
                        eng={eng}
                        employeePhotoById={employeePhotoById}
                        borderClassName="border border-border"
                      />
                      <span className="text-xs font-medium text-foreground">
                        {eng.name}
                        {eng.lastName ? ` ${eng.lastName}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
