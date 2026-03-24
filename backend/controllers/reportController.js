/**
 * PM/MA Checklist Report - รับ report และบันทึกลง database (table report)
 * ใช้ไฟล์เดียวสำหรับทั้ง PM และ MA แยกด้วย reportType / type
 */

const db = require('../config/database');

async function generateNextReportId() {
  const [rows] = await db.execute(
    `
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM report WHERE report_id = 1) THEN 1
        ELSE (
          SELECT MIN(r1.report_id + 1)
          FROM report r1
          LEFT JOIN report r2 ON r2.report_id = r1.report_id + 1
          WHERE r2.report_id IS NULL
        )
      END AS nextId
    `
  );
  const nextId = rows?.[0]?.nextId;
  return nextId != null ? Number(nextId) : 1;
}

// ถ้าได้ตัวเลข (sla_result) ใช้เกณฑ์ Pass/Fail
// MA: อิงตาม sla_term จาก contract (ผ่าน task), PM: ใช้ 70
function getStatusAndSlaResult(body, resultKey, slaThreshold = 70) {
  const num = body.sla_result;
  if (num !== undefined && num !== null && num !== '') {
    const n = Number(num);
    if (!Number.isNaN(n)) {
      return { status: n > slaThreshold ? 'Pass' : 'Fail', sla_result: n };
    }
  }
  const result = body[resultKey] ?? body.pmResult ?? body.maResult;
  const r = (result || '').toLowerCase();
  if (r === 'pass') return { status: 'Pass', sla_result: 1 };
  return { status: 'Fail', sla_result: 0 };
}

function parseJsonField(val, fallback = []) {
  if (val == null) return fallback;
  try {
    return typeof val === 'string' ? JSON.parse(val) : (Array.isArray(val) ? val : fallback);
  } catch (_) {
    return fallback;
  }
}

