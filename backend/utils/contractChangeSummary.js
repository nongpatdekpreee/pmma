const slc = require('../lib/siteLocationContract');

function normDateYmd(v) {
  if (v == null || v === '') return null;
  const s = String(v).split('T')[0].trim();
  return s || null;
}

function normStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function displayVal(v) {
  if (v == null || String(v).trim() === '') return '—';
  const s = String(v).trim();
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

function jsonContact(field) {
  if (field == null) return null;
  if (typeof field === 'object') {
    if (Array.isArray(field)) return null;
    if (Object.keys(field).length === 0) return null;
    return JSON.stringify(field);
  }
  const trimmed = String(field).trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    JSON.parse(trimmed);
  } catch {
    return null;
  }
  return trimmed;
}

function contactComparable(field) {
  const j = jsonContact(field);
  if (j == null) return '';
  try {
    return JSON.stringify(JSON.parse(j));
  } catch {
    return j;
  }
}

function jsonPaths(field) {
  if (Array.isArray(field)) return JSON.stringify(field);
  if (field && String(field).trim()) return String(field).trim();
  return null;
}

function pathsComparable(field) {
  const j = jsonPaths(field);
  if (j == null) return '';
  try {
    return JSON.stringify(JSON.parse(j));
  } catch {
    return j;
  }
}

function pushChange(changes, label, from, to) {
  const f = displayVal(from);
  const t = displayVal(to);
  if (f !== t) changes.push({ label, from: f, to: t });
}

/**
 * สรุปฟิลด์ที่เปลี่ยนจาก body เทียบกับแถว sites_location เดิม
 * @returns {Array<{ label: string, from: string, to: string }>}
 */
function collectContractChanges(existing, body, { skipNotRenewingStatus = false } = {}) {
  const changes = [];

  if (body.site_device_pairs !== undefined) {
    changes.push({ label: 'Site / devices', from: '—', to: 'Updated' });
  }

  if (body.start_date !== undefined) {
    pushChange(changes, 'Start date', normDateYmd(existing.start_date), normDateYmd(body.start_date));
  }
  if (body.end_date !== undefined) {
    pushChange(changes, 'End date', normDateYmd(existing.end_date), normDateYmd(body.end_date));
  }
  if (body.sof_name !== undefined) {
    pushChange(
      changes,
      'SOF',
      existing.SOF != null ? String(existing.SOF).trim() : null,
      body.sof_name != null ? String(body.sof_name).trim() : null
    );
  }
  if (body.contract_name !== undefined) {
    pushChange(
      changes,
      'Contract name',
      slc.resolveContractNameFromRow(existing),
      body.contract_name
    );
  }
  if (body.status !== undefined) {
    const inc = normStr(body.status).toLowerCase();
    const cur = normStr(existing.status).toLowerCase();
    if (!(skipNotRenewingStatus && inc === 'not_renewing') && inc !== cur) {
      pushChange(changes, 'Status', cur || '—', inc || '—');
    }
  }
  if (body.sla_term !== undefined) {
    const incoming =
      body.sla_term != null && String(body.sla_term).trim() !== ''
        ? String(body.sla_term).trim()
        : '2';
    const current =
      existing.sla_term != null && String(existing.sla_term).trim() !== ''
        ? String(existing.sla_term).trim()
        : '2';
    pushChange(changes, 'SLA term', current, incoming);
  }
  if (body.assigned_service !== undefined) {
    pushChange(changes, 'Assigned service', existing.Assigned_Service, body.assigned_service);
  }
  if (body.sale_account !== undefined) {
    pushChange(changes, 'Sale account', existing.sale_account, body.sale_account);
  }
  if (body.tel_acc !== undefined) {
    pushChange(changes, 'Contact phone', existing.tel_acc, body.tel_acc);
  }
  if (body.email_acc !== undefined) {
    pushChange(changes, 'Contact email', existing.email_acc, body.email_acc);
  }
  if (body.coverage_scope !== undefined) {
    pushChange(changes, 'Coverage scope', existing.coverage_scope, body.coverage_scope);
  }
  if (body.contact !== undefined) {
    const from = contactComparable(existing.contact);
    const to = contactComparable(body.contact);
    if (from !== to) {
      changes.push({ label: 'Contact', from: from ? 'Previous value' : '—', to: to ? 'Updated' : '—' });
    }
  }
  if (body.pm_time_per_year !== undefined) {
    pushChange(
      changes,
      'PM times / year',
      normStr(existing.pm_time_per_year) || '2',
      normStr(body.pm_time_per_year) || '2'
    );
  }
  if (body.termination_reason !== undefined && normStr(body.termination_reason)) {
    changes.push({
      label: 'Termination reason',
      from: '—',
      to: displayVal(body.termination_reason),
    });
  }

  return changes;
}

module.exports = { collectContractChanges };
