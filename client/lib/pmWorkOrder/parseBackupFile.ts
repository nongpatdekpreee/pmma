import * as XLSX from 'xlsx';
import type { PmBackupRecord } from './types';

const SERIAL_KEYS = [
  'serial',
  'serialnumber',
  'serial_number',
  'serial no',
  'serialno',
  'sn',
];

const FIELD_ALIASES: Record<keyof Omit<PmBackupRecord, 'serialNumber'>, string[]> = {
  equipmentType: ['equipmenttype', 'equipment_type', 'type', 'type of equipment', 'device type'],
  equipmentLocation: ['equipmentlocation', 'equipment_location', 'location'],
  hostname: ['hostname', 'host name', 'host'],
  product: ['product'],
  model: ['model'],
  rackRu: ['rackru', 'rack_ru', 'rack', 'rack/ru', 'ru'],
  osVersion: [
    'softwareversion',
    'software version',
    'software_version',
    'osversion',
    'os_version',
    'os version',
    'ios version',
    'firmwareversion',
    'firmware version',
    'firmware',
    'swversion',
    'sw version',
    'version',
  ],
  ipAddress: ['ipaddress', 'ip_address', 'ip address', 'ip'],
  stackNo: ['stackno', 'stack_no', 'stack no', 'stack number'],
  stackRole: ['stackrole', 'stack_role', 'stack role'],
  cpuProcessor: ['cpuprocessor', 'cpu_processor', 'cpu', 'cpu processor', 'cpu usage'],
  memoryUtilization: [
    'memoryutilization',
    'memory_utilization',
    'memory',
    'memory utilization',
    'memory usage',
  ],
  temperature: ['temperature', 'temp'],
  environmentAlarm: ['environmentalarm', 'environment_alarm', 'environment alarm', 'alarm'],
  powerSupply: ['powersupply', 'power_supply', 'power supply', 'psu'],
  fan: ['fan', 'fans'],
  systemUptime: ['systemuptime', 'system_uptime', 'system uptime', 'uptime'],
  backupConfig: ['backupconfig', 'backup_config', 'backup config', 'config backup'],
  hardwareCleaning: ['hardwarecleaning', 'hardware_cleaning', 'hardware cleaning', 'cleaning'],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_\s-]+/g, '');
}

function pickSerial(row: Record<string, unknown>): string {
  for (const [key, val] of Object.entries(row)) {
    if (SERIAL_KEYS.includes(normalizeKey(key)) && val != null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
}

function pickField(row: Record<string, unknown>, aliases: string[]): string {
  const normalizedRow = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    normalizedRow.set(normalizeKey(k), v);
  }
  for (const alias of aliases) {
    const val = normalizedRow.get(normalizeKey(alias));
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return '';
}

function rowToBackupRecord(row: Record<string, unknown>): PmBackupRecord | null {
  const serialNumber = pickSerial(row);
  if (!serialNumber) return null;

  const record: PmBackupRecord = { serialNumber };
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
    keyof Omit<PmBackupRecord, 'serialNumber'>,
    string[],
  ][]) {
    const val = pickField(row, aliases);
    if (val) record[field] = val;
  }
  return record;
}

export function normalizeSerial(serial: string): string {
  return serial.trim().toUpperCase().replace(/[\s-]+/g, '');
}

function normalizeLabel(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, '');
}

function deviceModelKey(device: { CI_Name?: string; model?: string }): string | null {
  const raw = (device.CI_Name ?? device.model ?? '').trim();
  if (!raw) return null;
  return normalizeLabel(raw);
}

/** Task CI_Name/model must match backup Model column */
export function backupModelMatchesDevice(
  device: { CI_Name?: string; model?: string },
  backup: PmBackupRecord
): boolean {
  const deviceModel = deviceModelKey(device);
  const backupModel = (backup.model ?? '').trim();
  if (!deviceModel || !backupModel) return false;
  return deviceModel === normalizeLabel(backupModel);
}

export function findBackupBySerial(
  records: PmBackupRecord[],
  serial: string
): PmBackupRecord | undefined {
  const target = normalizeSerial(serial);
  if (!target) return undefined;
  return records.find((r) => normalizeSerial(r.serialNumber) === target);
}

/** Match device → backup row when Model + Serial Number both align */
export function findBackupForDevice(
  records: PmBackupRecord[],
  device: { serial?: string; CI_Name?: string; model?: string }
): PmBackupRecord | undefined {
  const serial = (device.serial ?? '').trim();
  if (!serial || !deviceModelKey(device)) return undefined;

  const targetSerial = normalizeSerial(serial);
  return records.find(
    (r) =>
      normalizeSerial(r.serialNumber) === targetSerial && backupModelMatchesDevice(device, r)
  );
}

function rowsFromObjects(objects: unknown[]): PmBackupRecord[] {
  const out: PmBackupRecord[] = [];
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    const rec = rowToBackupRecord(obj as Record<string, unknown>);
    if (rec) out.push(rec);
  }
  return out;
}

function parseJsonText(text: string): PmBackupRecord[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return rowsFromObjects(parsed);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.records)) return rowsFromObjects(obj.records);
    if (Array.isArray(obj.devices)) return rowsFromObjects(obj.devices);
    if (Array.isArray(obj.data)) return rowsFromObjects(obj.data);
    const single = rowToBackupRecord(obj);
    return single ? [single] : [];
  }
  return [];
}

function parseCsvText(text: string): PmBackupRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    rows.push(row);
  }
  return rowsFromObjects(rows);
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<PmBackupRecord[]> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rowsFromObjects(json);
}

/** Parse backup file (JSON / CSV / XLSX / XLS) → records indexed by serial */
export async function parseBackupFile(file: File): Promise<PmBackupRecord[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const text = await file.text();
    return parseJsonText(text);
  }
  if (name.endsWith('.csv')) {
    const text = await file.text();
    return parseCsvText(text);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer);
  }
  throw new Error('รองรับไฟล์ .json, .csv, .xlsx, .xls เท่านั้น');
}
