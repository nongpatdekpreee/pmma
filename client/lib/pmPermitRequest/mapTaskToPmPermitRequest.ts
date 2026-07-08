import { formatPlanDateDisplay } from './formatPlanDate';
import type { PmPermitRequestData, PmPermitRequestTaskInput } from './types';
import { toThaiDateParts } from '@/lib/maWorkOrder/formatThaiDate';

function formatEngineerNames(task: PmPermitRequestTaskInput): string[] {
  if (Array.isArray(task.Eng_ids) && task.Eng_ids.length > 0) {
    return task.Eng_ids
      .map((eng) => {
        const name = (eng.name ?? eng.id ?? '').trim();
        const last = (eng.lastName ?? '').trim();
        return last ? `${name} ${last}` : name;
      })
      .filter(Boolean);
  }
  const fromEngineer = (task.engineer ?? '').trim();
  if (!fromEngineer) return [];
  return fromEngineer
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveClientCompanyName(task: PmPermitRequestTaskInput): string {
  return (
    (task.siteDbName ?? '').trim() ||
    (task.Sname ?? '').trim() ||
    (task.siteName ?? '').trim() ||
    '—'
  );
}

function resolveTableLocation(task: PmPermitRequestTaskInput): string {
  const site = (task.siteDbName ?? task.Sname ?? task.siteName ?? '').trim();
  const loc = (task.location ?? '').trim();
  if (site && loc && !site.includes(loc)) return `${site} - ${loc}`;
  return site || loc || '—';
}

export function mapTaskToPmPermitRequest(
  task: PmPermitRequestTaskInput,
  context: { referSof?: string } = {}
): PmPermitRequestData {
  const assets = Array.isArray(task.assets) ? task.assets : [];
  const referSof = (context.referSof ?? task.sofName ?? '').trim();
  const staffNames = formatEngineerNames(task);

  return {
    issueDate: toThaiDateParts(new Date()),
    clientCompanyName: resolveClientCompanyName(task),
    referSof,
    rows: [
      {
        no: '1',
        location: resolveTableLocation(task),
        province: (task.province ?? '').trim() || '—',
        deviceCount: assets.length,
        startDate: formatPlanDateDisplay(task.startDate),
        endDate: formatPlanDateDisplay(task.endDate ?? task.startDate),
        staffNames: staffNames.length > 0 ? staffNames : ['—'],
      },
    ],
  };
}
