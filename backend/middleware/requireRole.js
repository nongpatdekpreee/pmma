const { normalizeRole } = require('../utils/roleUtils');
const { logAuthFailure } = require('../utils/authLogger');

function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.map((r) => normalizeRole(r)));

  return (req, res, next) => {
    const role = normalizeRole(req.user?.Role);

    if (!allowed.has(role)) {
      logAuthFailure('forbidden', {
        userId: req.user?.id,
        role,
        required: [...allowed],
        path: req.originalUrl,
      });
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์เข้าถึง',
      });
    }

    next();
  };
}

module.exports = { requireRole };
