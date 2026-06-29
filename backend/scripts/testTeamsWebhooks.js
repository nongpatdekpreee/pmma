#!/usr/bin/env node
/**
 * ทดสอบ Teams Incoming Webhook ทุกตัวใน .env
 * Usage: npm run teams:test-webhooks   (จาก backend หรือ root)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const WEBHOOKS = [
  { key: 'TEAMS_WEBHOOK_PROJECT_OWEN_SNS', label: 'Contract + PM/MA (ทันที)' },
  { key: 'TEAMS_WEBHOOK_SNS_UPCOMING_PLANS', label: 'สรุปแพลนใกล้ถึง (cron)' },
  { key: 'TEAMS_WEBHOOK_CONTRACT_EXPIRING', label: 'สัญญาใกล้หมด (cron)' },
];

async function testWebhook({ key, label }) {
  const raw = process.env[key];
  const url = raw && String(raw).trim() ? String(raw).trim() : null;
  if (!url) {
    console.log(`⏭️  ${key}: ไม่ได้ตั้งค่า — ข้าม`);
    return { key, ok: null, skipped: true };
  }

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: '2563EB',
    summary: 'PMMA webhook test',
    sections: [
      {
        activityTitle: '✅ Webhook test',
        text: `ทดสอบจาก \`${key}\` — ถ้าเห็นข้อความนี้ใน Teams แปลว่า webhook ใช้งานได้`,
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (res.ok) {
      console.log(`✅ ${key} (${label}): HTTP ${res.status}`);
      return { key, ok: true, status: res.status };
    }
    console.error(
      `❌ ${key} (${label}): HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`
    );
    if (res.status === 403) {
      console.error(
        '   → 403 มักหมายถึง webhook หมดอายุ/ถูกลบ — สร้าง Incoming Webhook ใหม่ใน Teams channel แล้วอัปเดต .env'
      );
    }
    return { key, ok: false, status: res.status };
  } catch (err) {
    console.error(`❌ ${key} (${label}): ${err.message}`);
    return { key, ok: false, error: err.message };
  }
}

async function main() {
  console.log('Testing Teams webhooks...\n');
  const results = [];
  for (const w of WEBHOOKS) {
    results.push(await testWebhook(w));
  }
  const failed = results.filter((r) => r.ok === false);
  const passed = results.filter((r) => r.ok === true);
  console.log(`\nสรุป: ผ่าน ${passed.length}, ล้มเหลว ${failed.length}, ข้าม ${results.length - passed.length - failed.length}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
