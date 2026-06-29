/** สถานะ Asset_State ที่เลือกได้สำหรับอุปกรณ์ที่เสียตอน Add/Edit Plan MA — sync กับ backend/config/maBrokenAssetState.js */
export const MA_BROKEN_ASSET_STATE_OPTIONS = [
  'Broken',
  'Waiting to Claim',
  'In Store',
] as const;

export type MaBrokenAssetState = (typeof MA_BROKEN_ASSET_STATE_OPTIONS)[number];

export function isMaBrokenAssetState(value: string): value is MaBrokenAssetState {
  return (MA_BROKEN_ASSET_STATE_OPTIONS as readonly string[]).includes(value);
}

export function resolveMaBrokenAssetStateDefault(
  storedOrDeviceState?: string | null
): MaBrokenAssetState {
  const s = (storedOrDeviceState ?? '').trim();
  if (isMaBrokenAssetState(s)) return s;
  return 'Broken';
}

/** สี dropdown Asset State ตามค่าที่เลือก */
export function maBrokenAssetStateSelectClass(
  state: MaBrokenAssetState,
  disabled?: boolean
): string {
  if (disabled) {
    return 'cursor-not-allowed border-border bg-muted text-muted-foreground';
  }
  const base =
    'cursor-pointer font-semibold outline-none transition focus:ring-2';
  switch (state) {
    case 'Broken':
      return `${base} border-red-300 bg-red-50 text-red-800 hover:border-red-400 focus:border-red-400 focus:ring-red-200/60 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40`;
    case 'Waiting to Claim':
      return `${base} border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 focus:border-amber-400 focus:ring-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40`;
    case 'In Store':
      return `${base} border-border bg-muted text-foreground hover:border-border focus:border-border focus:ring-border`;
    // case 'In Store On Site':
    //   return `${base} border-sky-300 bg-sky-50 text-sky-900 hover:border-sky-400 focus:border-sky-400 focus:ring-sky-200/60 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40`;
    default:
      return `${base} border-border bg-card text-foreground hover:border-border focus:border-sky-400 focus:ring-sky-500/15`;
  }
}
