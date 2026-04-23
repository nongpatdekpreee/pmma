/** ตัดให้เหลือ YYYY-MM-DD */
export function toDateOnly(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * แสดงวันที่ตาม locale — ให้สอดคล้องกับ input type="date" (เช่น lang="en-US" → MM/DD/YYYY)
 * ค่าเข้าเป็น YYYY-MM-DD หรือค่าที่ toDateOnly ตัดได้
 */
export function formatDateLocale(
  value: unknown,
  locales: Intl.LocalesArgument = 'en-US'
): string {
  const ymd = toDateOnly(value);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(locales, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** รองรับค่าจาก DB/API เช่น 14:30:00 → ใช้กับ input type="time" */
export function toTimeHHmm(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * แสดงเวลาแบบ 12 ชม. AM/PM — ให้ตรงกับ input type="time" lang="en-US"
 */
export function formatTime12h(
  value: unknown,
  locales: Intl.LocalesArgument = 'en-US'
): string {
  const s = toTimeHHmm(value);
  if (!s) return '';
  const [hh, mm] = s.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  const d = new Date(1970, 0, 1, hh, mm);
  return d.toLocaleTimeString(locales, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * ชั่วโมงรวมจาก downtime (วัน/เวลาเริ่ม) ถึง uptime (วัน/เวลากลับมาใช้งาน)
 */
export function computeDownTimeTotalHours(
  downtimeDate: string | null | undefined,
  uptimeDate: string | null | undefined,
  uptimeTimeHHmm: string | null | undefined,
  downtimeTimeHHmm?: string | null | undefined
): number | null {
  const sd = toDateOnly(downtimeDate);
  const ed = toDateOnly(uptimeDate);
  const tt = toTimeHHmm(uptimeTimeHHmm);
  if (!sd || !ed || !tt) return null;
  const st = toTimeHHmm(downtimeTimeHHmm);
  const startPart = st || '00:00';
  const start = new Date(`${sd}T${startPart}:00`);
  const end = new Date(`${ed}T${tt}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() < start.getTime()) return null;
  return Math.round(((end.getTime() - start.getTime()) / 36e5) * 100) / 100;
}
