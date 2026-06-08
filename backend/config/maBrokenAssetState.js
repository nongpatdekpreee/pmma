/**
 * Asset_State ที่เลือกได้สำหรับอุปกรณ์ที่เสียตอน Add/Edit Plan MA
 * ถ้าแก้ค่านี้ ให้ sync กับ client/lib/maBrokenAssetState.ts
 */
const MA_BROKEN_DEVICE_ASSET_STATES = [
  'In Store On Site',
  'Broken',
  'Waiting to Claim',
  'In Store',
];

const MA_BROKEN_DEVICE_ASSET_STATE_SET = new Set(MA_BROKEN_DEVICE_ASSET_STATES);

module.exports = {
  MA_BROKEN_DEVICE_ASSET_STATES,
  MA_BROKEN_DEVICE_ASSET_STATE_SET,
};
