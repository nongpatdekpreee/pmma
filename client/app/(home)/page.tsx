'use client';

import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
import { CircleAlert, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import DashboardHeader from '@/components/ui/Header';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTasks, getVendorStatistics, getEmployees, apiUrl } from '@/lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

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
  engineers?: Array<{ name: string; lastName?: string }>;
  status?: string;
  vendorName?: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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

export default function DashboardPage() {
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [employeePhotoById, setEmployeePhotoById] = useState<Record<string, string>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [vendorBars, setVendorBars] = useState<Array<{ name: string; value: number }>>([]);
  const [loadingMa, setLoadingMa] = useState(true);
  const [vendorError, setVendorError] = useState<string | null>(null);

  const [pmCardsPage, setPmCardsPage] = useState(1);
  const [nearestEventsPage, setNearestEventsPage] = useState(1);
  const [missingEventsPage, setMissingEventsPage] = useState(1);
  const [hoveredEvent, setHoveredEvent] = useState<EventItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const PM_CARDS_PAGE_SIZE = 5;
  const NEAREST_EVENTS_PAGE_SIZE = 4;
  const MISSING_EVENTS_PAGE_SIZE = 4;

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
    const loadMa = async () => {
      setLoadingMa(true);
      setVendorError(null);
      try {
        const res = await getVendorStatistics();
        if (cancelled) return;
        if (!res || res.success === false) {
          setVendorError((res as { message?: string })?.message || 'Failed to load vendor statistics');
          setVendorBars([]);
        } else {
          const list = Array.isArray(res?.data) ? res.data : [];
          const bars = list
            .slice()
            .sort((a: any, b: any) => Number(b.value || 0) - Number(a.value || 0))
            .slice(0, 6)
            .map((v: any) => ({ name: v.name || '—', value: Number(v.value || 0) }));
          setVendorBars(bars);
        }
      } catch (e) {
        if (!cancelled) {
          setVendorError(e instanceof Error ? e.message : 'Failed to load MA chart');
          setVendorBars([]);
        }
      } finally {
        if (!cancelled) setLoadingMa(false);
      }
    };
    loadMa();
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
    const engineers = Array.isArray(t.engineers)
      ? t.engineers.map((e: any) => ({
          name: e.name || e.id || '',
          lastName: e.lastName || e.last_name || '',
        }))
      : Array.isArray(t.Eng_ids)
        ? t.Eng_ids.map((e: any) => ({
            name: e.name || e.id || '',
            lastName: e.lastName || e.last_name || '',
          }))
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

  const pmCards = useMemo(() => {
    const upcomingPm = allTasks
      .filter((t: any) => String(t.taskType).toUpperCase() === 'PM')
      .filter((t: any) => (t.status || '') !== 'done')
      .filter((t: any) => t.startDate || t.start_date)
      .map((t: any) => ({ ...t, _start: taskStart(t)! }))
      .filter(
        (t: any) => !Number.isNaN(t._start.getTime()) && t._start >= todayStart
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
  }, [allTasks, employeePhotoById, todayStart]);

  const nearestEvents = useMemo(() => {
    const nearest = allTasks
      .filter((t: any) => (t.status || '') !== 'done' && (t.startDate || t.start_date))
      .map((t: any) => ({ ...t, _start: taskStart(t)! }))
      .filter(
        (t: any) => !Number.isNaN(t._start.getTime()) && t._start >= todayStart
      )
      .sort((a: any, b: any) => a._start.getTime() - b._start.getTime())
      .slice(0, 80)
      .map(toEventItem);
    return nearest;
  }, [allTasks, todayStart, toEventItem]);

  const missingEvents = useMemo(() => {
    const missing = allTasks
      .filter((t: any) => (t.status || 'not-started') !== 'done' && (t.endDate || t.end_date))
      .map((t: any) => ({ ...t, _end: taskEnd(t)! }))
      .filter(
        (t: any) => !Number.isNaN(t._end.getTime()) && t._end < todayStart
      )
      .sort((a: any, b: any) => b._end.getTime() - a._end.getTime())
      .slice(0, 80)
      .map(toEventItem);
    return missing;
  }, [allTasks, todayStart, toEventItem]);

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

  const loadErrors = [tasksError, employeesError, vendorError].filter(Boolean) as string[];

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

      <div className="flex flex-nowrap p-6 pt-4 gap-6 md:mt-0 mt-16 min-w-0 overflow-x-auto">
        <div className="flex-[2] space-y-6 min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <Link href="/" className="text-3xl font-bold text-slate-800 shrink-0 truncate">
              Dashboard
            </Link>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Preventive Maintenance</h3>
            </div>
            <div className="space-y-3">
              {loadingTasks ? (
                <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
              ) : tasksError ? (
                <div className="text-sm text-red-600 py-6 text-center">Unable to load PM tasks</div>
              ) : pmCards.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">No upcoming PM tasks</div>
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
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        {(pmPage - 1) * PM_CARDS_PAGE_SIZE + 1}–
                        {Math.min(pmPage * PM_CARDS_PAGE_SIZE, pmCards.length)} of {pmCards.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPmCardsPage((p) => Math.max(1, p - 1))}
                          disabled={pmPage <= 1}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-slate-600 px-1">
                          Page {pmPage}/{pmTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPmCardsPage((p) => Math.min(pmTotalPages, p + 1))}
                          disabled={pmPage >= pmTotalPages}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-700">Maintenance Agreement</h3>
            </div>
            <div className="h-64 w-full min-w-0 min-h-[16rem] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              {loadingMa ? (
                <div className="h-full flex items-center justify-center text-slate-400">Loading…</div>
              ) : vendorError ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-red-600">
                  <span>Could not load chart</span>
                  <span className="text-xs text-red-500">{vendorError}</span>
                </div>
              ) : vendorBars.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                  <BarChart data={vendorBars} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 min-w-0">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-slate-700">Incoming events</h3>
              <Link href="/schedule_management?view=table" className="text-blue-500 text-xs hover:underline">
                View all
              </Link>
            </div>
            {loadingTasks ? (
              <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
            ) : tasksError ? (
              <div className="text-sm text-red-600 py-6 text-center">Unable to load list</div>
            ) : nearestEvents.length === 0 ? (
              <div className="text-sm text-slate-400 py-6 text-center">There are no upcoming events</div>
            ) : (
              <>
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
                      className={`block border-l-4 pl-4 py-2 rounded-r-xl transition-colors ${
                        ev.taskType === 'MA'
                          ? 'border-red-400 bg-red-50/30 hover:bg-red-50/50'
                          : 'border-blue-400 bg-blue-50/30 hover:bg-blue-50/50'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-700 leading-tight">{ev.title}</p>
                      <p
                        className={`text-[10px] mt-1 ${ev.taskType === 'MA' ? 'text-red-600' : 'text-gray-500'}`}
                      >
                        {ev.dateStr}
                      </p>
                    </Link>
                  ))}
                </div>
                {nearestEvents.length > NEAREST_EVENTS_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {(nearestPage - 1) * NEAREST_EVENTS_PAGE_SIZE + 1}–
                      {Math.min(nearestPage * NEAREST_EVENTS_PAGE_SIZE, nearestEvents.length)} of{' '}
                      {nearestEvents.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNearestEventsPage((p) => Math.max(1, p - 1))}
                        disabled={nearestPage <= 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-slate-600 px-1">
                        Page {nearestPage}/{nearestTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNearestEventsPage((p) => Math.min(nearestTotalPages, p + 1))}
                        disabled={nearestPage >= nearestTotalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <CircleAlert size={18} className="text-amber-500" />
                Missing Events
              </h3>
              <Link href="/calendar?status=overdue" className="text-amber-600 text-xs hover:underline">
                View all
              </Link>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Overdue tasks</p>
            {loadingTasks ? (
              <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
            ) : tasksError ? (
              <div className="text-sm text-red-600 py-6 text-center">Unable to load list</div>
            ) : missingEvents.length === 0 ? (
              <div className="text-sm text-slate-400 py-6 text-center">No pending tasks</div>
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
                      className="block border-l-4 border-amber-400 pl-4 py-2 bg-amber-50/30 rounded-r-xl hover:bg-amber-50/50 transition-colors"
                    >
                      <p className="text-sm font-bold text-slate-700 leading-tight">{ev.title}</p>
                      <p className="text-[10px] text-amber-600 mt-1">Overdue {ev.dateStr}</p>
                    </Link>
                  ))}
                </div>
                {missingEvents.length > MISSING_EVENTS_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {(missingPage - 1) * MISSING_EVENTS_PAGE_SIZE + 1}–
                      {Math.min(missingPage * MISSING_EVENTS_PAGE_SIZE, missingEvents.length)} of{' '}
                      {missingEvents.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMissingEventsPage((p) => Math.max(1, p - 1))}
                        disabled={missingPage <= 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-slate-600 px-1">
                        Page {missingPage}/{missingTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMissingEventsPage((p) => Math.min(missingTotalPages, p + 1))}
                        disabled={missingPage >= missingTotalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {hoveredEvent && tooltipPosition && (
        <div
          className="fixed z-[300] bg-white rounded-lg shadow-2xl border border-slate-200 p-4 max-w-sm pointer-events-none max-h-[calc(100vh-32px)] overflow-y-auto"
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
                          : 'bg-gray-100 text-gray-700'
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
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Location</p>
                <p className="text-sm font-bold text-slate-800">{hoveredEvent.location}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-0.5">Site</p>
              <p className="text-sm font-bold text-slate-800">
                {hoveredEvent.siteName || hoveredEvent.title || '-'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {hoveredEvent.startDate && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">Start Date</p>
                  <p className="text-sm text-slate-700">
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
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">End Date</p>
                  <p className="text-sm text-slate-700">
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
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Engineers</p>
                <div className="flex flex-wrap gap-1">
                  {hoveredEvent.engineers.map((eng, idx) => (
                    <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {eng.name}
                      {eng.lastName ? ` ${eng.lastName}` : ''}
                    </span>
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
