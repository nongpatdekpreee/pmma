const db = require('../config/database');

function clampInt(val, { min, max, fallback }) {
  const n = parseInt(String(val ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getRange(months) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));
  const endExclusive = new Date(now);
  endExclusive.setHours(0, 0, 0, 0);
  endExclusive.setDate(1);
  endExclusive.setMonth(endExclusive.getMonth() + 1);
  return { start, endExclusive };
}

/** คำนวณช่วงจากปี (และเดือนถ้ามี) - year: ค.ศ., month: 1-12 หรือ null = ทั้งปี */
function getRangeFromYearMonth(year, month) {
  const y = parseInt(String(year ?? ''), 10);
  if (Number.isNaN(y) || y < 2000 || y > 2100) return null;
  const start = new Date(y, month != null ? month - 1 : 0, 1);
  start.setHours(0, 0, 0, 0);
  const endExclusive = new Date(start);
  if (month != null && month >= 1 && month <= 12) {
    endExclusive.setMonth(endExclusive.getMonth() + 1);
  } else {
    endExclusive.setFullYear(endExclusive.getFullYear() + 1);
  }
  return { start, endExclusive };
}

// GET /api/analytics/ma-pm?months=6
// นิยาม:
// - maCoverage: % งาน MA ที่เป็น done ต่อจำนวนงาน MA ทั้งหมดในเดือน
// - actualPM: % งาน PM ที่เป็น done ต่อจำนวนงาน PM ทั้งหมดในเดือน
const getMaPmAnalytics = async (req, res) => {
  try {
    const months = clampInt(req.query.months, { min: 1, max: 24, fallback: 6 });
    const { start, endExclusive } = getRange(months);

    // Monthly (PM/MA) completion % (month_key matches GROUP BY for ONLY_FULL_GROUP_BY)
    const [monthlyRows] = await db.execute(
      `
      SELECT
        DATE_FORMAT(t.start_date, '%Y-%m') AS month_key,
        SUM(CASE WHEN t.task_type = 'MA' THEN 1 ELSE 0 END) AS ma_total,
        SUM(CASE WHEN t.task_type = 'MA' AND t.status = 'done' THEN 1 ELSE 0 END) AS ma_done,
        SUM(CASE WHEN t.task_type = 'PM' THEN 1 ELSE 0 END) AS pm_total,
        SUM(CASE WHEN t.task_type = 'PM' AND t.status = 'done' THEN 1 ELSE 0 END) AS pm_done
      FROM tasks t
      WHERE t.start_date >= ? AND t.start_date < ?
      GROUP BY DATE_FORMAT(t.start_date, '%Y-%m')
      ORDER BY month_key ASC
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    // Vendor completion % (uses tasks.vendor_name)
    const [vendorRows] = await db.execute(
      `
      SELECT
        COALESCE(NULLIF(TRIM(t.vendor_name), ''), 'Unknown') AS vendor,
        SUM(CASE WHEN t.task_type = 'MA' THEN 1 ELSE 0 END) AS ma_total,
        SUM(CASE WHEN t.task_type = 'MA' AND t.status = 'done' THEN 1 ELSE 0 END) AS ma_done,
        SUM(CASE WHEN t.task_type = 'PM' THEN 1 ELSE 0 END) AS pm_total,
        SUM(CASE WHEN t.task_type = 'PM' AND t.status = 'done' THEN 1 ELSE 0 END) AS pm_done
      FROM tasks t
      WHERE t.start_date >= ? AND t.start_date < ?
      GROUP BY COALESCE(NULLIF(TRIM(t.vendor_name), ''), 'Unknown')
      ORDER BY vendor ASC
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    // Site completion % (uses tasks.site_name)
    const [siteRows] = await db.execute(
      `
      SELECT
        COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown') AS site,
        SUM(CASE WHEN t.task_type = 'MA' THEN 1 ELSE 0 END) AS ma_total,
        SUM(CASE WHEN t.task_type = 'MA' AND t.status = 'done' THEN 1 ELSE 0 END) AS ma_done,
        SUM(CASE WHEN t.task_type = 'PM' THEN 1 ELSE 0 END) AS pm_total,
        SUM(CASE WHEN t.task_type = 'PM' AND t.status = 'done' THEN 1 ELSE 0 END) AS pm_done
      FROM tasks t
      WHERE t.start_date >= ? AND t.start_date < ?
      GROUP BY COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown')
      ORDER BY site ASC
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    const comparisonData = monthlyRows.map((r) => {
      const monthStart = (r.month_key || '') + '-01';
      const maTotal = Number(r.ma_total || 0);
      const maDone = Number(r.ma_done || 0);
      const pmTotal = Number(r.pm_total || 0);
      const pmDone = Number(r.pm_done || 0);
      const maCoverage = maTotal > 0 ? Math.round((maDone / maTotal) * 100) : 0;
      const actualPM = pmTotal > 0 ? Math.round((pmDone / pmTotal) * 100) : 0;
      const target = 90;
      return {
        month: monthLabel(new Date(monthStart)),
        maCoverage,
        actualPM,
        target,
        gap: Math.max(0, target - actualPM),
      };
    });

    const vendorComparisonData = vendorRows.map((r) => {
      const maTotal = Number(r.ma_total || 0);
      const maDone = Number(r.ma_done || 0);
      const pmTotal = Number(r.pm_total || 0);
      const pmDone = Number(r.pm_done || 0);
      const maCoverage = maTotal > 0 ? Math.round((maDone / maTotal) * 100) : 0;
      const actualPM = pmTotal > 0 ? Math.round((pmDone / pmTotal) * 100) : 0;
      return { vendor: r.vendor, maCoverage, actualPM, gap: Math.max(0, maCoverage - actualPM) };
    });

    const siteComparisonData = siteRows.map((r) => {
      const maTotal = Number(r.ma_total || 0);
      const maDone = Number(r.ma_done || 0);
      const pmTotal = Number(r.pm_total || 0);
      const pmDone = Number(r.pm_done || 0);
      const maCoverage = maTotal > 0 ? Math.round((maDone / maTotal) * 100) : 0;
      const actualPM = pmTotal > 0 ? Math.round((pmDone / pmTotal) * 100) : 0;
      return { site: r.site, maCoverage, actualPM, gap: Math.max(0, maCoverage - actualPM) };
    });

    res.status(200).json({
      success: true,
      data: {
        months,
        range: { start: toISODate(start), endExclusive: toISODate(endExclusive) },
        comparisonData,
        vendorComparisonData,
        siteComparisonData,
      },
    });
  } catch (error) {
    console.error('[getMaPmAnalytics] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get MA–PM analytics', error: error.message });
  }
};

// GET /api/analytics/sla?months=6
// นิยาม SLA compliance (แบบง่าย):
// - เอา report ของ task ที่มี contract_id
// - pass = report.status = 'Pass'
// - คิดเป็น % pass ต่อจำนวน report ทั้งหมดในช่วงเวลา
const getSlaAnalytics = async (req, res) => {
  try {
    const months = clampInt(req.query.months, { min: 1, max: 24, fallback: 6 });
    const { start, endExclusive } = getRange(months);

    const [monthlyRows] = await db.execute(
      `
      SELECT
        DATE_FORMAT(t.start_date, '%Y-%m') AS month_key,
        COUNT(r.report_id) AS total_reports,
        SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports
      FROM report r
      INNER JOIN tasks t ON t.id = r.id
      WHERE t.contract_id IS NOT NULL
        AND t.start_date >= ? AND t.start_date < ?
      GROUP BY DATE_FORMAT(t.start_date, '%Y-%m')
      ORDER BY month_key ASC
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    const [vendorRows] = await db.execute(
      `
      SELECT
        COALESCE(NULLIF(TRIM(t.vendor_name), ''), 'Unknown') AS name,
        COUNT(r.report_id) AS total_reports,
        SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports
      FROM report r
      INNER JOIN tasks t ON t.id = r.id
      WHERE t.contract_id IS NOT NULL
        AND t.start_date >= ? AND t.start_date < ?
      GROUP BY COALESCE(NULLIF(TRIM(t.vendor_name), ''), 'Unknown')
      ORDER BY total_reports DESC, name ASC
      LIMIT 20
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    const [siteRows] = await db.execute(
      `
      SELECT
        COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown') AS name,
        COUNT(r.report_id) AS total_reports,
        SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports
      FROM report r
      INNER JOIN tasks t ON t.id = r.id
      WHERE t.contract_id IS NOT NULL
        AND t.start_date >= ? AND t.start_date < ?
      GROUP BY COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown')
      ORDER BY total_reports DESC, name ASC
      LIMIT 20
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    const lineChartData = monthlyRows.map((r) => {
      const total = Number(r.total_reports || 0);
      const pass = Number(r.pass_reports || 0);
      const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
      const monthStart = (r.month_key || '') + '-01';
      return { month: monthLabel(new Date(monthStart)), value: pct };
    });

    const vendorData = vendorRows.map((r) => {
      const total = Number(r.total_reports || 0);
      const pass = Number(r.pass_reports || 0);
      const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
      return { name: r.name, value: pct };
    });

    const siteData = siteRows.map((r) => {
      const total = Number(r.total_reports || 0);
      const pass = Number(r.pass_reports || 0);
      const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
      return { name: r.name, value: pct };
    });

    const totalReports = monthlyRows.reduce((sum, r) => sum + Number(r.total_reports || 0), 0);
    const passReports = monthlyRows.reduce((sum, r) => sum + Number(r.pass_reports || 0), 0);
    const overallPct = totalReports > 0 ? Math.round((passReports / totalReports) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        months,
        range: { start: toISODate(start), endExclusive: toISODate(endExclusive) },
        lineChartData,
        vendorData,
        siteData,
        summary: { totalReports, passReports, overallPct },
      },
    });
  } catch (error) {
    console.error('[getSlaAnalytics] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get SLA analytics', error: error.message });
  }
};

