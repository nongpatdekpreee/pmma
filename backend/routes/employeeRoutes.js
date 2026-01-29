const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
} = require('../controllers/employeeController');

// GET - ดึงข้อมูล Employees ทั้งหมด
router.get('/', getEmployees);

// GET - ดึงข้อมูล Employee ตาม ID
router.get('/:id', getEmployeeById);

module.exports = router;
