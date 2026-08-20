const db = require('../config/database');

/** SNS marker in devices.Owner */
const OWNER_SNS = 'SNS';
/** @deprecated use OWNER_SNS */
const PROJECT_OWEN_SNS = OWNER_SNS;

const parsePositiveDeviceId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
};

/** รวบรวม Did จาก assets JSON ของงาน (PM/MA รูปแบบต่างๆ) */
function collectDeviceIdsFromAssets(assets) {
  const ids = new Set();
  if (!Array.isArray(assets)) return ids;

  for (const a of assets) {
    if (a == null) continue;
    if (typeof a === 'number' || typeof a === 'string') {
      const n = parsePositiveDeviceId(a);
      if (n) ids.add(n);
      continue;
    }
    if (typeof a !== 'object') continue;

    for (const key of ['id', 'Did', 'deviceId', 'device_id']) {
      const n = parsePositiveDeviceId(a[key]);
      if (n) ids.add(n);
    }

    const repFromAsset = parsePositiveDeviceId(a.replacementDeviceId);
    if (repFromAsset) ids.add(repFromAsset);

    for (const nestedKey of ['brokenDevice', 'replacementDevice']) {
      const nested = a[nestedKey];
      if (nested && typeof nested === 'object') {
        for (const key of ['id', 'Did', 'deviceId', 'device_id']) {
          const n = parsePositiveDeviceId(nested[key]);
          if (n) ids.add(n);
        }
      }
    }
  }

  return ids;
}

async function hasSnsDeviceByIds(deviceIds) {
  const ids = [...new Set(deviceIds)].filter((id) => id > 0);
  if (ids.length === 0) return false;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT 1 FROM devices
     WHERE Did IN (${placeholders})
       AND UPPER(TRIM(Owner)) = ?
     LIMIT 1`,
    [...ids, OWNER_SNS]
  );
  return rows.length > 0;
}

async function hasSnsDeviceByContractId(contractId) {
  const cid = parsePositiveDeviceId(contractId);
  if (!cid) return false;
  const [rows] = await db.execute(
    `SELECT 1 FROM devices d
     WHERE d.SLid = ?
       AND UPPER(TRIM(d.Owner)) = ?
     LIMIT 1`,
    [cid, OWNER_SNS]
  );
  return rows.length > 0;
}

async function hasSnsDeviceBySiteId(siteId) {
  const sid = parsePositiveDeviceId(siteId);
  if (!sid) return false;
  const [rows] = await db.execute(
    `SELECT 1 FROM devices d
     INNER JOIN sites_location sl ON sl.SLid = d.SLid
     WHERE sl.Sid = ?
       AND UPPER(TRIM(d.Owner)) = ?
     LIMIT 1`,
    [sid, OWNER_SNS]
  );
  return rows.length > 0;
}

/**
 * งานนี้เป็นของ Owner SNS หรือไม่
 * — ตรวจจาก devices ใน assets / replacement, สัญญา, หรือ site
 */
async function isProjectOwenSnsPlan({ assets = [], replacementDeviceId, contractId, siteId }) {
  const deviceIds = collectDeviceIdsFromAssets(assets);
  const repId = parsePositiveDeviceId(replacementDeviceId);
  if (repId) deviceIds.add(repId);

  if (await hasSnsDeviceByIds([...deviceIds])) return true;
  if (await hasSnsDeviceByContractId(contractId)) return true;
  if (await hasSnsDeviceBySiteId(siteId)) return true;
  return false;
}

/** สัญญานี้เกี่ยวกับ Owner SNS หรือไม่ (จาก device ในคำขอหรือ SLid หลังบันทึก) */
async function isProjectOwenSnsContract({ contractId, deviceIds = [] }) {
  const ids = (Array.isArray(deviceIds) ? deviceIds : [])
    .map((id) => parsePositiveDeviceId(id))
    .filter((id) => id != null);
  if (await hasSnsDeviceByIds(ids)) return true;
  if (await hasSnsDeviceByContractId(contractId)) return true;
  return false;
}

module.exports = {
  OWNER_SNS,
  PROJECT_OWEN_SNS,
  collectDeviceIdsFromAssets,
  isProjectOwenSnsPlan,
  isProjectOwenSnsContract,
};
