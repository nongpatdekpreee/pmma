const { withCardImage } = require('./teamsCardImages');
const { isProjectOwenSnsPlan } = require('../utils/projectOwenSns');
const { TENANT_SNS, TENANT_TCC, webhookUrlForTenant } = require('../utils/tenantScope');

const STATUS_LABELS = {
  'not-started': 'Pending',
  working: 'In Progress',
  stuck: 'Stuck',
  done: 'Done',
};

const MAX_LIST_PER_TYPE = 15;

function getWebhookUrl(tenant) {
  return webhookUrlForTenant(tenant || TENANT_SNS, 'upcoming');
}

function dash(value) {
  if (value == null || String(value).trim() === '') return '—';
  return String(value).trim();
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
      return combined || (e?.id != null ? `#${e.id}` : '—');
    })
    .join(', ');
}

function daysUntilStart(startDateStr) {
  if (!startDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${startDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}

function formatCountdown(days) {
  if (days == null) return '';
  if (days === 0) return '**Today**';
  if (days === 1) return '**Tomorrow**';
  return `in **${days} days**`;
}

function formatWindowEnd(days) {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildPlanLine(plan) {
  const type = String(plan.taskType || 'PM').toUpperCase();
  const days = daysUntilStart(plan.startDate);
  const countdown = formatCountdown(days);
  const site = dash(plan.siteName);
  const sof = dash(plan.sofName);
  const schedule =
    plan.startDate === plan.endDate || !plan.endDate
      ? dash(plan.startDate)
      : `${dash(plan.startDate)} → ${dash(plan.endDate)}`;
  const eng = formatEngineers(plan.engineers);
  const status = formatStatus(plan.status);

  let line = `**#${plan.id}** · ${type} · ${site}`;
  if (countdown) line += ` · ${countdown}`;
  line += `\n`;
  line += `   ${schedule} · ${status}`;
  if (sof !== '—') line += ` · SOF: ${sof}`;
  line += `\n   Engineers: ${eng}`;
  if (type === 'MA' && plan.assignedService) {
    line += ` · Service: ${dash(plan.assignedService)}`;
  }
  return line;
}

function buildPlansMarkdown(plans, label, emoji) {
  if (!plans.length) {
    return `_No ${label} plans in this window._`;
  }
  const shown = plans.slice(0, MAX_LIST_PER_TYPE);
  const lines = shown.map((p) => buildPlanLine(p));
  const more = plans.length > MAX_LIST_PER_TYPE
    ? `\n_+${plans.length - MAX_LIST_PER_TYPE} more ${label} plan(s)_`
    : '';
  return lines.join('\n\n') + more;
}

function buildUpcomingMessageCard({ plans, windowDays }) {
  const pmPlans = plans.filter((p) => String(p.taskType || '').toUpperCase() === 'PM');
  const maPlans = plans.filter((p) => String(p.taskType || '').toUpperCase() === 'MA');
  const total = plans.length;
  const now = new Date();
  const runLabel = now.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const windowEnd = formatWindowEnd(windowDays);
  const todayStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const themeColor = total > 0 ? '0EA5E9' : '64748B';

  const sections = [
    withCardImage(
      {
        activityTitle: '📆 Upcoming PM/MA Plans',
        activitySubtitle: `Weekly summary · ${runLabel}`,
        markdown: true,
        text:
          total > 0
            ? `Found **${total}** open plan(s) starting between **${todayStr}** and **${windowEnd}** (next **${windowDays}** days).`
            : `No open **PM** or **MA** plans starting in the next **${windowDays}** days.`,
      },
      'upcoming',
      { hero: true }
    ),
    withCardImage(
      {
        title: `📅 Preventive Maintenance (${pmPlans.length})`,
        markdown: true,
        text: buildPlansMarkdown(pmPlans, 'PM', '📅'),
      },
      'pm'
    ),
    withCardImage(
      {
        title: `🔧 Maintenance Agreement (${maPlans.length})`,
        markdown: true,
        text: buildPlansMarkdown(maPlans, 'MA', '🔧'),
      },
      'ma'
    ),
  ];

  if (total > 0) {
    const urgent = plans.filter((p) => {
      const d = daysUntilStart(p.startDate);
      return d != null && d <= 7;
    });
    sections.push({
      title: '⏰ Attention',
      markdown: true,
      text:
        urgent.length > 0
          ? `**${urgent.length}** plan(s) start within **7 days** — please review assignments and site readiness.`
          : 'No plans starting within the next 7 days.',
    });
  }

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor,
    summary: `Upcoming PM/MA Plans: ${total} in ${windowDays} days`,
    sections,
  };
}

async function partitionPlansByTenant(plans) {
  const list = Array.isArray(plans) ? plans : [];
  const sns = [];
  const tcc = [];
  for (const plan of list) {
    const isSns = await isProjectOwenSnsPlan({
      assets: plan?.assets,
      replacementDeviceId: plan?.replacementDeviceId ?? plan?.replacement_device_id,
      contractId: plan?.contractId ?? plan?.contract_id,
      siteId: plan?.siteId ?? plan?.site_id,
    });
    if (isSns) sns.push(plan);
    else tcc.push(plan);
  }
  return { sns, tcc };
}

async function postUpcomingForTenant(tenant, tenantPlans, windowDays) {
  const webhookUrl = getWebhookUrl(tenant);
  if (!webhookUrl) {
    console.warn(`[teamsUpcomingPlans] skip ${tenant}: set Teams upcoming webhook`);
    return { sent: false, reason: 'no_webhook', tenant };
  }
  if (!tenantPlans.length) {
    return { sent: false, reason: 'none', tenant, pmCount: 0, maCount: 0 };
  }
  const payload = buildUpcomingMessageCard({ plans: tenantPlans, windowDays });
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[teamsUpcomingPlans] ${tenant} HTTP ${res.status}: ${text.slice(0, 500)}`);
      return { sent: false, reason: 'http_error', status: res.status, tenant };
    }
    return {
      sent: true,
      tenant,
      pmCount: tenantPlans.filter((p) => String(p.taskType).toUpperCase() === 'PM').length,
      maCount: tenantPlans.filter((p) => String(p.taskType).toUpperCase() === 'MA').length,
    };
  } catch (err) {
    console.error(`[teamsUpcomingPlans] ${tenant} request failed:`, err.message);
    return { sent: false, reason: 'network_error', tenant };
  }
}

async function notifyTeamsUpcomingPlans({ plans, windowDays }) {
  const { sns, tcc } = await partitionPlansByTenant(plans);
  const snsResult = await postUpcomingForTenant(TENANT_SNS, sns, windowDays);
  const tccResult = await postUpcomingForTenant(TENANT_TCC, tcc, windowDays);
  return {
    sent: Boolean(snsResult.sent || tccResult.sent),
    sns: snsResult,
    tcc: tccResult,
    pmCount: (snsResult.pmCount || 0) + (tccResult.pmCount || 0),
    maCount: (snsResult.maCount || 0) + (tccResult.maCount || 0),
  };
}

module.exports = {
  notifyTeamsUpcomingPlans,
  buildUpcomingMessageCard,
  getWebhookUrl,
};
