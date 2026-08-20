const { withCardImage } = require('./teamsCardImages');
const { isProjectOwenSnsContract } = require('../utils/projectOwenSns');
const { TENANT_SNS, TENANT_TCC, webhookUrlForTenant } = require('../utils/tenantScope');

const MAX_LIST = 20;

function getWebhookUrl(tenant) {
  return webhookUrlForTenant(tenant || TENANT_SNS, 'expiring');
}

function dash(value) {
  if (value == null || String(value).trim() === '') return '—';
  return String(value).trim();
}

function daysUntilEnd(endDateStr) {
  if (!endDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${String(endDateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

function formatCountdown(days) {
  if (days == null) return '';
  if (days === 0) return '**Expires today**';
  if (days === 1) return '**Expires tomorrow**';
  return `**${days} days left**`;
}

function siteLine(contract) {
  const site = dash(contract.site_name);
  const loc = dash(contract.site_location);
  return loc !== '—' ? `${site} — ${loc}` : site;
}

function buildContractLine(contract) {
  const days = daysUntilEnd(contract.end_date);
  const countdown = formatCountdown(days);
  const name = dash(contract.contract_name);
  const sof = dash(contract.sof_name);
  const end = dash(contract.end_date);
  let line = `**#${contract.contract_id}** · ${name}`;
  if (countdown) line += ` · ${countdown}`;
  line += `\n   ${siteLine(contract)} · SOF: ${sof} · End: ${end}`;
  return line;
}

function buildContractsMarkdown(contracts, label) {
  if (!contracts.length) return `_No contracts in this group._`;
  const shown = contracts.slice(0, MAX_LIST);
  const lines = shown.map(buildContractLine);
  const more =
    contracts.length > MAX_LIST
      ? `\n_+${contracts.length - MAX_LIST} more contract(s)_`
      : '';
  return lines.join('\n\n') + more;
}

function buildExpiringMessageCard({ contracts, windowDays, trigger = 'daily' }) {
  const total = contracts.length;
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

  const withDays = contracts.map((c) => ({
    ...c,
    daysLeft: daysUntilEnd(c.end_date),
  }));

  const expiringToday = withDays.filter((c) => c.daysLeft === 0);
  const within7 = withDays.filter((c) => c.daysLeft != null && c.daysLeft >= 1 && c.daysLeft <= 7);
  const later = withDays.filter((c) => c.daysLeft != null && c.daysLeft > 7);

  const urgentCount = expiringToday.length + within7.length;
  const themeColor = expiringToday.length > 0 ? 'DC2626' : urgentCount > 0 ? 'D97706' : '0EA5E9';

  const isChange = trigger === 'change';
  const heroTitle = isChange
    ? total === 1
      ? '⏳ Contract updated — expiring soon'
      : '⏳ Contracts updated — expiring soon'
    : '⏳ Contracts expiring soon';
  const heroSubtitle = isChange ? `Contract data changed · ${runLabel}` : `Daily reminder · ${runLabel}`;
  const heroText =
    total === 1
      ? isChange
        ? `Contract **#${withDays[0].contract_id}** was updated — ${formatCountdown(withDays[0].daysLeft)} (ends **${dash(withDays[0].end_date)}**).`
        : `**1** official contract ends within **${windowDays}** days.`
      : isChange
        ? `**${total}** updated contract(s) in the expiring window (within **${windowDays}** days).`
        : `**${total}** official contract(s) end within **${windowDays}** days (from today through expiry date).`;

  let sections;

  if (total === 1) {
    sections = [
      withCardImage(
        {
          activityTitle: heroTitle,
          activitySubtitle: heroSubtitle,
          markdown: true,
          text: heroText,
        },
        'upcoming',
        { hero: true }
      ),
      {
        title: 'Contract',
        markdown: true,
        text: buildContractLine(withDays[0]),
      },
    ];
  } else {
    sections = [
      withCardImage(
        {
          activityTitle: heroTitle,
          activitySubtitle: heroSubtitle,
          markdown: true,
          text: heroText,
        },
        'upcoming',
        { hero: true }
      ),
      {
        title: `🔴 Expires today (${expiringToday.length})`,
        markdown: true,
        text: buildContractsMarkdown(expiringToday, 'today'),
      },
      {
        title: `🟠 Within 7 days (${within7.length})`,
        markdown: true,
        text: buildContractsMarkdown(within7, '7d'),
      },
      {
        title: `📋 8–${windowDays} days left (${later.length})`,
        markdown: true,
        text: buildContractsMarkdown(later, 'later'),
      },
    ];
  }

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor,
    summary: isChange
      ? `Contract expiring (updated): ${total} within ${windowDays} days`
      : `Contracts expiring: ${total} within ${windowDays} days`,
    sections,
  };
}

async function partitionContractsByTenant(contracts) {
  const list = Array.isArray(contracts) ? contracts : [];
  const sns = [];
  const tcc = [];
  for (const contract of list) {
    const isSns = await isProjectOwenSnsContract({
      contractId: contract?.contract_id ?? contract?.SLid ?? contract?.site_id,
      deviceIds: [],
    });
    if (isSns) sns.push(contract);
    else tcc.push(contract);
  }
  return { sns, tcc };
}

async function postExpiringForTenant(tenant, tenantContracts, windowDays, trigger) {
  const webhookUrl = getWebhookUrl(tenant);
  if (!webhookUrl) {
    console.warn(`[teamsExpiringContracts] skip ${tenant}: set Teams expiring webhook`);
    return { sent: false, reason: 'no_webhook', tenant, contractCount: 0 };
  }
  if (!tenantContracts.length) {
    return { sent: false, reason: 'none_expiring', tenant, contractCount: 0 };
  }
  const payload = buildExpiringMessageCard({
    contracts: tenantContracts,
    windowDays,
    trigger,
  });
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[teamsExpiringContracts] ${tenant} HTTP ${res.status}: ${text.slice(0, 500)}`);
      return { sent: false, reason: 'http_error', status: res.status, tenant };
    }
    return { sent: true, tenant, contractCount: tenantContracts.length };
  } catch (err) {
    console.error(`[teamsExpiringContracts] ${tenant} request failed:`, err.message);
    return { sent: false, reason: 'network_error', tenant };
  }
}

async function notifyTeamsExpiringContracts({ contracts, windowDays, trigger = 'daily' }) {
  if (!contracts.length) {
    return { sent: false, reason: 'none_expiring', contractCount: 0 };
  }
  const { sns, tcc } = await partitionContractsByTenant(contracts);
  const snsResult = await postExpiringForTenant(TENANT_SNS, sns, windowDays, trigger);
  const tccResult = await postExpiringForTenant(TENANT_TCC, tcc, windowDays, trigger);
  return {
    sent: Boolean(snsResult.sent || tccResult.sent),
    sns: snsResult,
    tcc: tccResult,
    contractCount: (snsResult.contractCount || 0) + (tccResult.contractCount || 0),
  };
}

module.exports = {
  notifyTeamsExpiringContracts,
  buildExpiringMessageCard,
  getWebhookUrl,
  daysUntilEnd,
};
