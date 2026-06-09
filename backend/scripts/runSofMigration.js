/**
 * รัน migration SOF + schema ใหม่บน DB เก่า (ครั้งเดียว)
 * Usage: node scripts/runSofMigration.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'app_db',
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });

  console.log('Connected to', process.env.DB_NAME || 'app_db');

  // --- schema columns (subset) ---
  if (!(await columnExists(conn, 'contract', 'created_at'))) {
    await conn.query(
      `ALTER TABLE contract ADD COLUMN created_at timestamp NOT NULL DEFAULT current_timestamp() AFTER status`
    );
    console.log('+ contract.created_at');
  }

  if (!(await columnExists(conn, 'contract_history', 'terminated_reason'))) {
    await conn.query(
      `ALTER TABLE contract_history ADD COLUMN terminated_reason text DEFAULT NULL AFTER status_history`
    );
    console.log('+ contract_history.terminated_reason');
  }

  for (const [col, def] of [
    ['downtime_date', 'date DEFAULT NULL AFTER end_date'],
    ['downtime_time', 'time DEFAULT NULL'],
    ['uptime_date', 'date DEFAULT NULL'],
    ['uptime_time', 'time DEFAULT NULL'],
    ['downtime_total_hours', 'decimal(12,2) DEFAULT NULL'],
    ['assigned_service', 'varchar(255) DEFAULT NULL'],
  ]) {
    if (!(await columnExists(conn, 'tasks', col))) {
      await conn.query(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
      console.log(`+ tasks.${col}`);
    }
  }

  // --- SOF migration ---
  if (!(await columnExists(conn, 'sites_location', 'SOF'))) {
    await conn.query(
      `ALTER TABLE sites_location ADD COLUMN SOF varchar(255) NOT NULL DEFAULT '' AFTER lid`
    );
    console.log('+ sites_location.SOF');
  }

  if (await columnExists(conn, 'devices', 'Refer_SOF')) {
    await conn.query(`
      UPDATE sites_location sl
      INNER JOIN (
        SELECT SLid, refer_sof FROM (
          SELECT d.SLid, TRIM(d.Refer_SOF) AS refer_sof,
                 ROW_NUMBER() OVER (PARTITION BY d.SLid ORDER BY COUNT(*) DESC, TRIM(d.Refer_SOF)) AS rn
          FROM devices d
          WHERE d.SLid IS NOT NULL AND d.Refer_SOF IS NOT NULL
            AND TRIM(d.Refer_SOF) != '' AND TRIM(d.Refer_SOF) != 'Not Assigned'
          GROUP BY d.SLid, TRIM(d.Refer_SOF)
        ) ranked WHERE rn = 1
      ) src ON sl.SLid = src.SLid
      SET sl.SOF = src.refer_sof
      WHERE TRIM(COALESCE(sl.SOF, '')) = ''
    `);
    console.log('  backfill SOF from devices.Refer_SOF');

    await conn.query(`
      UPDATE sites_location sl
      INNER JOIN (
        SELECT cd.SLid, MAX(TRIM(c.sof_name)) AS sof_name
        FROM contract_device cd
        INNER JOIN contract c ON c.contract_id = cd.contract_id
        WHERE cd.SLid IS NOT NULL AND c.sof_name IS NOT NULL AND TRIM(c.sof_name) != ''
        GROUP BY cd.SLid
      ) ctr ON sl.SLid = ctr.SLid
      SET sl.SOF = ctr.sof_name
      WHERE TRIM(COALESCE(sl.SOF, '')) = ''
    `);
    console.log('  backfill SOF from contract.sof_name (fallback)');

    await conn.query(`ALTER TABLE devices DROP COLUMN Refer_SOF`);
    console.log('- devices.Refer_SOF dropped');
  }

  await conn.query(`UPDATE sites_location SET SOF = '' WHERE SOF IS NULL`);

  // --- triggers ---
  const triggerSql = fs.readFileSync(
    path.join(__dirname, '../../fix_trigger.sql'),
    'utf8'
  );
  await conn.query(`DROP TRIGGER IF EXISTS trg_devices_insert`);
  await conn.query(`DROP TRIGGER IF EXISTS trg_devices_update`);

  const blocks = triggerSql
    .replace(/^DELIMITER\s+\$\$\s*$/gm, '')
    .replace(/^DELIMITER\s+;\s*$/gm, '')
    .split('$$')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('CREATE TRIGGER'));

  for (const block of blocks) {
    await conn.query(block);
  }
  console.log('  triggers updated');

  const [[stats]] = await conn.query(
    `SELECT COUNT(*) total, SUM(TRIM(SOF)!='') with_sof FROM sites_location`
  );
  console.log('sites_location:', stats);

  await conn.end();
  console.log('Migration done.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
