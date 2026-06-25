const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { normalizeRole } = require('../utils/roleUtils');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';

function signAccessToken({ id, Username, Role }) {
  return jwt.sign(
    {
      id,
      Username,
      Role: normalizeRole(Role),
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

module.exports = { signAccessToken, ACCESS_TOKEN_TTL };
