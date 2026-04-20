/**
 * Employee phone: ช่องหลัก 10 หลัก แสดงเป็น xxx-xxx-xxxx (ใส่ - อัตโนมัติ)
 * ต่อ (Ext) สูงสุด 6 หลัก — บันทึกเป็น mainDigits-ext เช่น 0123456789-123456
 */

/** จำนวนหลักสูงสุด — ใช้ร่วมกับแจ้งเตือนใน UI */
export const PHONE_MAIN_MAX_DIGITS = 10;
export const PHONE_EXT_MAX_DIGITS = 6;

const MAIN_LEN = PHONE_MAIN_MAX_DIGITS;
const EXT_MAX = PHONE_EXT_MAX_DIGITS;

/** แสดงเบอร์ 10 หลักแบบ xxx-xxx-xxxx จาก input ใดๆ */
export function formatTenDigitUsDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, MAIN_LEN);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export function parseTelLineFromDb(line: string): { tel: string; telExt: string } {
  const t = String(line ?? '').trim();
  if (!t) return { tel: '', telExt: '' };
  // 10 หลัก + ต่อ
  let m = t.match(/^(\d{10})-(\d{1,6})$/);
  if (m) return { tel: m[1], telExt: m[2] };
  // รูปแบบ contract เดิม: 9–15 หลัก + ต่อ
  m = t.match(/^(\d{9,15})-(\d{1,6})$/);
  if (m) return { tel: m[1], telExt: m[2] };
  const digits = t.replace(/\D/g, '');
  if (!digits) return { tel: '', telExt: '' };
  if (digits.length <= MAIN_LEN) return { tel: digits, telExt: '' };
  return { tel: digits.slice(0, MAIN_LEN), telExt: digits.slice(MAIN_LEN, MAIN_LEN + EXT_MAX) };
}

export function formatTelLineForDb(tel: string, telExt: string): string {
  const m = tel.replace(/\D/g, '').slice(0, MAIN_LEN);
  const x = telExt.replace(/\D/g, '').slice(0, EXT_MAX);
  if (!m && !x) return '';
  if (m && x) return `${m}-${x}`;
  return m;
}

/** ระหว่างพิมพ์: แจ้งเฉพาะเมื่อน้อยกว่า 4 หลัก (มีตัวเลขแล้ว) หรือเกิน 10 หลัก */
export function validateEmployeePhoneInline(tel: string, telExt: string): string {
  const mainD = tel.replace(/\D/g, '');
  const extD = telExt.replace(/\D/g, '');
  if (mainD.length > MAIN_LEN) return 'Phone must be at most 10 digits.';
  if (mainD.length > 0 && mainD.length < 4) return 'Phone must be at least 4 digits.';
  if (extD && (extD.length < 1 || extD.length > EXT_MAX)) {
    return 'Extension must be 1–6 digits when provided.';
  }
  return '';
}

/** ตอนส่งฟอร์ม / import — เบอร์หลักต้องครบ 10 หลัก */
export function validateEmployeePhoneSubmit(tel: string, telExt: string): string {
  const mainD = tel.replace(/\D/g, '');
  const extD = telExt.replace(/\D/g, '');
  if (!mainD) return 'Phone is required.';
  if (mainD.length !== MAIN_LEN) return 'Phone must be 10 digits.';
  if (extD && (extD.length < 1 || extD.length > EXT_MAX)) {
    return 'Extension must be 1–6 digits when provided.';
  }
  return '';
}

/** เบอร์ไม่บังคับ: ว่างทั้งคู่ผ่าน; ถ้ามีตัวเลข — ใช้กฎเดียวกับ validateEmployeePhoneSubmit */
export function validateOptionalEmployeePhoneSubmit(tel: string, telExt: string): string {
  const mainD = tel.replace(/\D/g, '');
  const extD = telExt.replace(/\D/g, '');
  if (!mainD && !extD) return '';
  return validateEmployeePhoneSubmit(tel, telExt);
}

/** @deprecated ใช้ validateEmployeePhoneSubmit หรือ validateEmployeePhoneInline */
export const validateContractStylePhone = validateEmployeePhoneSubmit;

/** แสดงในรายการ: xxx-xxx-xxxx หรือ xxx-xxx-xxxx - ext */
export function formatEmployeeTelForDisplay(line: string): string {
  const p = parseTelLineFromDb(String(line ?? '').trim());
  const d = p.tel.replace(/\D/g, '');
  if (!d) return '';
  const main = formatTenDigitUsDisplay(p.tel);
  if (p.telExt) return `${main} - ${p.telExt}`;
  return main;
}
