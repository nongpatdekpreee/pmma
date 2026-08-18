/**
 * Feature flags from env.
 * Truthy: "true" | "1" | "yes"
 * Falsy: "false" | "0" | "no"
 * Unset / empty → use defaultValue.
 */
function envFlagEnabled(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  if (v === 'true' || v === '1' || v === 'yes') return true;
  return defaultValue;
}

/** Contract merge — default ON (set ENABLE_CONTRACT_MERGE=false to disable). */
function isContractMergeEnabled() {
  return envFlagEnabled('ENABLE_CONTRACT_MERGE', true);
}

module.exports = {
  envFlagEnabled,
  isContractMergeEnabled,
};
