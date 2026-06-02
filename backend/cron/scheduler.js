const cron = require('node-cron');
const { runSnsUpcomingPlansReminder } = require('../jobs/snsUpcomingPlansReminder');

const CRON_EXPR = '00 9 * * *'; // 09:00 ทุกวัน
const TZ = process.env.CRON_TIMEZONE || 'Asia/Bangkok';

function startCronJobs() {
  const enabled = process.env.SNS_UPCOMING_CRON_ENABLED !== 'false';
  if (!enabled) {
    console.log('[cron] SNS upcoming plans reminder is disabled (SNS_UPCOMING_CRON_ENABLED=false)');
    return;
  }

  if (!cron.validate(CRON_EXPR)) {
    console.error('[cron] Invalid cron expression:', CRON_EXPR);
    return;
  }

  cron.schedule(
    CRON_EXPR,
    async () => {
      const started = new Date().toISOString();
      console.log(`[cron] SNS upcoming plans reminder started at ${started}`);
      try {
        const result = await runSnsUpcomingPlansReminder();
        console.log('[cron] SNS upcoming plans reminder finished:', result);
      } catch (err) {
        console.error('[cron] SNS upcoming plans reminder error:', err?.message || err);
      }
    },
    { timezone: TZ }
  );

  console.log(`[cron] SNS upcoming plans reminder scheduled daily at 15:40 (${TZ})`);
}

module.exports = { startCronJobs, CRON_EXPR, TZ };
