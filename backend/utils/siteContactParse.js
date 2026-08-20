const {
  formatTelLineForDb,
  looksLikePhoneLine,
  parseTelLineFromDb,
} = require('./phoneFormat');

const EMAIL_LINE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Legacy multi-line contact blob (name + tel + email in one text field) */
function parsePlainContactBlob(raw) {
  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let name = '';
  let tel = '';
  const nameParts = [];
  for (const line of lines) {
    if (!tel && EMAIL_LINE_RE.test(line)) continue;
    if (!tel && looksLikePhoneLine(line)) {
      const parsed = parseTelLineFromDb(line);
      tel = formatTelLineForDb(parsed.tel, parsed.telExt);
      continue;
    }
    nameParts.push(line);
  }
  name = nameParts.join(' ').trim();
  return { name, tel };
}

/** Normalize sites_location.contact for API consumers */
function normalizeSiteContactRaw(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* legacy plain text below */
  }
  const { name, tel } = parsePlainContactBlob(s);
  if (!name && !tel) return null;
  return {
    site_contact_1: {
      name: name || s,
      ...(tel ? { tel } : {}),
    },
  };
}

module.exports = {
  normalizeSiteContactRaw,
  parsePlainContactBlob,
};
