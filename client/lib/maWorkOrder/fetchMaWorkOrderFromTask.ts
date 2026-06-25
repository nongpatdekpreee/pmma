import { apiUrl, apiFetch} from '@/lib/api';
import { mapTaskToMaWorkOrder } from './mapTaskToMaWorkOrder';
import type { MaWorkOrderData, MaWorkOrderMapContext, MaWorkOrderTaskInput } from './types';

export type MaWorkOrderDeviceMaps = {
  resolvedDevices?: MaWorkOrderMapContext['resolvedDevices'];
  resolvedReplacements?: MaWorkOrderMapContext['resolvedReplacements'];
  referSof?: string;
};

function resolveTaskSiteAndLocation(task: Record<string, unknown>): {
  siteName: string;
  location: string;
} {
  let siteName = String(task.Sname ?? task.siteName ?? task.site_name ?? '').trim();
  let location = String(
    task.location ?? task.Location2 ?? task.location2 ?? ''
  ).trim();

  if (!location && siteName.includes(' - ')) {
    const parts = siteName.split(' - ');
    const sitePart = parts[0]?.trim() || '';
    const locationPart = parts.slice(1).join(' - ').trim();
    if (locationPart) {
      location = locationPart;
      siteName = sitePart || siteName;
    }
  }

  return { siteName, location };
}

function taskRecordToInput(task: Record<string, unknown>): MaWorkOrderTaskInput {
  const assets = Array.isArray(task.assets) ? task.assets : [];
  const contractId = task.contractId ?? task.contract_id;
  const topRep = task.replacementDeviceId ?? task.replacement_device_id;
  const { siteName, location } = resolveTaskSiteAndLocation(task);

  return {
    id: task.id as string | number | undefined,
    taskType: 'MA',
    Sname: siteName,
    location,
    startDate: String(task.startDate ?? task.start_date ?? ''),
    endDate: String(task.endDate ?? task.end_date ?? ''),
    reporterName: String(task.reporterName ?? task.reporter_name ?? ''),
    reporterTel: String(task.reporterTel ?? task.reporter_tel ?? ''),
    ticket: String(task.ticket ?? ''),
    assignedService: String(task.assignedService ?? task.assigned_service ?? '') || null,
    assetBinding: String(task.assetBinding ?? task.asset_binding ?? '') || null,
    rootCause: String(task.rootCause ?? task.root_cause ?? ''),
    resolution: String(task.resolution ?? ''),
    notes: String(task.notes ?? ''),
    status: String(task.status ?? ''),
    contractId: contractId as string | number | null | undefined,
    replacementDeviceId: topRep as string | number | null | undefined,
    downtimeDate: (task.downtimeDate ?? task.downtime_date ?? task.down_time_start_date) as
      | string
      | null
      | undefined,
    uptimeDate: (task.uptimeDate ?? task.uptime_date ?? task.down_time_end_date) as
      | string
      | null
      | undefined,
    assets: assets.map((a: Record<string, unknown>) => ({
      id: a.id as string | number | undefined,
      name: String(a.name ?? ''),
      model: String(a.model ?? a.name ?? ''),
      serialNumber: String(a.serialNumber ?? a.serial ?? ''),
      replacementDeviceId: (a.replacementDeviceId ?? a.replacement_device_id) as
        | string
        | number
        | null
        | undefined,
    })),
  };
}

async function fetchReferSof(contractId: unknown): Promise<string> {
  if (contractId == null || !String(contractId).trim()) return '';
  try {
    const res = await apiFetch(apiUrl(`/api/contracts/${contractId}`));
    const json = await res.json();
    if (!res.ok || !json?.data) return '';
    return (
      json.data.sof_name ??
      json.data.SOF ??
      json.data.sof ??
      json.data.refer_sof ??
      ''
    );
  } catch {
    return '';
  }
}

async function fetchDeviceMapsFromTask(
  task: Record<string, unknown>
): Promise<MaWorkOrderDeviceMaps> {
  const assets = Array.isArray(task.assets) ? task.assets : [];
  const resolvedDevices: NonNullable<MaWorkOrderDeviceMaps['resolvedDevices']> = {};
  const resolvedReplacements: NonNullable<MaWorkOrderDeviceMaps['resolvedReplacements']> = {};
  const repIds = new Set<string>();

  await Promise.all(
    assets.map(async (asset: Record<string, unknown>) => {
      const id = asset.id;
      if (id == null) return;
      try {
        const res = await apiFetch(apiUrl(`/api/devices/${id}`));
        const json = await res.json();
        if (res.ok && json.data) {
          const d = json.data;
          resolvedDevices[String(id)] = {
            id: id as string | number | undefined,
            name: d.model || d.CI_Name || d.Asset_Number || String(asset.name ?? ''),
            model: d.model || String(asset.name ?? ''),
            serialNumber: d.serial || String(asset.serialNumber ?? ''),
          };
        }
      } catch {
        /* ignore */
      }
      const repId = asset.replacementDeviceId ?? asset.replacement_device_id;
      if (repId != null) repIds.add(String(repId));
    })
  );

  const topRep = task.replacementDeviceId ?? task.replacement_device_id;
  if (topRep != null) repIds.add(String(topRep));

  await Promise.all(
    [...repIds].map(async (repId) => {
      try {
        const res = await apiFetch(apiUrl(`/api/devices/${repId}`));
        const json = await res.json();
        if (res.ok && json.data) {
          const d = json.data;
          resolvedReplacements[repId] = {
            id: repId,
            name: d.model || d.CI_Name || d.Asset_Number || '',
            model: d.model || '',
            serialNumber: d.serial || '',
          };
        }
      } catch {
        /* ignore */
      }
    })
  );

  const contractId = task.contractId ?? task.contract_id;
  const referSof = await fetchReferSof(contractId);

  return { resolvedDevices, resolvedReplacements, referSof };
}

