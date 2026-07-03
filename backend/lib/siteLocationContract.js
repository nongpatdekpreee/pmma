/**
 * Contract API backed by sites_location (contract_id === SLid).
 * History: sites_location_sof_history (action_type mirrors legacy status_history).
 */

const { noSofWhere } = require('../config/deviceSof');

const HIST_ACTION = {
  RENEW: 'Renew',
  TERMINATED: 'Terminated',
  SOF_CHANGE: 'SOF Change',
  UPDATE: 'Update',
};

const SITE_LOCATION_NAME_EXPR = `CONCAT(COALESCE(s.Name, ''), CASE WHEN l.Location2 IS NOT NULL AND TRIM(l.Location2) != '' THEN CONCAT(' - ', l.Location2) ELSE '' END)`;

const SL_LIST_SELECT = `
  sl.SLid AS contract_id,
  COALESCE(NULLIF(TRIM(sl.contract_name), ''), ${SITE_LOCATION_NAME_EXPR}) AS contract_name,
  sl.start_date,
  sl.end_date,
  sl.created_at,
  sl.SLid AS site_id,
  sl.sla_term,
  sl.sale_account,
  sl.SOF AS sof_name,
  sl.status,
  s.Name AS contract_site_name,
  IFNULL(l.Location2, '') AS contract_site_location,
  IFNULL(l.Province, '') AS contract_site_province,
  s.Name AS site_name,
  IFNULL(l.Location2, '') AS site_location,
  IFNULL(l.Province, '') AS site_province,
  (SELECT COUNT(*) FROM devices d WHERE d.SLid = sl.SLid) AS device_count,
  1 AS devices_slid_aligned`;

async function buildSlListSelect(conn) {
  const col = await resolveContractNameDbColumn(conn, 'sites_location');
  const nameExpr =
    col === 'contract_name'
      ? `COALESCE(NULLIF(TRIM(sl.contract_name), ''), ${SITE_LOCATION_NAME_EXPR})`
      : `COALESCE(NULLIF(TRIM(sl.contactname), ''), ${SITE_LOCATION_NAME_EXPR})`;
  return `
  sl.SLid AS contract_id,
  ${nameExpr} AS contract_name,
  sl.start_date,
  sl.end_date,
  sl.created_at,
  sl.SLid AS site_id,
  sl.sla_term,
  sl.sale_account,
  sl.SOF AS sof_name,
  sl.status,
  s.Name AS contract_site_name,
  IFNULL(l.Location2, '') AS contract_site_location,
  IFNULL(l.Province, '') AS contract_site_province,
  s.Name AS site_name,
  IFNULL(l.Location2, '') AS site_location,
  IFNULL(l.Province, '') AS site_province,
  (SELECT COUNT(*) FROM devices d WHERE d.SLid = sl.SLid) AS device_count,
  1 AS devices_slid_aligned`;
}

const RENEW_HIST_RENEW_WHERE = `(
  h.action_type IN ('Renew', 'SOF Change')
  OR (h.old_sof IS NOT NULL AND TRIM(h.old_sof) != '')
)`;

/** app_db (7): ไม่มี changed_at — ใช้ created_at เป็นเวลา history */
async function resolveHistoryTimestamp(dbOrConn) {
  if (await columnExists(dbOrConn, 'sites_location_sof_history', 'changed_at')) {
    return { column: 'changed_at' };
  }
  if (await columnExists(dbOrConn, 'sites_location_sof_history', 'created_at')) {
    return { column: 'created_at' };
  }
  return { column: null };
}

function buildRenewHistSubqueries(tsColumn) {
  const atExpr = tsColumn
    ? `(SELECT h.${tsColumn} FROM sites_location_sof_history h
    WHERE h.SLid = sl.SLid AND ${RENEW_HIST_RENEW_WHERE}
    ORDER BY h.log_id DESC LIMIT 1)`
    : 'NULL';
  return `
  (SELECT h.old_sof FROM sites_location_sof_history h
    WHERE h.SLid = sl.SLid AND ${RENEW_HIST_RENEW_WHERE}
    ORDER BY h.log_id DESC LIMIT 1) AS renew_hist_old_sof,
  (SELECT h.SOF FROM sites_location_sof_history h
    WHERE h.SLid = sl.SLid AND ${RENEW_HIST_RENEW_WHERE}
    ORDER BY h.log_id DESC LIMIT 1) AS renew_hist_new_sof,
  ${atExpr} AS renew_hist_at,
  (SELECT GROUP_CONCAT(DISTINCT TRIM(h.old_sof) ORDER BY h.log_id SEPARATOR ',')
    FROM sites_location_sof_history h
    WHERE h.SLid = sl.SLid AND h.old_sof IS NOT NULL AND TRIM(h.old_sof) != '') AS hist_old_sofs`;
}

