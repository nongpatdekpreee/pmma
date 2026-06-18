import { PM_DEFAULT_PROJECT_SUFFIX, PM_INSPECTION_TITLE } from './constants';
import type {
  PmBackupRecord,
  PmFullDocument,
  PmInspectionSection,
  PmMaintenanceChecklistSection,
  PmMaintenanceItemDraft,
  PmMaintenanceItemRow,
  PmTaskContext,
} from './types';

function emptyInspection(ctx: PmTaskContext): PmInspectionSection {
  const site = (ctx.siteName ?? '').trim();
  const loc = (ctx.location ?? ctx.deviceLocation ?? '').trim();
  return {
    documentTitle: PM_INSPECTION_TITLE,
    projectName: ctx.projectName?.trim() || (site ? `${site} ${PM_DEFAULT_PROJECT_SUFFIX}` : PM_DEFAULT_PROJECT_SUFFIX),
    location: loc || site,
    pmNo: ctx.pmNo?.trim() || '1',
    pmDate: formatPmDisplayDate(ctx.pmDate),
    contactName: (ctx.contactName ?? '').trim(),
    contactTel: (ctx.contactTel ?? '').trim(),
    equipmentType: (ctx.deviceType ?? '').trim(),
    equipmentLocation: (ctx.deviceLocation ?? loc).trim(),
    hostname: '',
    product: '',
    model: (ctx.deviceModel ?? '').trim(),
    rackRu: '',
    osVersion: '',
    ipAddress: '',
    serialNumber: (ctx.deviceSerial ?? '').trim(),
    stackNo: '',
    stackRole: '',
    cpuProcessor: '',
    memoryUtilization: '',
    temperature: '',
    environmentAlarm: '',
    powerSupply: '',
    fan: '',
    systemUptime: '',
    backupConfig: '',
    hardwareCleaning: '',
    comment: '',
  };
}

function formatPmDisplayDate(value?: string): string {
  if (!value?.trim()) {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  return value.trim();
}

function formatChecklistDate(value?: string): string {
  if (!value?.trim()) {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    }
  }
  return value.trim();
}

export function applyBackupToInspection(
  inspection: PmInspectionSection,
  backup: PmBackupRecord
): PmInspectionSection {
  return {
    ...inspection,
    equipmentType: backup.equipmentType || inspection.equipmentType,
    equipmentLocation: backup.equipmentLocation || inspection.equipmentLocation,
    hostname: backup.hostname || inspection.hostname,
    product: backup.product || inspection.product,
    model: backup.model || inspection.model,
    rackRu: backup.rackRu || inspection.rackRu,
    osVersion: backup.osVersion || inspection.osVersion,
    ipAddress: backup.ipAddress || inspection.ipAddress,
    serialNumber: backup.serialNumber || inspection.serialNumber,
    stackNo: backup.stackNo || inspection.stackNo,
    stackRole: backup.stackRole || inspection.stackRole,
    cpuProcessor: backup.cpuProcessor || inspection.cpuProcessor,
    memoryUtilization: backup.memoryUtilization || inspection.memoryUtilization,
    temperature: backup.temperature || inspection.temperature,
    environmentAlarm: backup.environmentAlarm || inspection.environmentAlarm,
    powerSupply: backup.powerSupply || inspection.powerSupply,
    fan: backup.fan || inspection.fan,
    systemUptime: backup.systemUptime || inspection.systemUptime,
    backupConfig: backup.backupConfig || inspection.backupConfig,
    hardwareCleaning: backup.hardwareCleaning || inspection.hardwareCleaning,
  };
}

