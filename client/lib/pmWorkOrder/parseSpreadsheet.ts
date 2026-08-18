import * as XLSX from 'xlsx';

const SERIAL_HEADER_HINTS = ['serial', 'sn', 's/n'];
const MODEL_HEADER_HINTS = ['model', 'devicemodel', 'product', 'pid'];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Excel may store long serials as numbers — avoid scientific notation */
export function cellToString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '';
    if (Math.abs(val) >= 1e6 || (Number.isInteger(val) && String(val).includes('e'))) {
      return String(Math.trunc(val));
    }
  }
  return String(val).trim();
}

export function pickField(row: Record<string, unknown>, aliases: string[]): string {
  const normalizedRow = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeKey(k);
    if (!nk) continue;
    if (!normalizedRow.has(nk)) normalizedRow.set(nk, v);
  }

  for (const alias of aliases) {
    const text = cellToString(normalizedRow.get(normalizeKey(alias)));
    if (text) return text;
  }

  // Headers like "Serial Number (Chassis)" / "Product ID" / "Model Number"
  // — header detection already treats these as serial/model, but exact alias keys miss them.
  for (const alias of aliases) {
    const na = normalizeKey(alias);
    if (na.length < 4) continue;
    let bestKey = '';
    let bestVal = '';
    for (const [k, v] of normalizedRow) {
      if (!k.includes(na)) continue;
      const text = cellToString(v);
      if (!text) continue;
      if (!bestKey || k.length < bestKey.length) {
        bestKey = k;
        bestVal = text;
      }
    }
    if (bestVal) return bestVal;
  }
  return '';
}

function cellMatchesHeaderHints(cell: string, hints: string[]): boolean {
  const n = normalizeKey(cell);
  if (!n) return false;
  return hints.some((h) => {
    const nh = normalizeKey(h);
    return n === nh || n.includes(nh);
  });
}

/** -1 = no Serial header row in this sheet */
function detectHeaderRowIndex(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 30);
  let serialOnly = -1;
  for (let i = 0; i < limit; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? '').trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const hasSerial = cells.some((c) => cellMatchesHeaderHints(c, SERIAL_HEADER_HINTS));
    const hasModel = cells.some((c) => cellMatchesHeaderHints(c, MODEL_HEADER_HINTS));
    if (hasSerial && hasModel) return i;
    if (hasSerial && serialOnly < 0) serialOnly = i;
  }
  return serialOnly;
}

function applyMergedCells(matrix: unknown[][], sheet: XLSX.WorkSheet): void {
  const merges = sheet['!merges'];
  if (!merges?.length) return;
  for (const range of merges) {
    const src = matrix[range.s.r]?.[range.s.c];
    if (src == null || cellToString(src) === '') continue;
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      if (!matrix[r]) matrix[r] = [];
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        if (!cellToString(matrix[r][c])) matrix[r][c] = src;
      }
    }
  }
}

function matrixToRowObjects(matrix: unknown[][], headerRowIndex: number): Record<string, unknown>[] {
  if (headerRowIndex < 0) return [];
  const headerRow = matrix[headerRowIndex];
  if (!Array.isArray(headerRow)) return [];

  const headers = headerRow.map((h, idx) => {
    const label = String(h ?? '').trim();
    return label || `__col_${idx}`;
  });

  const out: Record<string, unknown>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const dataRow = matrix[r];
    if (!Array.isArray(dataRow)) continue;

    const obj: Record<string, unknown> = {};
    let hasAny = false;
    headers.forEach((h, c) => {
      const val = dataRow[c] ?? '';
      if (cellToString(val)) hasAny = true;
      obj[h] = val ?? '';
    });
    if (hasAny) out.push(obj);
  }
  return out;
}

function parseCsvText(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const matrix: unknown[][] = lines.map((line) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
  );
  const headerIdx = detectHeaderRowIndex(matrix);
  return matrixToRowObjects(matrix, headerIdx);
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

function sheetToRowObjects(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  applyMergedCells(matrix, sheet);
  const headerIdx = detectHeaderRowIndex(matrix);
  return matrixToRowObjects(matrix, headerIdx);
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const out: Record<string, unknown>[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    out.push(...sheetToRowObjects(sheet));
  }
  return out;
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
