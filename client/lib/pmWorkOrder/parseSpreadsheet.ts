import * as XLSX from 'xlsx';

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_\s./-]+/g, '');
}

export function pickField(row: Record<string, unknown>, aliases: string[]): string {
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

function parseCsvText(text: string): Record<string, unknown>[] {
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
  return rows;
}

function parseJsonText(text: string): Record<string, unknown>[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is Record<string, unknown> => x != null && typeof x === 'object') as Record<
      string,
      unknown
    >[];
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    for (const key of ['records', 'devices', 'data', 'rows']) {
      const arr = obj[key];
      if (Array.isArray(arr)) {
        return arr.filter((x): x is Record<string, unknown> => x != null && typeof x === 'object') as Record<
          string,
          unknown
        >[];
      }
    }
    return [obj];
  }
  return [];
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

/** Parse .json / .csv / .xlsx / .xls → array of row objects */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
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
