import type { PmLocationRecord } from './types';
import { pickField, parseSpreadsheetFile } from './parseSpreadsheet';
import { normalizeModel, normalizeSerial } from './normalizeMatch';

const SERIAL_ALIASES = ['serialnumber', 'serial number', 'serial', 'sn', 'sn.'];
const MODEL_ALIASES = ['model', 'device model'];
const IP_ALIASES = ['ipaddress', 'ip address', 'ip'];

function rowToLocationRecord(row: Record<string, unknown>): PmLocationRecord | null {
  const serialNumber = pickField(row, SERIAL_ALIASES);
  const model = pickField(row, MODEL_ALIASES);
  const ipAddress = pickField(row, IP_ALIASES);
  if (!serialNumber || !model) return null;

  return {
    serialNumber,
    model,
    ipAddress,
    hostname: pickField(row, ['hostname', 'host name']) || undefined,
    vendor: pickField(row, ['vendor']) || undefined,
    assetTag: pickField(row, ['assettag', 'asset tag']) || undefined,
    serviceTag: pickField(row, ['servicetag', 'service tag']) || undefined,
    locationLevel: pickField(row, ['locationlevel', 'location (level)', 'location']) || undefined,
    roomNameLevel: pickField(row, ['roomnamelevel', 'room name / level', 'room name']) || undefined,
    roomNumber: pickField(row, ['roomnumber', 'room number']) || undefined,
    cabinetRackName: pickField(row, ['cabinetrackname', 'cabinet / rack name', 'cabinet', 'rack name']) || undefined,
    rackUnit: pickField(row, ['rackunit', 'rack unit']) || undefined,
    ru: pickField(row, ['ru', 'rack ru']) || undefined,
    slot: pickField(row, ['slot']) || undefined,
    rackSide: pickField(row, ['rackside', 'rack / side', 'rack side']) || undefined,
    subLocation: pickField(row, ['sublocation', 'sub-location', 'sub location']) || undefined,
    unitName: pickField(row, ['unitname', 'unit name']) || undefined,
    status: pickField(row, ['status']) || undefined,
  };
}

export function buildLocationDisplayText(loc: PmLocationRecord): string {
  const parts = [
    loc.roomNameLevel,
    loc.roomNumber,
    loc.locationLevel,
    loc.subLocation,
    loc.unitName,
  ].filter((p) => p != null && String(p).trim() !== '');
  return parts.join(' / ').trim();
}

export function buildRackDisplayText(loc: PmLocationRecord): string {
  const parts = [loc.cabinetRackName, loc.rackUnit, loc.ru, loc.slot, loc.rackSide].filter(
    (p) => p != null && String(p).trim() !== ''
  );
  return parts.join(' / ').trim();
}

export async function parseLocationFile(file: File): Promise<PmLocationRecord[]> {
  const rows = await parseSpreadsheetFile(file);
  const out: PmLocationRecord[] = [];
  for (const row of rows) {
    const rec = rowToLocationRecord(row);
    if (rec) out.push(rec);
  }
  return out;
}

export function findLocationForDevice(
  records: PmLocationRecord[],
  device: { serial?: string; CI_Name?: string; model?: string }
): PmLocationRecord | undefined {
  const serial = (device.serial ?? '').trim();
  const model = (device.model ?? device.CI_Name ?? '').trim();
  if (!serial || !model) return undefined;

  const targetSerial = normalizeSerial(serial);
  const targetModel = normalizeModel(model);
  return records.find(
    (r) => normalizeSerial(r.serialNumber) === targetSerial && normalizeModel(r.model) === targetModel
  );
}

export function findLocationByIpAndModel(
  records: PmLocationRecord[],
  ip: string,
  model: string
): PmLocationRecord | undefined {
  if (!ip.trim() || !model.trim()) return undefined;
  const targetIp = ip.trim().toLowerCase();
  const targetModel = normalizeModel(model);
  return records.find(
    (r) => r.ipAddress.trim().toLowerCase() === targetIp && normalizeModel(r.model) === targetModel
  );
}
