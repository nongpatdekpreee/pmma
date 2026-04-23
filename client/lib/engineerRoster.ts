import { apiUrl } from '@/lib/api';

/** คีย์ที่อาจอยู่บน engineer object ใน tasks.engineers JSON */
const TASK_ENGINEER_ID_KEYS = [
  'id',
  'Eng_Eid',
  'eng_id',
  'employee_id',
  'Eid',
  'user_id',
] as const;

/** ดึง id พนักงานจากแถว engineer ที่แนบกับงาน — ให้เหมือนกันทุกหน้าที่โหลดจาก API */
export function rawEngineerIdFromTaskJson(raw: unknown): string {
  if (raw == null || typeof raw !== 'object') return '';
  const o = raw as Record<string, unknown>;
  for (const key of TASK_ENGINEER_ID_KEYS) {
    const x = o[key];
    if (x != null && String(x).trim() !== '') return String(x).trim();
  }
  return '';
}

/** ใช้กับตัวกรอง / dropdown engineer บนปฏิทินและ schedule */
export type EngineerRosterItem = {
  id: string;
  name: string;
  lastName?: string;
  photo: string | null;
};

function isTechnicalRole(emp: Record<string, unknown>): boolean {
  const raw = emp.positionType ?? emp.type;
  const t = String(raw ?? 'Technical').trim().toLowerCase();
  if (t === 'technical' || t === 'tech' || t === 'engineer' || t === 'technician') return true;
  if (t === 'วิศวกร' || t === 'engineer / technical') return true;
  return false;
}

function resolvePhoto(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  return s.startsWith('http') ? s : apiUrl(s);
}

/**
 * แปลงรายการจาก GET /api/employees ให้เป็นรายการ engineer สำหรับ UI
 * - กรอง role แบบยืดหยุ่น (ไม่จำกัดแค่สตริง 'Technical' ตัวพิมพ์ใหญ่พอดี)
 * - รองรับชื่อเต็มในฟิลด์เดียว / lastName แยก
 */
export function mapEmployeesToEngineerRoster(employees: unknown): EngineerRosterItem[] {
  if (!Array.isArray(employees)) return [];
  const out: EngineerRosterItem[] = [];
  for (const emp of employees) {
    if (!emp || typeof emp !== 'object') continue;
    const o = emp as Record<string, unknown>;
    if (!isTechnicalRole(o)) continue;
    const id = String(o.id ?? o.user_id ?? o.userId ?? o.employee_id ?? '').trim();
    if (!id) continue;
    const raw = String(o.name ?? o.displayName ?? o.fullName ?? '').trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const lastField = String(o.lastName ?? o.last_name ?? '').trim();
    const name = tokens[0] || raw;
    const lastName = tokens.slice(1).join(' ') || lastField || undefined;
    out.push({
      id,
      name,
      lastName,
      photo: resolvePhoto(o.photo ?? o.em_picture),
    });
  }
  return out;
}

/** ข้อความแสดงใน chip / รายการ dropdown */
export function engineerRosterLabel(eng: Pick<EngineerRosterItem, 'id' | 'name' | 'lastName'>): string {
  const s = `${eng.name || ''}${eng.lastName ? ` ${eng.lastName}` : ''}`.trim();
  if (s) return s;
  const id = String(eng.id || '').trim();
  return id ? `Employee #${id}` : 'Employee';
}
