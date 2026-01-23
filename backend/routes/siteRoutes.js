const express = require('express');
const router = express.Router();
const {
  createSite,
  getSites,
  getSitesLocation,
  updateSite,
  deleteSite
} = require('../controllers/siteController');

// POST - สร้าง Site ใหม่
router.post('/', createSite);

// GET - ดึงข้อมูล Sites ทั้งหมด
router.get('/', getSites);

// GET - ดึง Sites_Location (SLid สำหรับ contract.site_id)
router.get('/locations', getSitesLocation);

// PUT - แก้ไขข้อมูล Site
router.put('/:id', updateSite);

// DELETE - ลบ Site
router.delete('/:id', deleteSite);

module.exports = router;
