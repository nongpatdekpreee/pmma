const express = require('express');
const router = express.Router();
const {
  createUser,
  login,
  getMe,
  checkSession,
  refresh,
  logout,
  getAllUsers,
  updateUser,
  deleteUser,
} = require('../controllers/loginController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/requireRole');

// POST - สร้าง User ใหม่
router.post('/register', createUser);

// POST - Login
router.post('/login', login);

// GET - ตรวจ session จาก refresh cookie (ไม่หมุน token)
router.get('/check', checkSession);

// POST - ต่ออายุ access token (refresh cookie)
router.post('/refresh', refresh);

// POST - Logout
router.post('/logout', logout);

// GET - ดึงข้อมูลผู้ใช้ที่ Login อยู่ (ต้อง Login)
router.get('/me', authenticateToken, getMe);

// GET - ดึง user ทั้งหมด (ADMIN only)
router.get('/users', authenticateToken, requireRole('ADMIN'), getAllUsers);

// PUT - อัปเดต Username, Password หรือ Role (ADMIN only)
router.put('/users/:id', authenticateToken, requireRole('ADMIN'), updateUser);

// DELETE - ลบ user (ADMIN only)
router.delete('/users/:id', authenticateToken, requireRole('ADMIN'), deleteUser);

module.exports = router;