let sitesLocationCache: Array<{ SLid?: number; Location2?: string }> | null = null;

async function fetchLocationFromSiteId(siteId: unknown): Promise<string> {
  if (siteId == null || !String(siteId).trim()) return '';
  try {
    if (!sitesLocationCache) {
      const res = await apiFetch(apiUrl('/api/sites/locations'));
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) return '';
      sitesLocationCache = json.data;
    }
    const row = sitesLocationCache?.find((r) => String(r.SLid) === String(siteId));
    return row?.Location2 ? String(row.Location2).trim() : '';
  } catch {
    return '';
  }
}

/** ดึงข้อมูลฟอร์มจาก task MA — ใช้ maps ที่มีอยู่แล้วจาก detail ได้เพื่อลด API */
export async function fetchMaWorkOrderFromTask(
  task: Record<string, unknown>,
  prefetched?: MaWorkOrderDeviceMaps
): Promise<MaWorkOrderData> {
  const maps =
    prefetched?.resolvedDevices && Object.keys(prefetched.resolvedDevices).length > 0
      ? {
          resolvedDevices: prefetched.resolvedDevices,
          resolvedReplacements: prefetched.resolvedReplacements ?? {},
          referSof:
            prefetched.referSof ??
            (await fetchReferSof(task.contractId ?? task.contract_id)),
        }
      : await fetchDeviceMapsFromTask(task);

  const input = taskRecordToInput(task);
  if (!input.location?.trim()) {
    const fromSite = await fetchLocationFromSiteId(task.siteId ?? task.site_id);
    if (fromSite) input.location = fromSite;
  }

  return mapTaskToMaWorkOrder(input, {
    referSof: maps.referSof,
    resolvedDevices: maps.resolvedDevices,
    resolvedReplacements: maps.resolvedReplacements,
  });
}

export function buildMaWorkOrderFilename(task: Record<string, unknown>): string {
  const ticket = String(task.ticket ?? '').trim();
  const id = String(task.id ?? 'task').trim();
  const site = String(task.Sname ?? task.siteName ?? 'site')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const base = ticket ? `MA_${ticket}` : `MA_${id}`;
  return `${base}_${site}_${date}.pdf`;
}

type DetailDeviceLike = {
  id?: string | number;
  name?: string;
  type?: string;
  serialNumber?: string;
  replacementDeviceId?: string | number | null;
};

/** ใช้ข้อมูลอุปกรณ์ที่โหลดแล้วใน Task Detail — ตรงกับที่แสดงใน modal */
export function buildDeviceMapsFromDetail(
  assets: DetailDeviceLike[],
  assetDetailsMap: Record<string, DetailDeviceLike>,
  replacementDevicesMap: Record<string, DetailDeviceLike>,
  fallbackReplacementId?: string | number | null
): MaWorkOrderDeviceMaps {
  const resolvedDevices: NonNullable<MaWorkOrderDeviceMaps['resolvedDevices']> = {};
  const resolvedReplacements: NonNullable<MaWorkOrderDeviceMaps['resolvedReplacements']> = {};

  for (const asset of assets) {
    if (asset.id == null) continue;
    const key = String(asset.id);
    const d = assetDetailsMap[key] ?? asset;
    resolvedDevices[key] = {
      id: asset.id,
      name: d.name ?? '',
      model: d.type || d.name || '',
      serialNumber: d.serialNumber ?? '',
    };

    const repId =
      asset.replacementDeviceId ??
      (assets.length === 1 ? fallbackReplacementId : null);
    if (repId == null) continue;
    const rep = replacementDevicesMap[String(repId)];
    if (rep) {
      resolvedReplacements[String(repId)] = {
        id: repId,
        name: rep.name ?? '',
        model: rep.type || rep.name || '',
        serialNumber: rep.serialNumber ?? '',
      };
    }
  }

  return { resolvedDevices, resolvedReplacements };
}
