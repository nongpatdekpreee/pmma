const {
  REFRESH_TOKEN_COOKIE_NAME,
  findValidToken,
} = require('../services/refreshTokenService');
const { logAuthFailure } = require('../utils/authLogger');

/** ต้องมี refresh cookie ที่ยัง valid (ไม่หมุน token) — ใช้กับ /uploads */
async function requireSession(req, res, next) {
  const raw = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (!raw) {
    logAuthFailure('missing_session', { path: req.originalUrl });
    return res.status(401).json({
      success: false,
      message: 'ไม่พบ session กรุณา Login ก่อน',
    });
  }

  try {
    const row = await findValidToken(raw);
    if (!row) {
      logAuthFailure('invalid_session', { path: req.originalUrl });
      return res.status(401).json({
        success: false,
        message: 'session หมดอายุ กรุณา Login ใหม่',
      });
    }
    req.sessionUserId = row.user_id;
    next();
  } catch (error) {
    console.error('requireSession error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบ session',
    });
  }
}

module.exports = { requireSession };
