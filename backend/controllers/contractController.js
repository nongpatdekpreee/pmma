/**
 * Contract API — backed by sites_location (contract_id === SLid).
 * Legacy contract / contract_device / contract_history removed (see contractController.legacy.js).
 */
const db = require('../config/database');
const { DEFAULT_IN_STORE_SITE_NAME } = require('../config/inStoreSite');
const {
  normalizeReferSofKey,
  sofMatchWhere,
  siteLocationPendingContractWhere,
  PENDING_SLID_CONTRACT_SYNC_SQL,
  syncSofOnSiteLocations,
  syncSofRenameOnSiteLocations,
  findSlidsWithMatchingSof,
} = require('../config/deviceSof');
const slc = require('../lib/siteLocationContract');
const { isContractMergeEnabled } = require('../lib/featureFlags');
const { notifyTeamsContractEvent } = require('../services/teamsContractNotification');
const { notifyContractExpiringOnChange } = require('../jobs/contractExpiringReminder');
const { getTeamsActor } = require('../utils/teamsActor');
const { collectContractChanges } = require('../utils/contractChangeSummary');
const { resolveSlSofSchema } = require('../lib/slSofSchema');
const legacyContracts = require('./contractController.legacy');
const { usesLegacyContractTable } = require('../lib/contractSchemaMode');
const {
  tenantContractFilter,
  tenantDeviceFilter,
  isSlidVisibleToTenant,
} = require('../utils/tenantScope');

async function denyIfContractHidden(req, res, slid) {
  const ok = await isSlidVisibleToTenant(slid, req.user && req.user.tenant);
  if (!ok) {
    res.status(404).json({ success: false, message: 'Contract not found' });
    return true;
  }
  return false;
}

async function dispatchLegacyContract(handler, req, res) {
  if (!(await usesLegacyContractTable())) return false;
  await legacyContracts[handler](req, res);
  return true;
}

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

function jsonContact(field) {
  if (field == null) return null;
  if (typeof field === 'object') {
    if (Array.isArray(field)) return null;
    if (Object.keys(field).length === 0) return null;
    return JSON.stringify(field);
  }
  const trimmed = String(field).trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    JSON.parse(trimmed);
  } catch {
    return null;
  }
  return trimmed;
}

function contactComparable(field) {
  const j = jsonContact(field);
  if (j == null) return '';
  try {
    return JSON.stringify(JSON.parse(j));
  } catch {
    return j;
  }
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
        contact: p.contact !== undefined ? p.contact : undefined,
        province: p.province !== undefined ? (p.province != null ? String(p.province).trim() : null) : undefined,
      }))
      .filter(
        (p) =>
          p.site_id != null &&
          !isNaN(p.site_id) &&
          (p.device_ids.length > 0 || contractStatus === 'draft' || p.contact !== undefined)
      );
  }
  return pairs;
}

function bodyWithoutContact(body) {
  if (!body || body.contact === undefined) return body;
  const { contact: _omit, ...rest } = body;
  return rest;
}

function resolveContactForSlid(body, pairContact) {
  if (pairContact !== undefined) return jsonContact(pairContact);
  if (body.contact !== undefined) return jsonContact(body.contact);
  return undefined;
}

function pairContactForSlid(pairs, slid) {
  if (!Array.isArray(pairs)) return undefined;
  const id = parseInt(slid, 10);
  if (Number.isNaN(id)) return undefined;
  const match = pairs.find((p) => p.site_id === id);
  return match?.contact;
}

async function historySchemaFlags() {
  const [ts, hasTerm] = await Promise.all([
    slc.resolveHistoryTimestamp(db),
    slc.columnExists(db, 'sites_location_sof_history', 'terminated_reason'),
  ]);
  return { tsColumn: ts.column, hasTerm };
}

