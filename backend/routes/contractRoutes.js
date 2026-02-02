const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createContract, uploadContractFile, getContractsBySite, getAvailableDevices, getDevicesByContract, getSitesByContract, getVendorStatistics } = require('../controllers/contractController');

// โฟลเดอร์เก็บไฟล์/รูปของ contract
const uploadDir = path.join(__dirname, '..', 'uploads', 'contracts');
if (!fs.existsSync(path.join(__dirname, '..', 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${base}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// POST /api/contracts/upload — อัปโหลดไฟล์หรือรูป บันทึกลง uploads/contracts คืน path
router.post('/upload', upload.single('file'), uploadContractFile);

// POST /api/contracts — สร้างสัญญา
router.post('/', createContract);

// GET /api/contracts/devices/available — ดึง Devices ที่ไม่มี Contract (รองรับ site_id query parameter)
router.get('/devices/available', getAvailableDevices);

// GET /api/contracts/statistics/vendor — ดึง Vendor Statistics จาก Devices ที่มี Contract
router.get('/statistics/vendor', getVendorStatistics);

// GET /api/contracts/:id/devices — ดึง Devices ที่ผูกกับ Contract (ต้องมาก่อน GET / เพื่อไม่ให้ conflict)
router.get('/:id/devices', getDevicesByContract);

// GET /api/contracts/:id/sites — ดึง Sites ที่ผูกกับ Contract
router.get('/:id/sites', getSitesByContract);

// GET /api/contracts?site_id=xxx — ดึง Contracts ตาม site_id
router.get('/', getContractsBySite);

module.exports = router;
