/**
 * สูตรเดียวกับ client/lib/downtimeHours.ts — คำนวณชั่วโมง Down time รวม
 */

function toDateOnly(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function toTimeHHmm(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** downtimeDate → uptimeDate + uptime(time); เริ่มจาก downtime(time) (เที่ยงคืนถ้าไม่ระบุเวลาเริ่ม) */
function computeDownTimeTotalHours(
  downtimeDate,
  uptimeDate,
  uptimeTimeHHmm,
  downtimeTimeHHmm
) {
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

module.exports = {
  toDateOnly,
  toTimeHHmm,
  computeDownTimeTotalHours,
};