export function createDefaultMaintenanceDrafts(
  ctx: PmTaskContext,
  count = 1
): PmMaintenanceItemDraft[] {
  const loc = '';
  const rack = '';
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${Date.now()}-${i}`,
    location: loc,
    rack,
    remark: '',
  }));
}

export function maintenanceDraftsToRows(drafts: PmMaintenanceItemDraft[]): PmMaintenanceItemRow[] {
  return drafts.map((d, i) => ({
    id: d.id,
    no: i + 1,
    location: d.location,
    rack: d.rack,
    beforePhotoSrc: d.beforePreview ?? null,
    afterPhotoSrc: d.afterPreview ?? null,
    remark: d.remark,
  }));
}

type DeviceLike = {
  Did: number;
  serial?: string;
  model?: string;
  CI_Name?: string;
  Location2?: string;
};

export function buildDeviceTaskContext(base: PmTaskContext, device: DeviceLike): PmTaskContext {
  return {
    ...base,
    deviceSerial: (device.serial ?? '').trim(),
    deviceModel: (device.model ?? device.CI_Name ?? '').trim(),
    deviceLocation: (device.Location2 ?? '').trim(),
    deviceType: (device.CI_Name ?? '').trim(),
    location: (device.Location2 ?? '').trim(),
  };
}

export function buildPmFullDocument(
  ctx: PmTaskContext,
  backup: PmBackupRecord | null,
  maintenanceDrafts: PmMaintenanceItemDraft[],
  comment = ''
): PmFullDocument {
  let inspection = emptyInspection(ctx);
  if (backup) inspection = applyBackupToInspection(inspection, backup);
  inspection.comment = comment.trim();

  const maintenanceChecklist: PmMaintenanceChecklistSection = {
    date: formatChecklistDate(ctx.pmDate),
    site: (ctx.siteName ?? '').trim(),
    rows: maintenanceDraftsToRows(maintenanceDrafts),
  };

  return { inspections: [inspection], maintenanceChecklist };
}

export function buildPmFullDocumentMulti(
  baseCtx: PmTaskContext,
  devices: DeviceLike[],
  maintenanceDrafts: PmMaintenanceItemDraft[],
  backupByDid: Map<number, PmBackupRecord | null> = new Map()
): PmFullDocument {
  const noteByDid = new Map<number, string>();
  for (const row of maintenanceDrafts) {
    if (row.deviceDid != null) {
      noteByDid.set(row.deviceDid, (row.technicianNote ?? '').trim());
    }
  }

  const inspections = devices.map((device) => {
    const ctx = buildDeviceTaskContext(baseCtx, device);
    let inspection = emptyInspection(ctx);
    const backup = backupByDid.get(device.Did);
    if (backup) inspection = applyBackupToInspection(inspection, backup);
    inspection.comment = noteByDid.get(device.Did) ?? '';
    return inspection;
  });

  const maintenanceChecklist: PmMaintenanceChecklistSection = {
    date: formatChecklistDate(baseCtx.pmDate),
    site: (baseCtx.siteName ?? '').trim(),
    rows: maintenanceDraftsToRows(maintenanceDrafts),
  };

  return { inspections, maintenanceChecklist };
}

export function inspectionToChecklistItems(inspection: PmInspectionSection) {
  return [
    { id: 'hostname', task: 'Hostname', status: inspection.hostname ? 'pass' : 'pending', notes: inspection.hostname },
    { id: 'cpu', task: 'CPU processor', status: inspection.cpuProcessor ? 'pass' : 'pending', notes: inspection.cpuProcessor },
    { id: 'memory', task: 'Memory utilization', status: inspection.memoryUtilization ? 'pass' : 'pending', notes: inspection.memoryUtilization },
    { id: 'uptime', task: 'System Uptime', status: inspection.systemUptime ? 'pass' : 'pending', notes: inspection.systemUptime },
    { id: 'backup', task: 'Backup Config', status: inspection.backupConfig ? 'pass' : 'pending', notes: inspection.backupConfig },
  ];
}

export function inspectionsToChecklistItems(inspections: PmInspectionSection[]) {
  return inspections.flatMap((inspection, idx) => {
    const label = (inspection.serialNumber || inspection.hostname || `Device ${idx + 1}`).trim();
    const prefix = inspections.length > 1 ? `[${label}] ` : '';
    return inspectionToChecklistItems(inspection).map((item) => ({
      ...item,
      id: `${item.id}_${idx}`,
      task: `${prefix}${item.task}`,
    }));
  });
}
