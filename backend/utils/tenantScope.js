const db = require('../config/database');

const TENANT_SNS = 'SNS';
const TENANT_TCC = 'TCC';
/** Value in devices.Owner that marks SNS tenant */
const OWNER_SNS = 'SNS';
/** @deprecated use OWNER_SNS — kept for callers that still import this name */
const PROJECT_OWEN_SNS = OWNER_SNS;

function snsEmailDomain() {
  return String(process.env.TENANT_SNS_EMAIL_DOMAIN || 'shinasub.com')
    .trim()
    .toLowerCase();
}

function tccEmailDomain() {
  return String(process.env.TENANT_TCC_EMAIL_DOMAIN || 'tcc-technology.com')
    .trim()
    .toLowerCase();
}

function normalizeTenant(value) {
  const t = String(value || '').trim().toUpperCase();
  if (t === TENANT_SNS) return TENANT_SNS;
  if (t === TENANT_TCC) return TENANT_TCC;
  return null;
}

/** @shinasub.com → SNS, @tcc-technology.com → TCC */
function tenantFromEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return null;
  const domain = raw.slice(at + 1);
  if (!domain) return null;
  if (domain === snsEmailDomain()) return TENANT_SNS;
  if (domain === tccEmailDomain()) return TENANT_TCC;
  return null;
}

async function resolveTenantForUserId(userId) {
  if (userId == null || userId === '') return null;
  const [rows] = await db.execute(
    'SELECT gmail FROM user_profiles WHERE auth_user_id = ? LIMIT 1',
    [userId]
  );
  return tenantFromEmail(rows[0] && rows[0].gmail);
}

/**
 * SNS: Owner = SNS
 * TCC: everything that is not SNS (including NULL / empty / site names)
 */
function tenantDeviceFilter(tenant, alias = 'devices') {
  const col = `${alias}.Owner`;
  const isSns = `UPPER(TRIM(COALESCE(${col}, ''))) = '${OWNER_SNS}'`;
  const normalized = normalizeTenant(tenant);
  if (normalized === TENANT_SNS) {
    return { sql: ` AND ${isSns}`, params: [] };
  }
  if (normalized === TENANT_TCC) {
    return { sql: ` AND NOT (${isSns})`, params: [] };
  }
  return { sql: ' AND 1=0', params: [] };
}

/** Resolve devices.Owner for create — SNS users always get SNS */
function ownerForCreate(tenant, requested) {
  if (normalizeTenant(tenant) === TENANT_SNS) return OWNER_SNS;
  const raw = String(requested || '').trim();
  if (!raw) return null;
  if (raw.toUpperCase() === OWNER_SNS) return null;
  return raw;
}

/** @deprecated use ownerForCreate */
function projectOwenForCreate(tenant, requested) {
  return ownerForCreate(tenant, requested);
}

function snsDeviceExistsSql(slidExpr) {
  return `EXISTS (
    SELECT 1 FROM devices d_tn
    WHERE d_tn.SLid = ${slidExpr}
      AND UPPER(TRIM(COALESCE(d_tn.Owner, ''))) = '${OWNER_SNS}'
  )`;
}

/** Contract (SLid): SNS if it has an SNS device; TCC if it has none */
function tenantContractFilter(tenant, slAlias = 'sl') {
  const existsSns = snsDeviceExistsSql(`${slAlias}.SLid`);
  const normalized = normalizeTenant(tenant);
  if (normalized === TENANT_SNS) return { sql: ` AND ${existsSns}`, params: [] };
  if (normalized === TENANT_TCC) return { sql: ` AND NOT ${existsSns}`, params: [] };
  return { sql: ' AND 1=0', params: [] };
}

/** Task: SNS if contract_id or site_id SLid has an SNS device; TCC otherwise */
function tenantTaskFilter(tenant, taskAlias = 't') {
  const existsSns = `(
    ${snsDeviceExistsSql(`${taskAlias}.contract_id`)}
    OR ${snsDeviceExistsSql(`${taskAlias}.site_id`)}
  )`;
  const normalized = normalizeTenant(tenant);
  if (normalized === TENANT_SNS) return { sql: ` AND ${existsSns}`, params: [] };
  if (normalized === TENANT_TCC) return { sql: ` AND NOT ${existsSns}`, params: [] };
  return { sql: ' AND 1=0', params: [] };
}

