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

const ALLOWED_PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png']);
const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const employeePhotoFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_PHOTO_EXT.has(ext)) {
    return cb(new Error('Only JPG and PNG files are allowed.'));
  }
  if (file.mimetype && !ALLOWED_PHOTO_MIME.has(file.mimetype)) {
    return cb(new Error('Invalid image type.'));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 }, // 500KB
  fileFilter: employeePhotoFilter,
});

// POST - อัปโหลดรูปพนักงาน (ต้องอยู่ก่อน /:id)
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image must be 1 MB or smaller.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Upload failed',
      });
    }
    return uploadEmployeePhoto(req, res);
  });
});

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
