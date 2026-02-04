const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { submitReport, getReports, uploadReportFile } = require('../controllers/reportController');

// โฟลเดอร์เก็บไฟล์ Report (PM/MA)
const reportsUploadDir = path.join(__dirname, '..', 'uploads', 'reports');
if (!fs.existsSync(reportsUploadDir)) fs.mkdirSync(reportsUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reportsUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
    cb(null, `${Date.now()}-${base}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

// POST /upload — อัปโหลดไฟล์ Report (ต้องมาก่อน inferType)
router.post('/upload', upload.single('file'), uploadReportFile);

// เมื่อ mount ที่ /api/pm-reports หรือ /api/ma-reports ให้กำหนด type อัตโนมัติ
const inferType = (req, res, next) => {
  const base = (req.baseUrl || '').toLowerCase();
  if (base.includes('pm-reports')) {
    if (!req.query.type) req.query.type = 'PM';
    if (req.body && req.method === 'POST' && !req.body.reportType) req.body.reportType = 'PM';
  } else if (base.includes('ma-reports')) {
    if (!req.query.type) req.query.type = 'MA';
    if (req.body && req.method === 'POST' && !req.body.reportType) req.body.reportType = 'MA';
  }
  next();
};

router.get('/', inferType, getReports);
router.post('/', inferType, submitReport);

module.exports = router;
