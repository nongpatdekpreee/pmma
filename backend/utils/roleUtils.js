/** Normalize DB/app role values to canonical USER | ADMIN */
function normalizeRole(role) {
  if (role == null || role === '') return 'USER';
  const r = String(role).trim().toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRATOR') return 'ADMIN';
  return 'USER';
}

/** ค่า Role สำหรับเก็บใน DB (สอดคล้องข้อมูลเดิม) */
function toDbRole(role) {
  return normalizeRole(role) === 'ADMIN' ? 'Admin' : 'user';
}

module.exports = { normalizeRole, toDbRole };