const HISTORY_STATUS_SUBQUERY = `
  (SELECT h.action_type FROM sites_location_sof_history h
    WHERE h.SLid = sl.SLid ORDER BY h.log_id DESC LIMIT 1) AS history_status`;

async function columnExists(dbOrConn, table, column) {
  try {
    const safeCol = String(column).replace(/[^a-zA-Z0-9_]/g, '');
    const [cols] = await dbOrConn.execute(`SHOW COLUMNS FROM \`${table}\` LIKE '${safeCol}'`);
    return Array.isArray(cols) && cols.length > 0;
  } catch {
    return false;
  }
}

function historyOrderByClause(tsColumn, tableAlias = '') {
  const p = tableAlias ? `${tableAlias}.` : '';
  if (tsColumn) {
    return `ORDER BY COALESCE(${p}${tsColumn}, ${p}log_id) DESC, ${p}log_id DESC`;
  }
  return `ORDER BY ${p}log_id DESC`;
}

function buildHistoryRowSelect(tsColumn, hasTerm = false, contractNameField = 'contract_name') {
  const changedCol =
    tsColumn === 'changed_at'
      ? 'changed_at'
      : tsColumn === 'created_at'
        ? 'created_at AS changed_at'
        : 'NULL AS changed_at';
  const base = `
  log_id, SLid, action_type, ${changedCol}, old_sof,
  SOF, ${contractNameField}, start_date, end_date, sla_term, Assigned_Service,
  pm_time_per_year, sale_account, tel_acc, email_acc, coverage_scope,
  file_paths, image_paths, status, created_at, Sid, lid`;
  return hasTerm ? `${base}, terminated_reason` : base;
}

async function resolveContractNameDbColumn(conn, table) {
  if (await columnExists(conn, table, 'contract_name')) return 'contract_name';
  if (await columnExists(conn, table, 'contactname')) return 'contactname';
  return 'contract_name';
}

