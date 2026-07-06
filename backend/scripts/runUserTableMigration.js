/**
 * Ensure `user` table exists (auth login/register).
 * Usage: node scripts/runUserTableMigration.js
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

async function ensureUserTable() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'app_db',
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });

  try {
    if (await tableExists(conn, 'user')) {
      return;
    }
    await conn.query(`
      CREATE TABLE user (
        User_id INT NOT NULL AUTO_INCREMENT,
        Username VARCHAR(255) NOT NULL,
        Password VARCHAR(255) NOT NULL,
        Role VARCHAR(50) NOT NULL DEFAULT 'user',
        PRIMARY KEY (User_id),
        UNIQUE KEY idx_user_username (Username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('+ user table created');
  } finally {
    await conn.end();
  }
}

async function main() {
  console.log('Connected to', process.env.DB_NAME || 'app_db');
  await ensureUserTable();
  console.log('Done.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureUserTable };
