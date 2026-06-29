const { tableColumnExists, tableExists } = require('./taskContractJoin');

let schemaCache = null;

function sofExprForSl(slAlias) {
  return `COALESCE(
    (SELECT c.sof_name FROM contract_device cd
     INNER JOIN contract c ON cd.contract_id = c.contract_id
     WHERE cd.SLid = ${slAlias}.SLid AND c.sof_name IS NOT NULL AND TRIM(c.sof_name) != ''
     ORDER BY c.contract_id DESC LIMIT 1),
    (SELECT d.Refer_SOF FROM devices d
     WHERE d.SLid = ${slAlias}.SLid AND d.Refer_SOF IS NOT NULL AND TRIM(d.Refer_SOF) != ''
     LIMIT 1)
  )`;
}

/** SQL fragments สำหรับ SOF — รองรับ sites_location.SOF และ schema แยก contract/devices */
async function resolveSlSofSchema() {
  if (schemaCache) return schemaCache;

  if (await tableColumnExists('sites_location', 'SOF')) {
    schemaCache = {
      mode: 'sites_location',
      locationSofSelect(sl = 'SL') {
        return `${sl}.SOF, ${sl}.SOF AS Refer_SOF`;
      },
      sofIsValidWhere(sl = 'sl') {
        return `${sl}.SOF IS NOT NULL AND TRIM(${sl}.SOF) != ''`;
      },
      sofMatchWhere(sl = 'SL') {
        return `(${sl}.SOF = ? OR TRIM(LEADING '0' FROM COALESCE(${sl}.SOF, '')) = ?)`;
      },
      sofMatchParams(referSof, referSofTrim) {
        return [referSof, referSofTrim];
      },
      officialContractWhere(sl = 'sl') {
        return `${sl}.status = 'official'`;
      },
      async activeContractSlidsQuery() {
        const hasStatus = await tableColumnExists('sites_location', 'status');
        const hasEnd = await tableColumnExists('sites_location', 'end_date');
        if (!hasStatus) {
          return {
            sql: `SELECT DISTINCT sl.SLid FROM sites_location sl WHERE 1=1`,
            params: [],
          };
        }
        const endClause = hasEnd ? ' AND (sl.end_date IS NULL OR sl.end_date >= CURDATE())' : '';
        return {
          sql: `SELECT DISTINCT sl.SLid
            FROM sites_location sl
            WHERE sl.status IN ('draft', 'official')
              AND (sl.status = 'draft' OR TRIM(COALESCE(sl.SOF, '')) != '')${endClause}`,
          params: [],
        };
      },
      async periodStartFilter(sl = 'sl', usePeriod) {
        if (!usePeriod) return { sql: '', params: [] };
        if (await tableColumnExists('sites_location', 'start_date')) {
          return {
            sql: ` AND ${sl}.start_date IS NOT NULL AND DATE(${sl}.start_date) >= ? AND DATE(${sl}.start_date) < ?`,
            params: [],
          };
        }
        return { sql: '', params: [] };
      },
      async expiringSoonExpr(sl = 'sl') {
        if (await tableColumnExists('sites_location', 'end_date')) {
          return `COUNT(DISTINCT CASE
            WHEN ${sl}.end_date IS NOT NULL AND ${sl}.end_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
              AND ${sl}.end_date >= CURDATE()
            THEN ${sl}.SLid END)`;
        }
        return '0';
      },
    };
    return schemaCache;
  }

  const sofExpr = sofExprForSl;
  schemaCache = {
    mode: 'contract_devices',
    locationSofSelect(sl = 'SL') {
      const e = sofExpr(sl);
      return `${e} AS SOF, ${e} AS Refer_SOF`;
    },
    sofIsValidWhere(sl = 'sl') {
      return `(
        EXISTS (
          SELECT 1 FROM contract_device cd
          INNER JOIN contract c ON cd.contract_id = c.contract_id
          WHERE cd.SLid = ${sl}.SLid AND c.sof_name IS NOT NULL AND TRIM(c.sof_name) != ''
        )
        OR EXISTS (
          SELECT 1 FROM devices d
          WHERE d.SLid = ${sl}.SLid AND d.Refer_SOF IS NOT NULL AND TRIM(d.Refer_SOF) != ''
        )
      )`;
    },
    sofMatchWhere(sl = 'SL') {
      return `(
        EXISTS (
          SELECT 1 FROM contract_device cd
          INNER JOIN contract c ON cd.contract_id = c.contract_id
          WHERE cd.SLid = ${sl}.SLid
            AND (c.sof_name = ? OR TRIM(LEADING '0' FROM COALESCE(c.sof_name, '')) = ?)
        )
        OR EXISTS (
          SELECT 1 FROM devices d
          WHERE d.SLid = ${sl}.SLid
            AND (d.Refer_SOF = ? OR TRIM(LEADING '0' FROM COALESCE(d.Refer_SOF, '')) = ?)
        )
      )`;
    },
    sofMatchParams(referSof, referSofTrim) {
      return [referSof, referSofTrim, referSof, referSofTrim];
    },
    officialContractWhere(sl = 'sl') {
      return `EXISTS (
        SELECT 1 FROM contract_device cd
        INNER JOIN contract c ON cd.contract_id = c.contract_id
        WHERE cd.SLid = ${sl}.SLid AND c.status = 'official'
      )`;
    },
    async activeContractSlidsQuery() {
      if ((await tableExists('contract')) && (await tableExists('contract_device'))) {
        return {
          sql: `SELECT DISTINCT cd.SLid
            FROM contract_device cd
            INNER JOIN contract c ON c.contract_id = cd.contract_id
            WHERE c.status IN ('draft', 'official')
              AND (c.status = 'draft' OR (c.sof_name IS NOT NULL AND TRIM(c.sof_name) != ''))
              AND (c.end_date IS NULL OR c.end_date >= CURDATE())`,
          params: [],
        };
      }
      return {
        sql: `SELECT DISTINCT d.SLid AS SLid
          FROM devices d
          WHERE d.SLid IS NOT NULL AND d.Refer_SOF IS NOT NULL AND TRIM(d.Refer_SOF) != ''`,
        params: [],
      };
    },
    async periodStartFilter(sl = 'sl', usePeriod) {
      if (!usePeriod) return { sql: '', params: [] };
      if (await tableExists('contract') && (await tableExists('contract_device'))) {
        return {
          sql: ` AND EXISTS (
            SELECT 1 FROM contract_device cd
            INNER JOIN contract c ON cd.contract_id = c.contract_id
            WHERE cd.SLid = ${sl}.SLid
              AND c.start_date IS NOT NULL
              AND DATE(c.start_date) >= ?
              AND DATE(c.start_date) < ?
          )`,
          params: [],
        };
      }
      return { sql: '', params: [] };
    },
    async expiringSoonExpr(sl = 'sl') {
      if ((await tableExists('contract')) && (await tableExists('contract_device'))) {
        return `COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM contract_device cd
            INNER JOIN contract c ON cd.contract_id = c.contract_id
            WHERE cd.SLid = ${sl}.SLid
              AND c.end_date IS NOT NULL
              AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
              AND c.end_date >= CURDATE()
          ) THEN ${sl}.SLid END)`;
      }
      return '0';
    },
  };
  return schemaCache;
}

module.exports = { resolveSlSofSchema };
