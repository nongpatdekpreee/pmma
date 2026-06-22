const db = require('../config/database');

const PROJECT_OWEN_SNS = 'SNS';

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
       AND UPPER(TRIM(Project_Owen)) = ?
     LIMIT 1`,
    [...ids, PROJECT_OWEN_SNS]
  );
  return rows.length > 0;
}

async function hasSnsDeviceByContractId(contractId) {
  const cid = parsePositiveDeviceId(contractId);
  if (!cid) return false;
  const [rows] = await db.execute(
    `SELECT 1 FROM devices d
     WHERE d.SLid = ?
       AND UPPER(TRIM(d.Project_Owen)) = ?
     LIMIT 1`,
    [cid, PROJECT_OWEN_SNS]
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
       AND UPPER(TRIM(d.Project_Owen)) = ?
     LIMIT 1`,
    [sid, PROJECT_OWEN_SNS]
  );
  return rows.length > 0;
}

/**
 * งานนี้เป็นของ Project_Owen SNS หรือไม่
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

/** สัญญานี้เกี่ยวกับ Project_Owen SNS หรือไม่ (จาก device ในคำขอหรือ SLid หลังบันทึก) */
async function isProjectOwenSnsContract({ contractId, deviceIds = [] }) {
  const ids = (Array.isArray(deviceIds) ? deviceIds : [])
    .map((id) => parsePositiveDeviceId(id))
    .filter((id) => id != null);
  if (await hasSnsDeviceByIds(ids)) return true;
  if (await hasSnsDeviceByContractId(contractId)) return true;
  return false;
}

module.exports = {
  PROJECT_OWEN_SNS,
  collectDeviceIdsFromAssets,
  isProjectOwenSnsPlan,
  isProjectOwenSnsContract,
};
