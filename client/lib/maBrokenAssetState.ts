/** สถานะ Asset_State ที่เลือกได้สำหรับอุปกรณ์ที่เสียตอน Add/Edit Plan MA — sync กับ backend/config/maBrokenAssetState.js */
export const MA_BROKEN_ASSET_STATE_OPTIONS = [
  'In Store On Site',
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
    return 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500';
  }
  const base =
    'cursor-pointer font-semibold outline-none transition focus:ring-2';
  switch (state) {
    case 'Broken':
      return `${base} border-red-300 bg-red-50 text-red-800 hover:border-red-400 focus:border-red-400 focus:ring-red-200/60`;
    case 'Waiting to Claim':
      return `${base} border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 focus:border-amber-400 focus:ring-amber-200/60`;
    case 'In Store':
      return `${base} border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-400 focus:border-slate-400 focus:ring-slate-200/60`;
    case 'In Store On Site':
      return `${base} border-sky-300 bg-sky-50 text-sky-900 hover:border-sky-400 focus:border-sky-400 focus:ring-sky-200/60`;
    default:
      return `${base} border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-sky-400 focus:ring-sky-500/15`;
  }
}
