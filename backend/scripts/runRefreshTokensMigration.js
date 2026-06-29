/**
 * สร้างตาราง refresh_tokens สำหรับ refresh token rotation
 * Usage: node scripts/runRefreshTokensMigration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

async function ensureRefreshTokensTable() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'app_db',
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });

  try {
    if (await tableExists(conn, 'refresh_tokens')) {
      return;
    }
    await conn.query(`
      CREATE TABLE refresh_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at DATETIME NULL DEFAULT NULL,
        PRIMARY KEY (id),
        INDEX idx_refresh_token_hash (token_hash),
        INDEX idx_refresh_user_id (user_id),
        INDEX idx_refresh_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('+ refresh_tokens table created');
  } finally {
    await conn.end();
  }
}

async function main() {
  console.log('Connected to', process.env.DB_NAME || 'app_db');
  await ensureRefreshTokensTable();
  console.log('Done.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureRefreshTokensTable };
