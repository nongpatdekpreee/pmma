const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  importEmployees,
} = require('../controllers/employeeController');

// GET - ดึงข้อมูล Employees ทั้งหมด
router.get('/', getEmployees);

// POST - สร้าง Employee ใหม่
router.post('/', createEmployee);

// POST - Import หลายคน (ต้องอยู่ก่อน /:id)
router.post('/import', importEmployees);

// GET - ดึงข้อมูล Employee ตาม ID
router.get('/:id', getEmployeeById);

module.exports = router;
