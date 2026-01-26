const express = require('express');
const router = express.Router();
const {
  createDevice,
  getDevices,
  getDevicesExcludeInStore,
  getDevicesExcludeOutStore,
  getDeviceById,
  getDashboard,
  getDevicesByModel,
  viewDeviceHistory,
  getDeviceHistory,
  updateAssetState,
  updateDevice,
  deleteDevice,
  getDevicesBySite,
  getDevicesByStatus
} = require('../controllers/deviceController');

// POST - สร้าง Device ใหม่
router.post('/', createDevice);

// GET - Dashboard Statistics (ต้องอยู่ก่อน GET /:id)
router.get('/dashboard', getDashboard);

// GET - ดึงข้อมูล Devices แยกตาม Model (ต้องอยู่ก่อน GET /:id)
router.get('/by-model', getDevicesByModel);

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ "In Store" (ต้องอยู่ก่อน GET /:id)
router.get('/exclude-in-store', getDevicesExcludeInStore);

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ "Out Store" (ต้องอยู่ก่อน GET /:id)
router.get('/exclude-out-store', getDevicesExcludeOutStore);

// GET - ดูประวัติการเปลี่ยนแปลงของ Devices ทั้งหมด (ต้องอยู่ก่อน GET /:id)
router.get('/history', viewDeviceHistory);

// GET - ดึงประวัติการเปลี่ยนแปลงของ Device (ต้องอยู่ก่อน GET /:id)
router.get('/:id/history', getDeviceHistory);

// get เพิ่มใหม่อะ แบบby site ////////////////////////////////////////////////////////////////////////////
router.get('/by-site', getDevicesBySite);

router.get('/by-status', getDevicesByStatus);
// GET - ดึงข้อมูล Device ตาม ID (ต้องอยู่ก่อน GET /)
router.get('/:id', getDeviceById);

// GET - ดึงข้อมูล Devices ทั้งหมด (พร้อม Pagination และ Search)
router.get('/', getDevices);

// PUT - อัพเดท Asset_State (รองรับหลาย records) (ต้องอยู่ก่อน PUT /:id)
router.put('/asset-state', updateAssetState);

// PUT - แก้ไขข้อมูล Device
router.put('/:id', updateDevice);

// DELETE - ลบ Device
router.delete('/:id', deleteDevice);



module.exports = router;

