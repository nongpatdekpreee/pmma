/** Normalized keys for matching devices across task, location Excel, and backup Excel */

export function normalizeSerial(serial: string): string {
  return serial.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function normalizeModel(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, '');
}

export function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase();
}

export function modelsMatch(a: string, b: string): boolean {
  const na = normalizeModel(a);
  const nb = normalizeModel(b);
  if (!na || !nb) return false;
  return na === nb;
}

/** e.g. C9300 vs CiscoC9300 */
export function modelsLooselyMatch(a: string, b: string): boolean {
  if (modelsMatch(a, b)) return true;
  const na = normalizeModel(a);
  const nb = normalizeModel(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function modelCandidatesFromDevice(device: {
  CI_Name?: string;
  model?: string;
  Asset_Number?: string;
}): string[] {
  const out: string[] = [];
  for (const v of [device.model, device.CI_Name, device.Asset_Number]) {
    const s = (v ?? '').trim();
    if (s && !out.some((x) => modelsMatch(x, s))) out.push(s);
  }
  return out;
}

export function ipsMatch(a: string, b: string): boolean {
  const na = normalizeIp(a);
  const nb = normalizeIp(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function serialsMatch(a: string, b: string): boolean {
  const na = normalizeSerial(a);
  const nb = normalizeSerial(b);
  if (!na || !nb) return false;
  return na === nb;
}

/** Model used for Excel ↔ task matching (serial + model only; not CI_Name / hostname) */
export function deviceModelForMatch(device: { model?: string }): string {
  return (device.model ?? '').trim();
}

/** Prefer explicit model field; fall back to CI_Name for labels only */
export function deviceModelKey(device: { CI_Name?: string; model?: string }): string {
  return (device.model ?? device.CI_Name ?? '').trim();
}
