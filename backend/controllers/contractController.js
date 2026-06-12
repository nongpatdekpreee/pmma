/**
 * Contract API — backed by sites_location (contract_id === SLid).
 * Legacy contract / contract_device / contract_history removed (see contractController.legacy.js).
 */
const db = require('../config/database');
const { DEFAULT_IN_STORE_SITE_NAME } = require('../config/inStoreSite');
const {
  normalizeReferSofKey,
  sofIsValidWhere,
  sofMatchWhere,
  syncSofOnSiteLocations,
  syncSofRenameOnSiteLocations,
  findSlidsWithMatchingSof,
} = require('../config/deviceSof');
const slc = require('../lib/siteLocationContract');

const EMAIL_LINE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateMultilineEmails(emailAcc) {
  if (emailAcc == null || String(emailAcc).trim() === '') return { ok: true };
  const lines = String(emailAcc).split(/\n/).map((s) => s.trim());
  for (const line of lines) {
    if (!line) continue;
    if (!EMAIL_LINE_RE.test(line)) return { ok: false };
  }
  return { ok: true };
}

function validateMultilineTels(telAcc) {
  if (telAcc == null || String(telAcc).trim() === '') return { ok: true };
  const lines = String(telAcc).split(/\n/).map((s) => s.trim());
  for (const line of lines) {
    if (!line) continue;
    const extForm = line.match(/^(\d{9,15})-(\d{1,5})$/);
    if (extForm) continue;
    const digitsOnly = line.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 15) return { ok: false };
  }
  return { ok: true };
}

function jsonPaths(field) {
  if (Array.isArray(field)) return JSON.stringify(field);
  if (field && String(field).trim()) return String(field).trim();
  return null;
}

function parsePairsFromBody(body, contractStatus) {
  let pairs = [];
  if (Array.isArray(body.site_device_pairs) && body.site_device_pairs.length > 0) {
    pairs = body.site_device_pairs
      .map((p) => ({
        site_id: p.site_id != null ? parseInt(p.site_id, 10) : null,
        device_ids: Array.isArray(p.device_ids)
          ? p.device_ids.map((d) => parseInt(d, 10)).filter((n) => !isNaN(n))
          : [],
      }))
      .filter(
        (p) =>
          p.site_id != null &&
          !isNaN(p.site_id) &&
          (p.device_ids.length > 0 || contractStatus === 'draft')
      );
  }
  return pairs;
}

async function historySchemaFlags() {
  const [ts, hasTerm] = await Promise.all([
    slc.resolveHistoryTimestamp(db),
    slc.columnExists(db, 'sites_location_sof_history', 'terminated_reason'),
  ]);
  return { tsColumn: ts.column, hasTerm };
}

function historySelectSql(tsColumn, hasTerm) {
  return slc.buildHistoryRowSelect(tsColumn, hasTerm);
}

const uploadContractFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const path = `/uploads/contracts/${req.file.filename}`;
    return res.status(200).json({ success: true, path });
  } catch (error) {
    console.error('Error uploading contract file:', error);
    return res.status(500).json({ success: false, message: 'Error uploading file', error: error.message });
  }
};

const getContractsBySite = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    const expandSites = req.query.expand === 'sites';
    const { column: tsColumn } = await slc.resolveHistoryTimestamp(db);
    let sql = `
      SELECT ${slc.SL_LIST_SELECT},
        ${slc.HISTORY_STATUS_SUBQUERY},
        ${slc.buildRenewHistSubqueries(tsColumn)}
      FROM sites_location sl
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE sl.status <> 'not_renewing'
    `;
    const params = [];

    if (siteId) {
      const siteIdNum = parseInt(siteId, 10);
      if (!isNaN(siteIdNum)) {
        sql += ` AND (
          sl.SLid = ?
          OR sl.Sid = (SELECT sl0.Sid FROM sites_location sl0 WHERE sl0.SLid = ? LIMIT 1)
        )`;
        params.push(siteIdNum, siteIdNum);
      }
    }

    sql += expandSites
      ? ' ORDER BY sl.created_at DESC, sl.SLid DESC, s.Name ASC'
      : ' ORDER BY sl.created_at DESC, sl.SLid DESC';

    const [rows] = await db.execute(sql, params);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting contracts by site:', error);
    return res.status(500).json({
      success: false,
      message: 'No have any Contract',
      error: error.message,
    });
  }
};

const getContractById = async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }

    const slRow = await slc.fetchSiteLocationRow(db, cid);
    if (!slRow) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const [devicesRows] = await db.execute(slc.DEVICES_BY_SLID_SQL, [cid]);
    const sitesRows = [
      {
        SLid: cid,
        SiteName: slRow.site_name,
        Location2: slRow.site_location || null,
      },
    ];

    const { tsColumn, hasTerm } = await historySchemaFlags();
    const [histRows] = await db.execute(
      `SELECT ${historySelectSql(tsColumn, hasTerm)}
       FROM sites_location_sof_history
       WHERE SLid = ?
       ${slc.historyOrderByClause(tsColumn)}`,
      [cid]
    );

    const history = (histRows || []).map((r) => slc.mapHistoryRowToLegacy(r));

    return res.status(200).json({
      success: true,
      data: {
        ...slc.mapSlRowToContractDetail(slRow),
        devices: devicesRows,
        sites: sitesRows,
        history,
      },
    });
  } catch (error) {
    console.error('Error getting contract by id:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting contract by id',
      error: error.message,
    });
  }
};

