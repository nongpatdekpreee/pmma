const { withCardImage } = require('./teamsCardImages');
const { formatChangesMarkdown } = require('../utils/teamsMessageFormat');

const WEBHOOK_ENV = 'TEAMS_WEBHOOK_PROJECT_OWEN_SNS';

const STATUS_LABELS = {
  'not-started': 'Pending',
  working: 'In Progress',
  stuck: 'Stuck',
  done: 'Done',
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

function formatDateRange(start, end) {
  const s = dash(start);
  const e = dash(end);
  if (s === '—' && e === '—') return '—';
  if (s === e || e === '—') return s;
  return `${s} → ${e}`;
}

function formatStatus(status) {
  const key = String(status || 'not-started').toLowerCase();
  return STATUS_LABELS[key] || key;
}

function formatEngineers(engineers) {
  if (!Array.isArray(engineers) || engineers.length === 0) return '—';
  return engineers
    .map((e) => {
      const parts = [e?.name, e?.lastName].filter((x) => x != null && String(x).trim() !== '');
      const combined = parts.join(' ').trim();
      return combined || (e?.id != null ? `Engineer #${e.id}` : '—');
    })
    .join(' · ');
}

function formatAssetsMarkdown(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return '_No assets listed_';
  const items = assets.slice(0, 6).map((a) => {
    if (a == null) return '—';
    if (typeof a === 'object') {
      const label = a.name || a.CI_Name || a.serialNumber || a.serial;
      const id = a.id ?? a.Did ?? a.deviceId;
      if (label && id != null) return `• **${label}** _(#${id})_`;
      if (label) return `• **${label}**`;
      if (id != null) return `• Device **#${id}**`;
      return '• Device';
    }
    return `• ${String(a)}`;
  });
  const more = assets.length > 6 ? `\n_+${assets.length - 6} more device(s)_` : '';
  return items.join('\n') + more;
}

function planMeta(taskType) {
  const t = String(taskType || 'PM').toUpperCase();
  if (t === 'MA') {
    return {
      type: 'MA',
      themeColor: '6D28D9',
      emoji: '🔧',
      label: 'Maintenance Agreement',
      accent: 'MA Plan',
      imageKey: 'ma',
    };
  }
  return {
    type: 'PM',
    themeColor: '1D4ED8',
    emoji: '📅',
    label: 'Preventive Maintenance',
    accent: 'PM Plan',
    imageKey: 'pm',
  };
}

function fact(name, value) {
  return { name, value: dash(value) };
}

function buildTimestampSubtitle() {
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
  return `${date} · ${time}`;
}

function buildPlanSections(task, { event = 'created', actor = null, changes = [] } = {}) {
  const meta = planMeta(task.taskType || task.task_type);
  const site = dash(task.siteName || task.site_name);
  const sof = dash(task.sofName || task.contract_sof_name);
  const schedule = formatDateRange(task.startDate, task.endDate);
  const engineers = formatEngineers(task.engineers);
  const status = formatStatus(task.status);
  const assetsMd = formatAssetsMarkdown(task.assets);

  const isUpdate = event === 'updated';
  const heroTitle = isUpdate ? `${meta.emoji} ${meta.accent} Updated` : `${meta.emoji} New ${meta.accent}`;
  const heroText = isUpdate
    ? `**${meta.type}** plan **#${task.id}** was updated.`
    : `A new **${meta.type}** schedule has been created.`;

  const overviewFacts = [
    fact('Task ID', `#${task.id}`),
    fact('Site', site),
    fact('Contract / SOF', sof),
    fact('Schedule', schedule),
    fact('Status', status),
  ];

  const sections = [
    withCardImage(
      {
        activityTitle: heroTitle,
        activitySubtitle: `${meta.label} · PM/MA Plan · ${buildTimestampSubtitle()}`,
        markdown: true,
        text: heroText,
      },
      meta.imageKey,
      { hero: true }
    ),
  ];

  if (actor?.display) {
    sections.push({
      title: isUpdate ? 'Updated by' : 'Created by',
      markdown: true,
      facts: [fact(isUpdate ? 'Updated by' : 'Created by', actor.display)],
    });
  }

  if (isUpdate && changes.length > 0) {
    sections.push({
      title: 'What changed',
      markdown: true,
      text: formatChangesMarkdown(changes),
    });
  }

  sections.push(
    withCardImage(
      {
        title: 'Overview',
        markdown: true,
        facts: overviewFacts,
      },
      'sns'
    ),
    {
      title: 'Team',
      markdown: true,
      facts: [fact('Assigned engineers', engineers)],
    },
    {
      title: 'Assets',
      markdown: true,
      text: assetsMd,
    }
  );

  const notes = dash(task.notes);
  if (notes !== '—') {
    sections.push({
      title: 'Notes',
      markdown: true,
      text: notes,
    });
  }

  return { sections, meta, site, isUpdate };
}

function buildMessageCard(task, options = {}) {
  const { sections, meta, site } = buildPlanSections(task, options);
  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: meta.themeColor,
    summary: `${meta.emoji} ${options.event === 'updated' ? 'Updated' : 'New'} ${meta.type} Plan · ${site}`,
    sections,
  };
}

async function postTeamsCard(payload, logTag) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.warn(`[${logTag}] skip: set ${WEBHOOK_ENV} in backend/.env for Teams plan alerts`);
    return { sent: false, reason: 'no_webhook' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[${logTag}] HTTP ${res.status}: ${text.slice(0, 500)}`);
      return { sent: false, reason: 'http_error', status: res.status };
    }

    return { sent: true };
  } catch (err) {
    console.error(`[${logTag}] request failed:`, err.message);
    return { sent: false, reason: 'network_error' };
  }
}

/**
 * @param {object} task
 * @param {{ actor?: object }} [options]
 */
async function notifyTeamsPlanCreated(task, options = {}) {
  const card = buildMessageCard(task, { event: 'created', ...options });
  return postTeamsCard(card, 'teamsPlanNotification');
}

/**
 * @param {object} task
 * @param {{ actor?: object, changes?: Array }} [options]
 */
async function notifyTeamsPlanUpdated(task, options = {}) {
  const card = buildMessageCard(task, { event: 'updated', ...options });
  return postTeamsCard(card, 'teamsPlanNotification');
}

module.exports = {
  notifyTeamsPlanCreated,
  notifyTeamsPlanUpdated,
  buildMessageCard,
  getWebhookUrl,
};
