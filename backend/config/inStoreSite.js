/**
 * คลัง / In-store pool: ใช้ชื่อบริษัทใน `sites.Name` เป็นตัวกำหนด (ไม่ fix Sid)
 * รองรับหลาย Sid ที่ชื่อตรงกัน (เช่น ต่างแค่ตัวพิมพ์) ผ่านเงื่อนไข LOWER(TRIM(Name))
 * ถ้าแก้ค่านี้ ให้ sync กับ client/lib/inStoreSite.ts (ชื่อคลังใน MA UI/CSV)
 */
const DEFAULT_IN_STORE_SITE_NAME = 'บริษัท ที.ซี.ซี.เทคโนโลยี จำกัด Bangna';

module.exports = {
  DEFAULT_IN_STORE_SITE_NAME,
};
