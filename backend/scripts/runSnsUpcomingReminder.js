#!/usr/bin/env node
/**
 * รัน manual: node scripts/runSnsUpcomingReminder.js
 * ตรวจ PM/MA ที่เริ่มภายใน 30 วัน แล้วส่ง Teams webhook
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../config/database');

const { runSnsUpcomingPlansReminder } = require('../jobs/snsUpcomingPlansReminder');

function printTeamsResultHint(result) {
  if (result.sent) return;
  if (result.reason === 'no_webhook') {
    console.error('→ ตั้ง TEAMS_WEBHOOK_SNS_UPCOMING_PLANS ใน backend/.env');
    return;
  }
  if (result.reason === 'http_error' && result.status === 403) {
    console.error(
      '→ Teams HTTP 403: webhook หมดอายุหรือถูกลบ — สร้าง Incoming Webhook ใหม่ใน channel แล้วอัปเดต .env'
    );
    console.error('→ ทดสอบ: npm run teams:test-webhooks');
    return;
  }
  if (result.reason === 'http_error') {
    console.error(`→ Teams HTTP ${result.status} — ตรวจ URL webhook ใน .env`);
  }
}

async function main() {
  const result = await runSnsUpcomingPlansReminder();
  console.log('Done:', result);
  printTeamsResultHint(result);
  const fail =
    result.sent === false &&
    (result.reason === 'no_webhook' || result.reason === 'http_error');
  process.exitCode = fail ? 1 : 0;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof db.closePool === 'function') {
      try {
        await db.closePool();
      } catch {
        /* ignore */
      }
    }
  });
