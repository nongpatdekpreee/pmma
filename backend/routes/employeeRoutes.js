const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  importEmployees,
  uploadEmployeePhoto,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');

// โฟลเดอร์เก็บรูปพนักงาน
const uploadDir = path.join(__dirname, '..', 'uploads', 'employees');
if (!fs.existsSync(path.join(__dirname, '..', 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${(file.originalname || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST - อัปโหลดรูปพนักงาน (ต้องอยู่ก่อน /:id)
router.post('/upload', upload.single('file'), uploadEmployeePhoto);

// GET - ดึงข้อมูล Employees ทั้งหมด
router.get('/', getEmployees);

// POST - สร้าง Employee ใหม่
router.post('/', createEmployee);

// POST - Import หลายคน (ต้องอยู่ก่อน /:id)
router.post('/import', importEmployees);

// GET - ดึงข้อมูล Employee ตาม ID
router.get('/:id', getEmployeeById);

// PUT - แก้ไข Employee ตาม ID
router.put('/:id', updateEmployee);

// DELETE - ลบ Employee ตาม ID
router.delete('/:id', deleteEmployee);

module.exports = router;
