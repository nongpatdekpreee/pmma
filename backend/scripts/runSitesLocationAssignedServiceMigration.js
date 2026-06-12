/**
 * เพิ่ม sites_location.Assigned_Service + backfill จาก devices
 * Usage: node scripts/runSitesLocationAssignedServiceMigration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../migrations/sites_location_assigned_service.sql'),
    'utf8'
  );
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });
  console.log('Connected to', process.env.DB_NAME);
  await conn.query(sql);
  const [[col]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sites_location' AND COLUMN_NAME = 'Assigned_Service'`
  );
  const [[filled]] = await conn.query(
    `SELECT COUNT(*) AS n FROM sites_location WHERE TRIM(Assigned_Service) != ''`
  );
  console.log('Assigned_Service column:', col.n > 0 ? 'ok' : 'missing');
  console.log('sites_location rows with Assigned_Service:', filled.n);
  await conn.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
