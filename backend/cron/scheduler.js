const cron = require('node-cron');
const { runSnsUpcomingPlansReminder } = require('../jobs/snsUpcomingPlansReminder');
const { runContractExpiringReminder } = require('../jobs/contractExpiringReminder');

const PLANS_CRON_EXPR = '0 9 * * 1'; // จันทร์ 09:00
const CONTRACT_EXPIRING_CRON_EXPR = '0 9 * * *'; // ทุกวัน 09:00
const TZ = process.env.CRON_TIMEZONE || 'Asia/Bangkok';

function startCronJobs() {
  const plansEnabled = process.env.SNS_UPCOMING_CRON_ENABLED !== 'false';
  const contractExpiringEnabled = process.env.CONTRACT_EXPIRING_CRON_ENABLED !== 'false';

  if (plansEnabled) {
    if (!cron.validate(PLANS_CRON_EXPR)) {
      console.error('[cron] Invalid cron expression:', PLANS_CRON_EXPR);
    } else {
      cron.schedule(
        PLANS_CRON_EXPR,
        async () => {
          const started = new Date().toISOString();
          console.log(`[cron] PM/MA upcoming plans reminder started at ${started}`);
          try {
            const result = await runSnsUpcomingPlansReminder();
            console.log('[cron] PM/MA upcoming plans reminder finished:', result);
          } catch (err) {
            console.error('[cron] PM/MA upcoming plans reminder error:', err?.message || err);
          }
        },
        { timezone: TZ }
      );
      console.log(`[cron] PM/MA upcoming plans reminder scheduled every Monday at 09:00 (${TZ})`);
    }
  } else {
    console.log('[cron] PM/MA upcoming plans reminder is disabled (SNS_UPCOMING_CRON_ENABLED=false)');
  }

  if (contractExpiringEnabled) {
    if (!cron.validate(CONTRACT_EXPIRING_CRON_EXPR)) {
      console.error('[cron] Invalid cron expression:', CONTRACT_EXPIRING_CRON_EXPR);
    } else {
      cron.schedule(
        CONTRACT_EXPIRING_CRON_EXPR,
        async () => {
          const started = new Date().toISOString();
          console.log(`[cron] Contract expiring reminder started at ${started}`);
          try {
            const result = await runContractExpiringReminder();
            console.log('[cron] Contract expiring reminder finished:', result);
          } catch (err) {
            console.error('[cron] Contract expiring reminder error:', err?.message || err);
          }
        },
        { timezone: TZ }
      );
      console.log(
        `[cron] Contract expiring reminder scheduled daily at 09:00 (${TZ}) — window ${process.env.CONTRACT_EXPIRING_DAYS || '30'} days`
      );
    }
  } else {
    console.log(
      '[cron] Contract expiring reminder is disabled (CONTRACT_EXPIRING_CRON_ENABLED=false)'
    );
  }
}

module.exports = {
  startCronJobs,
  PLANS_CRON_EXPR,
  CONTRACT_EXPIRING_CRON_EXPR,
  TZ,
};
