const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
} = require('../controllers/employeeController');

// GET - ดึงข้อมูล Employees ทั้งหมด
router.get('/', getEmployees);

// POST - สร้าง Employee ใหม่
router.post('/', createEmployee);

// GET - ดึงข้อมูล Employee ตาม ID
router.get('/:id', getEmployeeById);

module.exports = router;
