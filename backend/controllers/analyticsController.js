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
  return d.toISOString().slice(0, 10);
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

// GET /api/analytics/ma-pm?months=6
// นิยาม:
// - maCoverage: % งาน MA ที่เป็น done ต่อจำนวนงาน MA ทั้งหมดในเดือน
// - actualPM: % งาน PM ที่เป็น done ต่อจำนวนงาน PM ทั้งหมดในเดือน
const getMaPmAnalytics = async (req, res) => {
  try {
    const months = clampInt(req.query.months, { min: 1, max: 24, fallback: 6 });
    const { start, endExclusive } = getRange(months);

    // Monthly (PM/MA) completion %
    const [monthlyRows] = await db.execute(
      `
      SELECT
        DATE_FORMAT(t.start_date, '%Y-%m-01') AS month_start,
        SUM(CASE WHEN t.task_type = 'MA' THEN 1 ELSE 0 END) AS ma_total,
        SUM(CASE WHEN t.task_type = 'MA' AND t.status = 'done' THEN 1 ELSE 0 END) AS ma_done,
        SUM(CASE WHEN t.task_type = 'PM' THEN 1 ELSE 0 END) AS pm_total,
        SUM(CASE WHEN t.task_type = 'PM' AND t.status = 'done' THEN 1 ELSE 0 END) AS pm_done
      FROM tasks t
      WHERE t.start_date >= ? AND t.start_date < ?
      GROUP BY DATE_FORMAT(t.start_date, '%Y-%m')
      ORDER BY month_start ASC
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
      const maTotal = Number(r.ma_total || 0);
      const maDone = Number(r.ma_done || 0);
      const pmTotal = Number(r.pm_total || 0);
      const pmDone = Number(r.pm_done || 0);
      const maCoverage = maTotal > 0 ? Math.round((maDone / maTotal) * 100) : 0;
      const actualPM = pmTotal > 0 ? Math.round((pmDone / pmTotal) * 100) : 0;
      const target = 90;
      return {
        month: monthLabel(new Date(r.month_start)),
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
        DATE_FORMAT(t.start_date, '%Y-%m-01') AS month_start,
        COUNT(r.report_id) AS total_reports,
        SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_reports
      FROM report r
      INNER JOIN tasks t ON t.id = r.id
      WHERE t.contract_id IS NOT NULL
        AND t.start_date >= ? AND t.start_date < ?
      GROUP BY DATE_FORMAT(t.start_date, '%Y-%m')
      ORDER BY month_start ASC
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
      return { month: monthLabel(new Date(r.month_start)), value: pct };
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

module.exports = {
  getMaPmAnalytics,
  getSlaAnalytics,
  getSlaContracts,
};

