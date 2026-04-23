/**
 * ชื่อไซต์คลังที่ใช้ดึงเครื่องทดแทน MA — ต้องตรงกับ `backend/config/inStoreSite.js`
 * (ใช้แสดง Site ก่อนติดตั้ง / ขณะอยู่คลัง ไม่ใช่ SLid ปัจจุบันหลังงาน Done)
 */
export const DEFAULT_IN_STORE_SITE_NAME =
  'บริษัท ที.ซี.ซี.เทคโนโลยี จำกัด Bangna';

/**
 * ตำแหน่งคลังสำหรับ MA report / export (CSV–Excel) เท่านั้น — ไม่ใช้ใน API ดึงรายการ device
 * ว่าง = ไม่ fallback; ถ้ามีค่าใช้เมื่อ API device ไม่ส่ง Location2
 */
export const DEFAULT_IN_STORE_LOCATION = '';
