/**
 * Shared helpers: link user_profiles (employee) ↔ user (login)
 */
const argon2 = require('argon2');
const db = require('../config/database');
const { normalizeRole, toDbRole } = require('../utils/roleUtils');
const {
  ensureEmployeeAuthLinkColumn,
} = require('../scripts/runEmployeeAuthLinkMigration');

let ready = false;

async function ensureAuthLinkReady() {
  if (ready) return;
  await ensureEmployeeAuthLinkColumn(db);
  ready = true;
}

async function verifyAdminPassword(actorUserId, adminPassword) {
  if (!adminPassword || String(adminPassword).trim() === '') {
    return { ok: false, status: 400, message: 'กรุณายืนยันรหัสผ่านของคุณ' };
  }
  const [actorRows] = await db.execute('SELECT Password FROM user WHERE User_id = ?', [
    actorUserId,
  ]);
  if (actorRows.length === 0) {
    return { ok: false, status: 401, message: 'ไม่พบบัญชีผู้ดำเนินการ' };
  }
  const passwordOk = await argon2.verify(actorRows[0].Password, adminPassword);
  if (!passwordOk) {
    return { ok: false, status: 403, message: 'รหัสผ่านยืนยันไม่ถูกต้อง' };
  }
  return { ok: true };
}

/**
 * Create login row and set user_profiles.auth_user_id
 * @returns {{ ok: true, account: { id: number, Username: string, Role: string } } | { ok: false, status: number, message: string }}
 */
async function createAndLinkLoginAccount({
  employeeId,
  Username,
  Password,
  Role,
  adminPassword,
  actorUserId,
  actorRole,
}) {
  await ensureAuthLinkReady();

  const empId = String(employeeId ?? '').trim();
  const username = String(Username ?? '').trim();
  const password = String(Password ?? '');

  if (!empId || !username || !password) {
    return {
      ok: false,
      status: 400,
      message: 'กรุณาระบุ Username และ Password สำหรับ Login',
    };
  }
  if (password.length < 6) {
    return {
      ok: false,
      status: 400,
      message: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร',
    };
  }

  let desiredRole = Role !== undefined ? normalizeRole(Role) : 'USER';
  // Non-admins can only create USER accounts
  if (normalizeRole(actorRole) !== 'ADMIN') {
    desiredRole = 'USER';
  }

  if (desiredRole === 'ADMIN') {
    const check = await verifyAdminPassword(actorUserId, adminPassword);
    if (!check.ok) {
      return { ok: false, status: check.status, message: check.message };
    }
  }

  const [emps] = await db.execute(
    'SELECT user_id, auth_user_id FROM user_profiles WHERE user_id = ?',
    [empId]
  );
  if (emps.length === 0) {
    return { ok: false, status: 404, message: 'ไม่พบพนักงาน' };
  }
  if (emps[0].auth_user_id) {
    return { ok: false, status: 400, message: 'พนักงานคนนี้มีบัญชี Login แล้ว' };
  }

  const [dup] = await db.execute('SELECT User_id FROM user WHERE Username = ?', [username]);
  if (dup.length > 0) {
    return { ok: false, status: 400, message: 'Username นี้มีอยู่ในระบบแล้ว' };
  }

  const hashedPassword = await argon2.hash(password);
  const [result] = await db.execute(
    'INSERT INTO user (Username, Password, Role) VALUES (?, ?, ?)',
    [username, hashedPassword, toDbRole(desiredRole)]
  );
  const authUserId = result.insertId;

  try {
    await db.execute(
      'UPDATE user_profiles SET auth_user_id = ? WHERE user_id = ? AND auth_user_id IS NULL',
      [authUserId, empId]
    );
  } catch (linkErr) {
    await db.execute('DELETE FROM user WHERE User_id = ?', [authUserId]);
    throw linkErr;
  }

  return {
    ok: true,
    account: {
      id: authUserId,
      Username: username,
      Role: desiredRole,
    },
  };
}

async function unlinkAndDeleteLoginIfAny(employeeId, { protectUserId } = {}) {
  await ensureAuthLinkReady();
  const [rows] = await db.execute(
    'SELECT auth_user_id FROM user_profiles WHERE user_id = ?',
    [String(employeeId)]
  );
  if (rows.length === 0 || rows[0].auth_user_id == null) return;
  const authId = Number(rows[0].auth_user_id);
  await db.execute('UPDATE user_profiles SET auth_user_id = NULL WHERE user_id = ?', [
    String(employeeId),
  ]);
  if (protectUserId != null && Number(protectUserId) === authId) return;
  await db.execute('DELETE FROM user WHERE User_id = ?', [authId]);
}

module.exports = {
  ensureAuthLinkReady,
  verifyAdminPassword,
  createAndLinkLoginAccount,
  unlinkAndDeleteLoginIfAny,
};