// GET /api/analytics/sla/contracts?months=6
// ตารางสำหรับหน้า SLA view all (ต่อจาก report+tasks แบบง่าย)
const getSlaContracts = async (req, res) => {
  try {
    const months = clampInt(req.query.months, { min: 1, max: 24, fallback: 6 });
    const { start, endExclusive } = getRange(months);

    const [rows] = await db.execute(
      `
      SELECT
        t.contract_id AS contract_id,
        COALESCE(NULLIF(TRIM(t.vendor_name), ''), 'Unknown') AS vendor,
        COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown') AS site,
        COUNT(r.report_id) AS total_reports,
        SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports
      FROM report r
      INNER JOIN tasks t ON t.id = r.id
      WHERE t.contract_id IS NOT NULL
        AND t.start_date >= ? AND t.start_date < ?
      GROUP BY t.contract_id, vendor, site
      ORDER BY t.contract_id DESC
      LIMIT 2000
      `,
      [toISODate(start), toISODate(endExclusive)]
    );

    const data = rows.map((r) => {
      const total = Number(r.total_reports || 0);
      const pass = Number(r.pass_reports || 0);
      const sla_percentage = total > 0 ? Math.round((pass / total) * 100) : 0;
      const status = sla_percentage >= 90 ? 'Pass' : sla_percentage >= 80 ? 'Warning' : 'Fail';
      return {
        contract_id: String(r.contract_id),
        vendor: r.vendor,
        site: r.site,
        sla_percentage,
        status,
        total_reports: total,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        months,
        range: { start: toISODate(start), endExclusive: toISODate(endExclusive) },
        contracts: data,
      },
    });
  } catch (error) {
    console.error('[getSlaContracts] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get SLA contracts', error: error.message });
  }
};