function parseSiteContactField(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function storedContractNameFromRow(slRow) {
  if (!slRow) return '';
  if (slRow.contract_name != null && String(slRow.contract_name).trim() !== '') {
    return String(slRow.contract_name).trim();
  }
  if (slRow.contactname != null && String(slRow.contactname).trim() !== '') {
    return String(slRow.contactname).trim();
  }
  return '';
}

async function ensureHistoryCompatColumns(conn) {
  const pairs = [
    ['old_sof', 'varchar(255) DEFAULT NULL'],
    ['terminated_reason', 'text DEFAULT NULL'],
  ];
  for (const [col, def] of pairs) {
    if (!(await columnExists(conn, 'sites_location_sof_history', col))) {
      await conn.execute(`ALTER TABLE sites_location_sof_history ADD COLUMN \`${col}\` ${def}`);
    }
  }
}

async function ensureSitesLocationAssignedService(conn) {
  if (await columnExists(conn, 'sites_location', 'Assigned_Service')) return;
  await conn.execute(
    `ALTER TABLE sites_location ADD COLUMN Assigned_Service varchar(100) NOT NULL DEFAULT '' AFTER sla_term`
  );
}

/** Site contact JSON ({ site_contact_1, site_contact_2 }) — แยกจาก contactname (ชื่อสัญญา) */
async function ensureSitesLocationContactColumn(conn) {
  if (await columnExists(conn, 'sites_location', 'contact')) return;
  const afterCol = (await columnExists(conn, 'sites_location', 'email_acc'))
    ? 'email_acc'
    : (await columnExists(conn, 'sites_location', 'contactname'))
      ? 'contactname'
      : 'lid';
  await conn.execute(
    `ALTER TABLE sites_location ADD COLUMN \`contact\` JSON DEFAULT NULL AFTER \`${afterCol}\``
  );
}

function resolveContractNameFromRow(slRow) {
  if (!slRow) return '';
  const stored = storedContractNameFromRow(slRow);
  if (stored) return stored;
  const siteName = slRow.site_name != null ? String(slRow.site_name) : '';
  const loc = slRow.site_location != null ? String(slRow.site_location) : '';
  if (siteName && loc) return `${siteName} - ${loc}`;
  if (siteName) return siteName;
  if (loc) return loc;
  return slRow.SLid != null ? `SLid ${slRow.SLid}` : '';
}

async function fetchSiteLocationRow(conn, slid) {
  const id = parseInt(slid, 10);
  if (Number.isNaN(id)) return null;
  const [rows] = await conn.execute(
    `SELECT sl.*, s.Name AS site_name, IFNULL(l.Location2, '') AS site_location, IFNULL(l.Province, '') AS site_province, IFNULL(l.Province, '') AS site_province
     FROM sites_location sl
     LEFT JOIN sites s ON sl.Sid = s.Sid
     LEFT JOIN location l ON sl.lid = l.lid
     WHERE sl.SLid = ?`,
    [id]
  );
  return rows[0] || null;
}

function mapSlRowToContractDetail(slRow) {
  if (!slRow) return null;
  const siteName = slRow.site_name != null ? String(slRow.site_name) : '';
  const loc = slRow.site_location != null ? String(slRow.site_location) : '';
  const province = slRow.site_province != null ? String(slRow.site_province) : '';
  return {
    contract_id: slRow.SLid,
    contract_name: resolveContractNameFromRow(slRow),
    start_date: slRow.start_date,
    end_date: slRow.end_date,
    site_id: slRow.SLid,
    sla_term: slRow.sla_term,
    sale_account: slRow.sale_account,
    sof_name: slRow.SOF,
    Assigned_Service: slRow.Assigned_Service,
    site_name: siteName,
    site_location: loc,
    site_province: province,
    status: slRow.status,
    tel_acc: slRow.tel_acc,
    email_acc: slRow.email_acc,
    coverage_scope: slRow.coverage_scope,
    file_paths: slRow.file_paths,
    image_paths: slRow.image_paths,
    contact: parseSiteContactField(slRow.contact),
    pm_time_per_year: slRow.pm_time_per_year,
    created_at: slRow.created_at,
  };
}

/**
 * Snapshot current sites_location row into history (before UPDATE).
 */
async function insertSiteLocationHistory(conn, slid, actionType, meta = {}) {
  await ensureHistoryCompatColumns(conn);
  const slRow = await fetchSiteLocationRow(conn, slid);
  if (!slRow) return null;

  const hasHistoryCreatedAt = await columnExists(conn, 'sites_location_sof_history', 'created_at');
  const hasChangedAt = await columnExists(conn, 'sites_location_sof_history', 'changed_at');
  const hasOldSof = await columnExists(conn, 'sites_location_sof_history', 'old_sof');
  const hasTerm = await columnExists(conn, 'sites_location_sof_history', 'terminated_reason');
  const hasContactHist = await columnExists(conn, 'sites_location_sof_history', 'contact');
  const contractNameCol = await resolveContractNameDbColumn(conn, 'sites_location_sof_history');

  const sofForHistory =
    meta.newSof != null && String(meta.newSof).trim() !== ''
      ? String(meta.newSof).trim()
      : slRow.SOF;

  const baseCols = ['action_type'];
  if (hasChangedAt) baseCols.push('changed_at');
  baseCols.push(
    'SLid',
    'Sid',
    'lid',
    'SOF',
    contractNameCol,
    'start_date',
    'end_date',
    'sla_term',
    'Assigned_Service',
    'pm_time_per_year',
    'sale_account',
    'tel_acc',
    'email_acc',
    'coverage_scope',
    ...(hasContactHist ? ['contact'] : []),
    'file_paths',
    'image_paths',
    'status'
  );
  if (hasHistoryCreatedAt) baseCols.push('created_at');
  const baseVals = [actionType];
  if (hasChangedAt) baseVals.push(new Date());
  baseVals.push(
    slRow.SLid,
    slRow.Sid,
    slRow.lid,
    sofForHistory,
    storedContractNameFromRow(slRow) || null,
    slRow.start_date,
    slRow.end_date,
    slRow.sla_term,
    slRow.Assigned_Service,
    slRow.pm_time_per_year,
    slRow.sale_account,
    slRow.tel_acc,
    slRow.email_acc,
    slRow.coverage_scope,
    ...(hasContactHist ? [slRow.contact ?? null] : []),
    slRow.file_paths,
    slRow.image_paths,
    slRow.status
  );
  if (hasHistoryCreatedAt) baseVals.push(new Date());

  if (hasOldSof && meta.oldSof != null) {
    baseCols.push('old_sof');
    baseVals.push(meta.oldSof);
  }
  if (hasTerm && meta.terminatedReason != null) {
    baseCols.push('terminated_reason');
    baseVals.push(meta.terminatedReason);
  }

  const placeholders = baseCols.map(() => '?').join(', ');
  const [result] = await conn.execute(
    `INSERT INTO sites_location_sof_history (${baseCols.join(', ')}) VALUES (${placeholders})`,
    baseVals
  );
  return result.insertId;
}

async function assignDevicesToSlid(conn, slid, deviceIds) {
  const ids = [...new Set((deviceIds || []).map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n)))];
  if (ids.length === 0) return;
  const ph = ids.map(() => '?').join(', ');
  await conn.execute(`UPDATE devices SET SLid = ? WHERE Did IN (${ph})`, [slid, ...ids]);
}

