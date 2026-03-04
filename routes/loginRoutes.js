const express = require('express');
const router = express.Router();
const { createUser, login, getAllUsers, updateUser, deleteUser } = require('../controllers/loginController');
const { authenticateToken } = require('../middleware/authMiddleware');

// POST - สร้าง User ใหม่
router.post('/register', createUser);

// POST - Login
router.post('/login', login);

// GET - ดึง user ทั้งหมด (ต้อง Login)
router.get('/users', authenticateToken, getAllUsers);

// PUT - อัปเดต Username หรือ Password (ต้อง Login)
router.put('/users/:id', authenticateToken, updateUser);

// DELETE - ลบ user (ต้อง Login)
router.delete('/users/:id', authenticateToken, deleteUser);

module.exports = router;


