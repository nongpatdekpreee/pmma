import type { PmLocationRecord } from './types';
import { pickField, parseSpreadsheetFile, cellToString } from './parseSpreadsheet';
import {
  modelCandidatesFromDevice,
  modelsLooselyMatch,
  modelsMatch,
  normalizeSerial,
} from './normalizeMatch';

const SERIAL_ALIASES = [
  'serialnumber',
  'serial number',
  'serial no',
  'serialno',
  'chassisserial',
  'chassis serial',
  'chassis serial number',
  'serial',
  'sn',
  'sn.',
  'sn:',
  's/n',
];

const MODEL_ALIASES = [
  'model',
  'model number',
  'modelnumber',
  'device model',
  'devicemodel',
  'product id',
  'productid',
  'pid',
  'product',
  'equipment model',
];

const IP_ALIASES = ['ipaddress', 'ip address', 'ip'];

const HOSTNAME_ALIASES = ['hostname', 'host name', 'host'];

/** Columns for photo-step "Location" field (not used for matching) */
const LOCATION_LEVEL_ALIASES = [
  'locationlevel',
  'location level',
  'location (level)',
  'location',
];

const ROOM_NAME_ALIASES = [
  'roomnamelevel',
  'room name level',
  'room name / level',
  'room name',
  'room',
];

/** Columns for photo-step "Rack" field (not used for matching) */
const CABINET_RACK_ALIASES = [
  'cabinetrackname',
  'cabinet rack name',
  'cabinet / rack name',
  'cabinet',
  'rack name',
];

const RACK_UNIT_ALIASES = ['rackunit', 'rack unit', 'rack no', 'rack no ru', 'rack no./ru'];

function rowToLocationRecord(row: Record<string, unknown>): PmLocationRecord | null {
  const serialNumber = pickField(row, SERIAL_ALIASES);
  const model = pickField(row, MODEL_ALIASES) || '';
  const ipAddress = pickField(row, IP_ALIASES);
  const rackCombined = pickField(row, ['rackno', 'rack no', 'rack no ru', 'rack noru', 'rack']);

  if (!serialNumber) return null;

  const cabinetRackName = pickField(row, CABINET_RACK_ALIASES) || undefined;

  const rackUnit =
    pickField(row, RACK_UNIT_ALIASES) || rackCombined || undefined;

  return {
    serialNumber,
    model,
    ipAddress,
    hostname: pickField(row, HOSTNAME_ALIASES) || undefined,
    vendor:
      pickField(row, ['vendor', 'vender', 'manufacturer', 'brand', 'product']) || undefined,
    assetTag: pickField(row, ['assettag', 'asset tag']) || undefined,
    serviceTag: pickField(row, ['servicetag', 'service tag']) || undefined,
    locationLevel: pickField(row, LOCATION_LEVEL_ALIASES) || undefined,
    roomNameLevel: pickField(row, ROOM_NAME_ALIASES) || undefined,
    roomNumber: pickField(row, ['roomnumber', 'room number']) || undefined,
    cabinetRackName,
    rackUnit,
    ru: pickField(row, ['ru', 'rack ru', 'rackru']) || rackCombined || undefined,
    slot: pickField(row, ['slot']) || undefined,
    rackSide: pickField(row, ['rackside', 'rack side', 'rack / side']) || undefined,
    subLocation: pickField(row, ['sublocation', 'sub location', 'sub-location']) || undefined,
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

/** Rack/room from location file — never used for matching, only display on photo step */
export function buildRackDisplayText(loc: PmLocationRecord): string {
  const parts = [loc.cabinetRackName, loc.rackUnit, loc.ru, loc.slot, loc.rackSide].filter(
    (p) => p != null && String(p).trim() !== ''
  );
  return parts.join(' / ').trim();
}

export type LocationParseResult = {
  records: PmLocationRecord[];
  rawRowCount: number;
  headerKeys: string[];
  skippedMissingSerial: number;
  skippedMissingModel: number;
};

function rowHasAnyValue(row: Record<string, unknown>): boolean {
  return Object.values(row).some((v) => cellToString(v) !== '');
}

export function diagnoseLocationRows(rows: Record<string, unknown>[]): Omit<LocationParseResult, 'records'> {
  const headerKeys = rows.length > 0 ? Object.keys(rows[0]).filter((k) => !k.startsWith('__col_')) : [];
  let skippedMissingSerial = 0;
  let skippedMissingModel = 0;

  for (const row of rows) {
    if (!rowHasAnyValue(row)) continue;
    const serialNumber = pickField(row, SERIAL_ALIASES);
    const model = pickField(row, MODEL_ALIASES);
    if (!serialNumber) skippedMissingSerial += 1;
    else if (!model) skippedMissingModel += 1;
  }

  return {
    rawRowCount: rows.length,
    headerKeys,
    skippedMissingSerial,
    skippedMissingModel,
  };
}

export function buildLocationParseErrorMessage(meta: Omit<LocationParseResult, 'records'>): string {
  const headers =
    meta.headerKeys.length > 0
      ? meta.headerKeys.slice(0, 12).join(', ') + (meta.headerKeys.length > 12 ? ', …' : '')
      : '(no headers detected — is row 1 the column names?)';

  const parts = [
    `No rows parsed from location file (${meta.rawRowCount} data row(s) read).`,
    `Headers found: ${headers}.`,
    'Need columns "Serial Number" (or SN, Chassis Serial) and "Model" (or Product ID, PID) with values on each row.',
  ];

  if (meta.skippedMissingSerial > 0) {
    parts.push(`${meta.skippedMissingSerial} row(s) have Model but no Serial.`);
  }
  if (meta.skippedMissingModel > 0) {
    parts.push(`${meta.skippedMissingModel} row(s) have Serial but no Model.`);
  }

  return parts.join(' ');
}

export async function parseLocationFileDetailed(file: File): Promise<LocationParseResult> {
  const rows = await parseSpreadsheetFile(file);
  const diag = diagnoseLocationRows(rows);
  const out: PmLocationRecord[] = [];
  for (const row of rows) {
    const rec = rowToLocationRecord(row);
    if (rec) out.push(rec);
  }
  return { records: out, ...diag };
}

export async function parseLocationFile(file: File): Promise<PmLocationRecord[]> {
  const { records } = await parseLocationFileDetailed(file);
  return records;
}

function recordMatchesSerial(record: PmLocationRecord, targetSerial: string): boolean {
  return (
    Boolean(record.serialNumber) && normalizeSerial(record.serialNumber) === targetSerial
  );
}

function locationModelMatches(record: PmLocationRecord, taskModel: string): boolean {
  if (!taskModel.trim() || !record.model.trim()) return false;
  return modelsMatch(record.model, taskModel) || modelsLooselyMatch(record.model, taskModel);
}

/** Match task device → location row: Serial + Model, then unique Serial if model differs */
export function findLocationForDevice(
  records: PmLocationRecord[],
  device: { serial?: string; model?: string; CI_Name?: string; Asset_Number?: string }
): PmLocationRecord | undefined {
  const serial = (device.serial ?? '').trim();
  if (!serial) return undefined;

  const targetSerial = normalizeSerial(serial);
  const serialHits = records.filter((r) => recordMatchesSerial(r, targetSerial));
  if (serialHits.length === 0) return undefined;

  const models = modelCandidatesFromDevice(device);
  for (const rec of serialHits) {
    if (models.some((m) => locationModelMatches(rec, m))) return rec;
  }

  if (serialHits.length === 1) return serialHits[0];
  return undefined;
}
