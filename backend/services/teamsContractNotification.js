const { withCardImage } = require('./teamsCardImages');

const WEBHOOK_ENV = 'TEAMS_WEBHOOK_PROJECT_OWEN_SNS';

const EVENT_META = {
  created: { emoji: '📄', title: 'New Contract', themeColor: '059669' },
  renewed: { emoji: '🔄', title: 'Contract Renewed', themeColor: '0D9488' },
  updated: { emoji: '✏️', title: 'Contract Updated', themeColor: '2563EB' },
  sof_changed: { emoji: '🔢', title: 'SOF Changed', themeColor: 'D97706' },
  terminated: { emoji: '⛔', title: 'Contract Not Renewing', themeColor: 'DC2626' },
};

function getWebhookUrl() {
  const url = process.env[WEBHOOK_ENV];
  return url && String(url).trim() ? String(url).trim() : null;
}

function dash(value) {
  if (value == null || String(value).trim() === '') return '—';
  const s = String(value).trim();
  return s.length > 4000 ? `${s.slice(0, 3997)}…` : s;
}

function fact(name, value) {
  return { name, value: dash(value) };
}

function formatDateRange(start, end) {
  const s = dash(start);
  const e = dash(end);
  if (s === '—' && e === '—') return '—';
  if (s === e || e === '—') return s;
  return `${s} → ${e}`;
}

function formatDevicesMarkdown(devices) {
  if (!Array.isArray(devices) || devices.length === 0) return '_No devices on contract_';
  const items = devices.slice(0, 8).map((d) => {
    const name = d.CI_Name || d.Asset_Number || `Device ${d.Did}`;
    const serial = d.serial ? ` · ${d.serial}` : '';
    return `• **${name}** _(#${d.Did})_${serial}`;
  });
  const more = devices.length > 8 ? `\n_+${devices.length - 8} more device(s)_` : '';
  return items.join('\n') + more;
}

function buildSubtitle() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} ${time}`;
}

function buildMessageCard({ event, contract, devices = [], meta = {} }) {
  const ev = EVENT_META[event] || EVENT_META.updated;
  const site = dash(contract?.site_name);
  const location = dash(contract?.site_location);
  const siteLine = location !== '—' ? `${site} — ${location}` : site;

  const overviewFacts = [
    fact('Contract ID', contract?.contract_id != null ? `#${contract.contract_id}` : '—'),
    fact('Contract name', contract?.contract_name),
    fact('SOF', contract?.sof_name),
    fact('Status', contract?.status),
    fact('Period', formatDateRange(contract?.start_date, contract?.end_date)),
    fact('Site', siteLine),
    fact('Assigned service', contract?.Assigned_Service),
    fact('Sale account', contract?.sale_account),
  ];

  const sections = [
    withCardImage(
      {
        activityTitle: `${ev.emoji} ${ev.title}`,
        activitySubtitle: `Contract · ${buildSubtitle()}`,
        markdown: true,
        text: `Contract **${dash(contract?.contract_name)}** (SOF **${dash(contract?.sof_name)}**) on **${siteLine}**.`,
      },
      'sns',
      { hero: true }
    ),
    withCardImage(
      {
        title: 'Overview',
        markdown: true,
        facts: overviewFacts,
      },
      'sns'
    ),
    {
      title: 'Devices',
      markdown: true,
      text: formatDevicesMarkdown(devices),
    },
  ];

  if (event === 'sof_changed' && (meta.oldSof != null || meta.newSof != null)) {
    sections.push({
      title: 'SOF change',
      markdown: true,
      facts: [fact('Previous SOF', meta.oldSof), fact('New SOF', meta.newSof)],
    });
  }

  if (event === 'terminated' && meta.terminationReason) {
    sections.push({
      title: 'Termination',
      markdown: true,
      text: dash(meta.terminationReason),
    });
  }

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: ev.themeColor,
    summary: `${ev.emoji} ${ev.title} · ${site}`,
    sections,
  };
}

/**
 * ส่งแจ้งเตือน Teams เมื่อสร้าง/แก้ไขสัญญา SNS (ไม่ throw)
 * @param {{ event: string, contract: object, devices?: object[], meta?: object }} payload
 */
async function notifyTeamsContractEvent(payload) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.warn(
      `[teamsContractNotification] skip: set ${WEBHOOK_ENV} in backend/.env`
    );
    return { sent: false, reason: 'no_webhook' };
  }

  const card = buildMessageCard(payload);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(
        `[teamsContractNotification] HTTP ${res.status}: ${text.slice(0, 500)}`
      );
      return { sent: false, reason: 'http_error', status: res.status };
    }
    return { sent: true };
  } catch (err) {
    console.error('[teamsContractNotification] request failed:', err.message);
    return { sent: false, reason: 'network_error' };
  }
}

module.exports = {
  notifyTeamsContractEvent,
  buildMessageCard,
  getWebhookUrl,
};
