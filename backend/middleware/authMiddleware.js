const jwt = require('jsonwebtoken');
const { normalizeRole } = require('../utils/roleUtils');
const { logAuthFailure } = require('../utils/authLogger');
const { requireSession } = require('./requireSession');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

function isMaNoticeFileGet(req) {
  return req.method === 'GET' && /\/api\/tasks\/\d+\/ma-notice\//.test(String(req.originalUrl || ''));
}

// Middleware ตรวจสอบ JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    if (isMaNoticeFileGet(req)) {
      return requireSession(req, res, next);
    }
    logAuthFailure('missing_token', { path: req.originalUrl });
    return res.status(401).json({
      success: false,
      message: 'ไม่พบ Token กรุณา Login ก่อน'
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      ...decoded,
      Role: normalizeRole(decoded.Role),
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' && isMaNoticeFileGet(req)) {
      return requireSession(req, res, next);
    }
    if (error.name === 'TokenExpiredError') {
      logAuthFailure('token_expired', { path: req.originalUrl });
      return res.status(401).json({
        success: false,
        message: 'Token หมดอายุ กรุณา Login ใหม่'
      });
    }
    logAuthFailure('invalid_token', { path: req.originalUrl, error: error.name });
    return res.status(403).json({
      success: false,
      message: 'Token ไม่ถูกต้อง'
    });
  }
};

module.exports = { authenticateToken, getJwtSecret };
