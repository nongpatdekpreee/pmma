const { isContractMergeEnabled } = require('../lib/featureFlags');

/**
 * Gate routes behind ENABLE_CONTRACT_MERGE (default off).
 * Returns 404 when disabled so the endpoint looks unavailable.
 */
function requireContractMergeEnabled(req, res, next) {
  if (!isContractMergeEnabled()) {
    return res.status(404).json({
      success: false,
      message: 'Not found',
    });
  }
  return next();
}

module.exports = {
  requireContractMergeEnabled,
};
