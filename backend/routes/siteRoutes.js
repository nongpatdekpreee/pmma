const express = require('express');
const router = express.Router();
const {
  createSite,
  getSites,
  getSitesLocation,
  getSiteLocationBySlid,
  getSitesLocationBySOF,
  getSitesLocationWithContracts,
  getSiteRegistryCounts,
  updateSitesLocationSof,
  updateSite,
  deleteSite
} = require('../controllers/siteController');

// POST - สร้าง Site ใหม่
router.post('/', createSite);

// GET - ดึงข้อมูล Sites ทั้งหมด
router.get('/', getSites);

// GET - จำนวน sites / locations จากตาราง sites และ sites_location
router.get('/registry-counts', getSiteRegistryCounts);

// GET - ดึง Sites_Location (SLid สำหรับ contract.site_id)
router.get('/locations', getSitesLocation);

// GET - sites_location ตาม SLid (contact จาก column contact)
router.get('/locations/:slid', getSiteLocationBySlid);

// GET - ดึง Sites_Location ที่ sites_location.SOF ตรง refer_sof
router.get('/locations-by-sof', getSitesLocationBySOF);

// PATCH - อัปเดต SOF ของ sites_location (body: SOF หรือ Refer_SOF)
router.patch('/locations/:slid/sof', updateSitesLocationSof);

// GET - ดึง Sites_Location เฉพาะที่มี contract
router.get('/locations-with-contracts', getSitesLocationWithContracts);

// PUT - แก้ไขข้อมูล Site
router.put('/:id', updateSite);

// DELETE - ลบ Site
router.delete('/:id', deleteSite);

module.exports = router;
