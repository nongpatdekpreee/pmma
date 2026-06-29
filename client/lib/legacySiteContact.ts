import { formatTenDigitUsDisplay, parseTelLineFromDb } from '@/lib/phoneFormat';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type ParsedSiteContact = { name: string; tel: string };

function looksLikeEmail(line: string): boolean {
  return EMAIL_RE.test(line.trim());
}

/** บรรทัดนี้เป็นเบอร์ไหม (9–15 หลัก หลังลบอักขระที่ไม่ใช่ตัวเลข) */
function looksLikePhone(line: string): boolean {
  const digits = line.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

/**
 * แยกชื่อกับเบอร์จาก legacy contact ที่ยัดหลายบรรทัดใน `name`
 * เช่น "พัฒ มีผิว\r\n099-111-2235\r\nPha@tv.com" + tel ว่าง
 */
export function parseLegacySiteContactFromNameBlob(
  nameBlob: string,
  telField = '',
): ParsedSiteContact {
  const telTrim = telField.trim();
  if (telTrim) {
    const parsed = parseTelLineFromDb(telTrim);
    const nameLines = nameBlob
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !looksLikeEmail(l) && !looksLikePhone(l));
    return {
      name: (nameLines.length > 0 ? nameLines.join(' ') : nameBlob.trim()),
      tel: formatTenDigitUsDisplay(parsed.tel),
    };
  }

  const lines = nameBlob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    const single = lines[0] ?? nameBlob.trim();
    if (looksLikePhone(single)) {
      const parsed = parseTelLineFromDb(single);
      return { name: '', tel: formatTenDigitUsDisplay(parsed.tel) };
    }
    return { name: single, tel: '' };
  }

  const nameParts: string[] = [];
  let telRaw = '';

  for (const line of lines) {
    if (!telRaw && looksLikePhone(line)) {
      telRaw = line;
      continue;
    }
    if (looksLikeEmail(line)) continue;
    nameParts.push(line);
  }

  const parsed = parseTelLineFromDb(telRaw);
  return {
    name: nameParts.join(' ').trim(),
    tel: formatTenDigitUsDisplay(parsed.tel),
  };
}

export function parseSiteContactPersonFromRecord(
  person: Record<string, unknown>,
): ParsedSiteContact {
  return parseLegacySiteContactFromNameBlob(
    person.name != null ? String(person.name) : '',
    person.tel != null ? String(person.tel) : '',
  );
}
