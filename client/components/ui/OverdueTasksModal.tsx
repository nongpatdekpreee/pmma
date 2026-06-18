'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getCompletedTasks, getInprocessTasks, getOverdueTasks, getPendingTasks, getSitesLocation } from '@/lib/api';
import { asRecord, getErrorMessage, readString } from '@/lib/unknownUtil';

type TaskType = 'PM' | 'MA';

type OverdueTask = {
  id: string;
  taskType: TaskType;
  title: string;
  siteLocationId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  engineer?: string;
};

type SiteLocationRow = {
  SLid: number;
  Sid: number;
  lid: number;
  SiteName: string;
  Location2: string;
};

function SiteLocationFilters({
  rows,
  sid,
  lid,
  onChangeSid,
  onChangeLid,
}: {
  rows: SiteLocationRow[];
  sid: number | null;
  lid: number | null;
  onChangeSid: (sid: number | null) => void;
  onChangeLid: (lid: number | null) => void;
}) {
  const sites = Array.from(
    new Map(rows.map((r) => [r.Sid, { Sid: r.Sid, SiteName: r.SiteName }])).values()
  ).sort((a, b) => a.SiteName.localeCompare(b.SiteName));

  const locationRows = rows
    .filter((r) => (sid == null ? false : r.Sid === sid))
    .map((r) => ({ lid: r.lid, Location2: r.Location2 }));
  const locations = Array.from(new Map(locationRows.map((r) => [r.lid, r])).values()).sort((a, b) =>
    a.Location2.localeCompare(b.Location2)
  );

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex-1">
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">Site</div>
        <select
          value={sid ?? ''}
          onChange={(e) => onChangeSid(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm outline-none focus:ring-2 focus:ring-border"
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.Sid} value={s.Sid}>
              {s.SiteName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">Location</div>
        <select
          value={lid ?? ''}
          onChange={(e) => onChangeLid(e.target.value ? Number(e.target.value) : null)}
          disabled={sid == null}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm outline-none focus:ring-2 focus:ring-border disabled:opacity-60 disabled:bg-muted disabled:cursor-not-allowed"
        >
          <option value="">{sid == null ? 'Select site first' : 'All locations'}</option>
          {locations.map((l) => (
            <option key={l.lid} value={l.lid}>
              {l.Location2}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Parse YYYY-MM-DD as local date (avoid UTC shift so "2026-03-07" = March 7 local) */
function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.includes('T') ? raw.split('T')[0] : raw;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Return local date string YYYY-MM-DD for comparison (วันครบกำหนด) */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTask(raw: unknown): OverdueTask | null {
  if (!raw) return null;
  const r = asRecord(raw);
  const id = r.id ?? r.taskId ?? r.task_id;
  if (id == null) return null;

  const taskTypeRaw = String(r.taskType ?? r.task_type ?? 'PM').toUpperCase();
  const taskType: TaskType = taskTypeRaw === 'MA' ? 'MA' : 'PM';

  const startDate = r.startDate ?? r.start_date ?? undefined;
  const endDate = r.endDate ?? r.end_date ?? startDate ?? undefined;
  const siteLocationIdRaw = r.siteId ?? r.site_id ?? r.SLid ?? r.slid ?? undefined;
  const siteLocationId = siteLocationIdRaw != null && siteLocationIdRaw !== '' ? Number(siteLocationIdRaw) : undefined;

  const status = r.status ?? undefined;
  const isMA = taskType === 'MA';

  // Prefer consistent "location - site" title similar to calendar page
  let siteName = readString(r, 'siteName') ?? readString(r, 'site_name') ?? readString(r, 'Sname') ?? '';
  let location = readString(r, 'location') ?? readString(r, 'Location2') ?? '';
  if (!location && siteName && String(siteName).includes(' - ')) {
    const parts = String(siteName).split(' - ');
    const sitePart = parts[0]?.trim() || '';
    const locationPart = parts.slice(1).join(' - ').trim();
    if (locationPart) {
      location = locationPart;
      siteName = sitePart;
    }
  }
  const title =
    location && siteName
      ? `${location} - ${siteName}`
      : location
        ? String(location)
        : siteName
          ? String(siteName)
          : String(r.vendorName ?? r.vendor_name ?? (isMA ? 'Maintenance Agreement' : 'Preventive Maintenance'));

  const engineers = r.engineers ?? r.Eng_ids ?? [];
  const engineer =
    Array.isArray(engineers) && engineers.length > 0
      ? engineers
          .map((entry) => {
            const e = asRecord(entry);
            const name = readString(e, 'name') || readString(e, 'id') || '';
            const last = readString(e, 'lastName');
            return `${name}${last ? ` ${last}` : ''}`.trim();
          })
          .filter(Boolean)
          .join(', ')
      : r.engineer ?? undefined;

  return {
    id: String(id),
    taskType,
    title,
    siteLocationId: siteLocationId != null && !Number.isNaN(siteLocationId) ? siteLocationId : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
    status: status != null ? String(status) : undefined,
    engineer: engineer ? String(engineer) : undefined,
  };
}

export function OverdueTasksModal({
  isOpen,
  onClose,
  taskTypeFilter,
  onSelectTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  taskTypeFilter: TaskType;
  onSelectTask: (taskId: string) => void;
}) {
  const OVERDUE_PAGE_SIZE = 5;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [page, setPage] = useState(1);
  const [siteRows, setSiteRows] = useState<SiteLocationRow[]>([]);
  const [sid, setSid] = useState<number | null>(null);
  const [lid, setLid] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSitesLocation();
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setSiteRows(res.data as SiteLocationRow[]);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setLid(null);
  }, [sid]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await getOverdueTasks(taskTypeFilter);
        if (!res?.success || !Array.isArray(res.data)) {
          throw new Error('Failed to load overdue tasks');
        }
        const normalized = res.data.map(normalizeTask).filter(Boolean) as OverdueTask[];
        if (!cancelled) {
          setTasks(normalized);
          setPage(1);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || 'Failed to load overdue tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, taskTypeFilter]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Backend คืนเฉพาะ overdue (not-started, end_date < today) แยก MA/PM แล้ว เรียง end_date ASC
  const overdueTasks = tasks;
  const availableSlids = new Set(
    overdueTasks.map((t) => t.siteLocationId).filter((v): v is number => typeof v === 'number')
  );
  const availableRows = siteRows.filter((r) => availableSlids.has(Number(r.SLid)));
  useEffect(() => {
    if (sid != null && !availableRows.some((r) => r.Sid === sid)) setSid(null);
  }, [sid, availableRows]);
  const filteredOverdueTasks = overdueTasks.filter((t) => {
    if (!t.siteLocationId) {
      return sid == null && lid == null;
    }
    const row = siteRows.find((r) => Number(r.SLid) === t.siteLocationId);
    if (!row) return sid == null && lid == null;
    if (sid != null && row.Sid !== sid) return false;
    if (lid != null && row.lid !== lid) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredOverdueTasks.length / OVERDUE_PAGE_SIZE));
  const startIdx = (page - 1) * OVERDUE_PAGE_SIZE;
  const paginatedTasks = filteredOverdueTasks.slice(startIdx, startIdx + OVERDUE_PAGE_SIZE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-foreground truncate">Overdue {taskTypeFilter} tasks</div>
              <div className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : `${filteredOverdueTasks.length.toLocaleString()} past due`}
                {!loading && filteredOverdueTasks.length > 0 && (
                  <span className="ml-2">(page {page} of {totalPages})</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5">
          {availableRows.length > 0 && (
            <SiteLocationFilters rows={availableRows} sid={sid} lid={lid} onChangeSid={setSid} onChangeLid={setLid} />
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              Loading tasks...
            </div>
          )}

          {!loading && !error && overdueTasks.length === 0 && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              No overdue tasks found.
            </div>
          )}

          {!loading && overdueTasks.length > 0 && (
            <>
              <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
                {paginatedTasks.map((t) => {
                const rawDate = t.endDate || t.startDate;
                const endLabel =
                  typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
                    ? rawDate.substring(0, 10)
                    : (() => {
                        const end = parseDateOnly(rawDate ?? null);
                        return end ? toLocalDateString(end) : (rawDate || '—');
                      })();
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t.id)}
                    className="w-full text-left px-4 py-3 border-b last:border-b-0 border-border hover:bg-muted transition-colors flex items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{t.title || `(Task ${t.id})`}</div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          Due {endLabel}
                        </span>
                        {t.engineer && (
                          <span className="truncate" title={t.engineer}>
                            {t.engineer}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg">
                      OVERDUE
                    </div>
                  </button>
                );
              })}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} className="text-muted-foreground" />
                  </button>
                  <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompletedTasksModal({
  isOpen,
  onClose,
  taskTypeFilter,
  onSelectTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  taskTypeFilter: TaskType;
  onSelectTask: (taskId: string) => void;
}) {
  const COMPLETED_PAGE_SIZE = 4;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [page, setPage] = useState(1);
  const [siteRows, setSiteRows] = useState<SiteLocationRow[]>([]);
  const [sid, setSid] = useState<number | null>(null);
  const [lid, setLid] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSitesLocation();
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setSiteRows(res.data as SiteLocationRow[]);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setLid(null);
  }, [sid]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await getCompletedTasks(taskTypeFilter);
        if (!res?.success || !Array.isArray(res.data)) {
          throw new Error('Failed to load completed tasks');
        }
        const normalized = res.data.map(normalizeTask).filter(Boolean) as OverdueTask[];
        if (!cancelled) {
          setTasks(normalized);
          setPage(1);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || 'Failed to load completed tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, taskTypeFilter]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Backend คืนเฉพาะ completed (done) แยก MA/PM แล้ว เรียง end_date DESC
  const completedTasks = tasks;
  const completedSlids = new Set(
    completedTasks.map((t) => t.siteLocationId).filter((v): v is number => typeof v === 'number')
  );
  const completedRows = siteRows.filter((r) => completedSlids.has(Number(r.SLid)));
  useEffect(() => {
    if (sid != null && !completedRows.some((r) => r.Sid === sid)) setSid(null);
  }, [sid, completedRows]);
  const filteredCompletedTasks = completedTasks.filter((t) => {
    if (!t.siteLocationId) {
      return sid == null && lid == null;
    }
    const row = siteRows.find((r) => Number(r.SLid) === t.siteLocationId);
    if (!row) return sid == null && lid == null;
    if (sid != null && row.Sid !== sid) return false;
    if (lid != null && row.lid !== lid) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredCompletedTasks.length / COMPLETED_PAGE_SIZE));
  const startIdx = (page - 1) * COMPLETED_PAGE_SIZE;
  const paginatedTasks = filteredCompletedTasks.slice(startIdx, startIdx + COMPLETED_PAGE_SIZE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-600" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-foreground truncate">
                Completed {taskTypeFilter} tasks
              </div>
              <div className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : `${completedTasks.length.toLocaleString()} completed`}
                {!loading && completedTasks.length > 0 && (
                  <span className="ml-2">(page {page} of {totalPages})</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5">
          {completedRows.length > 0 && (
            <SiteLocationFilters rows={completedRows} sid={sid} lid={lid} onChangeSid={setSid} onChangeLid={setLid} />
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              Loading tasks...
            </div>
          )}

          {!loading && !error && completedTasks.length === 0 && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              No completed tasks found.
            </div>
          )}

          {!loading && completedTasks.length > 0 && (
            <>
              <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
                {paginatedTasks.map((t) => {
                const rawDate = t.endDate || t.startDate;
                const endLabel =
                  typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
                    ? rawDate.substring(0, 10)
                    : (() => {
                        const end = parseDateOnly(rawDate ?? null);
                        return end ? toLocalDateString(end) : (rawDate || '—');
                      })();
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t.id)}
                    className="w-full text-left px-4 py-3 border-b last:border-b-0 border-border hover:bg-muted transition-colors flex items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{t.title || `(Task ${t.id})`}</div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          Done {endLabel}
                        </span>
                        {t.engineer && (
                          <span className="truncate" title={t.engineer}>
                            {t.engineer}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                      DONE
                    </div>
                  </button>
                );
              })}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex relative items-center justify-between gap-4">
          <div className="flex-1">
            {totalPages > 1 && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} className="text-muted-foreground" />
                </button>
                <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight size={18} className="text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function InprocessTasksModal({
  isOpen,
  onClose,
  taskTypeFilter,
  onSelectTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  taskTypeFilter: TaskType;
  onSelectTask: (taskId: string) => void;
}) {
  const PAGE_SIZE = 5;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [page, setPage] = useState(1);
  const [siteRows, setSiteRows] = useState<SiteLocationRow[]>([]);
  const [sid, setSid] = useState<number | null>(null);
  const [lid, setLid] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSitesLocation();
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setSiteRows(res.data as SiteLocationRow[]);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setLid(null);
  }, [sid]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await getInprocessTasks(taskTypeFilter, { sid, lid });
        if (!res?.success || !Array.isArray(res.data)) {
          throw new Error('Failed to load in process tasks');
        }
        const normalized = res.data.map(normalizeTask).filter(Boolean) as OverdueTask[];
        if (!cancelled) {
          setTasks(normalized);
          setPage(1);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || 'Failed to load in process tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, taskTypeFilter, sid, lid]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const inprocessTasks = tasks;
  const inprocessSlids = new Set(
    inprocessTasks.map((t) => t.siteLocationId).filter((v): v is number => typeof v === 'number')
  );
  const inprocessRows = siteRows.filter((r) => inprocessSlids.has(Number(r.SLid)));
  useEffect(() => {
    if (sid != null && !inprocessRows.some((r) => r.Sid === sid)) setSid(null);
  }, [sid, inprocessRows]);
  const filteredInprocessTasks = inprocessTasks.filter((t) => {
    if (!t.siteLocationId) {
      return sid == null && lid == null;
    }
    const row = siteRows.find((r) => Number(r.SLid) === t.siteLocationId);
    if (!row) return sid == null && lid == null;
    if (sid != null && row.Sid !== sid) return false;
    if (lid != null && row.lid !== lid) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredInprocessTasks.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const paginatedTasks = filteredInprocessTasks.slice(startIdx, startIdx + PAGE_SIZE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <AlertTriangle className="text-orange-600" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-foreground truncate">
                In process {taskTypeFilter} tasks
              </div>
              <div className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : `${inprocessTasks.length.toLocaleString()} in process`}
                {!loading && inprocessTasks.length > 0 && (
                  <span className="ml-2">(page {page} of {totalPages})</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5">
          {inprocessRows.length > 0 && (
            <SiteLocationFilters rows={inprocessRows} sid={sid} lid={lid} onChangeSid={setSid} onChangeLid={setLid} />
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              Loading tasks...
            </div>
          )}

          {!loading && !error && inprocessTasks.length === 0 && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              No in process tasks found.
            </div>
          )}

          {!loading && inprocessTasks.length > 0 && (
            <>
              <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
                {paginatedTasks.map((t) => {
                  const rawDate = t.endDate || t.startDate;
                  const endLabel =
                    typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
                      ? rawDate.substring(0, 10)
                      : (() => {
                          const end = parseDateOnly(rawDate ?? null);
                          return end ? toLocalDateString(end) : (rawDate || '—');
                        })();
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTask(t.id)}
                      className="w-full text-left px-4 py-3 border-b last:border-b-0 border-border hover:bg-muted transition-colors flex items-start gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground truncate">{t.title || `(Task ${t.id})`}</div>
                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} className="text-muted-foreground" />
                            Due {endLabel}
                          </span>
                          {t.engineer && (
                            <span className="truncate" title={t.engineer}>
                              {t.engineer}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-xs font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">
                        WORKING
                      </div>
                    </button>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} className="text-muted-foreground" />
                  </button>
                  <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function PendingTasksModal({
  isOpen,
  onClose,
  taskTypeFilter,
  onSelectTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  taskTypeFilter: TaskType;
  onSelectTask: (taskId: string) => void;
}) {
  const PAGE_SIZE = 5;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [page, setPage] = useState(1);
  const [siteRows, setSiteRows] = useState<SiteLocationRow[]>([]);
  const [sid, setSid] = useState<number | null>(null);
  const [lid, setLid] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSitesLocation();
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setSiteRows(res.data as SiteLocationRow[]);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setLid(null);
  }, [sid]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await getPendingTasks(taskTypeFilter, { sid, lid });
        if (!res?.success || !Array.isArray(res.data)) {
          throw new Error('Failed to load pending tasks');
        }
        const normalized = res.data.map(normalizeTask).filter(Boolean) as OverdueTask[];
        if (!cancelled) {
          setTasks(normalized);
          setPage(1);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || 'Failed to load pending tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, taskTypeFilter, sid, lid]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const pendingTasks = tasks;
  const pendingSlids = new Set(
    pendingTasks.map((t) => t.siteLocationId).filter((v): v is number => typeof v === 'number')
  );
  const pendingRows = siteRows.filter((r) => pendingSlids.has(Number(r.SLid)));
  useEffect(() => {
    if (sid != null && !pendingRows.some((r) => r.Sid === sid)) setSid(null);
  }, [sid, pendingRows]);
  const filteredPendingTasks = pendingTasks.filter((t) => {
    if (!t.siteLocationId) {
      return sid == null && lid == null;
    }
    const row = siteRows.find((r) => Number(r.SLid) === t.siteLocationId);
    if (!row) return sid == null && lid == null;
    if (sid != null && row.Sid !== sid) return false;
    if (lid != null && row.lid !== lid) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredPendingTasks.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const paginatedTasks = filteredPendingTasks.slice(startIdx, startIdx + PAGE_SIZE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center justify-center">
              <AlertTriangle className="text-yellow-700" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-foreground truncate">
                Pending {taskTypeFilter} tasks
              </div>
              <div className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : `${pendingTasks.length.toLocaleString()} pending`}
                {!loading && pendingTasks.length > 0 && (
                  <span className="ml-2">(page {page} of {totalPages})</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5">
          {pendingRows.length > 0 && (
            <SiteLocationFilters rows={pendingRows} sid={sid} lid={lid} onChangeSid={setSid} onChangeLid={setLid} />
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              Loading tasks...
            </div>
          )}

          {!loading && !error && pendingTasks.length === 0 && (
            <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              No pending tasks found.
            </div>
          )}

          {!loading && pendingTasks.length > 0 && (
            <>
              <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
                {paginatedTasks.map((t) => {
                  const rawDate = t.endDate || t.startDate;
                  const endLabel =
                    typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
                      ? rawDate.substring(0, 10)
                      : (() => {
                          const end = parseDateOnly(rawDate ?? null);
                          return end ? toLocalDateString(end) : (rawDate || '—');
                        })();
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTask(t.id)}
                      className="w-full text-left px-4 py-3 border-b last:border-b-0 border-border hover:bg-muted transition-colors flex items-start gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground truncate">{t.title || `(Task ${t.id})`}</div>
                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} className="text-muted-foreground" />
                            Due {endLabel}
                          </span>
                          {t.engineer && (
                            <span className="truncate" title={t.engineer}>
                              {t.engineer}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-xs font-bold text-yellow-800 bg-yellow-50 border border-yellow-100 px-2 py-1 rounded-lg">
                        PENDING
                      </div>
                    </button>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} className="text-muted-foreground" />
                  </button>
                  <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

