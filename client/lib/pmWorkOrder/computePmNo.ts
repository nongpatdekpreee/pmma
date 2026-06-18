/** Task fields used to derive PM round (ครั้งที่ทำ PM ในปี) */
export type PmTaskForRound = {
  id: number | string;
  siteId?: number | string | null;
  site_id?: number | string | null;
  siteName?: string | null;
  site_name?: string | null;
  startDate?: string | null;
  start_date?: string | null;
  endDate?: string | null;
  end_date?: string | null;
  taskType?: string | null;
  task_type?: string | null;
  status?: string | null;
};

function normalizeSiteId(task: PmTaskForRound): string | null {
  const id = task.siteId ?? task.site_id;
  if (id == null || id === '') return null;
  return String(id);
}

function normalizeSiteName(task: PmTaskForRound): string {
  return String(task.siteName ?? task.site_name ?? '')
    .trim()
    .toLowerCase();
}

function sameSite(a: PmTaskForRound, b: PmTaskForRound): boolean {
  const idA = normalizeSiteId(a);
  const idB = normalizeSiteId(b);
  if (idA && idB) return idA === idB;
  const nameA = normalizeSiteName(a);
  const nameB = normalizeSiteName(b);
  return Boolean(nameA && nameB && nameA === nameB);
}

function taskYear(task: PmTaskForRound, fallbackDate?: string): number {
  const raw = task.startDate ?? task.start_date ?? task.endDate ?? task.end_date ?? fallbackDate;
  if (raw) {
    const m = String(raw).trim().match(/^(\d{4})/);
    if (m) return Number(m[1]);
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  return new Date().getFullYear();
}

function taskSortTime(task: PmTaskForRound): number {
  const raw = task.startDate ?? task.start_date ?? task.endDate ?? task.end_date ?? '';
  const t = new Date(String(raw)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isDonePmTask(task: PmTaskForRound): boolean {
  const type = String(task.taskType ?? task.task_type ?? '').toUpperCase();
  if (type !== 'PM') return false;
  const status = String(task.status ?? '').toLowerCase();
  return status === 'done';
}

/**
 * PM No. = ครั้งที่ทำ PM ของ site ในปีนั้น (ไม่ใช่ลำดับหน้า/device)
 * รูปแบบ "2/3" = ครั้งที่ 2 จาก 3 ครั้งในปี
 */
export function computePmNo(
  allPmTasks: PmTaskForRound[],
  currentTaskId: number | string,
  pmDate?: string
): string {
  const current = allPmTasks.find((t) => Number(t.id) === Number(currentTaskId));
  if (!current) return '1';

  const year = taskYear(current, pmDate);

  const sameSiteYear = allPmTasks
    .filter((t) => isDonePmTask(t) && sameSite(t, current) && taskYear(t, pmDate) === year)
    .sort((a, b) => {
      const diff = taskSortTime(a) - taskSortTime(b);
      if (diff !== 0) return diff;
      return Number(a.id) - Number(b.id);
    });

  const total = sameSiteYear.length;
  const idx = sameSiteYear.findIndex((t) => Number(t.id) === Number(currentTaskId));
  const round = idx >= 0 ? idx + 1 : 1;

  if (total <= 1) return String(round);
  return `${round}/${total}`;
}