const getAvailableDevices = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    const contractId = req.query.contract_id;
    const params = [];
    let where = `WHERE (
      d.SLid IS NULL
      OR sl.SLid IS NULL
      OR sl.status = 'draft'
      OR ${slc.noSofWhere('sl', 'd')}
    )`;

    if (contractId) {
      const cid = parseInt(contractId, 10);
      if (!isNaN(cid)) {
        where += ` AND ${slc.noSofWhere('sl', 'd')} AND LOWER(TRIM(COALESCE(s.Name, ''))) = LOWER(TRIM(?))`;
        params.push(DEFAULT_IN_STORE_SITE_NAME);
      }
    } else if (siteId) {
      const sid = parseInt(siteId, 10);
      if (!isNaN(sid)) {
        where += ' AND d.SLid = ?';
        params.push(sid);
      }
    }

    const [rows] = await db.execute(
      `${slc.AVAILABLE_DEVICES_BASE} ${where} ORDER BY d.CI_Name ASC, d.Asset_Number ASC`,
      params
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting available devices:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting available devices',
      error: error.message,
    });
  }
};

const getSitesByContract = async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    const slRow = await slc.fetchSiteLocationRow(db, cid);
    if (!slRow) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    return res.status(200).json({
      success: true,
      data: [{ SLid: cid, SiteName: slRow.site_name, Location2: slRow.site_location || null }],
    });
  } catch (error) {
    console.error('Error getting sites by contract:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting sites by contract',
      error: error.message,
    });
  }
};

const getDevicesByContract = async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    const [rows] = await db.execute(slc.DEVICES_BY_SLID_SQL, [cid]);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting devices by contract:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting devices by contract',
      error: error.message,
    });
  }
};

const getContractHistory = async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    const { tsColumn, hasTerm } = await historySchemaFlags();
    const [rows] = await db.execute(
      `SELECT ${historySelectSql(tsColumn, hasTerm)}
       FROM sites_location_sof_history WHERE SLid = ?
       ${slc.historyOrderByClause(tsColumn)}`,
      [cid]
    );
    return res.status(200).json({
      success: true,
      data: (rows || []).map((r) => slc.mapHistoryRowToLegacy(r)),
    });
  } catch (error) {
    console.error('Error getting contract history:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting contract history',
      error: error.message,
    });
  }
};

