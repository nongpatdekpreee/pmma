const express = require('express');
const router = express.Router();
const {
  processExcelFile,
  processLocationFile,
  processCombinedFiles,
  uploadMiddleware,
  uploadMultipleMiddleware
} = require('../controllers/statComtroller');

// POST - รับไฟล์ Excel และประมวลผลข้อมูล (source.ip, source.geo)
router.post('/process-excel', uploadMiddleware, processExcelFile);

// POST - รับไฟล์ Excel และประมวลผลข้อมูล Location (location.building, location.site)
router.post('/process-location', uploadMiddleware, processLocationFile);

// POST - รับ 2 ไฟล์และรวมข้อมูล (source + location)
router.post('/process-combined', uploadMultipleMiddleware, processCombinedFiles);

module.exports = router;

