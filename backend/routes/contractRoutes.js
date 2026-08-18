const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
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
} = require('../controllers/contractController');
const { requireRole } = require('../middleware/requireRole');
const { requireContractMergeEnabled } = require('../middleware/requireFeature');

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

// POST /api/contracts/sync-from-refer-sof — สร้าง contract อัตโนมัติจาก sites_location.SOF
router.post('/sync-from-refer-sof', syncContractsFromReferSof);

// POST /api/contracts/import-sof-details — map Site+Location+SOF แล้วอัปเดต contact/dates/province
router.post('/import-sof-details', importSofDetails);

// GET /api/contracts/devices/available — ดึง Devices ที่ไม่มี Contract (รองรับ site_id query parameter)
router.get('/devices/available', getAvailableDevices);

// GET /api/contracts/statistics/vendor — ดึง Vendor Statistics จาก Devices ที่มี Contract
router.get('/statistics/vendor', getVendorStatistics);

// GET /api/contracts/statistics/top-sites?limit=8 — Top sites ตามจำนวน device ใน contract_device
router.get('/statistics/top-sites', getTopSitesByContractDevice);

router.get('/statistics/top-sites-heatmap', getTopSitesHeatmap);

// POST /api/contracts/history-display-rows — แถวจาก contract_history สำหรับตารางรายการสัญญา (body: { contract_ids, include_history_for_not_renewing_contracts? })
router.post('/history-display-rows', postContractHistoryDisplayRows);

// GET /api/contracts/history/:historyId — รายละเอียดจาก contract_history ตาม history_id (ต้องมาก่อน /:id)
router.get('/history/:historyId', getContractHistoryDetailByHistoryId);

// GET /api/contracts/devices-by-slids?slids=1,2,3 — batch devices (ต้องมาก่อน /:id)
router.get('/devices-by-slids', getDevicesBySlids);

// POST /api/contracts/merge — รวมสัญญา SOF เดียวกัน (ADMIN + ENABLE_CONTRACT_MERGE)
router.post(
  '/merge',
  requireContractMergeEnabled,
  requireRole('ADMIN'),
  mergeContracts
);

// GET /api/contracts/:id/merge-candidates — peer SOF เดียวกันสำหรับ Merge (ADMIN + flag)
router.get(
  '/:id/merge-candidates',
  requireContractMergeEnabled,
  requireRole('ADMIN'),
  getMergeCandidates
);

// GET /api/contracts/:id/devices — ดึง Devices ที่ผูกกับ Contract (ต้องมาก่อน GET / เพื่อไม่ให้ conflict)
router.get('/:id/devices', getDevicesByContract);

// GET /api/contracts/:id/sites — ดึง Sites ที่ผูกกับ Contract (ต้องมาก่อน GET / เพื่อไม่ให้ conflict)
router.get('/:id/sites', getSitesByContract);

// GET /api/contracts/:id/history — ดึงประวัติการต่อสัญญา (ต้องมาก่อน GET / เพื่อไม่ให้ conflict)
router.get('/:id/history', getContractHistory);

// PUT /api/contracts/:id — อัปเดต Contract (ต้องมาก่อน GET / เพื่อไม่ให้ conflict)
router.put('/:id', updateContract);

// GET /api/contracts/:id — ดึงข้อมูล Contract ทั้งหมดตาม contract_id (ต้องมาก่อน GET / เพื่อไม่ให้ conflict)
router.get('/:id', getContractById);

// GET /api/contracts?site_id=xxx — ดึง Contracts ตาม site_id
router.get('/', getContractsBySite);

module.exports = router;
