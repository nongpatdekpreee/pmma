/**
 * แปลงรายชื่อ engineer จาก task (API / JSON) เป็นข้อความบรรทัดเดียว — ครบทุกคน ชื่อ + นามสกุล
 */
export function formatTaskEngineersLine(engineers: unknown): string {
  const raw = engineers as unknown;
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length === 0) return '';

  const parts = arr.map((e: unknown) => {
    if (e == null) return '';
    if (typeof e === 'string') return e.trim();
    if (typeof e !== 'object') return String(e).trim();
    const o = e as Record<string, unknown>;
    const first =
      (o.name as string | undefined) ??
      (o.firstName as string | undefined) ??
      (o.first_name as string | undefined) ??
      (o.Name as string | undefined) ??
      '';
    const last =
      (o.lastName as string | undefined) ??
      (o.last_name as string | undefined) ??
      (o.LastName as string | undefined) ??
      (o.surname as string | undefined) ??
      '';
    const id = o.id != null && o.id !== '' ? String(o.id).trim() : '';
    const combined = [String(first).trim(), String(last).trim()].filter(Boolean).join(' ').trim();
    return combined || id;
  });

  return parts.filter(Boolean).join(', ');
}
