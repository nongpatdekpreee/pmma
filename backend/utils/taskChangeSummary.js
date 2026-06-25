const STATUS_LABELS = {
  'not-started': 'Pending',
  working: 'In Progress',
  stuck: 'Stuck',
  done: 'Done',
};

function displayVal(v) {
  if (v == null || String(v).trim() === '') return '—';
  const s = String(v).trim();
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

function normDate(v) {
  if (v == null || v === '') return null;
  return String(v).split('T')[0].trim() || null;
}

function formatStatus(status) {
  const key = String(status || 'not-started').toLowerCase();
  return STATUS_LABELS[key] || key;
}

function formatEngineers(engineers) {
  if (!engineers) return '—';
  let list = engineers;
  if (typeof engineers === 'string') {
    try {
      list = JSON.parse(engineers);
    } catch {
      return displayVal(engineers);
    }
  }
  if (!Array.isArray(list) || list.length === 0) return '—';
  return list
    .map((e) => {
      const parts = [e?.name, e?.lastName].filter((x) => x != null && String(x).trim() !== '');
      const combined = parts.join(' ').trim();
      return combined || (e?.id != null ? `#${e.id}` : '—');
    })
    .join(', ');
}

function pushChange(changes, label, from, to) {
  const f = displayVal(from);
  const t = displayVal(to);
  if (f !== t) changes.push({ label, from: f, to: t });
}

/**
 * @param {object} existing — แถว tasks จาก DB
 * @param {object} body — req.body
 */
function collectTaskChanges(existing, body) {
  const changes = [];

  if (body.taskType !== undefined) {
    pushChange(
      changes,
      'Task type',
      String(existing.task_type || '').toUpperCase(),
      String(body.taskType || '').toUpperCase()
    );
  }
  if (body.status !== undefined) {
    pushChange(changes, 'Status', formatStatus(existing.status), formatStatus(body.status));
  }
  if (body.startDate !== undefined) {
    pushChange(changes, 'Start date', normDate(existing.start_date), normDate(body.startDate));
  }
  if (body.endDate !== undefined) {
    pushChange(changes, 'End date', normDate(existing.end_date), normDate(body.endDate));
  }
  if (body.siteName !== undefined) {
    pushChange(changes, 'Site', existing.site_name, body.siteName);
  }
  if (body.vendorName !== undefined) {
    pushChange(changes, 'Vendor', existing.vendor_name, body.vendorName);
  }
  if (body.engineers !== undefined) {
    pushChange(changes, 'Engineers', formatEngineers(existing.engineers), formatEngineers(body.engineers));
  }
  if (body.coverageScope !== undefined) {
    pushChange(changes, 'Coverage scope', existing.coverage_scope, body.coverageScope);
  }
  if (body.notes !== undefined) {
    const from = existing.notes;
    const to = body.notes;
    if (displayVal(from) !== displayVal(to)) {
      changes.push({ label: 'Notes', from: displayVal(from), to: displayVal(to) });
    }
  }
  if (body.assets !== undefined) {
    changes.push({ label: 'Assets', from: '—', to: 'Updated' });
  }

  return changes;
}

module.exports = { collectTaskChanges };