async function historySelectSql(tsColumn, hasTerm) {
  const col = await slc.resolveContractNameDbColumn(db, 'sites_location_sof_history');
  const nameField = col === 'contract_name' ? 'contract_name' : 'contactname AS contract_name';
  return slc.buildHistoryRowSelect(tsColumn, hasTerm, nameField);
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
  if (await dispatchLegacyContract('getContractsBySite', req, res)) return;
  try {
    const siteId = req.query.site_id;
    const expandSites = req.query.expand === 'sites';
    const lite = String(req.query.lite ?? '') === '1' || String(req.query.lite ?? '').toLowerCase() === 'true';
    const pageRaw = req.query.page != null && req.query.page !== '' ? Number(req.query.page) : null;
    const limitRaw = req.query.limit != null && req.query.limit !== '' ? Number(req.query.limit) : null;
    const usePaging =
      Number.isInteger(pageRaw) &&
      pageRaw >= 1 &&
      Number.isInteger(limitRaw) &&
      limitRaw >= 1 &&
      limitRaw <= 500;

    const listSelect = await slc.buildSlListSelect(db, req.user && req.user.tenant);
    let selectExtra = '';
    if (lite) {
      // ตัด correlated history subqueries — รายการขึ้นเร็ว; badge Renew โหลดรอบสองได้
      selectExtra = `,
        NULL AS history_status,
        NULL AS renew_hist_old_sof,
        NULL AS renew_hist_new_sof,
        NULL AS renew_hist_at,
        NULL AS hist_old_sofs`;
    } else {
      const { column: tsColumn } = await slc.resolveHistoryTimestamp(db);
      selectExtra = `,
        ${slc.HISTORY_STATUS_SUBQUERY},
        ${slc.buildRenewHistSubqueries(tsColumn)}`;
    }

    let whereSql = ` WHERE sl.status <> 'not_renewing'`;
    const params = [];
    const cf = tenantContractFilter(req.user && req.user.tenant, 'sl');
    whereSql += cf.sql;
    params.push(...cf.params);

    if (siteId) {
      const siteIdNum = parseInt(siteId, 10);
      if (!isNaN(siteIdNum)) {
        whereSql += ` AND (
          sl.SLid = ?
          OR sl.Sid = (SELECT sl0.Sid FROM sites_location sl0 WHERE sl0.SLid = ? LIMIT 1)
        )`;
        params.push(siteIdNum, siteIdNum);
      }
    }

    const orderSql = expandSites
      ? ' ORDER BY sl.created_at DESC, sl.SLid DESC, s.Name ASC'
      : ' ORDER BY sl.created_at DESC, sl.SLid DESC';

    const fromSql = `
      FROM sites_location sl
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      ${whereSql}`;

    let total = null;
    if (usePaging) {
      const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total ${fromSql}`,
        params
      );
      total = Number(countRows?.[0]?.total ?? 0);
    }

    let sql = `SELECT ${listSelect}${selectExtra} ${fromSql}${orderSql}`;
    const queryParams = [...params];
    if (usePaging) {
      const offset = (pageRaw - 1) * limitRaw;
      sql += ` LIMIT ${limitRaw} OFFSET ${offset}`;
    }

    const [rows] = await db.execute(sql, queryParams);
    const payload = { success: true, data: rows };
    if (usePaging) {
      payload.pagination = {
        page: pageRaw,
        limit: limitRaw,
        total,
        totalPages: Math.max(1, Math.ceil((total || 0) / limitRaw)),
      };
    }
    return res.status(200).json(payload);
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
  if (await dispatchLegacyContract('getContractById', req, res)) return;
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }

    const slRow = await slc.fetchSiteLocationRow(db, cid);
    if (!slRow) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    if (await denyIfContractHidden(req, res, cid)) return;

    const tf = tenantDeviceFilter(req.user && req.user.tenant, 'd');
    const [devicesRows] = await db.execute(
      `${slc.DEVICES_BY_SLID_SQL.replace('ORDER BY', `${tf.sql} ORDER BY`)}`,
      [cid, ...tf.params]
    );
    const sitesRows = [
      {
        SLid: cid,
        SiteName: slRow.site_name,
        Location2: slRow.site_location || null,
        Province: slRow.site_province || null,
      },
    ];

    const includeHistory = String(req.query.include_history ?? '1') !== '0';
    let history = [];
    if (includeHistory) {
      const { tsColumn, hasTerm } = await historySchemaFlags();
      const histSelect = await historySelectSql(tsColumn, hasTerm);
      const [histRows] = await db.execute(
        `SELECT ${histSelect}
         FROM sites_location_sof_history
         WHERE SLid = ?
         ${slc.historyOrderByClause(tsColumn)}`,
        [cid]
      );
      history = (histRows || []).map((r) => slc.mapHistoryRowToLegacy(r));
    }

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
  if (await dispatchLegacyContract('getAvailableDevices', req, res)) return;
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

    const tf = tenantDeviceFilter(req.user && req.user.tenant, 'd');
    const [rows] = await db.execute(
      `${slc.AVAILABLE_DEVICES_BASE} ${where}${tf.sql} ORDER BY d.CI_Name ASC, d.Asset_Number ASC`,
      [...params, ...tf.params]
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
  if (await dispatchLegacyContract('getSitesByContract', req, res)) return;
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    const slRow = await slc.fetchSiteLocationRow(db, cid);
    if (!slRow) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    if (await denyIfContractHidden(req, res, cid)) return;
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
  if (await dispatchLegacyContract('getDevicesByContract', req, res)) return;
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    if (await denyIfContractHidden(req, res, cid)) return;
    const tf = tenantDeviceFilter(req.user && req.user.tenant, 'd');
    const [rows] = await db.execute(
      `${slc.DEVICES_BY_SLID_SQL.replace('ORDER BY', `${tf.sql} ORDER BY`)}`,
      [cid, ...tf.params]
    );
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

/** GET /api/contracts/devices-by-slids?slids=1,2,3 — ดึง devices หลาย SLid ในคำขอเดียว (renew/edit) */
const getDevicesBySlids = async (req, res) => {
  if (await usesLegacyContractTable()) {
    return res.status(400).json({
      success: false,
      message: 'devices-by-slids requires sites_location schema',
    });
  }
  try {
    const raw = String(req.query.slids ?? '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const slids = [...new Set(raw)].slice(0, 200);
    if (slids.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const ph = slids.map(() => '?').join(',');
    const tf = tenantDeviceFilter(req.user && req.user.tenant, 'd');
    const sql = `
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
  WHERE d.SLid IN (${ph})${tf.sql}
  ORDER BY d.SLid ASC, d.CI_Name ASC, d.Asset_Number ASC`;
    const [rows] = await db.execute(sql, [...slids, ...tf.params]);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting devices by slids:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting devices by slids',
      error: error.message,
    });
  }
};

const getContractHistory = async (req, res) => {
  if (await dispatchLegacyContract('getContractHistory', req, res)) return;
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    if (await denyIfContractHidden(req, res, cid)) return;
    const { tsColumn, hasTerm } = await historySchemaFlags();
    const histSelect = await historySelectSql(tsColumn, hasTerm);
    const [rows] = await db.execute(
      `SELECT ${histSelect}
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
  if (await dispatchLegacyContract('postContractHistoryDisplayRows', req, res)) return;
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
    const histSelect = await historySelectSql(tsColumn, hasTerm);
    const histCols = histSelect
      .split(',')
      .map((c) => `h.${c.trim()}`)
      .join(', ');

    let histRows = [];
    if (contractIds.length > 0) {
      const ph = contractIds.map(() => '?').join(',');
      const [rowsMain] = await db.execute(
        `SELECT ${histSelect}
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

    const slidsAll = [...new Set(histRows.map((r) => Number(r.SLid)).filter((n) => !Number.isNaN(n)))];
    let slids = slidsAll;
    if (slids.length) {
      const cfHist = tenantContractFilter(req.user && req.user.tenant, 'sl');
      const phVis = slids.map(() => '?').join(',');
      const [visRows] = await db.execute(
        `SELECT sl.SLid FROM sites_location sl WHERE sl.SLid IN (${phVis})${cfHist.sql}`,
        [...slids, ...cfHist.params]
      );
      const visSet = new Set((visRows || []).map((r) => Number(r.SLid)));
      histRows = histRows.filter((r) => visSet.has(Number(r.SLid)));
      slids = [...visSet];
    }
    if (!histRows.length) {
      return res.status(200).json({ success: true, data: [] });
    }
    const siteBySlid = new Map();
    if (slids.length) {
      const ph2 = slids.map(() => '?').join(',');
      const [slRows] = await db.execute(
        `SELECT sl.SLid, s.Name AS site_name, IFNULL(l.Location2, '') AS site_location, IFNULL(l.Province, '') AS site_province
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
          site_province: r.site_province != null ? String(r.site_province) : '',
        });
      }
    }

    const deviceCountBySlid = new Map();
    if (slids.length) {
      const ph3 = slids.map(() => '?').join(',');
      const tfCount = tenantDeviceFilter(req.user && req.user.tenant, 'devices');
      const [countRows] = await db.execute(
        `SELECT SLid, COUNT(*) AS cnt FROM devices WHERE SLid IN (${ph3})${tfCount.sql} GROUP BY SLid`,
        [...slids, ...tfCount.params]
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
        contract_site_province: sl?.site_province || null,
        site_name: sl?.site_name ?? null,
        site_location: sl?.site_location ?? null,
        site_province: sl?.site_province ?? null,
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
  if (await dispatchLegacyContract('getContractHistoryDetailByHistoryId', req, res)) return;
  try {
    const hid = parseInt(String(req.params.historyId), 10);
    if (Number.isNaN(hid) || hid <= 0) {
      return res.status(400).json({ success: false, message: 'history_id is not valid' });
    }

    const { tsColumn, hasTerm } = await historySchemaFlags();
    const histSelect = await historySelectSql(tsColumn, hasTerm);
    const [rows] = await db.execute(
      `SELECT ${histSelect}
       FROM sites_location_sof_history WHERE log_id = ?`,
      [hid]
    );
    if (!rows?.length) {
      return res.status(404).json({ success: false, message: 'Contract history not found' });
    }

    const histRow = rows[0];
    const legacy = slc.mapHistoryRowToLegacy(histRow);
    const cid = Number(histRow.SLid);
    if (await denyIfContractHidden(req, res, cid)) return;

    const slRow = await slc.fetchSiteLocationRow(db, cid);
    const siteInfo = slRow
      ? { site_name: slRow.site_name, site_location: slRow.site_location }
      : {};
    const liveDetail = slRow ? slc.mapSlRowToContractDetail(slRow) : null;
    const snap = slc.mapHistoryRowToContractDetail(histRow, siteInfo);
    const merged = slc.mergeHistoryDetailWithLive(snap, liveDetail);
    const tfHistDev = tenantDeviceFilter(req.user && req.user.tenant, 'd');
    const [devicesRows] = await db.execute(
      slc.DEVICES_BY_SLID_SQL.replace('ORDER BY', `${tfHistDev.sql} ORDER BY`),
      [cid, ...tfHistDev.params]
    );

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
  if (body.contact !== undefined && contactComparable(body.contact) !== contactComparable(existing.contact)) {
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
  if (body.contract_name !== undefined) {
    const inc = normStr(body.contract_name);
    const cur = normStr(slc.resolveContractNameFromRow(existing));
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

/** บันทึกประวัติ SOF ให้ทุก SLid ในรายการ (ยกเว้น excludeSlid ถ้าระบุ) */
async function recordSofChangeHistoryForSlids(
  conn,
  slids,
  { oldSof, newSof },
  { excludeSlid = null, action = slc.HIST_ACTION.SOF_CHANGE } = {}
) {
  const oldT = oldSof != null ? String(oldSof).trim() : '';
  const newT = newSof != null ? String(newSof).trim() : '';
  if (!oldT || !newT || oldT === newT) return;
  const excludeNum =
    excludeSlid != null && !Number.isNaN(parseInt(excludeSlid, 10))
      ? parseInt(excludeSlid, 10)
      : null;
  for (const slid of slids) {
    const id = parseInt(slid, 10);
    if (Number.isNaN(id)) continue;
    if (excludeNum != null && id === excludeNum) continue;
    await slc.insertSiteLocationHistory(conn, id, action, { oldSof: oldT, newSof: newT });
  }
}

/** แพร่ฟิลด์สัญญาไปทุก sites_location ที่ SOF ตรงกัน (ยกเว้นแถวที่แก้) — บันทึกประวัติก่อนอัปเดตแต่ละแถว */
async function propagateContractFieldsToSameSofPeers(
  conn,
  matchSof,
  excludeSlid,
  body,
  contractStatus
) {
  const peerSlids = await findSlidsWithMatchingSof(conn, matchSof, excludeSlid);
  for (const slid of peerSlids) {
    const peerRow = await slc.fetchSiteLocationRow(conn, slid);
    if (peerRow) {
      const peerOldSof = peerRow.SOF != null ? String(peerRow.SOF).trim() : null;
      await slc.insertSiteLocationHistory(conn, slid, slc.HIST_ACTION.UPDATE, { oldSof: peerOldSof });
    }
    await applyContractFieldsToSlid(conn, slid, bodyWithoutContact(body), contractStatus, {
      persistContractName: false,
    });
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

async function applyContractFieldsToSlid(conn, slid, body, contractStatus, options = {}) {
  const { persistContractName = true, contact: contactOverride } = options;
  const isDraft = String(contractStatus ?? '').trim().toLowerCase() === 'draft';
  const fields = { status: contractStatus };

  if (body.sof_name !== undefined || body.sof_id !== undefined) {
    const sofValue =
      body.sof_id != null && body.sof_id !== ''
        ? String(body.sof_id).trim()
        : body.sof_name && String(body.sof_name).trim()
          ? body.sof_name.trim()
          : null;
    // draft + empty → keep existing SOF (incomplete draft must not wipe)
    if (!(isDraft && (sofValue == null || sofValue === ''))) {
      fields.sof_name = sofValue;
    }
  }
  if (persistContractName && body.contract_name !== undefined) {
    const nameVal =
      body.contract_name != null && String(body.contract_name).trim() !== ''
        ? String(body.contract_name).trim()
        : null;
    if (!(isDraft && nameVal == null)) {
      fields.contract_name = nameVal;
    }
  }
  if (body.start_date !== undefined) {
    const v = body.start_date || null;
    if (!(isDraft && !v)) fields.start_date = v;
  }
  if (body.end_date !== undefined) {
    const v = body.end_date || null;
    if (!(isDraft && !v)) fields.end_date = v;
  }
  if (body.sla_term !== undefined) {
    const raw = body.sla_term != null && String(body.sla_term).trim() !== ''
      ? parseInt(String(body.sla_term).trim(), 10)
      : NaN;
    if (!(isDraft && isNaN(raw))) {
      fields.sla_term = isNaN(raw) ? 2 : raw;
    }
  }
  if (body.assigned_service !== undefined) {
    const svc =
      body.assigned_service && String(body.assigned_service).trim()
        ? body.assigned_service.trim()
        : '';
    if (!(isDraft && !svc)) {
      fields.assigned_service = svc;
    }
  }
  if (body.sale_account !== undefined) {
    const v = body.sale_account?.trim() || null;
    if (!(isDraft && v == null)) fields.sale_account = v;
  }
  if (body.tel_acc !== undefined) {
    const v =
      body.tel_acc != null && String(body.tel_acc).trim() !== '' ? String(body.tel_acc).trim() : null;
    if (!(isDraft && v == null)) fields.tel_acc = v;
  }
  if (body.email_acc !== undefined) {
    const v =
      body.email_acc != null && String(body.email_acc).trim() !== ''
        ? String(body.email_acc).trim()
        : '';
    if (!(isDraft && !v)) fields.email_acc = v;
  }
  if (body.coverage_scope !== undefined) {
    const v = body.coverage_scope?.trim() || null;
    if (!(isDraft && v == null)) fields.coverage_scope = v;
  }
  if (contactOverride !== undefined) {
    fields.contact = jsonContact(contactOverride);
  } else if (body.contact !== undefined) {
    fields.contact = jsonContact(body.contact);
  }
  if (body.file_paths !== undefined) fields.file_paths = jsonPaths(body.file_paths);
  if (body.image_paths !== undefined) fields.image_paths = jsonPaths(body.image_paths);
  if (body.pm_time_per_year !== undefined) {
    const pmRaw = body.pm_time_per_year != null ? String(body.pm_time_per_year).trim() : '';
    if (!(isDraft && !pmRaw)) {
      fields.pm_time_per_year = ['1', '2', '3', '4', '5'].includes(pmRaw) ? pmRaw : '2';
    }
  }

  await slc.updateSiteLocationContract(conn, slid, fields);
}

async function maybeNotifyTeamsContract(slid, { event, meta = {}, actor = null, changes = [] }) {
  try {
    const slRow = await slc.fetchSiteLocationRow(db, slid);
    if (!slRow) return;
    const [devicesRows] = await db.execute(slc.DEVICES_BY_SLID_SQL, [slid]);
    await notifyTeamsContractEvent({
      event,
      contract: slc.mapSlRowToContractDetail(slRow),
      devices: devicesRows,
      meta: { ...meta, actor, changes },
    });
    void notifyContractExpiringOnChange(slid).catch((err) => {
      console.error('[contract] Expiring Teams notification failed:', err?.message || err);
    });
  } catch (err) {
    console.error('[contract] Teams notification failed:', err?.message || err);
  }
}

const createContract = async (req, res) => {
  if (await dispatchLegacyContract('createContract', req, res)) return;
  const conn = await db.getConnection();
  try {
    const body = req.body;
    const contractStatus = body.status === 'draft' || body.status === 'official' ? body.status : 'official';

    if (!validateMultilineEmails(body.email_acc).ok) {
      if (contractStatus !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Please provide valid email address(es); one per line (e.g. example@domain.com)',
        });
      }
    }
    if (!validateMultilineTels(body.tel_acc).ok) {
      if (contractStatus !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Please provide valid phone number(s); one per line (9–15 digits each)',
        });
      }
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

    if (contractStatus === 'official') {
      const name =
        body.contract_name != null && String(body.contract_name).trim() !== ''
          ? String(body.contract_name).trim()
          : '';
      if (name.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Please enter Contract Name (at least 3 characters)',
        });
      }
      const sofValueCheck =
        body.sof_id != null && body.sof_id !== ''
          ? String(body.sof_id).trim()
          : body.sof_name && String(body.sof_name).trim()
            ? String(body.sof_name).trim()
            : '';
      if (!sofValueCheck) {
        return res.status(400).json({
          success: false,
          message: 'Please select or enter SOF',
        });
      }
      const svc =
        body.assigned_service != null && String(body.assigned_service).trim() !== ''
          ? String(body.assigned_service).trim()
          : '';
      if (!svc) {
        return res.status(400).json({
          success: false,
          message: 'Please select or enter Service',
        });
      }
      const sd = body.start_date != null ? String(body.start_date).trim() : '';
      const ed = body.end_date != null ? String(body.end_date).trim() : '';
      if (!sd || !ed) {
        return res.status(400).json({
          success: false,
          message: 'Please enter Start Date and End Date',
        });
      }
      if (ed < sd) {
        return res.status(400).json({
          success: false,
          message: 'End Date must be on or after Start Date',
        });
      }
    }

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
      const oldStart =
        existing.start_date != null ? String(existing.start_date).slice(0, 10) : '—';
      const oldEnd = existing.end_date != null ? String(existing.end_date).slice(0, 10) : '—';
      const isRenewDraft = contractStatus === 'draft';

      if (isRenewDraft) {
        /**
         * Renew → draft (in-place): overwrite primary only; keep peer rows official.
         * History "RenewDraft" stores previous values + old_sof before the update.
         */
        await slc.insertSiteLocationHistory(conn, primarySlid, slc.HIST_ACTION.RENEW_DRAFT, {
          oldSof,
          newSof: sofValue,
          terminatedReason: `Renew draft (not finalized). Previous SOF: ${oldSof || '—'}; previous period: ${oldStart} – ${oldEnd}`,
        });
        renewHistorySaved = true;

        await applyContractFieldsToSlid(conn, primarySlid, bodyWithoutContact(body), contractStatus, {
          contact: pairContactForSlid(pairs, primarySlid),
        });

        for (const p of pairs) {
          if (p.site_id !== primarySlid) continue;
          if (p.province !== undefined) {
            await slc.updateLocationProvinceBySlid(conn, p.site_id, p.province);
          }
          if (p.device_ids.length) await slc.assignDevicesToSlid(conn, p.site_id, p.device_ids);
        }
      } else {
        /** จับคู่ก่อนเปลี่ยน SOF/วันที่ — ใช้ sync วันที่ไปทุก location ที่ SOF เดิม */
        const renewPeerSlids = oldSof
          ? await findSlidsWithMatchingSof(conn, oldSof, primarySlid)
          : [];

        await slc.insertSiteLocationHistory(conn, primarySlid, slc.HIST_ACTION.RENEW, {
          oldSof,
          newSof: sofValue,
        });
        renewHistorySaved = true;

        await applyContractFieldsToSlid(conn, primarySlid, bodyWithoutContact(body), contractStatus, {
          contact: pairContactForSlid(pairs, primarySlid),
        });

        for (const slid of renewPeerSlids) {
          const peerRow = await slc.fetchSiteLocationRow(conn, slid);
          if (!peerRow) continue;
          const peerOldSof = peerRow.SOF != null ? String(peerRow.SOF).trim() : null;
          await slc.insertSiteLocationHistory(conn, slid, slc.HIST_ACTION.RENEW, {
            oldSof: peerOldSof,
            newSof: sofValue,
          });
          await applyContractFieldsToSlid(conn, slid, bodyWithoutContact(body), contractStatus, {
            persistContractName: false,
            contact: pairContactForSlid(pairs, slid),
          });
        }

        if (sofValue && oldSof && oldSof !== sofValue) {
          await syncSofRenameToAllPeers(conn, oldSof, sofValue);
        }

        for (const p of pairs) {
          if (p.province !== undefined) {
            await slc.updateLocationProvinceBySlid(conn, p.site_id, p.province);
          }
          if (p.device_ids.length) await slc.assignDevicesToSlid(conn, p.site_id, p.device_ids);
        }
      }
    } else {
      const targetPairs = pairs.length ? pairs : [];
      if (targetPairs.length === 0) {
        if (contractStatus === 'draft') {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message:
              'Draft still needs at least one site/location selected (other fields may be incomplete)',
          });
        }
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Please provide site_device_pairs' });
      }

      primarySlid = targetPairs[0].site_id;
      const bodySiteId =
        body.site_id != null && body.site_id !== '' ? parseInt(body.site_id, 10) : NaN;
      /** Create = สัญญา/SOF ใหม่ — INSERT SLid ใหม่ต่อ location (ไม่ทับสัญญาเดิม) */
      const createdSlidByRef = new Map();
      for (const p of targetPairs) {
        const refSlid = p.site_id;
        const ex = await slc.fetchSiteLocationRow(conn, refSlid);
        if (!ex) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Site location not found (SLid ${refSlid})`,
          });
        }
        const prevSof = ex.SOF != null ? String(ex.SOF).trim() : null;
        const newSlid = await slc.insertSiteLocationContract(conn, ex.Sid, ex.lid, {});
        createdSlidByRef.set(refSlid, newSlid);

        await applyContractFieldsToSlid(conn, newSlid, bodyWithoutContact(body), contractStatus, {
          contact: p.contact,
        });
        if (p.province !== undefined) {
          await slc.updateLocationProvinceBySlid(conn, refSlid, p.province);
        }
        await slc.insertSiteLocationHistory(conn, newSlid, slc.HIST_ACTION.UPDATE, {
          oldSof: prevSof || null,
          newSof: sofValue,
        });

        if (p.device_ids.length) {
          try {
            await slc.assignDevicesFromBangnaToSlid(conn, newSlid, p.device_ids);
          } catch (assignErr) {
            await conn.rollback();
            if (assignErr.code === 'DEVICES_NOT_AT_BANGNA') {
              return res.status(400).json({
                success: false,
                message: assignErr.message,
                device_ids: assignErr.device_ids,
              });
            }
            throw assignErr;
          }
          if (contractStatus === 'official') {
            await slc.reconcileInStoreDevicesAtSlid(conn, newSlid, p.device_ids);
          }
        }
      }

      primarySlid = createdSlidByRef.get(targetPairs[0].site_id) ?? targetPairs[0].site_id;
      if (
        !Number.isNaN(bodySiteId) &&
        targetPairs.some((p) => p.site_id === bodySiteId) &&
        createdSlidByRef.has(bodySiteId)
      ) {
        primarySlid = createdSlidByRef.get(bodySiteId);
      }
    }

    await conn.commit();

    const isRenewDraftSave =
      oldContractIdVal != null && !isNaN(oldContractIdVal) && contractStatus === 'draft';
    if (!isRenewDraftSave) {
      void maybeNotifyTeamsContract(primarySlid, {
        event: oldContractIdVal ? 'renewed' : 'created',
        actor: getTeamsActor(req.user),
      });
    }

    return res.status(201).json({
      success: true,
      message: isRenewDraftSave
        ? 'Renew saved as draft'
        : oldContractIdVal
          ? 'Contract renewed successfully'
          : 'Contract created successfully',
      data: {
        contract_id: primarySlid,
        renew_history_saved: renewHistorySaved,
        renew_draft: isRenewDraftSave || undefined,
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
  if (await dispatchLegacyContract('updateContract', req, res)) return;
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
    if (await denyIfContractHidden(req, res, cid)) return;

    const body = req.body;
    const oldSofForPeers =
      existing.SOF != null && String(existing.SOF).trim() !== ''
        ? String(existing.SOF).trim()
        : '';
    const prevDbStatus = existing.status;
    const prevStatusNorm =
      prevDbStatus != null ? String(prevDbStatus).trim().toLowerCase() : '';
    const isTransitionToNotRenewing =
      body.status === 'not_renewing' &&
      prevDbStatus != null &&
      String(prevDbStatus).toLowerCase() !== 'not_renewing';
    const isFinalizeRenewDraft =
      prevStatusNorm === 'draft' &&
      body.status === 'official';
    const terminationReason =
      body.termination_reason != null ? String(body.termination_reason).trim() : '';
    if (isTransitionToNotRenewing && !terminationReason) {
      return res.status(400).json({ success: false, message: 'Please provide termination reason' });
    }

    if (
      body.email_acc !== undefined &&
      !validateMultilineEmails(body.email_acc).ok &&
      body.status !== 'draft'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email address(es); one per line (e.g. example@domain.com)',
      });
    }
    if (
      body.tel_acc !== undefined &&
      !validateMultilineTels(body.tel_acc).ok &&
      body.status !== 'draft'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid phone number(s); one per line (9–15 digits each)',
      });
    }

    const nextStatusForValidation =
      body.status === 'draft' || body.status === 'official' || body.status === 'not_renewing'
        ? body.status
        : String(prevDbStatus ?? 'official').trim().toLowerCase() === 'draft'
          ? 'draft'
          : 'official';
    if (nextStatusForValidation === 'official' || isFinalizeRenewDraft) {
      const nameRaw =
        body.contract_name !== undefined
          ? body.contract_name
          : existing.contract_name ?? existing.contactname;
      const name =
        nameRaw != null && String(nameRaw).trim() !== '' ? String(nameRaw).trim() : '';
      if (name.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Please enter Contract Name (at least 3 characters)',
        });
      }
      const sofRaw =
        body.sof_name !== undefined
          ? body.sof_name
          : existing.SOF;
      const sofVal = sofRaw != null && String(sofRaw).trim() !== '' ? String(sofRaw).trim() : '';
      if (!sofVal) {
        return res.status(400).json({
          success: false,
          message: 'Please select or enter SOF',
        });
      }
      const svcRaw =
        body.assigned_service !== undefined
          ? body.assigned_service
          : existing.Assigned_Service;
      const svc = svcRaw != null && String(svcRaw).trim() !== '' ? String(svcRaw).trim() : '';
      if (!svc) {
        return res.status(400).json({
          success: false,
          message: 'Please select or enter Service',
        });
      }
      const sd =
        body.start_date !== undefined
          ? body.start_date != null
            ? String(body.start_date).trim()
            : ''
          : existing.start_date != null
            ? String(existing.start_date).slice(0, 10)
            : '';
      const ed =
        body.end_date !== undefined
          ? body.end_date != null
            ? String(body.end_date).trim()
            : ''
          : existing.end_date != null
            ? String(existing.end_date).slice(0, 10)
            : '';
      if (!sd || !ed) {
        return res.status(400).json({
          success: false,
          message: 'Please enter Start Date and End Date',
        });
      }
      if (ed < sd) {
        return res.status(400).json({
          success: false,
          message: 'End Date must be on or after Start Date',
        });
      }
    }

    await conn.beginTransaction();

    /** Latest Renew Draft row (if any) — used when publishing draft → official */
    let renewDraftOrigin = null;
    if (isFinalizeRenewDraft) {
      const [draftHistRows] = await conn.execute(
        `SELECT old_sof, start_date, end_date, SOF, terminated_reason
         FROM sites_location_sof_history
         WHERE SLid = ? AND action_type = ?
         ORDER BY log_id DESC
         LIMIT 1`,
        [cid, slc.HIST_ACTION.RENEW_DRAFT]
      );
      renewDraftOrigin = draftHistRows?.[0] || null;
    }

    let sofChangeHistory = null;
    if (body.sof_name !== undefined) {
      const oldSof = existing.SOF != null ? String(existing.SOF).trim() : null;
      const newSof =
        body.sof_name != null && String(body.sof_name).trim() !== ''
          ? String(body.sof_name).trim()
          : null;
      if ((oldSof ?? '') !== (newSof ?? '')) {
        sofChangeHistory = { oldSof, newSof };
        if (!renewDraftOrigin) {
          await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.SOF_CHANGE, {
            oldSof,
            newSof,
          });
        }
      }
    }

    const otherEdits = hasOtherContractEdits(existing, body, {
      skipNotRenewingStatus: isTransitionToNotRenewing,
    });
    const existingSofForHistory =
      existing.SOF != null && String(existing.SOF).trim() !== ''
        ? String(existing.SOF).trim()
        : null;

    if (renewDraftOrigin) {
      const originOldSof =
        renewDraftOrigin.old_sof != null && String(renewDraftOrigin.old_sof).trim() !== ''
          ? String(renewDraftOrigin.old_sof).trim()
          : existingSofForHistory;
      const newSofForRenew =
        body.sof_name != null && String(body.sof_name).trim() !== ''
          ? String(body.sof_name).trim()
          : existingSofForHistory;
      await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.RENEW, {
        oldSof: originOldSof,
        newSof: newSofForRenew,
        terminatedReason: 'Finalized renew draft',
      });
    } else if (otherEdits && !sofChangeHistory) {
      await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.UPDATE, {
        oldSof: existingSofForHistory,
      });
    }

    const contractStatus =
      body.status === 'draft' || body.status === 'official' || body.status === 'not_renewing'
        ? body.status
        : undefined;

    const effStatus = contractStatus ?? prevDbStatus;
    const syncSofRenameAll = body.sync_sof_rename_to_all_peers === true;
    /** จับคู่ก่อนอัปเดตแถวปัจจุบัน — ใช้ sync SOF + period ไปทุก location ที่ใช้เลข SOF เดิม */
    let peerSlidsWithOldSof = [];
    if (syncSofRenameAll && oldSofForPeers) {
      peerSlidsWithOldSof = await findSlidsWithMatchingSof(conn, oldSofForPeers);
    }

    const pairs = parsePairsFromBody(body, contractStatus || prevDbStatus);
    const primaryContact = pairContactForSlid(pairs, cid);

    await applyContractFieldsToSlid(conn, cid, bodyWithoutContact(body), effStatus, {
      ...(primaryContact != null && jsonContact(primaryContact) != null
        ? { contact: primaryContact }
        : {}),
    });

    if (renewDraftOrigin) {
      const originOldSof =
        renewDraftOrigin.old_sof != null && String(renewDraftOrigin.old_sof).trim() !== ''
          ? String(renewDraftOrigin.old_sof).trim()
          : null;
      const newSofForPeers =
        body.sof_name != null && String(body.sof_name).trim() !== ''
          ? String(body.sof_name).trim()
          : existingSofForHistory;
      const renewPeerSlids = originOldSof
        ? await findSlidsWithMatchingSof(conn, originOldSof, cid)
        : [];
      for (const slid of renewPeerSlids) {
        const peerRow = await slc.fetchSiteLocationRow(conn, slid);
        if (!peerRow) continue;
        const peerStatus = String(peerRow.status ?? '').trim().toLowerCase();
        if (peerStatus === 'not_renewing') continue;
        const peerOldSof = peerRow.SOF != null ? String(peerRow.SOF).trim() : null;
        await slc.insertSiteLocationHistory(conn, slid, slc.HIST_ACTION.RENEW, {
          oldSof: peerOldSof,
          newSof: newSofForPeers,
          terminatedReason: 'Finalized renew draft (peer)',
        });
        await applyContractFieldsToSlid(conn, slid, bodyWithoutContact(body), 'official', {
          persistContractName: false,
          contact: pairContactForSlid(pairs, slid),
        });
      }
      if (originOldSof && newSofForPeers && originOldSof !== newSofForPeers) {
        await syncSofRenameToAllPeers(conn, originOldSof, newSofForPeers);
      }
    } else {
      const syncAllPeersOnSofRename =
        syncSofRenameAll &&
        sofChangeHistory?.oldSof &&
        sofChangeHistory?.newSof &&
        sofChangeHistory.oldSof !== sofChangeHistory.newSof;

      if (syncAllPeersOnSofRename) {
        await recordSofChangeHistoryForSlids(
          conn,
          peerSlidsWithOldSof,
          {
            oldSof: sofChangeHistory.oldSof,
            newSof: sofChangeHistory.newSof,
          },
          { excludeSlid: cid }
        );
        for (const slid of peerSlidsWithOldSof) {
          if (slid === cid) continue;
          await applyContractFieldsToSlid(conn, slid, bodyWithoutContact(body), effStatus, {
            persistContractName: false,
          });
        }
      } else {
        const peerBody =
          sofChangeHistory && !syncSofRenameAll
            ? bodyWithoutContact({ ...body, sof_name: undefined, sof_id: undefined })
            : bodyWithoutContact(body);

        if (
          oldSofForPeers &&
          shouldPropagateContractFields(peerBody, existing, {
            sofChangeHistory: syncSofRenameAll ? sofChangeHistory : null,
            otherEdits,
            isTransitionToNotRenewing,
          })
        ) {
          await propagateContractFieldsToSameSofPeers(
            conn,
            oldSofForPeers,
            cid,
            peerBody,
            effStatus
          );
        }
      }
    }

    if (body.site_device_pairs !== undefined && pairs.length > 0) {
      for (const p of pairs) {
        const targetSlid = p.site_id ?? cid;
        if (p.contact != null && jsonContact(p.contact) != null) {
          await applyContractFieldsToSlid(conn, targetSlid, {}, effStatus, {
            contact: p.contact,
          });
        }
        if (p.province !== undefined) {
          await slc.updateLocationProvinceBySlid(conn, targetSlid, p.province);
        }
        if (p.device_ids.length) await slc.assignDevicesToSlid(conn, targetSlid, p.device_ids);
      }
    }

    if (body.status !== undefined && isTransitionToNotRenewing) {
      await slc.insertSiteLocationHistory(conn, cid, slc.HIST_ACTION.TERMINATED, {
        terminatedReason: terminationReason,
        oldSof: existingSofForHistory,
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

    let notifyEvent = 'updated';
    const notifyMeta = {};
    if (isTransitionToNotRenewing) {
      notifyEvent = 'terminated';
      notifyMeta.terminationReason = terminationReason;
    } else if (renewDraftOrigin) {
      notifyEvent = 'renewed';
    } else if (sofChangeHistory) {
      notifyEvent = 'sof_changed';
      notifyMeta.oldSof = sofChangeHistory.oldSof;
      notifyMeta.newSof = sofChangeHistory.newSof;
    }
    const contractChanges = collectContractChanges(existing, body, {
      skipNotRenewingStatus: isTransitionToNotRenewing,
    });
    void maybeNotifyTeamsContract(cid, {
      event: notifyEvent,
      meta: notifyMeta,
      actor: getTeamsActor(req.user),
      changes: contractChanges,
    });

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
    const slSof = await resolveSlSofSchema();
    const [rows] = await db.execute(`
      SELECT d.Vendor,
        COUNT(DISTINCT sl.SLid) AS contract_count,
        COUNT(DISTINCT d.Did) AS device_count,
        COUNT(DISTINCT sl.SLid) AS site_count
      FROM devices d
      INNER JOIN sites_location sl ON d.SLid = sl.SLid
      WHERE d.Vendor IS NOT NULL AND d.Vendor != ''
        AND ${slSof.officialContractWhere('sl')}
        AND ${slSof.sofIsValidWhere('sl')}
        ${tenantDeviceFilter(req.user && req.user.tenant, 'd').sql}
        ${tenantContractFilter(req.user && req.user.tenant, 'sl').sql}
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
    const slSof = await resolveSlSofSchema();
    const periodPart = await slSof.periodStartFilter('sl', usePeriod);
    const periodFilter = periodPart.sql;
    const periodBind = usePeriod ? [periodStart, periodEndEx] : [];
    const expiringExpr = await slSof.expiringSoonExpr('sl');

    const [rows] = await db.execute(
      `
      SELECT sl.SLid AS slid, s.Name AS site_name, IFNULL(l.Location2, '') AS location2,
        COUNT(DISTINCT d.Did) AS device_count,
        1 AS contract_count,
        ${expiringExpr} AS contracts_expiring_soon
      FROM sites_location sl
      INNER JOIN devices d ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE ${slSof.sofIsValidWhere('sl')}${periodFilter}
        ${tenantDeviceFilter(req.user && req.user.tenant, 'd').sql}
        ${tenantContractFilter(req.user && req.user.tenant, 'sl').sql}
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
      WHERE ${slSof.sofIsValidWhere('sl')}${periodFilter}
        ${tenantDeviceFilter(req.user && req.user.tenant, 'd').sql}
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
    const slSof = await resolveSlSofSchema();

    const [siteRows] = await db.execute(
      `
      SELECT sl.SLid AS slid, s.Name AS site_name, IFNULL(l.Location2, '') AS location2,
        COUNT(DISTINCT d.Did) AS total_devices
      FROM sites_location sl
      INNER JOIN devices d ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE ${slSof.sofIsValidWhere('sl')}
        ${tenantDeviceFilter(req.user && req.user.tenant, 'd').sql}
        ${tenantContractFilter(req.user && req.user.tenant, 'sl').sql}
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
  if (await dispatchLegacyContract('syncContractsFromReferSof', req, res)) return;
  const dryRun = Boolean(req.body && req.body.dry_run);
  const singleSof =
    req.body && req.body.refer_sof != null ? String(req.body.refer_sof).trim() : '';
  const startDate =
    req.body && req.body.start_date ? String(req.body.start_date).trim() : undefined;
  const endDate = req.body && req.body.end_date ? String(req.body.end_date).trim() : undefined;

  let conn;
  try {
    let pendingRows = [];
    if (singleSof) {
      const key = normalizeReferSofKey(singleSof);
      const [rows] = await db.execute(
        `SELECT sl.SLid,
                sl.SOF AS refer_sof,
                MAX(d.Assigned_Service) AS Assigned_Service
         FROM devices d
         INNER JOIN sites_location sl ON d.SLid = sl.SLid
         WHERE (${sofMatchWhere('sl')})
           AND d.SLid IS NOT NULL
           AND ${siteLocationPendingContractWhere('sl')}
         GROUP BY sl.SLid, sl.SOF
         ORDER BY sl.SLid ASC`,
        [singleSof, key]
      );
      pendingRows = rows || [];
    } else {
      const [rows] = await db.execute(PENDING_SLID_CONTRACT_SYNC_SQL);
      pendingRows = rows || [];
    }

    if (!pendingRows.length) {
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

    for (const row of pendingRows) {
      const referSof = row.refer_sof;
      const slid = row.SLid;
      if (!referSof || slid == null) {
        skipped += 1;
        continue;
      }

      try {
        const [deviceRows] = await conn.execute(
          'SELECT Did FROM devices WHERE SLid = ?',
          [slid]
        );
        if (!deviceRows.length) {
          results.push({
            refer_sof: referSof,
            action: 'skipped',
            contract_id: slid,
            reason: 'no_eligible_devices',
          });
          skipped += 1;
          continue;
        }

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
          assigned_service: row.Assigned_Service || '',
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
        results.push({ refer_sof: referSof, action: 'error', contract_id: slid, error: err.message });
        skipped += 1;
      }
    }

    return res.status(200).json({
      success: true,
      message: dryRun
        ? `Dry run: ${pendingRows.length} site location(s) reviewed`
        : linked > 0
          ? `Updated ${linked} site location(s), skipped ${skipped}`
          : 'No Refer_SOF pending contract provisioning',
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

/**
 * POST /api/contracts/import-sof-details
 * Map Customer + Location + New SOF → sites_location แล้วอัปเดต contact / start_date / end_date / province
 * (ไม่สร้างสัญญาใหม่ — อัปเดตแถวที่มีอยู่แล้ว)
 */
const importSofDetails = async (req, res) => {
  if (await usesLegacyContractTable()) {
    return res.status(400).json({
      success: false,
      message: 'Import SOF details requires sites_location schema (not legacy contract table)',
    });
  }

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: 'No rows to import' });
  }

  const normText = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const {
    parseTelLineFromDb,
    formatTelLineForDb,
    looksLikePhoneLine,
  } = require('../utils/phoneFormat');

  const looksLikeEmail = (line) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(line).trim());

  const parseContactBlob = (raw) => {
    const lines = String(raw ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let name = '';
    let tel = '';
    let email = '';
    const nameParts = [];
    for (const line of lines) {
      if (!email && looksLikeEmail(line)) {
        email = line;
        continue;
      }
      if (!tel && looksLikePhoneLine(line)) {
        const parsed = parseTelLineFromDb(line);
        tel = formatTelLineForDb(parsed.tel, parsed.telExt);
        continue;
      }
      nameParts.push(line);
    }
    name = nameParts.join(' ').trim();
    return { name, tel, email };
  };

  const parseImportDate = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number' && value >= 10000 && value <= 1000000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + value * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  };

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const results = [];
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const rowNum = row._row != null ? Number(row._row) : i + 2;
      const customer = String(row.customer ?? row.siteName ?? row.site ?? '').trim();
      const location = String(row.location ?? row.Location2 ?? '').trim();
      const sofRaw = String(row.sof ?? row.sof_name ?? row.new_sof ?? row['New SOF'] ?? '').trim();
      const service = String(row.service ?? row.assigned_service ?? '').trim();
      const province = String(row.province ?? row.Province ?? '').trim();
      const contactRaw = row.contact;
      const startDate = parseImportDate(row.start_date ?? row.startDate);
      const endDate = parseImportDate(row.end_date ?? row.endDate);

      if (!sofRaw) {
        failed += 1;
        results.push({ row: rowNum, ok: false, reason: 'SOF is required' });
        continue;
      }
      if (!location) {
        failed += 1;
        results.push({ row: rowNum, ok: false, reason: 'Location is required' });
        continue;
      }

      const sofKey = normalizeReferSofKey(sofRaw);
      const [candidates] = await conn.execute(
        `SELECT sl.SLid,
                s.Name AS site_name,
                IFNULL(l.Location2, '') AS site_location,
                sl.SOF AS sof_name
         FROM sites_location sl
         INNER JOIN sites s ON s.Sid = sl.Sid
         LEFT JOIN location l ON l.lid = sl.lid
         WHERE (${sofMatchWhere('sl')})`,
        [sofRaw, sofKey]
      );

      let matches = Array.isArray(candidates) ? candidates : [];
      const locNorm = normText(location);
      matches = matches.filter((m) => normText(m.site_location) === locNorm);

      if (customer) {
        const custNorm = normText(customer);
        const byCustomer = matches.filter((m) => {
          const siteNorm = normText(m.site_name);
          return siteNorm === custNorm || siteNorm.includes(custNorm) || custNorm.includes(siteNorm);
        });
        if (byCustomer.length > 0) matches = byCustomer;
      }

      if (matches.length === 0) {
        failed += 1;
        results.push({
          row: rowNum,
          ok: false,
          reason: `No match for SOF "${sofRaw}" + Location "${location}"${customer ? ` + Customer "${customer}"` : ''}`,
        });
        continue;
      }
      if (matches.length > 1) {
        failed += 1;
        results.push({
          row: rowNum,
          ok: false,
          reason: `Ambiguous match (${matches.length} rows) for SOF "${sofRaw}" + Location "${location}"`,
          candidates: matches.map((m) => ({
            SLid: m.SLid,
            site: m.site_name,
            location: m.site_location,
          })),
        });
        continue;
      }

      const target = matches[0];
      const slid = Number(target.SLid);
      const fields = {};
      if (startDate) fields.start_date = startDate;
      if (endDate) fields.end_date = endDate;
      if (service) fields.assigned_service = service;

      if (contactRaw != null && String(contactRaw).trim() !== '') {
        const parsed = parseContactBlob(contactRaw);
        if (parsed.name || parsed.tel) {
          const contactObj = {
            site_contact_1: {
              name: parsed.name || '',
              ...(parsed.tel ? { tel: parsed.tel } : {}),
            },
          };
          fields.contact = JSON.stringify(contactObj);
        }
        if (parsed.email) fields.email_acc = parsed.email;
      }

      if (Object.keys(fields).length === 0 && !province) {
        failed += 1;
        results.push({
          row: rowNum,
          ok: false,
          reason: 'Nothing to update (need contact, dates, or province)',
          SLid: slid,
        });
        continue;
      }

      if (Object.keys(fields).length > 0) {
        await slc.updateSiteLocationContract(conn, slid, fields);
      }
      if (province) {
        await slc.updateLocationProvinceBySlid(conn, slid, province);
      }

      updated += 1;
      results.push({
        row: rowNum,
        ok: true,
        SLid: slid,
        site: target.site_name,
        location: target.site_location,
        sof: target.sof_name,
      });
    }

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: `Updated ${updated} row(s)${failed ? `, ${failed} failed` : ''}`,
      data: { updated, failed, results },
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    console.error('[importSofDetails]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import SOF details',
      error: error.message,
    });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * GET /api/contracts/:id/merge-candidates
 * Peers with the same SOF (active only) for Merge UI.
 */
const getMergeCandidates = async (req, res) => {
  if (!isContractMergeEnabled()) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  if (await dispatchLegacyContract('getContractById', req, res)) return;
  const conn = await db.getConnection();
  try {
    const primarySlid = parseInt(req.params.id, 10);
    if (Number.isNaN(primarySlid)) {
      return res.status(400).json({ success: false, message: 'contract_id is not valid' });
    }
    const primary = await slc.fetchSiteLocationRow(conn, primarySlid);
    if (!primary) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    if (!(await isSlidVisibleToTenant(primarySlid, req.user && req.user.tenant))) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    const sof = primary.SOF != null ? String(primary.SOF).trim() : '';
    if (!sof) {
      return res.status(400).json({
        success: false,
        message: 'Primary contract has no SOF — cannot merge',
      });
    }

    const peerSlids = await findSlidsWithMatchingSof(conn, sof, primarySlid);
    const candidates = [];
    for (const slid of peerSlids) {
      if (!(await isSlidVisibleToTenant(slid, req.user && req.user.tenant))) continue;
      const row = await slc.fetchSiteLocationRow(conn, slid);
      if (!row) continue;
      const status = String(row.status ?? '').trim().toLowerCase();
      if (status === 'not_renewing') continue;
      const detail = slc.mapSlRowToContractDetail(row);
      const tf = tenantDeviceFilter(req.user && req.user.tenant, 'devices');
      const [countRows] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM devices WHERE SLid = ?${tf.sql}`,
        [slid, ...tf.params]
      );
      const deviceCount = Number(countRows?.[0]?.cnt || 0);
      candidates.push({
        contract_id: slid,
        contract_name: detail?.contract_name || '',
        site_name: detail?.site_name || '',
        site_location: detail?.site_location || '',
        site_province: detail?.site_province || '',
        sof_name: sof,
        status: row.status,
        start_date: row.start_date,
        end_date: row.end_date,
        device_count: deviceCount,
        suggested_name:
          detail?.site_name && detail?.site_location
            ? `${detail.site_name} - ${detail.site_location}`
            : detail?.contract_name || `SLid ${slid}`,
      });
    }

    const primaryDetail = slc.mapSlRowToContractDetail(primary);
    const tfPrimary = tenantDeviceFilter(req.user && req.user.tenant, 'devices');
    const [primaryCountRows] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM devices WHERE SLid = ?${tfPrimary.sql}`,
      [primarySlid, ...tfPrimary.params]
    );
    const primaryDeviceCount = Number(primaryCountRows?.[0]?.cnt || 0);

    return res.status(200).json({
      success: true,
      data: {
        primary: {
          contract_id: primarySlid,
          contract_name: primaryDetail?.contract_name || '',
          site_name: primaryDetail?.site_name || '',
          site_location: primaryDetail?.site_location || '',
          site_province: primaryDetail?.site_province || '',
          sof_name: sof,
          status: primary.status,
          start_date: primary.start_date,
          end_date: primary.end_date,
          device_count: primaryDeviceCount,
          suggested_name:
            primaryDetail?.site_name && primaryDetail?.site_location
              ? `${primaryDetail.site_name} - ${primaryDetail.site_location}`
              : primaryDetail?.contract_name || `SLid ${primarySlid}`,
        },
        candidates,
      },
    });
  } catch (error) {
    console.error('getMergeCandidates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load merge candidates',
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/contracts/merge
 * Merge source SLids into primary (same SOF only). Moves devices, closes sources.
 * Body: { primary_slid, source_slids: number[], contract_name?: string }
 */
const mergeContracts = async (req, res) => {
  if (!isContractMergeEnabled()) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  if (await usesLegacyContractTable()) {
    return res.status(400).json({
      success: false,
      message: 'Merge is not available in legacy contract mode',
    });
  }
  const conn = await db.getConnection();
  try {
    const body = req.body || {};
    const primarySlid = parseInt(body.primary_slid, 10);
    const sourceRaw = Array.isArray(body.source_slids) ? body.source_slids : [];
    const sourceSlids = [
      ...new Set(
        sourceRaw
          .map((id) => parseInt(id, 10))
          .filter((n) => !Number.isNaN(n) && n !== primarySlid)
      ),
    ];
    const contractName =
      body.contract_name != null && String(body.contract_name).trim() !== ''
        ? String(body.contract_name).trim()
        : null;

    if (Number.isNaN(primarySlid)) {
      return res.status(400).json({ success: false, message: 'primary_slid is required' });
    }
    if (sourceSlids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one contract to merge into the primary',
      });
    }

    const primary = await slc.fetchSiteLocationRow(conn, primarySlid);
    if (!primary) {
      return res.status(404).json({ success: false, message: 'Primary contract not found' });
    }
    if (!(await isSlidVisibleToTenant(primarySlid, req.user && req.user.tenant))) {
      return res.status(404).json({ success: false, message: 'Primary contract not found' });
    }
    const primaryStatus = String(primary.status ?? '').trim().toLowerCase();
    if (primaryStatus === 'not_renewing') {
      return res.status(400).json({
        success: false,
        message: 'Cannot merge into a closed (not renewing) contract',
      });
    }
    const sof = primary.SOF != null ? String(primary.SOF).trim() : '';
    if (!sof) {
      return res.status(400).json({
        success: false,
        message: 'Primary contract has no SOF — cannot merge',
      });
    }

    const allowedPeers = new Set(
      (await findSlidsWithMatchingSof(conn, sof, primarySlid)).map((id) => parseInt(id, 10))
    );
    for (const slid of sourceSlids) {
      if (!allowedPeers.has(slid)) {
        return res.status(400).json({
          success: false,
          message: `Contract ${slid} does not share the same SOF as the primary — merge blocked`,
        });
      }
      const src = await slc.fetchSiteLocationRow(conn, slid);
      if (!src) {
        return res.status(404).json({ success: false, message: `Contract ${slid} not found` });
      }
      if (!(await isSlidVisibleToTenant(slid, req.user && req.user.tenant))) {
        return res.status(404).json({ success: false, message: `Contract ${slid} not found` });
      }
      const st = String(src.status ?? '').trim().toLowerCase();
      if (st === 'not_renewing') {
        return res.status(400).json({
          success: false,
          message: `Contract ${slid} is already closed — skip or pick another`,
        });
      }
    }

    await conn.beginTransaction();

    let devicesMoved = 0;
    const closedSlids = [];

    for (const slid of sourceSlids) {
      await slc.insertSiteLocationHistory(conn, slid, slc.HIST_ACTION.MERGE, {
        oldSof: sof,
        newSof: sof,
        terminatedReason: `Merged into SLid ${primarySlid}`,
      });

      const [devRows] = await conn.execute('SELECT Did FROM devices WHERE SLid = ?', [slid]);
      const deviceIds = (devRows || [])
        .map((r) => parseInt(r.Did, 10))
        .filter((n) => !Number.isNaN(n));
      if (deviceIds.length > 0) {
        await slc.assignDevicesToSlid(conn, primarySlid, deviceIds);
        devicesMoved += deviceIds.length;
      }

      await slc.updateSiteLocationContract(conn, slid, { status: 'not_renewing' });
      closedSlids.push(slid);
    }

    await slc.insertSiteLocationHistory(conn, primarySlid, slc.HIST_ACTION.MERGE, {
      oldSof: sof,
      newSof: sof,
      terminatedReason: `Merged from SLid(s): ${closedSlids.join(', ')}`,
    });

    if (contractName != null) {
      await slc.updateSiteLocationContract(conn, primarySlid, { contract_name: contractName });
    }

    await conn.commit();

    const [afterCountRows] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM devices WHERE SLid = ?',
      [primarySlid]
    );
    const primaryDeviceCount = Number(afterCountRows?.[0]?.cnt || 0);

    return res.status(200).json({
      success: true,
      message: 'Contracts merged successfully',
      data: {
        primary_slid: primarySlid,
        closed_slids: closedSlids,
        devices_moved: devicesMoved,
        primary_device_count: primaryDeviceCount,
        contract_name: contractName,
        sof_name: sof,
      },
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('mergeContracts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to merge contracts',
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

module.exports = {
  createContract,
  uploadContractFile,
  syncContractsFromReferSof,
  importSofDetails,
  getContractsBySite,
  postContractHistoryDisplayRows,
  getContractHistoryDetailByHistoryId,
  getAvailableDevices,
  getSitesByContract,
  getDevicesByContract,
  getDevicesBySlids,
  getVendorStatistics,
  getTopSitesByContractDevice,
  getTopSitesHeatmap,
  getContractHistory,
  getContractById,
  updateContract,
  getMergeCandidates,
  mergeContracts,
};