function tenantEmployeeFilter(tenant, gmailExpr = 'p.gmail') {
  const normalized = normalizeTenant(tenant);
  if (normalized === TENANT_SNS) {
    return {
      sql: ` AND LOWER(TRIM(COALESCE(${gmailExpr}, ''))) LIKE ?`,
      params: [`%@${snsEmailDomain()}`],
    };
  }
  if (normalized === TENANT_TCC) {
    return {
      sql: ` AND LOWER(TRIM(COALESCE(${gmailExpr}, ''))) LIKE ?`,
      params: [`%@${tccEmailDomain()}`],
    };
  }
  return { sql: ' AND 1=0', params: [] };
}

async function isTaskVisibleToTenant(taskId, tenant) {
  const n = parseInt(String(taskId ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return false;
  const tf = tenantTaskFilter(tenant, 't');
  const [rows] = await db.execute(
    `SELECT 1 FROM tasks t WHERE t.id = ?${tf.sql} LIMIT 1`,
    [n, ...tf.params]
  );
  return rows.length > 0;
}

/** Resolve devices.Owner for manual MA devices */
function ownerForManualDevice(tenant, requested) {
  if (normalizeTenant(tenant) === TENANT_SNS) return OWNER_SNS;
  const raw = String(requested || '').trim();
  if (!raw || raw.toUpperCase() === OWNER_SNS) return TENANT_TCC;
  return raw;
}

/** @deprecated use ownerForManualDevice */
function projectOwenForManualDevice(tenant, requested) {
  return ownerForManualDevice(tenant, requested);
}

async function isSlidVisibleToTenant(slid, tenant) {
  const n = parseInt(String(slid ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return false;
  const cf = tenantContractFilter(tenant, 'sl');
  const [rows] = await db.execute(
    `SELECT 1 FROM sites_location sl WHERE sl.SLid = ?${cf.sql} LIMIT 1`,
    [n, ...cf.params]
  );
  return rows.length > 0;
}

function envUrl(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

/** kind: default | upcoming | expiring */
function webhookUrlForTenant(tenant, kind = 'default') {
  const t = normalizeTenant(tenant);
  if (t === TENANT_SNS) {
    if (kind === 'upcoming') {
      return envUrl('TEAMS_WEBHOOK_SNS_UPCOMING_PLANS') || envUrl('TEAMS_WEBHOOK_PROJECT_OWEN_SNS');
    }
    if (kind === 'expiring') {
      return (
        envUrl('TEAMS_WEBHOOK_CONTRACT_EXPIRING') || envUrl('TEAMS_WEBHOOK_PROJECT_OWEN_SNS')
      );
    }
    return envUrl('TEAMS_WEBHOOK_PROJECT_OWEN_SNS');
  }
  if (t === TENANT_TCC) {
    if (kind === 'upcoming') {
      return envUrl('TEAMS_WEBHOOK_TCC_UPCOMING_PLANS') || envUrl('TEAMS_WEBHOOK_TCC');
    }
    if (kind === 'expiring') {
      return envUrl('TEAMS_WEBHOOK_TCC_CONTRACT_EXPIRING') || envUrl('TEAMS_WEBHOOK_TCC');
    }
    return envUrl('TEAMS_WEBHOOK_TCC');
  }
  return null;
}

module.exports = {
  TENANT_SNS,
  TENANT_TCC,
  OWNER_SNS,
  PROJECT_OWEN_SNS,
  normalizeTenant,
  tenantFromEmail,
  resolveTenantForUserId,
  tenantDeviceFilter,
  ownerForCreate,
  projectOwenForCreate,
  tenantContractFilter,
  tenantTaskFilter,
  tenantEmployeeFilter,
  isSlidVisibleToTenant,
  isTaskVisibleToTenant,
  ownerForManualDevice,
  projectOwenForManualDevice,
  webhookUrlForTenant,
};
