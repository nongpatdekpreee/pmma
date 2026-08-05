import {
  formatContractTelForDisplay,
  formatContractTelLineForDb,
  parseTelLineFromDb,
} from '@/lib/phoneFormat';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type ParsedSiteContact = { name: string; tel: string };

function looksLikeEmail(line: string): boolean {
  return EMAIL_RE.test(line.trim());
}

/** บรรทัดนี้เป็นเบอร์ไหม (รองรับเบอร์ต่อ เช่น 034130700-5#1000) */
function looksLikePhone(line: string): boolean {
  const parsed = parseTelLineFromDb(line.trim());
  if (!parsed.tel) return false;
  return parsed.tel.length >= 9 && parsed.tel.length <= 15;
}

function formatSiteContactTel(line: string): string {
  const trimmed = String(line ?? '').trim();
  if (!trimmed) return '';
  const parsed = parseTelLineFromDb(trimmed);
  const dbLine = formatContractTelLineForDb(parsed.tel, parsed.telExt);
  return formatContractTelForDisplay(dbLine || trimmed);
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
    const nameLines = nameBlob
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !looksLikeEmail(l) && !looksLikePhone(l));
    return {
      name: (nameLines.length > 0 ? nameLines.join(' ') : nameBlob.trim()),
      tel: formatSiteContactTel(telTrim),
    };
  }

  const lines = nameBlob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    const single = lines[0] ?? nameBlob.trim();
    if (looksLikePhone(single)) {
      return { name: '', tel: formatSiteContactTel(single) };
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

  return {
    name: nameParts.join(' ').trim(),
    tel: formatSiteContactTel(telRaw),
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
