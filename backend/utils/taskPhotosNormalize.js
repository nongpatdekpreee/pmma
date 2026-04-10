/** เก็บ tasks.photos / report.repair_notice_paths เป็น JSON array ของ path string */

const parsePhotosArray = (raw) => {
  if (raw == null || raw === '') return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

const photosToPathStringArray = (items) => {
  const out = [];
  for (const item of items) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) out.push(t);
    } else if (item && typeof item === 'object') {
      const t = String(item.path || item.url || '').trim();
      if (t) out.push(t);
    }
  }
  return out;
};

/** จาก request body ก่อนบันทึกลง tasks.photos */
const normalizePhotosInput = (photos) => {
  if (!Array.isArray(photos)) return [];
  return photosToPathStringArray(photos);
};

/** จากค่าในคอลัมน์ DB (longtext JSON) */
const rowPhotosToPathArray = (raw) => photosToPathStringArray(parsePhotosArray(raw));

module.exports = {
  parsePhotosArray,
  photosToPathStringArray,
  normalizePhotosInput,
  rowPhotosToPathArray,
};