const postContractHistoryDisplayRows = async (req, res) => {
  try {
    const rawIds = req.body && Array.isArray(req.body.contract_ids) ? req.body.contract_ids : [];
    const includeNrHistory =
      req.body == null ||
      req.body.include_history_for_not_renewing_contracts === undefined ||
      req.body.include_history_for_not_renewing_contracts === true;
    const contractIds = [
      ...new Set(
        rawIds.map((x) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n) && n > 0)
      ),
    ];

    const { tsColumn, hasTerm } = await historySchemaFlags();
    const histCols = historySelectSql(tsColumn, hasTerm)
      .split(',')
      .map((c) => `h.${c.trim()}`)
      .join(', ');

    let histRows = [];
    if (contractIds.length > 0) {
      const ph = contractIds.map(() => '?').join(',');
      const [rowsMain] = await db.execute(
        `SELECT ${historySelectSql(tsColumn, hasTerm)}
         FROM sites_location_sof_history WHERE SLid IN (${ph})
         ${slc.historyOrderByClause(tsColumn)}`,
        contractIds
      );
      histRows = rowsMain || [];
    }

    if (includeNrHistory) {
      const [rowsNr] = await db.execute(
        `SELECT ${histCols}
         FROM sites_location_sof_history h
         INNER JOIN sites_location sl ON sl.SLid = h.SLid AND sl.status = 'not_renewing'
         WHERE (
           h.action_type IN ('Renew', 'Terminated')
           OR (h.action_type IS NULL AND h.old_sof IS NOT NULL AND h.SOF IS NOT NULL AND TRIM(h.SOF) != '')
         )
         ${slc.historyOrderByClause(tsColumn, 'h')}`
      );
      const seen = new Set(histRows.map((r) => Number(r.log_id)));
      for (const row of rowsNr || []) {
        if (!seen.has(Number(row.log_id))) {
          seen.add(Number(row.log_id));
          histRows.push(row);
        }
      }
    }

    if (!histRows.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const slids = [...new Set(histRows.map((r) => Number(r.SLid)).filter((n) => !Number.isNaN(n)))];
    const siteBySlid = new Map();
    if (slids.length) {
      const ph2 = slids.map(() => '?').join(',');
      const [slRows] = await db.execute(
        `SELECT sl.SLid, s.Name AS site_name, IFNULL(l.Location2, '') AS site_location
         FROM sites_location sl
         LEFT JOIN sites s ON sl.Sid = s.Sid
         LEFT JOIN location l ON sl.lid = l.lid
         WHERE sl.SLid IN (${ph2})`,
        slids
      );
      for (const r of slRows || []) {
        siteBySlid.set(Number(r.SLid), {
          site_name: r.site_name != null ? String(r.site_name) : '',
          site_location: r.site_location != null ? String(r.site_location) : '',
        });
      }
    }

    const deviceCountBySlid = new Map();
    if (slids.length) {
      const ph3 = slids.map(() => '?').join(',');
      const [countRows] = await db.execute(
        `SELECT SLid, COUNT(*) AS cnt FROM devices WHERE SLid IN (${ph3}) GROUP BY SLid`,
        slids
      );
      for (const r of countRows || []) {
        deviceCountBySlid.set(Number(r.SLid), Number(r.cnt) || 0);
      }
    }

    const data = histRows.map((row) => {
      const legacy = slc.mapHistoryRowToLegacy(row);
      const slid = Number(row.SLid);
      const sl = siteBySlid.get(slid);
      const snap = slc.mapHistoryRowToContractDetail(row, sl || {});
      return {
        row_type: 'history',
        history_id: legacy.history_id,
        contract_id: slid,
        contract_name: snap?.contract_name ?? null,
        start_date: snap?.start_date ? String(snap.start_date).slice(0, 10) : null,
        end_date: snap?.end_date ? String(snap.end_date).slice(0, 10) : null,
        sale_account: snap?.sale_account ?? null,
        sof_name: snap?.sof_name ?? null,
        site_id: slid,
        contract_site_name: sl?.site_name || null,
        contract_site_location: sl?.site_location || null,
        site_name: sl?.site_name ?? null,
        site_location: sl?.site_location ?? null,
        device_count: deviceCountBySlid.get(slid) ?? 0,
        status: snap?.status ?? 'official',
        devices_slid_aligned: 1,
        history_status: legacy.status_history,
        renew_hist_old_sof: legacy.old_sof,
        renew_hist_new_sof: legacy.new_sof,
        renew_hist_at: legacy.renewed_at,
        terminated_reason: legacy.terminated_reason,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error getting contract history display rows:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting contract history display rows',
      error: error.message,
    });
  }
};

const getContractHistoryDetailByHistoryId = async (req, res) => {
  try {
    const hid = parseInt(String(req.params.historyId), 10);
    if (Number.isNaN(hid) || hid <= 0) {
      return res.status(400).json({ success: false, message: 'history_id is not valid' });
    }

    const { tsColumn, hasTerm } = await historySchemaFlags();
    const [rows] = await db.execute(
      `SELECT ${historySelectSql(tsColumn, hasTerm)}
       FROM sites_location_sof_history WHERE log_id = ?`,
      [hid]
    );
    if (!rows?.length) {
      return res.status(404).json({ success: false, message: 'Contract history not found' });
    }

    const histRow = rows[0];
    const legacy = slc.mapHistoryRowToLegacy(histRow);
    const cid = Number(histRow.SLid);

    const slRow = await slc.fetchSiteLocationRow(db, cid);
    const siteInfo = slRow
      ? { site_name: slRow.site_name, site_location: slRow.site_location }
      : {};
    const liveDetail = slRow ? slc.mapSlRowToContractDetail(slRow) : null;
    const snap = slc.mapHistoryRowToContractDetail(histRow, siteInfo);
    const merged = slc.mergeHistoryDetailWithLive(snap, liveDetail);
    const [devicesRows] = await db.execute(slc.DEVICES_BY_SLID_SQL, [cid]);

    const contractBase = {
      ...(merged || snap || liveDetail || {}),
      contract_id: cid,
      history_id: legacy.history_id,
      history_detail: true,
      sof_name:
        snap?.sof_name ?? legacy.new_sof ?? legacy.old_sof ?? liveDetail?.sof_name ?? null,
      site_id: cid,
      site_name: snap?.site_name ?? slRow?.site_name ?? null,
      site_location: snap?.site_location ?? slRow?.site_location ?? null,
    };

    return res.status(200).json({
      success: true,
      data: {
        ...contractBase,
        devices: devicesRows,
        sites: slRow
          ? [{ SLid: cid, SiteName: slRow.site_name, Location2: slRow.site_location }]
          : [],
        history: [legacy],
      },
    });
  } catch (error) {
    console.error('Error getting contract history detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting contract history detail',
      error: error.message,
    });
  }
};

function normDateYmd(v) {
  if (v == null || v === '') return null;
  const s = String(v).split('T')[0].trim();
  return s || null;
}

function normStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function pathsComparable(field) {
  const j = jsonPaths(field);
  if (j == null) return '';
  try {
    const parsed = JSON.parse(j);
    return JSON.stringify(parsed);
  } catch {
    return j;
  }
}

/** มีการแก้ฟิลด์อื่นนอกจากเปลี่ยน SOF / Terminate */
function hasOtherContractEdits(existing, body, { skipNotRenewingStatus = false } = {}) {
  if (body.site_device_pairs !== undefined) return true;

  if (body.start_date !== undefined && normDateYmd(body.start_date) !== normDateYmd(existing.start_date)) {
    return true;
  }
  if (body.end_date !== undefined && normDateYmd(body.end_date) !== normDateYmd(existing.end_date)) {
    return true;
  }
  if (body.sla_term !== undefined) {
    const incoming =
      body.sla_term != null && String(body.sla_term).trim() !== ''
        ? parseInt(String(body.sla_term).trim(), 10)
        : 2;
    const current =
      existing.sla_term != null && String(existing.sla_term).trim() !== ''
        ? parseInt(String(existing.sla_term).trim(), 10)
        : 2;
    if (incoming !== current) return true;
  }
  if (body.assigned_service !== undefined) {
    const inc = normStr(body.assigned_service);
    const cur = normStr(existing.Assigned_Service);
    if (inc !== cur) return true;
  }
  if (body.sale_account !== undefined && normStr(body.sale_account) !== normStr(existing.sale_account)) {
    return true;
  }
  if (body.tel_acc !== undefined && normStr(body.tel_acc) !== normStr(existing.tel_acc)) {
    return true;
  }
  if (body.email_acc !== undefined && normStr(body.email_acc) !== normStr(existing.email_acc)) {
    return true;
  }
  if (body.coverage_scope !== undefined && normStr(body.coverage_scope) !== normStr(existing.coverage_scope)) {
    return true;
  }
  if (body.file_paths !== undefined && pathsComparable(body.file_paths) !== pathsComparable(existing.file_paths)) {
    return true;
  }
  if (body.image_paths !== undefined && pathsComparable(body.image_paths) !== pathsComparable(existing.image_paths)) {
    return true;
  }
  if (body.pm_time_per_year !== undefined) {
    const inc = normStr(body.pm_time_per_year) || '2';
    const cur = normStr(existing.pm_time_per_year) || '2';
    if (inc !== cur) return true;
  }
  if (body.status !== undefined) {
    const inc = normStr(body.status).toLowerCase();
    const cur = normStr(existing.status).toLowerCase();
    if (skipNotRenewingStatus && inc === 'not_renewing') return false;
    if (inc !== cur && inc !== 'not_renewing') return true;
  }
  return false;
}

/** เปลี่ยนเลข SOF ทุก sites_location ที่ใช้ oldSof เดียวกัน (รวม normalize เลขนำหน้า 0) */
async function syncSofRenameToAllPeers(conn, oldSof, newSof) {
  const oldTrim = oldSof != null ? String(oldSof).trim() : '';
  const newTrim = newSof != null ? String(newSof).trim() : '';
  if (!oldTrim || !newTrim || oldTrim === newTrim) return;
  await syncSofRenameOnSiteLocations(conn, oldTrim, newTrim);
}

/** แพร่ฟิลด์สัญญาไปทุก sites_location ที่ SOF ตรงกัน (ยกเว้นแถวที่แก้) */
async function propagateContractFieldsToSameSofPeers(
  conn,
  matchSof,
  excludeSlid,
  body,
  contractStatus
) {
  const peerSlids = await findSlidsWithMatchingSof(conn, matchSof, excludeSlid);
  for (const slid of peerSlids) {
    await applyContractFieldsToSlid(conn, slid, body, contractStatus);
  }
}

function shouldPropagateContractFields(
  body,
  existing,
  { sofChangeHistory, otherEdits, isTransitionToNotRenewing }
) {
  if (sofChangeHistory) return true;
  if (otherEdits) return true;
  if (isTransitionToNotRenewing) return true;
  if (body.status !== undefined) {
    const inc = String(body.status).toLowerCase();
    const cur = existing.status != null ? String(existing.status).toLowerCase() : '';
    if (inc !== cur) return true;
  }
  return false;
}

