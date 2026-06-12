const db = require('../config/database');
const { isProjectOwenSnsPlan, PROJECT_OWEN_SNS } = require('../utils/projectOwenSns');
const {
  notifyTeamsUpcomingPlans,
} = require('../services/teamsUpcomingPlansNotification');

const UPCOMING_DAYS = 30;

function toDateOnlyString(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val.trim().substring(0, 10) || null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

function mapTaskRow(row) {
  const sofRaw = row.contract_sof_name != null ? String(row.contract_sof_name).trim() : '';
  let engineers = [];
  let assets = [];
  try {
    engineers = row.engineers
      ? typeof row.engineers === 'string'
        ? JSON.parse(row.engineers)
        : row.engineers
      : [];
  } catch {
    engineers = [];
  }
  try {
    assets = row.assets
      ? typeof row.assets === 'string'
        ? JSON.parse(row.assets)
        : row.assets
      : [];
  } catch {
    assets = [];
  }
  return {
    id: row.id,
    taskType: row.task_type,
    contractId: row.contract_id,
    ...(sofRaw ? { sofName: sofRaw } : {}),
    replacementDeviceId: row.replacement_device_id,
    siteId: row.site_id,
    siteName: row.site_name,
    vendorName: row.vendor_name,
    startDate: toDateOnlyString(row.start_date),
    endDate: toDateOnlyString(row.end_date),
    engineers: Array.isArray(engineers) ? engineers : [],
    assets: Array.isArray(assets) ? assets : [],
    status: row.status || 'not-started',
    assignedService:
      row.assigned_service != null && String(row.assigned_service).trim() !== ''
        ? String(row.assigned_service).trim()
        : null,
  };
}

async function fetchTasksStartingWithinDays(days) {
  const [rows] = await db.execute(
    `SELECT t.*, sl.SOF AS contract_sof_name
     FROM tasks t
     LEFT JOIN sites_location sl ON t.contract_id = sl.SLid
     WHERE t.status != 'done'
       AND t.start_date >= CURDATE()
       AND t.start_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY t.start_date ASC, t.task_type ASC, t.id ASC`,
    [days]
  );
  return rows;
}

/**
 * ดึง PM/MA ของ Project_Owen SNS ที่เริ่มภายใน 30 วันข้างหน้า (ยังไม่ Done)
 */
async function fetchUpcomingSnsPlans(days = UPCOMING_DAYS) {
  const rows = await fetchTasksStartingWithinDays(days);
  const plans = [];
  for (const row of rows) {
    const mapped = mapTaskRow(row);
    const sns = await isProjectOwenSnsPlan({
      assets: mapped.assets,
      replacementDeviceId: mapped.replacementDeviceId,
      contractId: mapped.contractId,
      siteId: mapped.siteId,
    });
    if (sns) plans.push(mapped);
  }
  return plans;
}

async function runSnsUpcomingPlansReminder() {
  const plans = await fetchUpcomingSnsPlans(UPCOMING_DAYS);
  const result = await notifyTeamsUpcomingPlans({
    plans,
    windowDays: UPCOMING_DAYS,
    projectOwen: PROJECT_OWEN_SNS,
  });
  return { planCount: plans.length, ...result };
}

module.exports = {
  UPCOMING_DAYS,
  fetchUpcomingSnsPlans,
  runSnsUpcomingPlansReminder,
};
