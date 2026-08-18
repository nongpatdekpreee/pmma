/**
 * Client feature flags (NEXT_PUBLIC_*).
 * Truthy: "true" | "1" | "yes". Falsy: "false" | "0" | "no".
 * Unset → defaultValue.
 */
function envFlagEnabled(raw: string | undefined, defaultValue = false): boolean {
  if (raw == null || raw.trim() === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  if (v === 'true' || v === '1' || v === 'yes') return true;
  return defaultValue;
}

/**
 * Build-time fallback only. Prefer GET /api/features (backend ENABLE_CONTRACT_MERGE).
 * Default ON so Docker builds without NEXT_PUBLIC still show Merge for ADMIN.
 */
export function isContractMergeEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_ENABLE_CONTRACT_MERGE, true);
}
