/** แยก site / location จาก site_name แบบเก่า "Site - Location" หรือ "Site – Location" */
export function splitLegacyTaskSiteName(siteName: string): { siteName: string; location: string } {
  const trimmed = siteName.trim();
  const sep = trimmed.match(/\s[-–]\s/);
  if (!sep || sep.index == null) {
    return { siteName: trimmed, location: '' };
  }
  const idx = sep.index;
  return {
    siteName: trimmed.slice(0, idx).trim(),
    location: trimmed.slice(idx + sep[0].length).trim(),
  };
}

/** ชื่อ Site ล้วนๆ สำหรับหน้า detail (ไม่รวม location) */
export function taskDetailSiteName(input: {
  siteDbName?: string | null;
  Sname?: string | null;
  siteName?: string | null;
}): string {
  const db = (input.siteDbName ?? '').trim();
  if (db) return db;
  const legacy = (input.Sname ?? input.siteName ?? '').trim();
  if (!legacy) return '—';
  const { siteName } = splitLegacyTaskSiteName(legacy);
  return siteName || legacy;
}

export type TaskSiteLabelInput = {
  taskType?: string | null;
  province?: string | null;
  location?: string | null;
  siteName?: string | null;
  vendorName?: string | null;
};

/** ชื่อแสดงบน calendar / schedule: Province - location */
export function buildTaskSiteDisplayTitle(input: TaskSiteLabelInput): string {
  const province = (input.province ?? '').trim();
  let location = (input.location ?? '').trim();
  let siteName = (input.siteName ?? '').trim();

  if (!location && siteName.includes(' - ')) {
    const split = splitLegacyTaskSiteName(siteName);
    siteName = split.siteName;
    location = split.location;
  }

  if (province && location) return `${province} - ${location}`;
  if (province) return province;
  if (location) return location;

  const taskType = String(input.taskType || 'PM').toUpperCase();
  if (taskType === 'MA') {
    return siteName || (input.vendorName ?? '').trim() || 'Maintenance Agreement';
  }
  return siteName || 'Preventive Maintenance';
}
