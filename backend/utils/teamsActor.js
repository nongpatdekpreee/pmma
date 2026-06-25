/**
 * @param {object | null | undefined} user — req.user จาก JWT
 * @returns {{ username: string | null, id: number | null, display: string } | null}
 */
function getTeamsActor(user) {
  if (!user || typeof user !== 'object') return null;

  const username =
    user.Username != null && String(user.Username).trim() !== ''
      ? String(user.Username).trim()
      : user.username != null && String(user.username).trim() !== ''
        ? String(user.username).trim()
        : null;

  const id =
    user.id != null && !Number.isNaN(Number(user.id)) ? Number(user.id) : null;

  const display = username || (id != null ? `User #${id}` : null);
  if (!display) return null;

  return { username, id, display };
}

module.exports = { getTeamsActor };
