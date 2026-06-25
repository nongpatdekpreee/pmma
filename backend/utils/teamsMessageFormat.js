function dash(value) {
  if (value == null || String(value).trim() === '') return '—';
  const s = String(value).trim();
  return s.length > 4000 ? `${s.slice(0, 3997)}…` : s;
}

function formatChangesMarkdown(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return '_No field-level changes recorded_';
  }
  return changes
    .map((c) => `• **${dash(c.label)}:** ${dash(c.from)} → ${dash(c.to)}`)
    .join('\n');
}

module.exports = { formatChangesMarkdown, dash };