// GET /api/analytics/ma-dashboard?months=6 | ?year=2024 | ?year=2024&month=3
// Detailed MA dashboard: top equipment, top vendors, failure ranking, monthly MA counts
const getMaDashboard = async (req, res) => {
  try {
    const months = clampInt(req.query.months, { min: 1, max: 120, fallback: 6 });
    const yearParam = req.query.year;
    const monthParam = req.query.month != null && req.query.month !== '' ? parseInt(String(req.query.month), 10) : null;

    // Optional filters for MA top-model / equipment analytics
    const roleFilterRaw = req.query.role_id;
    const siteFilterRaw = req.query.sl_id;
    const roleFilter =
      roleFilterRaw != null && roleFilterRaw !== '' && !Number.isNaN(Number(roleFilterRaw))
        ? Number(roleFilterRaw)
        : null;
    const siteFilter =
      siteFilterRaw != null && siteFilterRaw !== '' && !Number.isNaN(Number(siteFilterRaw))
        ? Number(siteFilterRaw)
        : null;

    let start, endExclusive, effectiveMonths = months;
    const rangeFromYear = yearParam != null && yearParam !== '' ? getRangeFromYearMonth(parseInt(String(yearParam), 10), (monthParam >= 1 && monthParam <= 12) ? monthParam : null) : null;
    if (rangeFromYear) {
      start = rangeFromYear.start;
      endExclusive = rangeFromYear.endExclusive;
      effectiveMonths = monthParam >= 1 && monthParam <= 12 ? 1 : 12;
    } else {
      const range = getRange(months);
      start = range.start;
      endExclusive = range.endExclusive;
    }
    const startISO = toISODate(start);
    const endISO = toISODate(endExclusive);

    // 1) Monthly MA task counts by task status (month_key matches GROUP BY for ONLY_FULL_GROUP_BY)
    const [monthlyMA] = await db.execute(
      `SELECT
         DATE_FORMAT(t.start_date, '%Y-%m') AS month_key,
         COUNT(DISTINCT t.id) AS total,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'done' THEN t.id END) AS done,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'working' OR (LOWER(t.status) = 'done' AND r.id IS NULL) THEN t.id END) AS inprocess,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) <> 'done' AND t.end_date < CURDATE() THEN t.id END) AS overdue,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) NOT IN ('done', 'working') AND (t.end_date IS NULL OR t.end_date >= CURDATE()) THEN t.id END) AS pending,
         COUNT(DISTINCT CASE WHEN r.status = 'Fail' THEN t.id END) AS report_fail,
         COUNT(DISTINCT CASE WHEN r.status = 'Pass' THEN t.id END) AS report_pass
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'MA' AND t.start_date >= ? AND t.start_date < ?
       GROUP BY DATE_FORMAT(t.start_date, '%Y-%m')
       ORDER BY month_key ASC`,
      [startISO, endISO]
    );

    // 2) Vendor MA ranking (top 10) – use vendor from device DB, not tasks.vendor_name
    // First get all MA tasks with assets + report; then resolve device -> Vendor from devices table
    const [vendorTaskRows] = await db.execute(
      `SELECT t.id, t.assets, t.status AS task_status, t.start_date, t.end_date,
              r.status AS report_status
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'MA' AND t.start_date >= ? AND t.start_date < ?`,
      [startISO, endISO]
    );
    const deviceIdsFromTasks = new Set();
    for (const row of vendorTaskRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      if (Array.isArray(assets)) {
        for (const a of assets) {
          const id = a.id ?? a.Did ?? a.deviceId;
          if (id != null && String(id).trim() !== '') deviceIdsFromTasks.add(String(id).trim());
        }
      }
    }
    const deviceIdToVendor = {};
    const deviceIdToModel = {};
    const deviceIdToSerial = {};
    const deviceIdToRole = {};
    const deviceIdToRoleId = {};
    const deviceIdToSiteId = {};
    if (deviceIdsFromTasks.size > 0) {
      const ids = Array.from(deviceIdsFromTasks);
      const [deviceRows] = await db.execute(
        `SELECT Did, COALESCE(NULLIF(TRIM(Vendor), ''), 'Unknown') AS vendor FROM devices WHERE Did IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      for (const d of deviceRows) {
        deviceIdToVendor[String(d.Did)] = d.vendor || 'Unknown';
      }
      const [deviceDetailRows] = await db.execute(
        `SELECT d.Did, d.CI_Name, d.serial, d.DeRoleid, d.SLid, r.name AS role_name
         FROM devices d
         LEFT JOIN device_role r ON r.DeRoleid = d.DeRoleid
         WHERE d.Did IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      for (const d of deviceDetailRows) {
        const sid = String(d.Did);
        const ciName = d.CI_Name ? String(d.CI_Name).trim() : '';
        deviceIdToSerial[sid] = d.serial ? String(d.serial).trim() : null;
        deviceIdToRole[sid] = d.role_name ? String(d.role_name).trim() : null;
        deviceIdToRoleId[sid] = d.DeRoleid != null && !Number.isNaN(Number(d.DeRoleid)) ? Number(d.DeRoleid) : null;
        deviceIdToSiteId[sid] = d.SLid != null && !Number.isNaN(Number(d.SLid)) ? Number(d.SLid) : null;
        if (ciName && ciName.includes(' / ')) {
          deviceIdToModel[sid] = ciName.split(' / ')[0].trim() || null;
        } else {
          deviceIdToModel[sid] = ciName || null;
        }
      }
    }
    const vendorAgg = {};
    const modelMonthlyAgg = {};
    for (const row of vendorTaskRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      const firstAsset = Array.isArray(assets) && assets[0] != null ? assets[0] : null;
      const rawId = firstAsset ? (firstAsset.id ?? firstAsset.Did ?? firstAsset.deviceId) : null;
      const primaryId = rawId != null ? String(rawId).trim() : null;

      // Apply optional device role / site filters using primary asset
      if (primaryId) {
        const devRoleId = deviceIdToRoleId[primaryId] ?? null;
        const devSiteId = deviceIdToSiteId[primaryId] ?? null;
        if ((roleFilter != null && devRoleId !== roleFilter) || (siteFilter != null && devSiteId !== siteFilter)) {
          continue;
        }
      } else if (roleFilter != null || siteFilter != null) {
        // If we cannot resolve a device id, exclude when filters are active
        continue;
      }

      const vendor = primaryId != null ? (deviceIdToVendor[primaryId] || 'Unknown') : 'Unknown';
      if (!vendorAgg[vendor]) {
        vendorAgg[vendor] = { total: 0, done: 0, inprocess: 0, pending: 0, overdue: 0, report_fail: 0, report_pass: 0 };
      }
      vendorAgg[vendor].total++;
      const taskStatus = (row.task_status || '').toLowerCase();
      const hasReport = row.report_status != null;
      if (taskStatus === 'done') {
        vendorAgg[vendor].done++;
        if (!hasReport) vendorAgg[vendor].inprocess++;
      } else if (taskStatus === 'working') {
        vendorAgg[vendor].inprocess++;
      } else {
        vendorAgg[vendor].pending++;
      }
      if (taskStatus !== 'done' && row.end_date && new Date(row.end_date) < new Date()) vendorAgg[vendor].overdue++;
      if (row.report_status === 'Fail') vendorAgg[vendor].report_fail++;
      if (row.report_status === 'Pass') vendorAgg[vendor].report_pass++;

      // model monthly aggregation (for trendline)
      const monthStart = row.start_date ? new Date(row.start_date).toISOString().slice(0, 7) + '-01' : null;
      if (monthStart && Array.isArray(assets) && assets.length > 0 && primaryId) {
        const modelFromDb = deviceIdToModel[primaryId] || null;
        const model =
          (firstAsset.model || firstAsset.deviceModel || modelFromDb || '').toString().trim() || 'Unknown Model';
        const mmKey = `${model}\t${monthStart}`;
        if (!modelMonthlyAgg[mmKey]) modelMonthlyAgg[mmKey] = { model, month_start: monthStart, total: 0 };
        modelMonthlyAgg[mmKey].total++;
      }
    }
    const vendorMA = Object.entries(vendorAgg)
      .map(([vendor, v]) => ({ vendor, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 3) Site MA ranking (top 10) by task status
    const [siteMA] = await db.execute(
      `SELECT
         COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown') AS site,
         COUNT(DISTINCT t.id) AS total,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'done' THEN t.id END) AS done,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'working' OR (LOWER(t.status) = 'done' AND r.id IS NULL) THEN t.id END) AS inprocess,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) <> 'done' AND t.end_date < CURDATE() THEN t.id END) AS overdue,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) NOT IN ('done', 'working') AND (t.end_date IS NULL OR t.end_date >= CURDATE()) THEN t.id END) AS pending,
         COUNT(DISTINCT CASE WHEN r.status = 'Fail' THEN t.id END) AS report_fail,
         COUNT(DISTINCT CASE WHEN r.status = 'Pass' THEN t.id END) AS report_pass
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'MA' AND t.start_date >= ? AND t.start_date < ?
       GROUP BY COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown')
       ORDER BY total DESC
       LIMIT 10`,
      [startISO, endISO]
    );

    // 4) Equipment MA ranking - parse assets JSON + join report for pass/fail
    const [equipRows] = await db.execute(
      `SELECT t.id, t.assets, t.status AS task_status, t.vendor_name, t.site_name,
              r.status AS report_status
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'MA' AND t.start_date >= ? AND t.start_date < ?`,
      [startISO, endISO]
    );

    const equipMap = {};
    for (const row of equipRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      if (!Array.isArray(assets) || assets.length === 0) continue;
      for (const a of assets) {
        const name = a.name || a.CI_Name || a.deviceName || 'Unknown Device';
        const id = a.id || a.Did || a.deviceId || name;
        const sid = id != null ? String(id).trim() : null;

        // Apply optional device role / site filters per asset
        if (sid) {
          const devRoleId = deviceIdToRoleId[sid] ?? null;
          const devSiteId = deviceIdToSiteId[sid] ?? null;
          if ((roleFilter != null && devRoleId !== roleFilter) || (siteFilter != null && devSiteId !== siteFilter)) {
            continue;
          }
        } else if (roleFilter != null || siteFilter != null) {
          continue;
        }

        const vendorFromDevice = sid ? (deviceIdToVendor[sid] || null) : null;
        const modelFromDb = sid ? (deviceIdToModel[sid] || null) : null;
        const serialFromDb = sid ? (deviceIdToSerial[sid] || null) : null;
        const roleFromDb = sid ? (deviceIdToRole[sid] || null) : null;
        const model = (a.model || a.deviceModel || modelFromDb || '').toString().trim() || 'Unknown Model';
        const site = (row.site_name || '').toString().trim() || '';
        const key = `${site}\t${model}`;
        if (!equipMap[key]) {
          equipMap[key] = {
            deviceId: String(id),
            deviceName: name,
            model: model === 'Unknown Model' ? null : model,
            serial: a.serialNumber || a.serial || serialFromDb || null,
            role: roleFromDb,
            vendor: vendorFromDevice || (row.vendor_name || '').trim() || null,
            site: site || null,
            total: 0,
            done: 0,
            inprocess: 0,
            pending: 0,
            reportFail: 0,
            reportPass: 0,
          };
        }
        equipMap[key].total++;
        const taskStatus = (row.task_status || '').toLowerCase();
        const hasReport = row.report_status != null;
        if (taskStatus === 'done') {
          equipMap[key].done++;
          if (!hasReport) equipMap[key].inprocess++;
        } else if (taskStatus === 'working') {
          equipMap[key].inprocess++;
        } else {
          equipMap[key].pending++;
        }
        if (row.report_status === 'Fail') equipMap[key].reportFail++;
        if (row.report_status === 'Pass') equipMap[key].reportPass++;
      }
    }
    const equipmentRanking = Object.values(equipMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // Top model monthly trend (overall most repaired model)
    const topModelName = equipmentRanking.length > 0
      ? (equipmentRanking[0].model || equipmentRanking[0].deviceName || 'Unknown Model')
      : null;
    let topModelMonthly = [];
    if (topModelName) {
      topModelMonthly = Object.values(modelMonthlyAgg)
        .filter((m) => m.model === topModelName)
        .sort((a, b) => a.month_start.localeCompare(b.month_start));
    }

    // 5) Vendor vs monthly MA heatmap data (vendor from device)
    const vendorMonthlyAgg = {};
    for (const row of vendorTaskRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      const firstId = Array.isArray(assets) && assets[0] != null ? (assets[0].id ?? assets[0].Did ?? assets[0].deviceId) : null;
      const vendor = firstId != null ? (deviceIdToVendor[String(firstId)] || 'Unknown') : 'Unknown';
      const monthStart = row.start_date ? new Date(row.start_date).toISOString().slice(0, 7) + '-01' : null;
      if (!monthStart) continue;
      const key = `${vendor}\t${monthStart}`;
      if (!vendorMonthlyAgg[key]) vendorMonthlyAgg[key] = { vendor, month_start: monthStart, total: 0 };
      vendorMonthlyAgg[key].total++;
    }
    const vendorMonthly = Object.values(vendorMonthlyAgg).sort((a, b) => a.vendor.localeCompare(b.vendor) || a.month_start.localeCompare(b.month_start));

    // 6) Report pass/fail stats per vendor (vendor from device: report.device_id -> devices.Vendor)
    let vendorReportStats = [];
    try {
      const [vrRows] = await db.execute(
        `SELECT
           COALESCE(NULLIF(TRIM(d.Vendor), ''), 'Unknown') AS vendor,
           COUNT(r.report_id) AS total_reports,
           SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports,
           SUM(CASE WHEN r.status = 'Fail' THEN 1 ELSE 0 END) AS fail_reports
         FROM report r
         INNER JOIN tasks t ON t.id = r.id AND t.task_type = 'MA' AND t.start_date >= ? AND t.start_date < ?
         LEFT JOIN devices d ON d.Did = r.device_id
         GROUP BY COALESCE(NULLIF(TRIM(d.Vendor), ''), 'Unknown')
         ORDER BY total_reports DESC`,
        [startISO, endISO]
      );
      vendorReportStats = vrRows.map(r => ({
        vendor: r.vendor,
        totalReports: Number(r.total_reports),
        passReports: Number(r.pass_reports),
        failReports: Number(r.fail_reports),
        passRate: Number(r.total_reports) > 0 ? Math.round((Number(r.pass_reports) / Number(r.total_reports)) * 100) : 0,
      }));
    } catch (_) { /* table might not have all columns */ }

    // 7) Overall summary - "failed" = report.status = 'Fail'
    const totalMA = monthlyMA.reduce((s, r) => s + Number(r.total), 0);
    const totalDone = monthlyMA.reduce((s, r) => s + Number(r.done), 0);
    const totalInprocess = monthlyMA.reduce((s, r) => s + Number(r.inprocess || 0), 0);
    const totalReportFail = monthlyMA.reduce((s, r) => s + Number(r.report_fail), 0);
    const totalReportPass = monthlyMA.reduce((s, r) => s + Number(r.report_pass), 0);
    const totalOverdue = monthlyMA.reduce((s, r) => s + Number(r.overdue || 0), 0);
    const totalPending = monthlyMA.reduce((s, r) => s + Number(r.pending || 0), 0);

    const topVendor = vendorMA.length > 0 ? vendorMA[0].vendor : 'N/A';
    const topEquip = equipmentRanking.length > 0 ? equipmentRanking[0].deviceName : 'N/A';

    res.status(200).json({
      success: true,
      data: {
        months: effectiveMonths,
        range: { start: startISO, endExclusive: endISO },
        summary: {
          totalMA,
          totalDone,
          totalInprocess,
          totalFailed: totalReportFail,
          totalPassed: totalReportPass,
          totalOverdue,
          totalPending,
          completionRate: totalMA > 0 ? Math.round((totalDone / totalMA) * 100) : 0,
          failRate: (totalReportFail + totalReportPass) > 0 ? Math.round((totalReportFail / (totalReportFail + totalReportPass)) * 100) : 0,
          topVendor,
          topVendorCount: vendorMA.length > 0 ? Number(vendorMA[0].total) : 0,
          topEquipment: topEquip,
          topEquipmentCount: equipmentRanking.length > 0 ? equipmentRanking[0].total : 0,
        },
        monthlyMA: monthlyMA.map(r => {
          const monthStart = (r.month_key || '') + '-01';
          return {
            month: monthLabel(new Date(monthStart)),
            monthKey: monthStart,
            total: Number(r.total),
            done: Number(r.done),
            inprocess: Number(r.inprocess || 0),
            reportFail: Number(r.report_fail),
            reportPass: Number(r.report_pass),
            overdue: Number(r.overdue || 0),
            pending: Number(r.pending || 0),
          };
        }),
        vendorRanking: vendorMA.map(r => ({
          vendor: r.vendor,
          total: Number(r.total),
          done: Number(r.done),
          inprocess: Number(r.inprocess || 0),
          reportFail: Number(r.report_fail),
          reportPass: Number(r.report_pass),
          overdue: Number(r.overdue || 0),
          pending: Number(r.pending || 0),
          completionRate: Number(r.total) > 0 ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0,
        })),
        siteRanking: siteMA.map(r => ({
          site: r.site,
          total: Number(r.total),
          done: Number(r.done),
          inprocess: Number(r.inprocess || 0),
          reportFail: Number(r.report_fail),
          reportPass: Number(r.report_pass),
          overdue: Number(r.overdue || 0),
          pending: Number(r.pending || 0),
          completionRate: Number(r.total) > 0 ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0,
        })),
        equipmentRanking,
        topModelTrend: {
          model: topModelName,
          points: topModelMonthly,
        },
        vendorMonthly: vendorMonthly.map(r => ({
          vendor: r.vendor,
          month: monthLabel(new Date(r.month_start)),
          monthKey: r.month_start,
          total: Number(r.total),
        })),
        vendorReportStats,
      },
    });
  } catch (error) {
    console.error('[getMaDashboard] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get MA dashboard data', error: error.message });
  }
};

// GET /api/analytics/pm-dashboard?months=6 | ?year=2024 | ?year=2024&month=3
// Same structure as MA dashboard but for task_type = 'PM'
const getPmDashboard = async (req, res) => {
  try {
    const months = clampInt(req.query.months, { min: 1, max: 120, fallback: 6 });
    const yearParam = req.query.year;
    const monthParam = req.query.month != null && req.query.month !== '' ? parseInt(String(req.query.month), 10) : null;

    let start, endExclusive, effectiveMonths = months;
    const rangeFromYear = yearParam != null && yearParam !== '' ? getRangeFromYearMonth(parseInt(String(yearParam), 10), (monthParam >= 1 && monthParam <= 12) ? monthParam : null) : null;
    if (rangeFromYear) {
      start = rangeFromYear.start;
      endExclusive = rangeFromYear.endExclusive;
      effectiveMonths = monthParam >= 1 && monthParam <= 12 ? 1 : 12;
    } else {
      const range = getRange(months);
      start = range.start;
      endExclusive = range.endExclusive;
    }
    const startISO = toISODate(start);
    const endISO = toISODate(endExclusive);

    const [monthlyMA] = await db.execute(
      `SELECT
         DATE_FORMAT(t.start_date, '%Y-%m') AS month_key,
         COUNT(DISTINCT t.id) AS total,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'done' THEN t.id END) AS done,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) NOT IN ('done') AND t.end_date < CURDATE() THEN t.id END) AS overdue,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'not-started' AND t.start_date >= CURDATE() THEN t.id END) AS pending,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'working' OR (LOWER(t.status) = 'done' AND r.id IS NULL) THEN t.id END) AS inprocess,
         COUNT(DISTINCT CASE WHEN r.status = 'Fail' THEN t.id END) AS report_fail,
         COUNT(DISTINCT CASE WHEN r.status = 'Pass' THEN t.id END) AS report_pass
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'PM' AND t.start_date >= ? AND t.start_date < ?
       GROUP BY DATE_FORMAT(t.start_date, '%Y-%m')
       ORDER BY month_key ASC`,
      [startISO, endISO]
    );

    const [vendorTaskRows] = await db.execute(
      `SELECT t.id, t.assets, t.status AS task_status, t.start_date, t.end_date,
              r.status AS report_status
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'PM' AND t.start_date >= ? AND t.start_date < ?`,
      [startISO, endISO]
    );
    const deviceIdsFromTasks = new Set();
    for (const row of vendorTaskRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      if (Array.isArray(assets)) {
        for (const a of assets) {
          const id = a.id ?? a.Did ?? a.deviceId;
          if (id != null && String(id).trim() !== '') deviceIdsFromTasks.add(String(id).trim());
        }
      }
    }
    const deviceIdToVendor = {};
    const deviceIdToModel = {};
    const deviceIdToRole = {};
    if (deviceIdsFromTasks.size > 0) {
      const ids = Array.from(deviceIdsFromTasks);
      const [deviceRows] = await db.execute(
        `SELECT Did, COALESCE(NULLIF(TRIM(Vendor), ''), 'Unknown') AS vendor FROM devices WHERE Did IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      for (const d of deviceRows) {
        deviceIdToVendor[String(d.Did)] = d.vendor || 'Unknown';
      }
      const [deviceDetailRows] = await db.execute(
        `SELECT d.Did, d.CI_Name, d.serial, r.name AS role_name
         FROM devices d
         LEFT JOIN device_role r ON r.DeRoleid = d.DeRoleid
         WHERE d.Did IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      for (const d of deviceDetailRows) {
        const sid = String(d.Did);
        const ciName = d.CI_Name ? String(d.CI_Name).trim() : '';
        deviceIdToRole[sid] = d.role_name ? String(d.role_name).trim() : null;
        if (ciName && ciName.includes(' / ')) {
          deviceIdToModel[sid] = ciName.split(' / ')[0].trim() || null;
        } else {
          deviceIdToModel[sid] = ciName || null;
        }
      }
    }
    const vendorAgg = {};
    for (const row of vendorTaskRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      const firstId = Array.isArray(assets) && assets[0] != null ? (assets[0].id ?? assets[0].Did ?? assets[0].deviceId) : null;
      const vendor = firstId != null ? (deviceIdToVendor[String(firstId)] || 'Unknown') : 'Unknown';
      if (!vendorAgg[vendor]) {
        vendorAgg[vendor] = { total: 0, done: 0, overdue: 0, report_fail: 0, report_pass: 0 };
      }
      vendorAgg[vendor].total++;
      if ((row.task_status || '').toLowerCase() === 'done') vendorAgg[vendor].done++;
      if ((row.task_status || '').toLowerCase() !== 'done' && row.end_date && new Date(row.end_date) < new Date()) vendorAgg[vendor].overdue++;
      if (row.report_status === 'Fail') vendorAgg[vendor].report_fail++;
      if (row.report_status === 'Pass') vendorAgg[vendor].report_pass++;
    }
    const vendorMA = Object.entries(vendorAgg)
      .map(([vendor, v]) => ({ vendor, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const [siteMA] = await db.execute(
      `SELECT
         COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown') AS site,
         COUNT(DISTINCT t.id) AS total,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) = 'done' THEN t.id END) AS done,
         COUNT(DISTINCT CASE WHEN LOWER(t.status) NOT IN ('done') AND t.end_date < CURDATE() THEN t.id END) AS overdue,
         COUNT(DISTINCT CASE WHEN r.status = 'Fail' THEN t.id END) AS report_fail,
         COUNT(DISTINCT CASE WHEN r.status = 'Pass' THEN t.id END) AS report_pass
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'PM' AND t.start_date >= ? AND t.start_date < ?
       GROUP BY COALESCE(NULLIF(TRIM(t.site_name), ''), 'Unknown')
       ORDER BY total DESC
       LIMIT 10`,
      [startISO, endISO]
    );

    const [equipRows] = await db.execute(
      `SELECT t.id, t.assets, t.status AS task_status, t.vendor_name, t.site_name,
              r.status AS report_status
       FROM tasks t
       LEFT JOIN report r ON r.id = t.id
       WHERE t.task_type = 'PM' AND t.start_date >= ? AND t.start_date < ?`,
      [startISO, endISO]
    );

    const equipMap = {};
    for (const row of equipRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      if (!Array.isArray(assets) || assets.length === 0) continue;
      for (const a of assets) {
        const name = a.name || a.CI_Name || a.deviceName || 'Unknown Device';
        const id = a.id || a.Did || a.deviceId || name;
        const sid = id != null ? String(id) : null;
        const vendorFromDevice = sid ? (deviceIdToVendor[sid] || null) : null;
        const modelFromDb = sid ? (deviceIdToModel[sid] || null) : null;
        const roleFromDb = sid ? (deviceIdToRole[sid] || null) : null;
        const model = (a.model || a.deviceModel || modelFromDb || '').toString().trim() || 'Unknown Model';
        const site = (row.site_name || '').toString().trim() || '';
        const key = `${site}\t${model}`;
        if (!equipMap[key]) {
          equipMap[key] = {
            deviceId: String(id),
            deviceName: name,
            model: model === 'Unknown Model' ? null : model,
            serial: a.serialNumber || a.serial || null,
            role: roleFromDb,
            vendor: vendorFromDevice || (row.vendor_name || '').trim() || null,
            site: site || null,
            total: 0,
            done: 0,
            inprocess: 0,
            pending: 0,
            reportFail: 0,
            reportPass: 0,
          };
        }
        equipMap[key].total++;
        if ((row.task_status || '').toLowerCase() === 'done') equipMap[key].done++;
        else equipMap[key].pending++;
        if (row.report_status === 'Fail') equipMap[key].reportFail++;
        if (row.report_status === 'Pass') equipMap[key].reportPass++;
      }
    }
    const equipmentRanking = Object.values(equipMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const vendorMonthlyAgg = {};
    for (const row of vendorTaskRows) {
      let assets = [];
      try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (Array.isArray(row.assets) ? row.assets : []);
      } catch (_) { /* ignore */ }
      const firstId = Array.isArray(assets) && assets[0] != null ? (assets[0].id ?? assets[0].Did ?? assets[0].deviceId) : null;
      const vendor = firstId != null ? (deviceIdToVendor[String(firstId)] || 'Unknown') : 'Unknown';
      const monthStart = row.start_date ? new Date(row.start_date).toISOString().slice(0, 7) + '-01' : null;
      if (!monthStart) continue;
      const key = `${vendor}\t${monthStart}`;
      if (!vendorMonthlyAgg[key]) vendorMonthlyAgg[key] = { vendor, month_start: monthStart, total: 0 };
      vendorMonthlyAgg[key].total++;
    }
    const vendorMonthly = Object.values(vendorMonthlyAgg).sort((a, b) => a.vendor.localeCompare(b.vendor) || a.month_start.localeCompare(b.month_start));

    let vendorReportStats = [];
    try {
      const [vrRows] = await db.execute(
        `SELECT
           COALESCE(NULLIF(TRIM(d.Vendor), ''), 'Unknown') AS vendor,
           COUNT(r.report_id) AS total_reports,
           SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports,
           SUM(CASE WHEN r.status = 'Fail' THEN 1 ELSE 0 END) AS fail_reports
         FROM report r
         INNER JOIN tasks t ON t.id = r.id AND t.task_type = 'PM' AND t.start_date >= ? AND t.start_date < ?
         LEFT JOIN devices d ON d.Did = r.device_id
         GROUP BY COALESCE(NULLIF(TRIM(d.Vendor), ''), 'Unknown')
         ORDER BY total_reports DESC`,
        [startISO, endISO]
      );
      vendorReportStats = vrRows.map(r => ({
        vendor: r.vendor,
        totalReports: Number(r.total_reports),
        passReports: Number(r.pass_reports),
        failReports: Number(r.fail_reports),
        passRate: Number(r.total_reports) > 0 ? Math.round((Number(r.pass_reports) / Number(r.total_reports)) * 100) : 0,
      }));
    } catch (_) { /* ignore */ }

    const totalMA = monthlyMA.reduce((s, r) => s + Number(r.total), 0);
    const totalDone = monthlyMA.reduce((s, r) => s + Number(r.done), 0);
    const totalReportFail = monthlyMA.reduce((s, r) => s + Number(r.report_fail), 0);
    const totalReportPass = monthlyMA.reduce((s, r) => s + Number(r.report_pass), 0);
    const totalOverdue = monthlyMA.reduce((s, r) => s + Number(r.overdue || 0), 0);
    const totalPending = monthlyMA.reduce((s, r) => s + Number(r.pending || 0), 0);

    const topVendor = vendorMA.length > 0 ? vendorMA[0].vendor : 'N/A';
    const topEquip = equipmentRanking.length > 0 ? equipmentRanking[0].deviceName : 'N/A';

    res.status(200).json({
      success: true,
      data: {
        months: effectiveMonths,
        range: { start: startISO, endExclusive: endISO },
        summary: {
          totalMA,
          totalDone,
          totalInprocess: 0,
          totalFailed: totalReportFail,
          totalPassed: totalReportPass,
          totalOverdue,
          totalPending,
          completionRate: totalMA > 0 ? Math.round((totalDone / totalMA) * 100) : 0,
          failRate: (totalReportFail + totalReportPass) > 0 ? Math.round((totalReportFail / (totalReportFail + totalReportPass)) * 100) : 0,
          topVendor,
          topVendorCount: vendorMA.length > 0 ? Number(vendorMA[0].total) : 0,
          topEquipment: topEquip,
          topEquipmentCount: equipmentRanking.length > 0 ? equipmentRanking[0].total : 0,
        },
        monthlyMA: monthlyMA.map(r => {
          const monthStart = (r.month_key || '') + '-01';
          return {
            month: monthLabel(new Date(monthStart)),
            monthKey: monthStart,
            total: Number(r.total),
            done: Number(r.done),
            inprocess: 0,
            reportFail: Number(r.report_fail),
            reportPass: Number(r.report_pass),
            overdue: Number(r.overdue || 0),
            pending: Number(r.total) - Number(r.done),
          };
        }),
        vendorRanking: vendorMA.map(r => ({
          vendor: r.vendor,
          total: Number(r.total),
          done: Number(r.done),
          inprocess: 0,
          reportFail: Number(r.report_fail),
          reportPass: Number(r.report_pass),
          overdue: Number(r.overdue || 0),
          pending: Math.max(0, Number(r.total) - Number(r.done)),
          completionRate: Number(r.total) > 0 ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0,
        })),
        siteRanking: siteMA.map(r => ({
          site: r.site,
          total: Number(r.total),
          done: Number(r.done),
          inprocess: 0,
          reportFail: Number(r.report_fail),
          reportPass: Number(r.report_pass),
          overdue: Number(r.overdue || 0),
          pending: Math.max(0, Number(r.total) - Number(r.done)),
          completionRate: Number(r.total) > 0 ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0,
        })),
        equipmentRanking,
        vendorMonthly: vendorMonthly.map(r => ({
          vendor: r.vendor,
          month: monthLabel(new Date(r.month_start)),
          monthKey: r.month_start,
          total: Number(r.total),
        })),
        vendorReportStats,
      },
    });
  } catch (error) {
    console.error('[getPmDashboard] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get PM dashboard data', error: error.message });
  }
};

module.exports = {
  getMaPmAnalytics,
  getSlaAnalytics,
  getSlaContracts,
  getMaDashboard,
  getPmDashboard,
};

