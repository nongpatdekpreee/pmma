const crypto = require('crypto');
const db = require('../config/database');

const REFRESH_TOKEN_COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function cookieOptions() {
  const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
  const secure = process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res, rawToken) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, rawToken, cookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/',
  });
}

function expiresAtFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
}

async function createRefreshToken(userId) {
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = expiresAtFromNow();
  await db.execute(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
  return raw;
}

async function findValidToken(raw) {
  const tokenHash = hashToken(raw);
  const [rows] = await db.execute(
    `SELECT id, user_id, token_hash, expires_at
     FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeTokenById(id) {
  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
    [id]
  );
}

async function revokeRefreshToken(raw) {
  const row = await findValidToken(raw);
  if (row) await revokeTokenById(row.id);
}

/** Rotate: revoke old token, issue new one for same user */
async function rotateRefreshToken(raw) {
  const row = await findValidToken(raw);
  if (!row) return null;

  await revokeTokenById(row.id);
  const newRaw = await createRefreshToken(row.user_id);
  return { userId: row.user_id, refreshToken: newRaw };
}

module.exports = {
  REFRESH_TOKEN_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  findValidToken,
};
