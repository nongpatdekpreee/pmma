import type { PmBackupRecord, PmMonitoringBackupRecord } from './types';
import { pickField, pickVendorField, isBlankProductValue, parseSpreadsheetFile } from './parseSpreadsheet';
import {
  BACKUP_CONFIGURATION_ALIASES,
  BACKUP_CPU_USAGE_ALIASES,
  BACKUP_ENVIRONMENT_ALARM_ALIASES,
  BACKUP_FAN_ALIASES,
  BACKUP_FILE_SIZE_ALIASES,
  BACKUP_HOSTNAME_ALIASES,
  BACKUP_IP_ALIASES,
  BACKUP_MEMORY_UTILIZATION_ALIASES,
  BACKUP_MODEL_ALIASES,
  BACKUP_POWER_SUPPLY_ALIASES,
  BACKUP_REMARK_ALIASES,
  BACKUP_SERIAL_ALIASES,
  BACKUP_SOFTWARE_VERSION_ALIASES,
  BACKUP_STACK_HA_ROLE_ALIASES,
  BACKUP_STACK_ROLE_ALIASES,
  BACKUP_SYSTEM_UPTIME_ALIASES,
  BACKUP_TEMPERATURE_ALIASES,
} from './backupFieldAliases';
import { modelsMatch, modelsLooselyMatch, normalizeModel, normalizeSerial, serialsMatch } from './normalizeMatch';

function monitoringModelFromRow(row: Record<string, unknown>): string {
  for (const alias of BACKUP_MODEL_ALIASES) {
    const val = pickField(row, [alias]);
    if (val.trim()) return val.trim();
  }
  return '';
}

function rowToMonitoringRecord(row: Record<string, unknown>): PmMonitoringBackupRecord | null {
  const serialNumber = pickField(row, BACKUP_SERIAL_ALIASES);
  const model = monitoringModelFromRow(row);
  if (!serialNumber && !model) return null;

  const equipmentName = pickField(row, ['equipmentname', 'equipment name']) || undefined;

  return {
    serialNumber: serialNumber || '',
    model,
    hostname: pickField(row, BACKUP_HOSTNAME_ALIASES) || equipmentName || undefined,
    ipAddress: pickField(row, BACKUP_IP_ALIASES) || undefined,
    osVersion: pickField(row, BACKUP_SOFTWARE_VERSION_ALIASES) || undefined,
    systemUptime: pickField(row, BACKUP_SYSTEM_UPTIME_ALIASES) || undefined,
    stackNo: pickField(row, BACKUP_STACK_HA_ROLE_ALIASES) || undefined,
    stackRole: pickField(row, BACKUP_STACK_ROLE_ALIASES) || undefined,
    cpuUsage: pickField(row, BACKUP_CPU_USAGE_ALIASES) || undefined,
    memoryUtilization: pickField(row, BACKUP_MEMORY_UTILIZATION_ALIASES) || undefined,
    environmentAlarm: pickField(row, BACKUP_ENVIRONMENT_ALARM_ALIASES) || undefined,
    powerSupply: pickField(row, BACKUP_POWER_SUPPLY_ALIASES) || undefined,
    temperature: pickField(row, BACKUP_TEMPERATURE_ALIASES) || undefined,
    fileSizeKb: pickField(row, BACKUP_FILE_SIZE_ALIASES) || undefined,
    fan: pickField(row, BACKUP_FAN_ALIASES) || undefined,
    backupConfig: pickField(row, BACKUP_CONFIGURATION_ALIASES) || undefined,
    remark: pickField(row, BACKUP_REMARK_ALIASES) || undefined,
    equipmentName,
    vendor: pickVendorField(row) || undefined,
    gps: pickField(row, ['gps']) || undefined,
    substation: pickField(row, ['substation']) || undefined,
    installationDate: pickField(row, ['installationdate', 'installation date']) || undefined,
  };
}

export async function parsePmMonitoringBackupFile(file: File): Promise<PmMonitoringBackupRecord[]> {
  const rows = await parseSpreadsheetFile(file);
  const out: PmMonitoringBackupRecord[] = [];
  for (const row of rows) {
    const rec = rowToMonitoringRecord(row);
    if (rec && (rec.serialNumber || rec.model)) out.push(rec);
  }
  return out;
}

/** Join backup row to location: Serial + Model must match */
export function findMonitoringForLocation(
  monitoringRecords: PmMonitoringBackupRecord[],
  location: { model: string; serialNumber: string }
): PmMonitoringBackupRecord | undefined {
  const locModel = location.model.trim();
  const locSerial = location.serialNumber.trim();
  if (!locSerial || !locModel) return undefined;

  const bySerialModel = monitoringRecords.filter(
    (m) =>
      m.serialNumber &&
      serialsMatch(m.serialNumber, locSerial) &&
      (modelsMatch(m.model, locModel) || modelsLooselyMatch(m.model, locModel))
  );
  if (bySerialModel.length === 1) return bySerialModel[0];
  if (bySerialModel.length > 1) {
    return (
      bySerialModel.find((m) => (m.vendor ?? '').trim() && modelsMatch(m.model, locModel)) ??
      bySerialModel.find((m) => (m.vendor ?? '').trim()) ??
      bySerialModel.find((m) => modelsMatch(m.model, locModel)) ??
      bySerialModel[0]
    );
  }

  return undefined;
}

function productFromParts(...parts: Array<string | undefined | null>): string {
  for (const part of parts) {
    const t = (part ?? '').trim();
    if (t && !isBlankProductValue(t)) return t;
  }
  return '';
}

/** Hostname + IP always from location file (not backup) */
export function monitoringToPmBackupRecord(
  mon: PmMonitoringBackupRecord,
  location?: { hostname?: string; vendor?: string; ipAddress?: string }
): PmBackupRecord {
  return {
    serialNumber: mon.serialNumber,
    model: mon.model || mon.equipmentName || '',
    hostname: (location?.hostname ?? '').trim(),
    product: productFromParts(mon.vendor, location?.vendor),
    ipAddress: (location?.ipAddress ?? '').trim(),
    osVersion: mon.osVersion || '',
    systemUptime: mon.systemUptime || '',
    stackNo: mon.stackNo || '',
    stackRole: mon.stackRole || '',
    cpuProcessor: mon.cpuUsage || '',
    memoryUtilization: mon.memoryUtilization || '',
    environmentAlarm: mon.environmentAlarm || '',
    powerSupply: mon.powerSupply || '',
    temperature: mon.temperature || '',
    fileSizeKb: mon.fileSizeKb || '',
    fan: mon.fan || '',
    backupConfig: mon.backupConfig || '',
    equipmentLocation: mon.substation || '',
  };
}

export function deviceLabelFromParts(parts: {
  CI_Name?: string;
  model?: string;
  serial?: string;
  Did: number;
}): string {
  const model = (parts.model || parts.CI_Name || '').trim();
  const serial = (parts.serial || '').trim();
  if (model && serial && !model.toUpperCase().includes(serial.toUpperCase())) {
    return `${model} · ${serial}`;
  }
  if (model) return model;
  if (serial) return serial;
  return `Device ${parts.Did}`;
}

export { normalizeSerial, normalizeModel };
