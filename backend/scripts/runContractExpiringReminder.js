#!/usr/bin/env node
/**
 * รัน manual: node scripts/runContractExpiringReminder.js
 * แจ้ง Teams สัญญา official ที่จะหมดภายใน 30 วัน (ตั้งแต่วันนี้จนวันหมดอายุ)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('../config/database');

const { runContractExpiringReminder } = require('../jobs/contractExpiringReminder');

runContractExpiringReminder()
  .then((result) => {
    console.log('Done:', result);
    process.exit(result.sent === false && result.reason === 'no_webhook' ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
