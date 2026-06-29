#!/usr/bin/env node
/**
 * รัน manual: node scripts/runContractExpiringReminder.js
 * แจ้ง Teams สัญญา official ที่จะหมดภายใน N วัน (CONTRACT_EXPIRING_DAYS)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../config/database');

const { runContractExpiringReminder } = require('../jobs/contractExpiringReminder');

function printTeamsResultHint(result) {
  if (result.sent) return;
  if (result.reason === 'none_expiring') {
    console.log('→ ไม่มีสัญญา official ในช่วงใกล้หมดอายุ — ไม่ส่ง Teams (ปกติ)');
    return;
  }
  if (result.reason === 'no_webhook') {
    console.error('→ ตั้ง TEAMS_WEBHOOK_CONTRACT_EXPIRING หรือ TEAMS_WEBHOOK_PROJECT_OWEN_SNS ใน .env');
    return;
  }
  if (result.reason === 'http_error' && result.status === 403) {
    console.error(
      '→ Teams HTTP 403: webhook หมดอายุหรือถูกลบ — สร้าง Incoming Webhook ใหม่แล้วอัปเดต .env'
    );
    console.error('→ ทดสอบ: npm run teams:test-webhooks');
  }
}

async function main() {
  const result = await runContractExpiringReminder();
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
