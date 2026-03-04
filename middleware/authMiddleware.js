const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tccstock-secret-key-2024';

// Middleware ตรวจสอบ JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'ไม่พบ Token กรุณา Login ก่อน'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token หมดอายุ กรุณา Login ใหม่'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Token ไม่ถูกต้อง'
    });
  }
};

module.exports = { authenticateToken, JWT_SECRET };
