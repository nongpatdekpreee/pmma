const express = require('express');
const router = express.Router();
const {
  createDevice,
  getDevices,
  getDevicesExcludeInStore,
  getDevicesExcludeOutStore,
  getDevicesByAssetState,
  getDevicesBySiteId,
  getDevicesBySite,
  searchDevices,
  getDeviceById,
  getDashboardSummary,
  getDashboard,
  getDevicesByModel,
  viewDeviceHistory,
  getDeviceHistory,
  updateAssetState,
  updateAssetStateOther,
  updateDevice,
  deleteDevice,
  deleteDevicesByExcel,
  importExcel,
  getDropdownData,
  updateAndDeleteDevices,
  getDevicesSell
} = require('../controllers/deviceController');

// POST - Import Excel (JSON format)
router.post('/import-excel', importExcel);

// POST - สร้าง Device ใหม่
router.post('/', createDevice);

// GET - Dashboard Summary (Essential data - Fast loading) (ต้องอยู่ก่อน GET /:id)
router.get('/dashboard-summary', getDashboardSummary);

// GET - Dashboard Statistics Full (ต้องอยู่ก่อน GET /:id)
router.get('/dashboard', getDashboard);

// GET - Dynamic Dropdown Data (Sites, Asset States, Manufacturers)
router.get('/dropdown', getDropdownData);

// GET - ดึงข้อมูล Devices แยกตาม Model (ต้องอยู่ก่อน GET /:id)
router.get('/by-model', getDevicesByModel);

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ "In Store" (ต้องอยู่ก่อน GET /:id)
router.get('/exclude-in-store', getDevicesExcludeInStore);

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ "Out Store" (ต้องอยู่ก่อน GET /:id)
router.get('/exclude-out-store', getDevicesExcludeOutStore);

// GET - ดึงข้อมูล Devices เฉพาะสถานะ Sell (ต้องอยู่ก่อน GET /:id)
router.get('/sell', getDevicesSell);

// GET - ค้นหา Devices ตาม Asset_State (ต้องอยู่ก่อน GET /:id)
router.get('/by-asset-state', getDevicesByAssetState);

// GET - ค้นหา Devices ตาม Site (รองรับทั้ง Site ID และ Site Name) (ต้องอยู่ก่อน GET /:id และ /by-site/:siteId)
router.get('/by-site', getDevicesBySite);

// GET - ดึงข้อมูล Devices แยกตาม Site ID (ต้องอยู่ก่อน GET /:id)
router.get('/by-site/:siteId', getDevicesBySiteId);

// GET - Advanced Search Devices (รองรับหลายเงื่อนไขพร้อมกัน) (ต้องอยู่ก่อน GET /:id)
router.get('/search', searchDevices);

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


// PUT - อัพเดท Asset_State Other (Site, Location2, Reason, Request_Date) (ต้องอยู่ก่อน PUT /:id)
router.put('/asset-state-other', updateAssetStateOther);

// PUT+DELETE - อัพเดท Asset_State แล้วลบ Device (Batch - JSON array) (ต้องอยู่ก่อน PUT /:id)
router.put('/update-delete', updateAndDeleteDevices);

// PUT - แก้ไขข้อมูล Device
router.put('/:id', updateDevice);

// DELETE - ลบ Devices หลายตัวจาก Excel (ตรวจสอบด้วย Serial) (ต้องอยู่ก่อน DELETE /:id)
router.delete('/delete-excel', deleteDevicesByExcel);

// DELETE - ลบ Device
router.delete('/:id', deleteDevice);

module.exports = router;

