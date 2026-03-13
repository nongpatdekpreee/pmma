const express = require('express');
const router = express.Router();
const {
  createDeviceType,
  getDeviceTypes,
  updateDeviceType, 
  deleteDeviceType
} = require('../controllers/deviceTypeController');

// POST - สร้าง Device_Type ใหม่
router.post('/', createDeviceType);

// GET - ดึงข้อมูล Device_Types (สำรองไว้สำหรับอนาคต)
router.get('/', getDeviceTypes);

// PUT - แก้ไขข้อมูล Device_Type (สำรองไว้สำหรับอนาคต)
router.put('/:id', updateDeviceType);

// DELETE - ลบ Device_Type (สำรองไว้สำหรับอนาคต)
router.delete('/:id', deleteDeviceType);

module.exports = router;

