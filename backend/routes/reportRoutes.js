const express = require('express');
const router = express.Router();
const { submitReport, getReports } = require('../controllers/reportController');

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
