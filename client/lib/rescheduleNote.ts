/**
 * ประกอบ reschedule_note ให้มีบรรทัดแรกบอกว่าย้ายมาจากวัน/ช่วงเดิม (แสดงใน Task detail)
 */
export function composeRescheduleNoteWithOrigin(
  previousStartYmd: string,
  previousEndYmd: string,
  userReason: string,
  formatMonthDayYear: (ymd: string) => string
): string {
  const reason = userReason.trim();
  const same =
    previousStartYmd &&
    previousEndYmd &&
    previousStartYmd === previousEndYmd;
  const originLine = same
    ? `จากวันที่เดิม ${formatMonthDayYear(previousStartYmd)}`
    : `จากช่วงเดิม ${formatMonthDayYear(previousStartYmd)} – ${formatMonthDayYear(previousEndYmd)}`;
  if (!reason) return originLine;
  return `${originLine}\n${reason}`;
}

function isOriginFirstLine(line: string): boolean {
  return (
    line.startsWith('จากวันที่เดิม ') ||
    line.startsWith('จากช่วงเดิม ')
  );
}

/** แยกบรรทัดแรก (ต้นทางเดิม) กับเหตุผล — ถ้าไม่ตรงรูปแบบใหม่ คืน null */
export function parseRescheduleNoteOrigin(note: string | null | undefined): {
  originLine: string;
  reasonBody: string;
} | null {
  const s = note == null ? '' : String(note).trim();
  if (!s.includes('\n')) return null;
  const idx = s.indexOf('\n');
  const first = s.slice(0, idx).trim();
  const rest = s.slice(idx + 1).trim();
  if (!isOriginFirstLine(first)) return null;
  return { originLine: first, reasonBody: rest };
}