async function applyContractFieldsToSlid(conn, slid, body, contractStatus) {
  const sofValue =
    body.sof_id != null && body.sof_id !== ''
      ? String(body.sof_id).trim()
      : body.sof_name && String(body.sof_name).trim()
        ? body.sof_name.trim()
        : null;
  const pmRaw = body.pm_time_per_year != null ? String(body.pm_time_per_year).trim() : '';
  const pmEnum = ['1', '2', '3', '4', '5'].includes(pmRaw) ? pmRaw : '2';
  const slaTermInt = (() => {
    const v =
      body.sla_term != null && String(body.sla_term).trim() !== ''
        ? parseInt(String(body.sla_term).trim(), 10)
        : NaN;
    return isNaN(v) ? 2 : v;
  })();

  await slc.updateSiteLocationContract(conn, slid, {
    sof_name: sofValue,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    sla_term: slaTermInt,
    assigned_service:
      body.assigned_service && String(body.assigned_service).trim()
        ? body.assigned_service.trim()
        : '',
    sale_account: body.sale_account?.trim() || null,
    tel_acc: body.tel_acc != null && String(body.tel_acc).trim() !== '' ? String(body.tel_acc).trim() : null,
    email_acc:
      body.email_acc != null && String(body.email_acc).trim() !== '' ? String(body.email_acc).trim() : '',
    coverage_scope: body.coverage_scope?.trim() || null,
    file_paths: jsonPaths(body.file_paths),
    image_paths: jsonPaths(body.image_paths),
    pm_time_per_year: pmEnum,
    status: contractStatus,
  });
}