// POST /api/reports/upload (หรือ /api/pm-reports/upload, /api/ma-reports/upload)
const uploadReportFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File not found' });
    }
    const filePath = `/uploads/reports/${req.file.filename}`;
    res.status(200).json({ success: true, path: filePath, name: req.file.originalname });
  } catch (error) {
    console.error('[uploadReportFile] Error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
};

/**
 * POST /api/reports
 * body: { reportType: 'PM'|'MA', taskId, deviceId, device, checklistItems, uploadedFiles, pmResult|maResult, comment, technicianName, pmDate|maDate }
 */
const submitReport = async (req, res) => {
  try {
    const body = req.body || {};
    const reportType = (body.reportType || '').toUpperCase() === 'MA' ? 'MA' : 'PM';
    const resultKey = reportType === 'PM' ? 'pmResult' : 'maResult';

    const {
      taskId,
      deviceId,
      device,
      checklistItems = [],
      uploadedFiles = [],
      comment,
      technicianName,
      pmDate,
      maDate,
    } = body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Please select Task (taskId) before submitting Report',
      });
    }

    // PM/MA: ดึง sla_term จาก table contract (ผ่าน task.contract_id) เพื่อใช้เป็นเกณฑ์ Pass/Fail
    let slaThreshold = 70;
    try {
      const [rows] = await db.execute(
        'SELECT c.sla_term FROM tasks t INNER JOIN contract c ON t.contract_id = c.contract_id WHERE t.id = ?',
        [taskId]
      );
      const st = rows[0]?.sla_term;
      if (st != null && String(st).trim() !== '') {
        const n = parseInt(String(st).trim(), 10);
        if (!Number.isNaN(n)) slaThreshold = n;
      }
    } catch (err) {
      console.warn('[submitReport] Could not fetch contract sla_term:', err.message);
    }

    const { status, sla_result } = getStatusAndSlaResult(body, resultKey, slaThreshold);
    const files = uploadedFiles || [];
    const filePaths = JSON.stringify(files.filter((f) => f.type !== 'image'));
    const imagePaths = JSON.stringify(files.filter((f) => f.type === 'image'));
    const checklistItemsJson = JSON.stringify(checklistItems || []);
    const dateVal = reportType === 'PM' ? pmDate : maDate;
    const pmDateVal = dateVal && typeof dateVal === 'string' ? dateVal.split('T')[0] : null;
    const deviceJsonStr = device ? JSON.stringify(device) : null;
    const deviceIdVal = deviceId ? parseInt(deviceId, 10) : null;

    let reportId = 1;
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      reportId = await generateNextReportId();
      try {
        await db.execute(
          `INSERT INTO report (report_id, id, file_path, image_path, sla_result, status, checklist_items, comment, technician_name, pm_date, device_id, device_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [reportId, taskId, filePaths, imagePaths, sla_result, status, checklistItemsJson, comment || null, technicianName || null, pmDateVal, deviceIdVal, deviceJsonStr]
        );
        inserted = true;
      } catch (insertErr) {
        // schema เก่าอาจไม่มีคอลัมน์เพิ่ม → fallback insert แบบสั้น
        if (insertErr.code === 'ER_BAD_FIELD_ERROR' || insertErr.message?.includes('Unknown column')) {
          try {
            await db.execute(
              `INSERT INTO report (report_id, id, file_path, image_path, sla_result, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [reportId, taskId, filePaths, imagePaths, sla_result, status]
            );
            inserted = true;
          } catch (fallbackErr) {
            if (fallbackErr.code === 'ER_DUP_ENTRY') continue;
            throw fallbackErr;
          }
        } else if (insertErr.code === 'ER_DUP_ENTRY') {
          continue; // มีคนแทรก id เดียวกันพอดี → คำนวณใหม่
        } else {
          throw insertErr;
        }
      }
    }
    if (!inserted) {
      throw new Error('Unable to generate a unique report_id, please try again');
    }

    const reportData = {
      id: String(reportId),
      report_id: reportId,
      reportType,
      taskId: Number(taskId),
      deviceId,
      device,
      checklistItems: checklistItems || [],
      uploadedFiles: files,
      [resultKey]: status === 'Pass' ? 'pass' : 'fail',
      sla_result,
      comment: comment || undefined,
      technicianName: technicianName || undefined,
      pmDate: pmDate || maDate,
      status,
      createdAt: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: reportType === 'PM' ? 'PM Checklist Report saved successfully' : 'MA Checklist Report saved successfully',
      data: reportData,
      list: checklistItems,
    });
  } catch (error) {
    console.error('[submitReport] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting Report',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports?type=PM|MA&limit=&offset=
 */
const getReports = async (req, res) => {
  try {
    const { type = '', limit = 1000, offset = 0 } = req.query;
    const taskType = (String(type).toUpperCase() === 'MA' ? 'MA' : 'PM');
    const limitNum = Math.min(parseInt(limit) || 1000, 1000);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    let rows;
    try {
      [rows] = await db.execute(
        `SELECT r.report_id, r.id AS taskId, r.file_path, r.image_path,
                r.sla_result, r.status,
                r.checklist_items, r.comment, r.technician_name, r.pm_date, r.device_id, r.device_json,
                r.created_at,
                t.task_type AS task_task_type, t.assets, t.site_name, t.engineers, t.start_date,
                t.replacement_device_id, t.vendor_name, t.vendor_tel, t.reporter_name, t.reporter_tel, t.ticket
         FROM report r
         INNER JOIN tasks t ON t.id = r.id AND t.task_type = ?
         ORDER BY r.report_id DESC
         LIMIT ? OFFSET ?`,
        [taskType, limitNum, offsetNum]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR' || colErr.message?.includes('Unknown column')) {
        [rows] = await db.execute(
          `SELECT r.report_id, r.id AS taskId, r.file_path, r.image_path,
                  r.sla_result, r.status,
                  t.task_type AS task_task_type, t.assets, t.site_name, t.engineers, t.start_date,
                  t.replacement_device_id, t.vendor_name, t.vendor_tel, t.reporter_name, t.reporter_tel, t.ticket
           FROM report r
           INNER JOIN tasks t ON t.id = r.id AND t.task_type = ?
           ORDER BY r.report_id DESC
           LIMIT ? OFFSET ?`,
          [taskType, limitNum, offsetNum]
        );
      } else {
        throw colErr;
      }
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM report r INNER JOIN tasks t ON t.id = r.id WHERE t.task_type = ?`,
      [taskType]
    );
    const total = countRows[0]?.total || 0;

    const resultKey = taskType === 'PM' ? 'pmResult' : 'maResult';
    const dateKey = taskType === 'PM' ? 'pmDate' : 'maDate';

    const data = rows.map((r) => {
      const file_path = parseJsonField(r.file_path);
      const image_path = parseJsonField(r.image_path);
      const checklistItems = parseJsonField(r.checklist_items);
      const deviceFromJson = parseJsonField(r.device_json, null);
      const assets = parseJsonField(r.assets);
      const engineers = parseJsonField(r.engineers);
      const firstAsset = Array.isArray(assets) && assets[0] ? assets[0] : null;
      const firstEngineer = Array.isArray(engineers) && engineers[0] ? engineers[0] : null;
      const deviceId = r.device_id != null ? String(r.device_id) : (firstAsset ? String(firstAsset.id ?? firstAsset.Did ?? firstAsset.deviceId ?? '') : null);
      const device = deviceFromJson && typeof deviceFromJson === 'object'
        ? deviceFromJson
        : firstAsset
          ? {
              Did: firstAsset.id ?? firstAsset.Did,
              CI_Name: firstAsset.name ?? firstAsset.CI_Name,
              Asset_Number: firstAsset.assetNumber ?? firstAsset.Asset_Number,
              serial: firstAsset.serialNumber ?? firstAsset.serial,
              Sitename: firstAsset.site ?? firstAsset.Sitename,
            }
          : null;
      const fullNameFromEngineer = firstEngineer
        ? `${firstEngineer.name ?? firstEngineer.id ?? ''} ${firstEngineer.lastName ?? ''}`.trim() || null
        : null;
      const technicianName = r.technician_name || fullNameFromEngineer;
      const reportDate = r.pm_date
        ? (typeof r.pm_date === 'string' ? r.pm_date : r.pm_date.toISOString?.()?.slice(0, 10))
        : (r.start_date ? (typeof r.start_date === 'string' ? r.start_date : r.start_date.toISOString?.()?.slice(0, 10)) : null);

      const item = {
        id: String(r.report_id),
        report_id: r.report_id,
        taskId: r.taskId,
        task_type: taskType,
        deviceId,
        device,
        engineers,
        checklistItems: Array.isArray(checklistItems) ? checklistItems : [],
        comment: r.comment || undefined,
        uploadedFiles: [...file_path, ...image_path],
        [resultKey]: r.status === 'Pass' ? 'pass' : 'fail',
        status: r.status,
        sla_result: r.sla_result,
        technicianName: technicianName || undefined,
        [dateKey]: reportDate || undefined,
        createdAt: r.created_at
          ? (typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString?.())
          : undefined,
        assets,
        site_name: r.site_name,
        ...(taskType === 'MA' && r.replacement_device_id != null ? { replacementDeviceId: r.replacement_device_id } : {}),
        ...(taskType === 'MA' && (r.vendor_name != null || r.vendor_tel != null || r.reporter_name != null || r.reporter_tel != null || r.ticket != null) ? {
          vendorName: r.vendor_name,
          vendorTel: r.vendor_tel,
          reporterName: r.reporter_name,
          reporterTel: r.reporter_tel,
          ticket: r.ticket,
        } : {}),
      };
      return item;
    });

    res.status(200).json({
      success: true,
      data,
      count: data.length,
      total,
    });
  } catch (error) {
    console.error('[getReports] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting reports',
      error: error.message,
    });
  }
};

/**
 * GET /api/ma-reports/reported-task-ids - ดึง task_id ที่มี report_id ใน table report แล้ว
 * Frontend จะใช้กรองออก แสดงเฉพาะ Task ที่ยังไม่มี report_id
 */
const getReportedTaskIds = async (req, res) => {
  try {
    const base = (req.baseUrl || '').toLowerCase();
    const taskType = base.includes('ma-reports') ? 'MA' : 'PM';

    const [rows] = await db.execute(
      `SELECT DISTINCT r.id AS taskId FROM report r
       INNER JOIN tasks t ON t.id = r.id AND t.task_type = ?
       ORDER BY r.id`,
      [taskType]
    );

    const taskIds = rows
      .map((r) => (r.taskId != null ? Number(r.taskId) : null))
      .filter((n) => n != null && !Number.isNaN(n));

    res.status(200).json({
      success: true,
      taskIds,
    });
  } catch (error) {
    console.error('[getReportedTaskIds] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting reported task IDs',
      error: error.message,
    });
  }
};

module.exports = {
  submitReport,
  getReports,
  getReportedTaskIds,
  uploadReportFile,
};
