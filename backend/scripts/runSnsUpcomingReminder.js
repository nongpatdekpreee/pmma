#!/usr/bin/env node
/**
 * รัน manual: node scripts/runSnsUpcomingReminder.js
 * ตรวจ PM/MA ของ Project_Owen SNS ที่เริ่มภายใน 30 วัน แล้วส่ง Teams webhook
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('../config/database');

const { runSnsUpcomingPlansReminder } = require('../jobs/snsUpcomingPlansReminder');

runSnsUpcomingPlansReminder()
  .then((result) => {
    console.log('Done:', result);
    process.exit(result.sent === false && result.reason === 'no_webhook' ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
