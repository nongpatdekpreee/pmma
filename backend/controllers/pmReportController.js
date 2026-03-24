/**
 * PM Checklist Report - รับ report และบันทึกลง database (table report)
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

// แปลง pmResult (pass/warning/fail) เป็น status และ sla_result
function mapResultToStatus(pmResult) {
  const r = (pmResult || '').toLowerCase();
  if (r === 'pass') return { status: 'Pass', sla_result: 1 };
  return { status: 'Fail', sla_result: 0 }; // warning, fail -> Fail
}

const submitPmReport = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      taskId,
      deviceId,
      device,
      checklistItems = [],
      uploadedFiles = [],
      pmResult,
      comment,
      technicianName,
      pmDate,
    } = body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Please select Task (taskId) before submitting Report',
      });
    }

    const { status, sla_result } = mapResultToStatus(pmResult);
    const files = uploadedFiles || [];
    const filePaths = JSON.stringify(files.filter((f) => f.type !== 'image'));
    const imagePaths = JSON.stringify(files.filter((f) => f.type === 'image'));

    // เลือก report_id ที่ว่างที่น้อยที่สุด (gap-filling)
    let reportId = 1;
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      reportId = await generateNextReportId();
      try {
        await db.execute(
          `INSERT INTO report (report_id, id, file_path, image_path, sla_result, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [reportId, taskId, filePaths, imagePaths, sla_result, status]
        );
        inserted = true;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }
    if (!inserted) {
      throw new Error('Unable to generate a unique report_id, please try again');
    }
    const reportData = {
      id: String(reportId),
      report_id: reportId,
      taskId: Number(taskId),
      deviceId,
      device,
      checklistItems,
      uploadedFiles: files,
      pmResult,
      comment,
      technicianName,
      pmDate,
      status,
      sla_result,
      createdAt: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'PM Checklist Report saved successfully',
      data: reportData,
      list: checklistItems,
    });
  } catch (error) {
    console.error('[submitPmReport] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting Report',
      error: error.message,
    });
  }
};

const getPmReports = async (req, res) => {
  try {
    const { limit = 1000, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 1000, 1000);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    // แยก PM/MA โดย JOIN กับ tasks (table report ไม่มี task_type)
    const [rows] = await db.execute(
      `SELECT r.report_id, r.id AS taskId, r.file_path, r.image_path,
              r.sla_result, r.status,
              t.task_type AS task_task_type, t.assets, t.site_name
       FROM report r
       INNER JOIN tasks t ON t.id = r.id AND t.task_type = 'PM'
       ORDER BY r.report_id DESC
       LIMIT ? OFFSET ?`,
      [limitNum, offsetNum]
    );

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM report r INNER JOIN tasks t ON t.id = r.id WHERE t.task_type = 'PM'`
    );
    const total = countRows[0]?.total || 0;

    const data = rows.map((r) => {
      let file_path = [];
      let image_path = [];
      try {
        file_path = typeof r.file_path === 'string' ? JSON.parse(r.file_path) : r.file_path || [];
      } catch (_) {}
      try {
        image_path = typeof r.image_path === 'string' ? JSON.parse(r.image_path) : r.image_path || [];
      } catch (_) {}
      return {
        id: String(r.report_id),
        report_id: r.report_id,
        taskId: r.taskId,
        task_type: 'PM',
        deviceId: null,
        device: null,
        checklistItems: [],
        uploadedFiles: [...file_path, ...image_path],
        pmResult: r.sla_result === 1 ? 'pass' : 'fail',
        status: r.status,
        sla_result: r.sla_result,
        createdAt: null,
        assets: r.assets,
        site_name: r.site_name,
      };
    });

    res.status(200).json({
      success: true,
      data,
      count: data.length,
      total,
    });
  } catch (error) {
    console.error('[getPmReports] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting reports',
      error: error.message,
    });
  }
};

module.exports = {
  submitPmReport,
  getPmReports,
};
