import { apiFetch, apiUrl } from '@/lib/api';
import { mapTaskToPmPermitRequest } from './mapTaskToPmPermitRequest';
import type { PmPermitRequestData, PmPermitRequestTaskInput } from './types';

async function fetchReferSof(contractId: unknown, sofFromTask?: string): Promise<string> {
  const fromTask = (sofFromTask ?? '').trim();
  if (fromTask) return fromTask;
  if (contractId == null || !String(contractId).trim()) return '';
  try {
    const res = await apiFetch(apiUrl(`/api/contracts/${contractId}`));
    const json = await res.json();
    if (!res.ok || !json?.data) return '';
    return String(
      json.data.sof_name ?? json.data.SOF ?? json.data.sof ?? json.data.refer_sof ?? ''
    ).trim();
  } catch {
    return '';
  }
}

function taskRecordToInput(task: Record<string, unknown>): PmPermitRequestTaskInput {
  const assets = Array.isArray(task.assets) ? task.assets : [];
  return {
    id: task.id as string | number | undefined,
    taskType: String(task.taskType ?? task.task_type ?? 'PM'),
    Sname: String(task.Sname ?? task.siteName ?? task.site_name ?? '').trim(),
    siteDbName: String(task.siteDbName ?? task.site_db_name ?? '').trim(),
    siteName: String(task.siteName ?? task.site_name ?? '').trim(),
    location: String(task.location ?? task.Location2 ?? '').trim(),
    province: String(task.province ?? task.Province ?? '').trim(),
    startDate: String(task.startDate ?? task.start_date ?? '').trim(),
    endDate: String(task.endDate ?? task.end_date ?? '').trim(),
    engineer: String(task.engineer ?? '').trim(),
    Eng_ids: Array.isArray(task.Eng_ids)
      ? (task.Eng_ids as PmPermitRequestTaskInput['Eng_ids'])
      : Array.isArray(task.engineers)
        ? (task.engineers as PmPermitRequestTaskInput['Eng_ids'])
        : undefined,
    assets,
    contractId: (task.contractId ?? task.contract_id) as string | number | null | undefined,
    sofName: String(task.sofName ?? task.sof_name ?? '').trim(),
  };
}

export async function fetchPmPermitRequestFromTask(
  task: Record<string, unknown>
): Promise<PmPermitRequestData> {
  const input = taskRecordToInput(task);
  const referSof = await fetchReferSof(
    task.contractId ?? task.contract_id,
    input.sofName
  );
  return mapTaskToPmPermitRequest(input, { referSof });
}

export function buildPmPermitRequestFilename(task: Record<string, unknown>): string {
  const id = String(task.id ?? 'task').trim();
  const site = String(task.Sname ?? task.siteName ?? task.site_db_name ?? 'site')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .slice(0, 40);
  const date = String(task.startDate ?? task.start_date ?? new Date().toISOString().slice(0, 10))
    .replace(/[^\d-]/g, '')
    .slice(0, 10);
  return `PM_Permit_${id}_${site}_${date}.pdf`;
}
