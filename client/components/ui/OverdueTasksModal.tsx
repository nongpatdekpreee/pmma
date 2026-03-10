'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, X } from 'lucide-react';
import { getTasks } from '@/lib/api';

type TaskType = 'PM' | 'MA';

type OverdueTask = {
  id: string;
  taskType: TaskType;
  title: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  engineer?: string;
};

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

function normalizeTask(raw: any): OverdueTask | null {
  if (!raw) return null;
  const id = raw.id ?? raw.taskId ?? raw.task_id;
  if (id == null) return null;

  const taskTypeRaw = String(raw.taskType ?? raw.task_type ?? 'PM').toUpperCase();
  const taskType: TaskType = taskTypeRaw === 'MA' ? 'MA' : 'PM';

  const startDate = raw.startDate ?? raw.start_date ?? undefined;
  const endDate = raw.endDate ?? raw.end_date ?? startDate ?? undefined;

  const status = raw.status ?? undefined;
  const isMA = taskType === 'MA';

  // Prefer consistent "location - site" title similar to calendar page
  let siteName = raw.siteName ?? raw.site_name ?? raw.Sname ?? '';
  let location = raw.location ?? raw.Location2 ?? '';
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
          : String(raw.vendorName ?? raw.vendor_name ?? (isMA ? 'Maintenance Agreement' : 'Preventive Maintenance'));

  const engineers = raw.engineers ?? raw.Eng_ids ?? [];
  const engineer =
    Array.isArray(engineers) && engineers.length > 0
      ? engineers
          .map((e: any) => String(e?.name || e?.id || '').trim() + (e?.lastName ? ` ${String(e.lastName).trim()}` : ''))
          .filter(Boolean)
          .join(', ')
      : raw.engineer ?? undefined;

  return {
    id: String(id),
    taskType,
    title,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
    status: status != null ? String(status) : undefined,
    engineer: engineer ? String(engineer) : undefined,
  };
}

/** งานที่ถือว่า "ทำแล้ว" — ไม่แสดงในรายการ overdue */
function isDoneStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s === 'done' || s === 'completed' || s === 'complete' || s === 'finished';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OverdueTask[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await getTasks();
        if (!res?.success || !Array.isArray(res.data)) {
          throw new Error('Failed to load tasks');
        }
        const normalized = res.data.map(normalizeTask).filter(Boolean) as OverdueTask[];
        if (!cancelled) setTasks(normalized);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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

  // เฉพาะอันที่ยังไม่ทำ และครบกำหนดเป็นอดีตเท่านั้น (ไม่รวมวันนี้)
  const overdueTasks = useMemo(() => {
    const todayStr = toLocalDateString(new Date());
    return tasks
      .filter((t) => t.taskType === taskTypeFilter)
      .filter((t) => !isDoneStatus(t.status))
      .filter((t) => {
        const end = parseDateOnly(t.endDate || t.startDate || null);
        if (!end) return false;
        const endStr = toLocalDateString(end);
        // หมดอายุ = ครบกำหนดก่อนวันนี้เท่านั้น (วันนี้ยังไม่ถือว่าหมดอายุ)
        if (endStr < todayStr) return false;
        return true;
      })
      .sort((a, b) => {
        const da = parseDateOnly(a.endDate || a.startDate || null)?.getTime() ?? 0;
        const db = parseDateOnly(b.endDate || b.startDate || null)?.getTime() ?? 0;
        return da - db;
      });
  }, [tasks, taskTypeFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-slate-900 truncate">
                Overdue {taskTypeFilter} tasks
              </div>
              <div className="text-xs text-slate-500">
                {loading ? 'Loading...' : `${overdueTasks.length.toLocaleString()} past due`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Loading tasks...
            </div>
          )}

          {!loading && !error && overdueTasks.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No overdue tasks found.
            </div>
          )}

          {!loading && overdueTasks.length > 0 && (
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
              {overdueTasks.map((t) => {
                const end = parseDateOnly(t.endDate || t.startDate || null);
                const endLabel = end ? toLocalDateString(end) : (t.endDate || t.startDate || '—');
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t.id)}
                    className="w-full text-left px-4 py-3 border-b last:border-b-0 border-slate-200 hover:bg-slate-50 transition-colors flex items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{t.title || `(Task ${t.id})`}</div>
                      <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
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
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
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

