const express = require('express');
const router = express.Router();
const {
  createManufacturer,
  getManufacturers,
  updateManufacturer,
  deleteManufacturer
} = require('../controllers/manufacturerController');

// POST - สร้าง Manufacturer ใหม่
router.post('/', createManufacturer);

// GET - ดึงข้อมูล Manufacturers
router.get('/', getManufacturers);

// PUT - แก้ไขข้อมูล Manufacturer
router.put('/:id', updateManufacturer);

// DELETE - ลบ Manufacturer
router.delete('/:id', deleteManufacturer);

module.exports = router;
