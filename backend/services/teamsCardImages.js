/**
 * URL รูปสติกเกอร์สำหรับ Teams MessageCard (activityImage)
 * Teams ต้องดึงรูปผ่าน HTTPS สาธารณะ — ตั้ง PUBLIC_APP_URL เป็น URL ของ API ที่เข้าถึงได้จาก internet
 *
 * ไฟล์รูป: backend/public/teams-cards/{pm-plan|ma-plan|upcoming-plans|sns-badge}.png
 */

const CARD_FILES = {
  pm: 'pm-plan.png',
  ma: 'ma-plan.png',
  upcoming: 'upcoming-plans.png',
  sns: 'sns-badge.png',
};

/** CDN สำรองเมื่อยังไม่ตั้ง PUBLIC_APP_URL (ใช้ jsDelivr จาก GitHub ถ้า push ขึ้น repo) */
const FALLBACK_CDN_BASE =
  process.env.TEAMS_CARD_IMAGE_CDN_BASE ||
  '';

function resolvePublicBase() {
  const raw =
    process.env.PUBLIC_APP_URL ||
    process.env.TEAMS_CARD_IMAGE_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    '';
  const base = String(raw).trim().replace(/\/$/, '');
  if (!base) return null;
  return base;
}

/**
 * @param {'pm'|'ma'|'upcoming'|'sns'} key
 * @returns {string|null}
 */
function getTeamsCardImageUrl(key) {
  const file = CARD_FILES[key];
  if (!file) return null;

  const base = resolvePublicBase();
  if (base) {
    return `${base}/public/teams-cards/${file}`;
  }

  if (FALLBACK_CDN_BASE) {
    return `${String(FALLBACK_CDN_BASE).replace(/\/$/, '')}/${file}`;
  }

  return null;
}

/** ใส่รูปสติกเกอร์ใน section (hero + avatar) ถ้ามี URL สาธารณะ */
function withCardImage(section, imageKey, { hero = false } = {}) {
  const url = getTeamsCardImageUrl(imageKey);
  if (!url) return section;
  const out = { ...section, activityImage: url };
  if (hero) {
    out.heroImage = {
      image: url,
      title: section.activityTitle || 'Plan schedule',
    };
  }
  return out;
}

module.exports = {
  CARD_FILES,
  getTeamsCardImageUrl,
  withCardImage,
  resolvePublicBase,
};
