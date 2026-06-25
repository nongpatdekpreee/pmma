function logAuthFailure(event, details = {}) {
  console.warn('[auth]', event, {
    ...details,
    at: new Date().toISOString(),
  });
}

module.exports = { logAuthFailure };
