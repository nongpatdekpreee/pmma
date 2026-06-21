/** site_contact_1 จาก sites_location.contact (JSON บนสัญญา) */
export function parseSiteContact1FromContractContact(
  raw: unknown,
): { name: string; tel: string } {
  if (raw == null || raw === '') return { name: '', tel: '' };
  let obj: Record<string, unknown>;
  try {
    obj =
      typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  } catch {
    return { name: '', tel: '' };
  }
  const person = obj.site_contact_1 ?? obj.site_l1;
  if (!person || typeof person !== 'object') return { name: '', tel: '' };
  const o = person as Record<string, unknown>;
  return {
    name: o.name != null ? String(o.name).trim() : '',
    tel: o.tel != null ? String(o.tel).trim() : '',
  };
}
