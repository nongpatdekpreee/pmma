const express = require('express');
const router = express.Router();
const {
  createDeviceRole,
  getDeviceRoles,
  updateDeviceRole,
  deleteDeviceRole
} = require('../controllers/deviceRoleController');

// POST - สร้าง Device_Role ใหม่
router.post('/', createDeviceRole);

// GET - ดึงข้อมูล Device_Roles (สำรองไว้สำหรับอนาคต)
router.get('/', getDeviceRoles);

// PUT - แก้ไขข้อมูล Device_Role (สำรองไว้สำหรับอนาคต)
router.put('/:id', updateDeviceRole);

// DELETE - ลบ Device_Role (สำรองไว้สำหรับอนาคต)
router.delete('/:id', deleteDeviceRole);

module.exports = router;