/** sites_location ที่มีสัญญา official อยู่แล้ว — ห้าม Create ทับ (ใช้ Renew/Edit แทน) */
function slRowHasBlockingOfficialContract(slRow) {
  if (!slRow) return false;
  const status = String(slRow.status ?? '').trim().toLowerCase();
  if (!status || status === 'draft' || status === 'not_renewing') return false;
  if (status !== 'official') return false;
  const sof = slRow.SOF != null ? String(slRow.SOF).trim() : '';
  if (!sof) return false;
  const lower = sof.toLowerCase();
  if (lower === 'not assigned' || lower === 'n/a' || lower === 'na') return false;
  return true;
}

/** ตรวจว่า device อยู่คลัง Bangna และ In Store (พร้อม assign ไป site ลูกค้า) */
async function assertDevicesAtBangnaWarehouse(conn, deviceIds) {
  const { DEFAULT_IN_STORE_SITE_NAME } = require('../config/inStoreSite');
  const ids = [...new Set(deviceIds.map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n)))];
  if (ids.length === 0) return;
  const ph = ids.map(() => '?').join(', ');
  const [rows] = await conn.execute(
    `SELECT d.Did
     FROM devices d
     INNER JOIN sites_location sl ON d.SLid = sl.SLid
     INNER JOIN sites s ON sl.Sid = s.Sid
     WHERE d.Did IN (${ph})
       AND LOWER(TRIM(s.Name)) = LOWER(TRIM(?))
       AND LOWER(TRIM(COALESCE(d.Asset_State,''))) = 'in store'`,
    [...ids, DEFAULT_IN_STORE_SITE_NAME]
  );
  const found = new Set((rows || []).map((r) => parseInt(r.Did, 10)));
  const invalid = ids.filter((id) => !found.has(id));
  if (invalid.length > 0) {
    const err = new Error(
      `Selected devices must be In Store at Bangna warehouse (invalid Did: ${invalid.join(', ')})`
    );
    err.code = 'DEVICES_NOT_AT_BANGNA';
    err.device_ids = invalid;
    throw err;
  }
}

/** สร้างสัญญาใหม่: ย้าย device จากคลัง Bangna → SLid ลูกค้า และตั้ง Asset_State = In Use */
async function assignDevicesFromBangnaToSlid(conn, targetSlid, deviceIds) {
  const slidNum = parseInt(targetSlid, 10);
  if (Number.isNaN(slidNum)) {
    throw new Error(`Invalid target SLid for device assignment: ${targetSlid}`);
  }
  const ids = [...new Set(deviceIds.map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n)))];
  if (ids.length === 0) return;
  await assertDevicesAtBangnaWarehouse(conn, ids);
  const ph = ids.map(() => '?').join(', ');
  await conn.execute(
    `UPDATE devices SET SLid = ?, Asset_State = 'In Use' WHERE Did IN (${ph})`,
    [slidNum, ...ids]
  );
}

