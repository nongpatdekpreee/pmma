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
  getEmployeeAccounts,
  createEmployeeAccount,
  linkEmployeeAccount,
  updateUser,
  deleteUser,
} = require('../controllers/loginController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/requireRole');

// POST - สร้าง User ใหม่
router.post('/register', createUser);

// POST - Login
router.post('/login', login);
router.get('/login', (_req, res) => {
  res.status(405).json({
    success: false,
    message: 'Use POST /api/auth/login with JSON body { Username, Password }',
    path: '/api/auth/login',
  });
});

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

// GET - พนักงาน + บัญชี Login ที่เชื่อม (ADMIN only)
router.get('/employee-accounts', authenticateToken, requireRole('ADMIN'), getEmployeeAccounts);

// POST - สร้างบัญชี Login ให้พนักงาน (ADMIN only)
router.post('/employee-accounts', authenticateToken, requireRole('ADMIN'), createEmployeeAccount);

// PUT - เชื่อมพนักงานกับบัญชีที่มีอยู่ (ADMIN only)
router.put(
  '/employee-accounts/:employeeId/link',
  authenticateToken,
  requireRole('ADMIN'),
  linkEmployeeAccount
);

// PUT - อัปเดต Username, Password หรือ Role (ADMIN only)
router.put('/users/:id', authenticateToken, requireRole('ADMIN'), updateUser);

// DELETE - ลบ user (ADMIN only)
router.delete('/users/:id', authenticateToken, requireRole('ADMIN'), deleteUser);

module.exports = router;
