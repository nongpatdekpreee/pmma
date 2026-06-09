const express = require('express');
const router = express.Router();
const {
  //
  createDevice,
  getDevices,
  getDevicesExcludeInStore,
  getDevicesExcludeOutStore,
  getDeviceById,
  getDashboard,
  getDevicesByModel,
  getVendors,
  getReferSOFList,
  getAssignedServicesList,
  getDevicesBySOFAndSite,
  getImportLocation2HintsByContractAndSof,
  getDevicesByContractAndSite,
  getDevicesBySerials,
  getDevicesBySiteNoSOF,
  getDevicesNoSofInStore,
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

// GET - รายการ Refer SOF (distinct sites_location.SOF)
router.get('/refer-sof', getReferSOFList);

// GET - รายการ Assigned_Service (DISTINCT จาก devices สำหรับ Add Contract dropdown Service)
router.get('/assigned-services', getAssignedServicesList);

// GET - Devices ตาม Refer_SOF และ site_id (สำหรับ Contract)
router.get('/by-sof-and-site', getDevicesBySOFAndSite);

// GET - Devices จาก contract_device ตาม contract_id + slid (Site+Location)
router.get('/by-contract-and-site', getDevicesByContractAndSite);

// GET - Distinct Location2 per SLid on contract where sites_location.SOF matches (schedule import hints)
router.get('/import-location2-hints', getImportLocation2HintsByContractAndSof);

// GET - Devices ตาม Serial หลายตัว (สำหรับ Import Contract) ?serials=FGL2314A91L,FGL2314A92L
router.get('/by-serials', getDevicesBySerials);

// GET - Devices ตาม site_id ที่ยังไม่มี SOF (สำหรับ Contract เมื่อพิมพ์ SOF ใหม่)
router.get('/by-site-no-sof', getDevicesBySiteNoSOF);

// GET - Devices ที่ไม่มี SOF และสถานะ In Store (ไม่กรองตาม site สำหรับ Edit Contract SOF ใหม่)
router.get('/no-sof-in-store', getDevicesNoSofInStore);

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