/** หลังสร้างสัญญา official — ย้าย device In Store ที่ SLid นี้แต่ไม่อยู่ในรายการที่เลือก กลับคลัง */
async function reconcileInStoreDevicesAtSlid(conn, slid, keepDeviceIds) {
  const slidNum = parseInt(slid, 10);
  if (Number.isNaN(slidNum)) return;
  const keep = new Set(
    (keepDeviceIds || []).map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n))
  );
  const [rows] = await conn.execute(
    `SELECT Did FROM devices
     WHERE SLid = ?
       AND LOWER(TRIM(COALESCE(Asset_State,''))) = 'in store'`,
    [slidNum]
  );
  if (!rows.length) return;
  const { assignDeviceToInStoreWarehouse } = require('../config/inStoreSite');
  for (const row of rows) {
    const did = parseInt(row.Did, 10);
    if (Number.isNaN(did) || keep.has(did)) continue;
    await assignDeviceToInStoreWarehouse(conn, did);
  }
}

/** Device already on another official sites_location with SOF */
async function findDevicesOnOtherContracts(conn, deviceIds, excludeSlid) {
  const ids = [...new Set(deviceIds.map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n)))];
  if (ids.length === 0) return [];
  const ph = ids.map(() => '?').join(', ');
  const params = [...ids];
  let excludeSql = '';
  if (excludeSlid != null) {
    const ex = parseInt(excludeSlid, 10);
    if (!Number.isNaN(ex)) {
      excludeSql = ' AND sl.SLid <> ?';
      params.push(ex);
    }
  }
  const [rows] = await conn.execute(
    `SELECT DISTINCT d.Did AS device_id
     FROM devices d
     INNER JOIN sites_location sl ON d.SLid = sl.SLid
     WHERE d.Did IN (${ph})
       AND sl.status = 'official'
       AND sl.SOF IS NOT NULL AND TRIM(sl.SOF) != ''
       ${excludeSql}`,
    params
  );
  return (rows || []).map((r) => r.device_id);
}

function buildSiteLocationContractFieldMap(fields, connMeta = {}) {
  const { contractNameCol = 'contract_name', hasAssignedService = true, hasContactCol = true } =
    connMeta;
  return {
    SOF: fields.sof_name,
    [contractNameCol]: fields.contract_name,
    start_date: fields.start_date,
    end_date: fields.end_date,
    sla_term: fields.sla_term,
    Assigned_Service: fields.assigned_service,
    sale_account: fields.sale_account,
    tel_acc: fields.tel_acc,
    email_acc: fields.email_acc,
    coverage_scope: fields.coverage_scope,
    contact: fields.contact,
    file_paths: fields.file_paths,
    image_paths: fields.image_paths,
    pm_time_per_year: fields.pm_time_per_year,
    status: fields.status,
  };
}

