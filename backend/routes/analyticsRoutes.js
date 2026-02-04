const express = require('express');
const router = express.Router();

const { getMaPmAnalytics, getSlaAnalytics, getSlaContracts } = require('../controllers/analyticsController');

// GET /api/analytics/ma-pm?months=6
router.get('/ma-pm', getMaPmAnalytics);

// GET /api/analytics/sla?months=6
router.get('/sla', getSlaAnalytics);

// GET /api/analytics/sla/contracts?months=6
router.get('/sla/contracts', getSlaContracts);

module.exports = router;

