import { asRecord, readString } from '@/lib/unknownUtil';

/** Untyped task row from GET /api/tasks (camelCase and snake_case fields). */
export type ApiTask = Record<string, unknown>;

export function apiTaskString(task: ApiTask, camel: string, snake: string): string | undefined {
  return readString(task, camel) ?? readString(task, snake);
}

export function apiTaskId(task: ApiTask): string {
  const id = task.id ?? task.taskId ?? task.task_id;
  return id != null ? String(id) : '';
}

export function taskStartDate(task: ApiTask): Date | null {
  const s = apiTaskString(task, 'startDate', 'start_date');
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function taskEndDate(task: ApiTask): Date | null {
  const s = apiTaskString(task, 'endDate', 'end_date');
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapEngineerFromApi(e: unknown): { id?: string; name: string; lastName?: string } {
  const rec = asRecord(e);
  const rawId = rec.id ?? rec.user_id;
  const id =
    rawId !== null && rawId !== undefined && String(rawId).trim() !== '' ? String(rawId) : undefined;
  return {
    id,
    name: readString(rec, 'name') || (id ?? '') || '',
    lastName: readString(rec, 'lastName') ?? readString(rec, 'last_name'),
  };
}
