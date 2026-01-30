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
  getVendors,
  getReferSOFList,
  getDevicesBySOFAndSite,
  getDevicesBySiteNoSOF,
  getDevicesBySite,
  getDevicesByAssetState,
  getReplacementDevices,
  getDevicesWithPM,
  viewDeviceHistory,
  getDeviceHistory,
  updateAssetState,
  updateDevice,
  deleteDevice
} = require('../controllers/deviceController');

// POST - สร้าง Device ใหม่
router.post('/', createDevice);

// GET - Dashboard Statistics (ต้องอยู่ก่อน GET /:id)
router.get('/dashboard', getDashboard);

// GET - ดึงข้อมูล Devices แยกตาม Model (ต้องอยู่ก่อน GET /:id)
router.get('/by-model', getDevicesByModel);

// GET - รายการ Vendor (DISTINCT Project_purchase จาก Devices สำหรับ dropdown)
router.get('/vendors', getVendors);

// GET - รายการ Refer_SOF (unique values จาก Devices table)
router.get('/refer-sof', getReferSOFList);

// GET - Devices ตาม Refer_SOF และ site_id (สำหรับ Contract)
router.get('/by-sof-and-site', getDevicesBySOFAndSite);

// GET - Devices ตาม site_id ที่ยังไม่มี SOF (สำหรับ Contract เมื่อพิมพ์ SOF ใหม่)
router.get('/by-site-no-sof', getDevicesBySiteNoSOF);

// GET - Devices ตาม site_id (สำหรับ Asset Binding)
router.get('/by-site', getDevicesBySite);

// GET - Devices ตาม Asset_State (สำหรับ MA เลือกอุปกรณ์ใหม่)
router.get('/by-asset-state', getDevicesByAssetState);

// GET - Replacement Devices (In Store ตาม Dtypeid และ DeRoleid)
router.get('/replacement', getReplacementDevices);

// GET - Devices with PM Information (สำหรับ Asset & Site Database)
router.get('/with-pm', getDevicesWithPM);

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ "In Store" (ต้องอยู่ก่อน GET /:id)
router.get('/exclude-in-store', getDevicesExcludeInStore);

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ "Out Store" (ต้องอยู่ก่อน GET /:id)
router.get('/exclude-out-store', getDevicesExcludeOutStore);

// GET - ดูประวัติการเปลี่ยนแปลงของ Devices ทั้งหมด (ต้องอยู่ก่อน GET /:id)
router.get('/history', viewDeviceHistory);

// GET - ดึงประวัติการเปลี่ยนแปลงของ Device (ต้องอยู่ก่อน GET /:id)
router.get('/:id/history', getDeviceHistory);

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

