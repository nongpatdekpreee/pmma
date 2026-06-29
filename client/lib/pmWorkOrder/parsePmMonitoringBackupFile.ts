import type { PmBackupRecord, PmMonitoringBackupRecord } from './types';
import { pickField, parseSpreadsheetFile } from './parseSpreadsheet';
import { ipsMatch, modelsMatch, normalizeModel, normalizeSerial, serialsMatch } from './normalizeMatch';

const SERIAL_ALIASES = ['sn.', 'sn', 'serialnumber', 'serial number', 'serial'];
const IP_ALIASES = ['ipaddress', 'ip address', 'ip'];

function monitoringModelFromRow(row: Record<string, unknown>): string {
  const candidates = [
    pickField(row, ['equipmentname', 'equipment name']),
    pickField(row, ['model', 'device model']),
    pickField(row, ['asset']),
    pickField(row, ['manufacturer']),
  ];
  for (const c of candidates) {
    if (c.trim()) return c.trim();
  }
  return '';
}

function rowToMonitoringRecord(row: Record<string, unknown>): PmMonitoringBackupRecord | null {
  const serialNumber = pickField(row, SERIAL_ALIASES);
  const model = monitoringModelFromRow(row);
  if (!serialNumber && !model) return null;

  const ipAddress = pickField(row, IP_ALIASES) || undefined;

  return {
    serialNumber: serialNumber || '',
    model,
    ipAddress,
    equipmentName: pickField(row, ['equipmentname', 'equipment name']) || undefined,
    manufacturer: pickField(row, ['manufacturer']) || undefined,
    temperature:
      pickField(row, [
        'temperature(celsius)',
        'temperature (celsius)',
        'temperature',
        'temp',
      ]) || undefined,
    remark: pickField(row, ['remark', 'remarks']) || undefined,
    backupReference: pickField(row, ['backup(reference)', 'backup (reference)', 'backup']) || undefined,
    operatingStatus:
      pickField(row, [
        'normaloperatingstatus',
        'normal operating status',
        'status(condition)',
        'status (condition)',
        'status',
      ]) || undefined,
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

/** Join monitoring row to location row: IP + Model (fallback Serial + Model) */
export function findMonitoringForLocation(
  monitoringRecords: PmMonitoringBackupRecord[],
  location: { ipAddress: string; model: string; serialNumber: string }
): PmMonitoringBackupRecord | undefined {
  const locModel = location.model.trim();
  const locIp = location.ipAddress.trim();
  const locSerial = location.serialNumber.trim();

  if (locIp && locModel) {
    const byIpModel = monitoringRecords.find(
      (m) =>
        m.ipAddress &&
        ipsMatch(m.ipAddress, locIp) &&
        modelsMatch(m.model, locModel)
    );
    if (byIpModel) return byIpModel;
  }

  if (locSerial && locModel) {
    return monitoringRecords.find(
      (m) => serialsMatch(m.serialNumber, locSerial) && modelsMatch(m.model, locModel)
    );
  }

  return undefined;
}

/** Convert monitoring row → PmBackupRecord for PDF inspection */
export function monitoringToPmBackupRecord(
  mon: PmMonitoringBackupRecord,
  location?: { hostname?: string; vendor?: string; ipAddress?: string }
): PmBackupRecord {
  return {
    serialNumber: mon.serialNumber,
    model: mon.model || mon.equipmentName || '',
    hostname: location?.hostname || mon.equipmentName || '',
    product: mon.manufacturer || location?.vendor || '',
    ipAddress: mon.ipAddress || location?.ipAddress || '',
    temperature: mon.temperature || '',
    backupConfig: mon.backupReference || '',
    equipmentType: mon.equipmentName || '',
    environmentAlarm: mon.operatingStatus || '',
    equipmentLocation: mon.substation || '',
  };
}

export function deviceLabelFromParts(parts: {
  CI_Name?: string;
  model?: string;
  serial?: string;
  Did: number;
}): string {
  return parts.CI_Name || parts.model || parts.serial || `Device ${parts.Did}`;
}

export { normalizeSerial, normalizeModel };
