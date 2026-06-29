/**
 * Ensure a Docker/admin login exists for smoke tests and first deploy.
 * Usage: node scripts/ensureAdminUser.js
 * Env: DOCKER_ADMIN_USER (default admin), DOCKER_ADMIN_PASSWORD (default Admin@2026)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const argon2 = require('argon2');
const mysql = require('mysql2/promise');

async function main() {
  const username = (process.env.DOCKER_ADMIN_USER || 'admin').trim();
  const password = process.env.DOCKER_ADMIN_PASSWORD || 'Admin@2026';

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'app_db',
    port: Number(process.env.DB_PORT || 3306),
  });

  const [rows] = await conn.query('SELECT User_id FROM user WHERE Username = ?', [username]);
  const hash = await argon2.hash(password);

  if (rows.length === 0) {
    await conn.query('INSERT INTO user (Username, Password, Role) VALUES (?, ?, ?)', [
      username,
      hash,
      'Admin',
    ]);
    console.log(`+ created admin user "${username}"`);
  } else {
    await conn.query('UPDATE user SET Password = ?, Role = ? WHERE Username = ?', [
      hash,
      'Admin',
      username,
    ]);
    console.log(`~ updated password for "${username}"`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
