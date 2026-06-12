/**
 * SOF อยู่ที่ sites_location.SOF (schema ใหม่) — อ่านผ่าน devices.SLid
 * API ยังคืนฟิลด์ Refer_SOF เป็น alias จาก sl.SOF เพื่อ backward compatibility ฝั่ง client
 */

function normalizeReferSofKey(sof) {
  const s = sof != null ? String(sof).trim() : '';
  if (!s) return '';
  const stripped = s.replace(/^0+/, '');
  return stripped || '0';
}

/** JOIN sites_location สำหรับดึง SOF (alias เริ่มต้น sl_sof) */
function deviceSofJoin(deviceAlias = 'd', slAlias = 'sl_sof') {
  return `LEFT JOIN sites_location ${slAlias} ON ${deviceAlias}.SLid = ${slAlias}.SLid`;
}

/** SELECT alias Refer_SOF จาก sites_location */
function deviceSofSelect(slAlias = 'sl_sof') {
  return `${slAlias}.SOF AS Refer_SOF`;
}

function sofIsValidWhere(slAlias = 'sl_sof') {
  return `${slAlias}.SOF IS NOT NULL AND TRIM(${slAlias}.SOF) != '' AND TRIM(${slAlias}.SOF) != 'Not Assigned'`;
}

/** bind: referSOF, referSOFTrim (normalized) */
function sofMatchWhere(slAlias = 'sl_sof') {
  return `(${slAlias}.SOF = ? OR TRIM(LEADING '0' FROM COALESCE(${slAlias}.SOF, '')) = ?)`;
}

/** device ยังไม่มี SOF ที่ location (หรือไม่มี SLid) */
function noSofWhere(slAlias = 'sl_sof', deviceAlias = 'd') {
  return `(
    ${deviceAlias}.SLid IS NULL
    OR ${slAlias}.SLid IS NULL
    OR ${slAlias}.SOF IS NULL
    OR TRIM(COALESCE(${slAlias}.SOF, '')) = ''
    OR LOWER(TRIM(${slAlias}.SOF)) = 'not assigned'
    OR LOWER(TRIM(${slAlias}.SOF)) = 'n/a'
    OR LOWER(TRIM(${slAlias}.SOF)) = 'na'
  )`;
}

/** SOF ที่มี device ยังไม่ official บน sites_location */
const PENDING_REFER_SOF_SQL = `
  SELECT DISTINCT sl.SOF AS refer_sof
  FROM devices d
  INNER JOIN sites_location sl ON d.SLid = sl.SLid
  WHERE ${sofIsValidWhere('sl')}
    AND d.SLid IS NOT NULL
    AND (sl.status IS NULL OR sl.status = 'draft' OR sl.start_date IS NULL)
  ORDER BY sl.SOF ASC
`;

const DEVICES_FOR_REFER_SOF_SQL = `
  SELECT d.Did, d.SLid, d.Assigned_Service
  FROM devices d
  INNER JOIN sites_location sl ON d.SLid = sl.SLid
  WHERE ${sofMatchWhere('sl')}
    AND d.SLid IS NOT NULL
  ORDER BY d.SLid, d.Did
`;

/** dropdown Add Contract: SOF ที่ยังไม่มี sites_location official สำหรับ SOF นั้น */
const REFER_SOF_DROPDOWN_SQL = `
  SELECT DISTINCT sl.SOF AS refer_sof
  FROM devices d
  INNER JOIN sites_location sl ON d.SLid = sl.SLid
  WHERE ${sofIsValidWhere('sl')}
    AND NOT EXISTS (
      SELECT 1 FROM sites_location sl2
      WHERE sl2.SOF = sl.SOF AND sl2.status = 'official'
    )
  ORDER BY sl.SOF ASC
`;

async function applyReferSofToSiteLocation(dbOrConn, slid, referSof) {
  if (slid == null || referSof === undefined) return;
  const slidNum = parseInt(slid, 10);
  if (isNaN(slidNum)) return;
  const sofVal = referSof != null ? String(referSof).trim() : '';
  await dbOrConn.execute('UPDATE sites_location SET SOF = ? WHERE SLid = ?', [sofVal, slidNum]);
}

async function syncSofOnSiteLocations(dbOrConn, sofValue, slidList) {
  const sof = sofValue != null ? String(sofValue).trim() : '';
  if (!sof || !Array.isArray(slidList)) return;
  const unique = [
    ...new Set(
      slidList.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n))
    ),
  ];
  for (const slid of unique) {
    await dbOrConn.execute('UPDATE sites_location SET SOF = ? WHERE SLid = ?', [sof, slid]);
  }
}

async function syncSofRenameOnSiteLocations(dbOrConn, oldSof, newSof) {
  const oldTrim = oldSof != null ? String(oldSof).trim() : '';
  const newTrim = newSof != null ? String(newSof).trim() : '';
  if (!oldTrim || !newTrim || oldTrim === newTrim) return;
  const oldKey = normalizeReferSofKey(oldTrim);
  await dbOrConn.execute(
    `UPDATE sites_location SET SOF = ?
     WHERE SOF = ? OR TRIM(LEADING '0' FROM COALESCE(SOF, '')) = ?`,
    [newTrim, oldTrim, oldKey]
  );
}

/** SLid อื่นที่ใช้ SOF เดียวกัน (รวม normalize เลขนำหน้า 0) */
async function findSlidsWithMatchingSof(dbOrConn, sof, excludeSlid = null) {
  const sofTrim = sof != null ? String(sof).trim() : '';
  if (!sofTrim) return [];
  const key = normalizeReferSofKey(sofTrim);
  const params = [sofTrim, key];
  let excludeSql = '';
  if (excludeSlid != null) {
    const ex = parseInt(excludeSlid, 10);
    if (!Number.isNaN(ex)) {
      excludeSql = ' AND SLid <> ?';
      params.push(ex);
    }
  }
  const [rows] = await dbOrConn.execute(
    `SELECT SLid FROM sites_location
     WHERE (SOF = ? OR TRIM(LEADING '0' FROM COALESCE(SOF, '')) = ?)${excludeSql}
     ORDER BY SLid`,
    params
  );
  return (rows || []).map((r) => r.SLid);
}

module.exports = {
  normalizeReferSofKey,
  deviceSofJoin,
  deviceSofSelect,
  sofIsValidWhere,
  sofMatchWhere,
  noSofWhere,
  PENDING_REFER_SOF_SQL,
  DEVICES_FOR_REFER_SOF_SQL,
  REFER_SOF_DROPDOWN_SQL,
  applyReferSofToSiteLocation,
  syncSofOnSiteLocations,
  syncSofRenameOnSiteLocations,
  findSlidsWithMatchingSof,
};
