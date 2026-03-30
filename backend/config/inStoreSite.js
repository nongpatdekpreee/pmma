/**
 * คลัง/In-store: ดึง device จาก pool คลังต้องตรงทั้ง Sid และชื่อใน sites
 * (กันกรณี Sid=2 ถูก map ไปบริษัทอื่นใน DB)
 */
const DEFAULT_IN_STORE_SITE_SID = 2;
const DEFAULT_IN_STORE_SITE_NAME = 'บริษัท ที.ซี.ซี.เทคโนโลยี จำกัด Bangna';

module.exports = {
  DEFAULT_IN_STORE_SITE_SID,
  DEFAULT_IN_STORE_SITE_NAME,
};
