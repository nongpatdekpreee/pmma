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

/** Prefer explicit model field; fall back to CI_Name */
export function deviceModelKey(device: { CI_Name?: string; model?: string }): string {
  return (device.model ?? device.CI_Name ?? '').trim();
}
