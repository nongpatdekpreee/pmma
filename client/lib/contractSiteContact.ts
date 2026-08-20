import {
  parseLegacySiteContactFromNameBlob,
  parseSiteContactPersonFromRecord,
} from '@/lib/legacySiteContact';

function contactPersonCandidates(obj: Record<string, unknown>): unknown[] {
  return [obj.site_contact_1, obj.site_l1, obj.site_contact_2, obj.site_l2];
}

function digitsOnlyTel(tel: string): string {
  return tel.replace(/\D/g, '').slice(0, 15);
}

/** site_contact_1 (then site_contact_2) จาก sites_location.contact — รองรับ JSON และ legacy plain text */
export function parseSiteContact1FromContractContact(
  raw: unknown,
): { name: string; tel: string } {
  if (raw == null || raw === '') return { name: '', tel: '' };

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { name: '', tel: '' };
    try {
      return parseSiteContact1FromContractContact(JSON.parse(trimmed) as unknown);
    } catch {
      return parseLegacySiteContactFromNameBlob(trimmed, '');
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;

    if ('name' in obj || 'tel' in obj) {
      const flat = parseSiteContactPersonFromRecord(obj);
      if (flat.name.trim() || flat.tel.trim()) return flat;
    }

    for (const person of contactPersonCandidates(obj)) {
      if (!person || typeof person !== 'object') continue;
      const parsed = parseSiteContactPersonFromRecord(person as Record<string, unknown>);
      if (parsed.name.trim() || parsed.tel.trim()) return parsed;
    }
  }

  return { name: '', tel: '' };
}

export function positiveSlidFromTaskFields(
  ...values: Array<string | number | null | undefined | unknown>
): number | null {
  for (const raw of values) {
    if (raw == null || raw === '') continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function contactFieldsFromRaw(raw: unknown): { name: string; tel: string } {
  const { name, tel } = parseSiteContact1FromContractContact(raw);
  return { name: name.trim(), tel: digitsOnlyTel(tel) };
}