const createContract = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const body = req.body;
    const contractStatus = body.status === 'draft' || body.status === 'official' ? body.status : 'official';

    if (!validateMultilineEmails(body.email_acc).ok) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email address(es); one per line (e.g. example@domain.com)',
      });
    }
    if (!validateMultilineTels(body.tel_acc).ok) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid phone number(s); one per line (9–15 digits each)',
      });
    }

    const pairs = parsePairsFromBody(body, contractStatus);
    if (pairs.length === 0 && contractStatus !== 'draft') {
      return res.status(400).json({
        success: false,
        message:
          'Please select at least one site and device in each site (site_id and device_ids must not be empty)',
      });
    }

    const deviceIdList = [...new Set(pairs.flatMap((p) => p.device_ids))];
    const oldContractIdVal =
      body.old_contract_id != null && body.old_contract_id !== ''
        ? parseInt(body.old_contract_id, 10)
        : null;

    if (deviceIdList.length > 0 && !oldContractIdVal) {
      const taken = await slc.findDevicesOnOtherContracts(conn, deviceIdList, null);
      if (taken.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            'Some devices are already associated with other contracts, please select only devices that are not already associated',
          device_ids: taken,
        });
      }
    }

    const sofValue =
      body.sof_id != null && body.sof_id !== ''
        ? String(body.sof_id).trim()
        : body.sof_name && String(body.sof_name).trim()
          ? body.sof_name.trim()
          : null;

    await conn.beginTransaction();

    let primarySlid;
    let renewHistorySaved = null;

    if (oldContractIdVal != null && !isNaN(oldContractIdVal)) {
      primarySlid = oldContractIdVal;
      const existing = await slc.fetchSiteLocationRow(conn, primarySlid);
      if (!existing) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Contract not found for renew' });
      }
      const oldSof = existing.SOF != null ? String(existing.SOF).trim() : null;

      await slc.insertSiteLocationHistory(conn, primarySlid, slc.HIST_ACTION.RENEW, {
        oldSof,
        newSof: sofValue,
      });
      renewHistorySaved = true;

      await applyContractFieldsToSlid(conn, primarySlid, body, contractStatus);

      if (sofValue && oldSof && oldSof !== sofValue) {
        await syncSofRenameToAllPeers(conn, oldSof, sofValue);
      }

      for (const p of pairs) {
        if (p.device_ids.length) await slc.assignDevicesToSlid(conn, p.site_id, p.device_ids);
      }

      const effStatus = contractStatus;
      if (
        oldSof &&
        shouldPropagateContractFields(body, existing, {
          sofChangeHistory:
            sofValue && oldSof !== sofValue ? { oldSof, newSof: sofValue } : null,
          otherEdits: true,
          isTransitionToNotRenewing: false,
        })
      ) {
        await propagateContractFieldsToSameSofPeers(
          conn,
          oldSof,
          primarySlid,
          body,
          effStatus
        );
      }
    } else {
      const targetPairs = pairs.length ? pairs : [];
      if (targetPairs.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Please provide site_device_pairs' });
      }

      primarySlid = targetPairs[0].site_id;
      const firstEx = await slc.fetchSiteLocationRow(conn, primarySlid);
      const oldSofOnCreate =
        firstEx?.SOF != null && String(firstEx.SOF).trim() !== ''
          ? String(firstEx.SOF).trim()
          : '';
      for (const p of targetPairs) {
        const ex = await slc.fetchSiteLocationRow(conn, p.site_id);
        if (!ex) continue;
        await applyContractFieldsToSlid(conn, p.site_id, body, contractStatus);
        if (p.device_ids.length) await slc.assignDevicesToSlid(conn, p.site_id, p.device_ids);
      }

      if (sofValue && oldSofOnCreate && oldSofOnCreate !== sofValue) {
        await syncSofRenameToAllPeers(conn, oldSofOnCreate, sofValue);
      }

      if (
        oldSofOnCreate &&
        shouldPropagateContractFields(body, firstEx, {
          sofChangeHistory:
            sofValue && oldSofOnCreate !== sofValue
              ? { oldSof: oldSofOnCreate, newSof: sofValue }
              : null,
          otherEdits: true,
          isTransitionToNotRenewing: false,
        })
      ) {
        await propagateContractFieldsToSameSofPeers(
          conn,
          oldSofOnCreate,
          primarySlid,
          body,
          contractStatus
        );
      } else if (contractStatus !== 'draft' && sofValue) {
        await syncSofOnSiteLocations(
          conn,
          sofValue,
          targetPairs.map((p) => p.site_id)
        );
      }
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: oldContractIdVal ? 'Contract renewed successfully' : 'Contract created successfully',
      data: {
        contract_id: primarySlid,
        renew_history_saved: renewHistorySaved,
      },
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('Error creating contract:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating contract',
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

const updateContract = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }

    const existing = await slc.fetchSiteLocationRow(conn, cid);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const body = req.body;
    const oldSofForPeers =
      existing.SOF != null && String(existing.SOF).trim() !== ''
        ? String(existing.SOF).trim()
        : '';
    const prevDbStatus = existing.status;
    const isTransitionToNotRenewing =
      body.status === 'not_renewing' &&
      prevDbStatus != null &&
      String(prevDbStatus).toLowerCase() !== 'not_renewing';
    const terminationReason =
      body.termination_reason != null ? String(body.termination_reason).trim() : '';
    if (isTransitionToNotRenewing && !terminationReason) {
      return res.status(400).json({ success: false, message: 'Please provide termination reason' });
    }

    if (body.email_acc !== undefined && !validateMultilineEmails(body.email_acc).ok) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email address(es); one per line (e.g. example@domain.com)',
      });
    }
    if (body.tel_acc !== undefined && !validateMultilineTels(body.tel_acc).ok) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid phone number(s); one per line (9–15 digits each)',
      });
    }

    await conn.beginTransaction();

    let sofChangeHistory = null;
    if (body.sof_name !== undefined) {
      const oldSof = existing.SOF != null ? String(existing.SOF).trim() : null;
      const newSof =
        body.sof_name != null && String(body.sof_name).trim() !== ''
          ? String(body.sof_name).trim()
          : null;
      if ((oldSof ?? '') !== (newSof ?? '')) {
        sofChangeHistory = { oldSof, newSof };
        await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.SOF_CHANGE, {
          oldSof,
          newSof,
        });
      }
    }

    const otherEdits = hasOtherContractEdits(existing, body, {
      skipNotRenewingStatus: isTransitionToNotRenewing,
    });
    if (otherEdits && !sofChangeHistory) {
      await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.UPDATE);
    }

    const contractStatus =
      body.status === 'draft' || body.status === 'official' || body.status === 'not_renewing'
        ? body.status
        : undefined;

    const effStatus = contractStatus ?? prevDbStatus;
    await applyContractFieldsToSlid(conn, cid, body, effStatus);

    if (
      sofChangeHistory?.oldSof &&
      sofChangeHistory?.newSof &&
      sofChangeHistory.oldSof !== sofChangeHistory.newSof
    ) {
      await syncSofRenameToAllPeers(
        conn,
        sofChangeHistory.oldSof,
        sofChangeHistory.newSof
      );
    }

    if (
      oldSofForPeers &&
      shouldPropagateContractFields(body, existing, {
        sofChangeHistory,
        otherEdits,
        isTransitionToNotRenewing,
      })
    ) {
      await propagateContractFieldsToSameSofPeers(
        conn,
        oldSofForPeers,
        cid,
        body,
        effStatus
      );
    }

    const pairs = parsePairsFromBody(body, contractStatus || prevDbStatus);
    if (body.site_device_pairs !== undefined && pairs.length > 0) {
      for (const p of pairs) {
        if (p.device_ids.length) await slc.assignDevicesToSlid(conn, p.site_id ?? cid, p.device_ids);
      }
    }

    if (body.status !== undefined && isTransitionToNotRenewing) {
      await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.TERMINATED, {
        terminatedReason: terminationReason,
      });
    }

    if (
      body.status === 'official' &&
      prevDbStatus != null &&
      String(prevDbStatus).toLowerCase() === 'not_renewing'
    ) {
      await conn.execute(
        `DELETE FROM sites_location_sof_history WHERE SLid = ? AND action_type = ?`,
        [cid, slc.HIST_ACTION.TERMINATED]
      );
    }

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: 'Contract updated successfully',
      data: { contract_id: cid },
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('Error updating contract:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating contract',
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

const getVendorStatistics = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.Vendor,
        COUNT(DISTINCT sl.SLid) AS contract_count,
        COUNT(DISTINCT d.Did) AS device_count,
        COUNT(DISTINCT sl.SLid) AS site_count
      FROM devices d
      INNER JOIN sites_location sl ON d.SLid = sl.SLid
      WHERE d.Vendor IS NOT NULL AND d.Vendor != ''
        AND sl.status = 'official'
        AND sl.SOF IS NOT NULL AND TRIM(sl.SOF) != ''
      GROUP BY d.Vendor
      ORDER BY contract_count DESC, d.Vendor ASC
    `);
    const vendorData = (rows || []).map((row) => ({
      name: row.Vendor,
      value: row.contract_count,
      deviceCount: row.device_count,
      siteCount: row.site_count,
      total: row.contract_count,
    }));
    return res.status(200).json({ success: true, data: vendorData });
  } catch (error) {
    console.error('Error getting vendor statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting vendor statistics',
      error: error.message,
    });
  }
};

const getTopSitesByContractDevice = async (req, res) => {
  try {
    const lim = parseInt(String(req.query.limit ?? '8'), 10);
    const limit = Number.isNaN(lim) ? 8 : Math.min(Math.max(lim, 1), 25);
    const ps = req.query.period_start;
    const pe = req.query.period_end_exclusive;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const usePeriod =
      ps && pe && dateRe.test(String(ps).trim()) && dateRe.test(String(pe).trim());
    const periodStart = usePeriod ? String(ps).trim() : null;
    const periodEndEx = usePeriod ? String(pe).trim() : null;
    const periodFilter = usePeriod
      ? ` AND sl.start_date IS NOT NULL AND DATE(sl.start_date) >= ? AND DATE(sl.start_date) < ?`
      : '';
    const periodBind = usePeriod ? [periodStart, periodEndEx] : [];

    const [rows] = await db.execute(
      `
      SELECT sl.SLid AS slid, s.Name AS site_name, IFNULL(l.Location2, '') AS location2,
        COUNT(DISTINCT d.Did) AS device_count,
        1 AS contract_count,
        COUNT(DISTINCT CASE
          WHEN sl.end_date IS NOT NULL AND sl.end_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
            AND sl.end_date >= CURDATE()
          THEN sl.SLid END) AS contracts_expiring_soon
      FROM sites_location sl
      INNER JOIN devices d ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE sl.SOF IS NOT NULL AND TRIM(sl.SOF) != ''${periodFilter}
      GROUP BY sl.SLid, s.Name, l.Location2
      ORDER BY device_count DESC
      LIMIT ?
      `,
      [...periodBind, limit]
    );

    const [totalRows] = await db.execute(
      `
      SELECT COUNT(DISTINCT d.Did) AS total
      FROM devices d
      INNER JOIN sites_location sl ON d.SLid = sl.SLid
      WHERE sl.SOF IS NOT NULL AND TRIM(sl.SOF) != ''${periodFilter}
      `,
      periodBind
    );
    const totalDevices = Number(totalRows[0]?.total || 0);

    const data = (rows || []).map((r, idx) => {
      const dc = Number(r.device_count || 0);
      return {
        rank: idx + 1,
        slid: r.slid,
        site_name: r.site_name || '—',
        location2: r.location2 || '',
        device_count: dc,
        contract_count: Number(r.contract_count || 0),
        contracts_expiring_soon: Number(r.contracts_expiring_soon || 0),
        pct_of_total: totalDevices > 0 ? Math.round((dc / totalDevices) * 1000) / 10 : 0,
      };
    });

    return res.status(200).json({
      success: true,
      total_devices: totalDevices,
      data,
      ...(usePeriod ? { period: { period_start: periodStart, period_end_exclusive: periodEndEx } } : {}),
    });
  } catch (error) {
    console.error('Error getting top sites by contract/device:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting top sites statistics',
      error: error.message,
    });
  }
};

const getTopSitesHeatmap = async (req, res) => {
  try {
    const siteLimit = Math.min(15, Math.max(3, parseInt(String(req.query.site_limit ?? '8'), 10) || 8));
    const contractLimit = Math.min(10, Math.max(2, parseInt(String(req.query.contract_limit ?? '5'), 10) || 5));

    const [siteRows] = await db.execute(
      `
      SELECT sl.SLid AS slid, s.Name AS site_name, IFNULL(l.Location2, '') AS location2,
        COUNT(DISTINCT d.Did) AS total_devices
      FROM sites_location sl
      INNER JOIN devices d ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE sl.SOF IS NOT NULL AND TRIM(sl.SOF) != ''
      GROUP BY sl.SLid, s.Name, l.Location2
      ORDER BY total_devices DESC
      LIMIT ?
      `,
      [siteLimit]
    );

    if (!siteRows.length) {
      return res.status(200).json({
        success: true,
        sites: [],
        contracts: [],
        matrix: [],
        max_value: 0,
      });
    }

    const slids = siteRows.map((r) => r.slid);
    const contractIds = slids.slice(0, contractLimit);
    const contractMeta = contractIds.map((cid, j) => ({
      contract_id: cid,
      short_id: String(j + 1).padStart(3, '0'),
      title: `SLid ${cid}`,
    }));
    const si = Object.fromEntries(slids.map((id, idx) => [Number(id), idx]));
    const ci = Object.fromEntries(contractIds.map((id, idx) => [id, idx]));
    const matrix = siteRows.map(() => contractIds.map(() => 0));

    for (const row of siteRows) {
      const i = si[Number(row.slid)];
      const j = ci[Number(row.slid)];
      if (i != null && j != null) matrix[i][j] = Number(row.total_devices || 0);
    }

    const flat = matrix.flat();
    const maxVal = Math.max(1, ...flat, ...siteRows.map((r) => Number(r.total_devices || 0)));

    const sites = siteRows.map((r, idx) => ({
      slid: r.slid,
      site_name: r.site_name || '—',
      location2: r.location2 || '',
      total_devices: Number(r.total_devices || 0),
      rank: idx + 1,
      contracts: [
        {
          contract_id: r.slid,
          short_id: '001',
          title: r.site_name || `SLid ${r.slid}`,
          devices: Number(r.total_devices || 0),
        },
      ],
    }));

    return res.status(200).json({
      success: true,
      sites,
      contracts: contractMeta,
      matrix,
      max_value: maxVal,
    });
  } catch (error) {
    console.error('Error getting top sites heatmap:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting top sites heatmap',
      error: error.message,
    });
  }
};

const syncContractsFromReferSof = async (req, res) => {
  const dryRun = Boolean(req.body && req.body.dry_run);
  const singleSof =
    req.body && req.body.refer_sof != null ? String(req.body.refer_sof).trim() : '';
  const startDate =
    req.body && req.body.start_date ? String(req.body.start_date).trim() : undefined;
  const endDate = req.body && req.body.end_date ? String(req.body.end_date).trim() : undefined;

  let conn;
  try {
    let referSofs = [];
    if (singleSof) {
      referSofs = [singleSof];
    } else {
      const [rows] = await db.execute(`
        SELECT DISTINCT sl.SOF AS refer_sof
        FROM devices d
        INNER JOIN sites_location sl ON d.SLid = sl.SLid
        WHERE ${sofIsValidWhere('sl')}
          AND (sl.status IS NULL OR sl.status = 'draft' OR sl.SOF IS NULL OR TRIM(sl.SOF) = '')
        ORDER BY sl.SOF ASC
      `);
      referSofs = rows.map((r) => r.refer_sof).filter(Boolean);
    }

    if (!referSofs.length) {
      return res.status(200).json({
        success: true,
        message: 'No Refer_SOF pending contract provisioning',
        data: { created: 0, linked: 0, skipped: 0, results: [] },
      });
    }

    conn = await db.getConnection();
    const results = [];
    let created = 0;
    let linked = 0;
    let skipped = 0;

    for (const referSof of referSofs) {
      try {
        const key = normalizeReferSofKey(referSof);
        const [deviceRows] = await conn.execute(
          `SELECT d.Did, d.SLid, d.Assigned_Service FROM devices d
           INNER JOIN sites_location sl ON d.SLid = sl.SLid
           WHERE (${sofMatchWhere('sl')}) AND d.SLid IS NOT NULL`,
          [referSof, key]
        );
        if (!deviceRows.length) {
          results.push({ refer_sof: referSof, action: 'skipped', reason: 'no_eligible_devices' });
          skipped += 1;
          continue;
        }

        const slid = deviceRows[0].SLid;
        if (dryRun) {
          results.push({
            refer_sof: referSof,
            action: 'would_update',
            contract_id: slid,
            device_count: deviceRows.length,
          });
          skipped += 1;
          continue;
        }

        await conn.beginTransaction();
        await slc.updateSiteLocationContract(conn, slid, {
          sof_name: referSof,
          start_date: startDate || null,
          end_date: endDate || null,
          assigned_service: deviceRows[0].Assigned_Service || '',
          status: 'official',
        });
        await conn.commit();
        results.push({
          refer_sof: referSof,
          action: 'updated',
          contract_id: slid,
          device_count: deviceRows.length,
        });
        linked += 1;
      } catch (err) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (_) {
            /* ignore */
          }
        }
        results.push({ refer_sof: referSof, action: 'error', error: err.message });
        skipped += 1;
      }
    }

    return res.status(200).json({
      success: true,
      message: dryRun
        ? `Dry run: ${referSofs.length} Refer_SOF(s) reviewed`
        : `Updated ${linked} site location(s), skipped ${skipped}`,
      data: { created, linked, skipped, dry_run: dryRun, results },
    });
  } catch (error) {
    console.error('Error syncing contracts from Refer_SOF:', error);
    return res.status(500).json({
      success: false,
      message: 'Error syncing contracts from Refer_SOF',
      error: error.message,
    });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  createContract,
  uploadContractFile,
  syncContractsFromReferSof,
  getContractsBySite,
  postContractHistoryDisplayRows,
  getContractHistoryDetailByHistoryId,
  getAvailableDevices,
  getSitesByContract,
  getDevicesByContract,
  getVendorStatistics,
  getTopSitesByContractDevice,
  getTopSitesHeatmap,
  getContractHistory,
  getContractById,
  updateContract,
};