/** Create = สัญญาใหม่ที่ location เดิม — INSERT sites_location แถวใหม่ (ไม่ทับ SLid เก่า) */
async function insertSiteLocationContract(conn, sid, lid, fields = {}) {
  await ensureSitesLocationAssignedService(conn);
  await ensureSitesLocationContactColumn(conn);
  const contractNameCol = await resolveContractNameDbColumn(conn, 'sites_location');
  const hasAssignedService = await columnExists(conn, 'sites_location', 'Assigned_Service');
  const hasContactCol = await columnExists(conn, 'sites_location', 'contact');
  const sidNum = parseInt(sid, 10);
  const lidNum = parseInt(lid, 10);
  if (Number.isNaN(sidNum) || Number.isNaN(lidNum)) {
    throw new Error(`Invalid Sid/lid for new sites_location: Sid=${sid}, lid=${lid}`);
  }

  const cols = ['Sid', 'lid'];
  const vals = [sidNum, lidNum];
  const map = buildSiteLocationContractFieldMap(fields, {
    contractNameCol,
    hasAssignedService,
    hasContactCol,
  });
  for (const [col, val] of Object.entries(map)) {
    if (col === 'Assigned_Service' && !hasAssignedService) continue;
    if (col === 'contact' && !hasContactCol) continue;
    if (col === 'contact' && (val === undefined || val === null)) continue;
    if (val !== undefined) {
      cols.push(col);
      vals.push(val);
    }
  }

  const [result] = await conn.execute(
    `INSERT INTO sites_location (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return result.insertId;
}

async function updateSiteLocationContract(conn, slid, fields) {
  await ensureSitesLocationAssignedService(conn);
  await ensureSitesLocationContactColumn(conn);
  const contractNameCol = await resolveContractNameDbColumn(conn, 'sites_location');
  const sets = [];
  const vals = [];
  const hasAssignedService = await columnExists(conn, 'sites_location', 'Assigned_Service');
  const hasContactCol = await columnExists(conn, 'sites_location', 'contact');
  const map = {
    SOF: fields.sof_name,
    [contractNameCol]: fields.contract_name,
    start_date: fields.start_date,
    end_date: fields.end_date,
    sla_term: fields.sla_term,
    Assigned_Service: fields.assigned_service,
    sale_account: fields.sale_account,
    tel_acc: fields.tel_acc,
    email_acc: fields.email_acc,
    coverage_scope: fields.coverage_scope,
    contact: fields.contact,
    file_paths: fields.file_paths,
    image_paths: fields.image_paths,
    pm_time_per_year: fields.pm_time_per_year,
    status: fields.status,
  };
  for (const [col, val] of Object.entries(map)) {
    if (col === 'Assigned_Service' && !hasAssignedService) continue;
    if (col === 'contact' && !hasContactCol) continue;
    // JSON column: skip NULL — empty contact = ไม่แก้ค่าเดิม (หลีกเลี่ยง NOT NULL / invalid JSON)
    if (col === 'contact' && (val === undefined || val === null)) continue;
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(val);
    }
  }
  if (sets.length === 0) return;
  vals.push(slid);
  await conn.execute(`UPDATE sites_location SET ${sets.join(', ')} WHERE SLid = ?`, vals);
}

const HISTORY_ROW_SELECT = buildHistoryRowSelect('created_at');

/** เติมฟิลด์ที่ snapshot ประวัติว่างจากสัญญาปัจจุบัน (เช่น start_date / end_date) */
function mergeHistoryDetailWithLive(snap, liveDetail) {
  if (!snap) return liveDetail || null;
  if (!liveDetail) return snap;
  const pick = (key) => {
    const v = snap[key];
    if (v != null && v !== '') return v;
    return liveDetail[key] ?? null;
  };
  return {
    ...liveDetail,
    ...snap,
    contract_name: pick('contract_name'),
    start_date: pick('start_date'),
    end_date: pick('end_date'),
    sla_term: snap.sla_term != null ? snap.sla_term : liveDetail.sla_term,
    sale_account: pick('sale_account'),
    tel_acc: pick('tel_acc'),
    email_acc: pick('email_acc'),
    coverage_scope: pick('coverage_scope'),
    contact: snap.contact != null ? parseSiteContactField(snap.contact) : parseSiteContactField(liveDetail.contact),
    file_paths: pick('file_paths'),
    image_paths: pick('image_paths'),
    pm_time_per_year: snap.pm_time_per_year != null ? snap.pm_time_per_year : liveDetail.pm_time_per_year,
    Assigned_Service: pick('Assigned_Service'),
    sof_name: pick('sof_name'),
    status: snap.status != null ? snap.status : liveDetail.status,
  };
}

/** Contract fields from a sites_location_sof_history row (mirrors sites_location snapshot). */
function mapHistoryRowToContractDetail(histRow, siteInfo = {}) {
  if (!histRow) return null;
  const siteName = siteInfo.site_name != null ? String(siteInfo.site_name) : '';
  const loc = siteInfo.site_location != null ? String(siteInfo.site_location) : '';
  const contractName = resolveContractNameFromRow({
    contract_name: histRow.contract_name ?? histRow.contactname,
    contactname: histRow.contactname,
    site_name: siteName,
    site_location: loc,
    SLid: histRow.SLid,
  });
  const sofRaw =
    histRow.SOF != null && String(histRow.SOF).trim() !== ''
      ? String(histRow.SOF).trim()
      : histRow.old_sof != null
        ? String(histRow.old_sof).trim()
        : '';
  return {
    contract_id: histRow.SLid,
    contract_name: contractName,
    start_date: histRow.start_date,
    end_date: histRow.end_date,
    site_id: histRow.SLid,
    sla_term: histRow.sla_term,
    sale_account: histRow.sale_account,
    sof_name: sofRaw || null,
    Assigned_Service: histRow.Assigned_Service,
    site_name: siteName,
    site_location: loc,
    status: histRow.status,
    tel_acc: histRow.tel_acc,
    email_acc: histRow.email_acc,
    coverage_scope: histRow.coverage_scope,
    contact: parseSiteContactField(histRow.contact),
    file_paths: histRow.file_paths,
    image_paths: histRow.image_paths,
    pm_time_per_year: histRow.pm_time_per_year,
    created_at: histRow.created_at,
  };
}

/** Map history row to legacy contract_history API shape */
function mapHistoryRowToLegacy(row) {
  return {
    history_id: row.log_id,
    contract_id: row.SLid,
    old_contract_id: row.SLid,
    old_sof: row.old_sof,
    new_sof: row.SOF ?? null,
    renewed_at: row.changed_at ?? row.created_at ?? null,
    created_at: row.changed_at ?? row.created_at ?? null,
    contract_snapshot: null,
    status_history: row.action_type,
    terminated_reason: row.terminated_reason ?? null,
  };
}

const DEVICES_BY_SLID_SQL = `
  SELECT d.Did, d.CI_Name, d.Asset_Number, d.serial, d.Asset_State, d.SLid,
    d.SLid AS contract_SLid, sl.SLid AS contract_id,
    s.Name AS SiteName, l.Location2 AS Location2,
    d.Dtypeid, d.DeRoleid, dt.model AS type_name, dr.name AS roleName
  FROM devices d
  INNER JOIN sites_location sl ON d.SLid = sl.SLid
  LEFT JOIN sites s ON sl.Sid = s.Sid
  LEFT JOIN location l ON sl.lid = l.lid
  LEFT JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
  LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid
  WHERE d.SLid = ?
  ORDER BY d.CI_Name ASC, d.Asset_Number ASC`;

const AVAILABLE_DEVICES_BASE = `
  SELECT d.Did, d.CI_Name, d.Asset_Number, d.serial, d.Asset_State, d.SLid,
    d.Dtypeid, d.DeRoleid, s.Name AS SiteName, dt.model AS model, dt.model AS type, dr.name AS roleName
  FROM devices d
  LEFT JOIN sites_location sl ON d.SLid = sl.SLid
  LEFT JOIN sites s ON sl.Sid = s.Sid
  LEFT JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
  LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid`;

async function updateLocationProvinceBySlid(conn, slid, province) {
  if (province === undefined) return;
  const row = await fetchSiteLocationRow(conn, slid);
  if (!row || row.lid == null) return;
  const val = province != null ? String(province).trim() : '';
  await conn.execute('UPDATE location SET Province = ? WHERE lid = ?', [val || null, row.lid]);
}

module.exports = {
  HIST_ACTION,
  SL_LIST_SELECT,
  buildSlListSelect,
  buildRenewHistSubqueries,
  resolveHistoryTimestamp,
  HISTORY_STATUS_SUBQUERY,
  buildHistoryRowSelect,
  resolveContractNameDbColumn,
  storedContractNameFromRow,
  historyOrderByClause,
  HISTORY_ROW_SELECT,
  columnExists,
  ensureHistoryCompatColumns,
  ensureSitesLocationAssignedService,
  ensureSitesLocationContactColumn,
  resolveContractNameFromRow,
  fetchSiteLocationRow,
  mapSlRowToContractDetail,
  mapHistoryRowToContractDetail,
  mergeHistoryDetailWithLive,
  insertSiteLocationHistory,
  assignDevicesToSlid,
  assignDevicesFromBangnaToSlid,
  assertDevicesAtBangnaWarehouse,
  slRowHasBlockingOfficialContract,
  reconcileInStoreDevicesAtSlid,
  findDevicesOnOtherContracts,
  insertSiteLocationContract,
  updateSiteLocationContract,
  updateLocationProvinceBySlid,
  mapHistoryRowToLegacy,
  DEVICES_BY_SLID_SQL,
  AVAILABLE_DEVICES_BASE,
  noSofWhere,
};
