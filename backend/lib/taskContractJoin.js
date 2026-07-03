const db = require('../config/database');

const columnCache = new Map();
let joinCache = null;

async function tableExists(tableName) {
  const key = `table:${tableName}`;
  if (columnCache.has(key)) return columnCache.get(key);
  try {
    const [rows] = await db.execute(
      `SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    const exists = rows.length > 0;
    columnCache.set(key, exists);
    return exists;
  } catch {
    return false;
  }
}

async function tableColumnExists(table, column) {
  const key = `${table}.${column}`;
  if (columnCache.has(key)) return columnCache.get(key);
  try {
    const [rows] = await db.execute(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    const exists = Array.isArray(rows) && rows.length > 0;
    columnCache.set(key, exists);
    return exists;
  } catch {
    return false;
  }
}

/** JOIN + SELECT สำหรับ sla_term / sof ของ task — รองรับ sites_location และ contract แยกตาราง */
async function resolveTaskContractJoin() {
  if (joinCache) return joinCache;

  if (await tableColumnExists('sites_location', 'sla_term')) {
    const sofCol = (await tableColumnExists('sites_location', 'SOF'))
      ? 'sl_contract.SOF'
      : 'NULL';
    joinCache = {
      select: `sl_contract.sla_term AS contract_sla_term, ${sofCol} AS contract_sof_name`,
      join: 'LEFT JOIN sites_location sl_contract ON t.contract_id = sl_contract.SLid',
    };
    return joinCache;
  }

  if (await tableExists('contract')) {
    const sofCol = (await tableColumnExists('contract', 'sof_name'))
      ? 'sof_name'
      : (await tableColumnExists('contract', 'SOF'))
        ? 'SOF'
        : null;
    const hasContractDevice = await tableExists('contract_device');

    if (hasContractDevice) {
      const sofSelect = sofCol
        ? `COALESCE(c_direct.${sofCol}, c_via_sl.${sofCol})`
        : 'NULL';
      joinCache = {
        select: `COALESCE(c_direct.sla_term, c_via_sl.sla_term) AS contract_sla_term,
                 ${sofSelect} AS contract_sof_name`,
        join: `LEFT JOIN contract c_direct ON t.contract_id = c_direct.contract_id
               LEFT JOIN contract_device cd ON t.contract_id = cd.SLid
               LEFT JOIN contract c_via_sl ON cd.contract_id = c_via_sl.contract_id`,
      };
    } else {
      const sofSelect = sofCol ? `c_direct.${sofCol}` : 'NULL';
      joinCache = {
        select: `c_direct.sla_term AS contract_sla_term, ${sofSelect} AS contract_sof_name`,
        join: 'LEFT JOIN contract c_direct ON t.contract_id = c_direct.contract_id',
      };
    }
    return joinCache;
  }

  joinCache = {
    select: 'NULL AS contract_sla_term, NULL AS contract_sof_name',
    join: '',
  };
  return joinCache;
}

/** ดึง sla_term สำหรับ report pass/fail */
async function fetchTaskSlaTerm(taskId) {
  const { select, join } = await resolveTaskContractJoin();
  const [rows] = await db.execute(
    `SELECT ${select} FROM tasks t ${join} WHERE t.id = ?`,
    [taskId]
  );
  return rows[0]?.contract_sla_term ?? null;
}

/** Location2 + Province จาก sites_location → location (สำหรับชื่อแสดงบน calendar/schedule) */
function resolveTaskSiteLocationSql({ existingSiteLocationAlias } = {}) {
  const select = `IFNULL(l_task.Location2, '') AS site_location, IFNULL(l_task.Province, '') AS site_province, IFNULL(s_task.Name, '') AS site_db_name`;
  if (existingSiteLocationAlias) {
    return {
      select,
      join: `LEFT JOIN location l_task ON l_task.lid = ${existingSiteLocationAlias}.lid LEFT JOIN sites s_task ON s_task.Sid = ${existingSiteLocationAlias}.Sid`,
    };
  }
  return {
    select,
    join: `LEFT JOIN sites_location sl_task ON sl_task.SLid = t.site_id LEFT JOIN location l_task ON l_task.lid = sl_task.lid LEFT JOIN sites s_task ON s_task.Sid = sl_task.Sid`,
  };
}

module.exports = {
  resolveTaskContractJoin,
  resolveTaskSiteLocationSql,
  fetchTaskSlaTerm,
  tableColumnExists,
  tableExists,
};
