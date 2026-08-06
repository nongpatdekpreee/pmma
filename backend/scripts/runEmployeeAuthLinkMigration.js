/**
 * เชื่อม user_profiles (employee) กับ user (login) ผ่าน auth_user_id
 * Usage: node scripts/runEmployeeAuthLinkMigration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

/**
 * Soft-link: จับคู่ Username กับ gmail (ก่อน @) หรือ name เมื่อยังไม่ถูกเชื่อม
 * ทำเฉพาะคู่ที่ unique เพื่อไม่ผูกผิดคน
 */
async function softLinkEmployeesToUsers(conn) {
  if (!(await columnExists(conn, 'user_profiles', 'auth_user_id'))) return { linked: 0 };

  const [employees] = await conn.query(
    `SELECT user_id, name, gmail, auth_user_id
     FROM user_profiles
     WHERE auth_user_id IS NULL`
  );
  const [users] = await conn.query(`SELECT User_id, Username FROM user`);
  const usedAuthIds = new Set();
  const [already] = await conn.query(
    `SELECT auth_user_id FROM user_profiles WHERE auth_user_id IS NOT NULL`
  );
  for (const row of already) {
    if (row.auth_user_id != null) usedAuthIds.add(Number(row.auth_user_id));
  }

  const byUsername = new Map();
  for (const u of users) {
    const key = String(u.Username || '').trim().toLowerCase();
    if (!key) continue;
    if (!byUsername.has(key)) byUsername.set(key, []);
    byUsername.get(key).push(u);
  }

  let linked = 0;
  for (const emp of employees) {
    const candidates = [];
    const gmail = String(emp.gmail || '').trim().toLowerCase();
    if (gmail.includes('@')) {
      const local = gmail.split('@')[0];
      if (local) candidates.push(local);
    }
    if (gmail) candidates.push(gmail);
    const name = String(emp.name || '').trim().toLowerCase();
    if (name) candidates.push(name);

    let match = null;
    for (const c of candidates) {
      const list = byUsername.get(c);
      if (list && list.length === 1) {
        const id = Number(list[0].User_id);
        if (!usedAuthIds.has(id)) {
          match = id;
          break;
        }
      }
    }
    if (match == null) continue;

    await conn.query(
      `UPDATE user_profiles SET auth_user_id = ? WHERE user_id = ? AND auth_user_id IS NULL`,
      [match, emp.user_id]
    );
    usedAuthIds.add(match);
    linked += 1;
  }
  return { linked };
}

async function ensureEmployeeAuthLinkColumn(existingConn) {
  const own = !existingConn;
  const conn =
    existingConn ||
    (await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'app_db',
      port: Number(process.env.DB_PORT || 3306),
      multipleStatements: true,
    }));

  try {
    if (!(await tableExists(conn, 'user_profiles'))) {
      console.warn('[migration] user_profiles missing — skip auth_user_id');
      return;
    }
    if (!(await columnExists(conn, 'user_profiles', 'auth_user_id'))) {
      await conn.query(`
        ALTER TABLE user_profiles
        ADD COLUMN auth_user_id INT NULL DEFAULT NULL,
        ADD UNIQUE INDEX uq_user_profiles_auth_user_id (auth_user_id)
      `);
      console.log('+ user_profiles.auth_user_id added');
    }

    const { linked } = await softLinkEmployeesToUsers(conn);
    if (linked > 0) {
      console.log(`+ soft-linked ${linked} employee(s) to login accounts`);
    }
  } finally {
    if (own) await conn.end();
  }
}

async function main() {
  console.log('Connected to', process.env.DB_NAME || 'app_db');
  await ensureEmployeeAuthLinkColumn();
  console.log('Done.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureEmployeeAuthLinkColumn };
