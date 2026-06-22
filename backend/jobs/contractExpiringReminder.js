const db = require('../config/database');
const slc = require('../lib/siteLocationContract');
const { notifyTeamsExpiringContracts } = require('../services/teamsExpiringContractsNotification');

const DEFAULT_WINDOW_DAYS = 30;

function parseWindowDays() {
  const raw = process.env.CONTRACT_EXPIRING_DAYS;
  if (raw == null || String(raw).trim() === '') return DEFAULT_WINDOW_DAYS;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isNaN(n) || n < 1 ? DEFAULT_WINDOW_DAYS : Math.min(n, 365);
}

/**
 * สัญญา official ที่ end_date อยู่ระหว่างวันนี้ถึง +N วัน (รวมวันหมดอายุ)
 */
async function fetchContractsExpiringWithinDays(days = DEFAULT_WINDOW_DAYS) {
  const [rows] = await db.execute(
    `SELECT sl.*, s.Name AS site_name, IFNULL(l.Location2, '') AS site_location
     FROM sites_location sl
     LEFT JOIN sites s ON sl.Sid = s.Sid
     LEFT JOIN location l ON sl.lid = l.lid
     WHERE sl.end_date IS NOT NULL
       AND sl.end_date >= CURDATE()
       AND sl.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND LOWER(TRIM(COALESCE(sl.status, ''))) = 'official'
       AND sl.SOF IS NOT NULL
       AND TRIM(sl.SOF) != ''
     ORDER BY sl.end_date ASC, s.Name ASC, sl.SLid ASC`,
    [days]
  );
  return (rows || []).map((row) => slc.mapSlRowToContractDetail(row));
}

async function runContractExpiringReminder() {
  const windowDays = parseWindowDays();
  const contracts = await fetchContractsExpiringWithinDays(windowDays);
  const result = await notifyTeamsExpiringContracts({ contracts, windowDays, trigger: 'daily' });
  return { windowDays, contractCount: contracts.length, ...result };
}

/** ส่งทันทีเมื่อแก้สัญญา — เฉพาะถ้ายังอยู่ในช่วงใกล้หมดอายุ */
async function notifyContractExpiringOnChange(slid) {
  const windowDays = parseWindowDays();
  const id = parseInt(slid, 10);
  if (Number.isNaN(id)) return { sent: false, reason: 'invalid_slid' };

  const contracts = await fetchContractsExpiringWithinDays(windowDays);
  const match = contracts.find((c) => Number(c.contract_id) === id);
  if (!match) return { sent: false, reason: 'not_in_window' };

  return notifyTeamsExpiringContracts({
    contracts: [match],
    windowDays,
    trigger: 'change',
  });
}

module.exports = {
  DEFAULT_WINDOW_DAYS,
  parseWindowDays,
  fetchContractsExpiringWithinDays,
  runContractExpiringReminder,
  notifyContractExpiringOnChange,
};
