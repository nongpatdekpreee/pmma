const express = require('express');
const router = express.Router();

const { getMaPmAnalytics, getSlaAnalytics, getSlaContracts, getMaDashboard, getPmDashboard } = require('../controllers/analyticsController');

// GET /api/analytics/ma-pm?months=6
router.get('/ma-pm', getMaPmAnalytics);

// GET /api/analytics/sla?months=6
router.get('/sla', getSlaAnalytics);

// GET /api/analytics/sla/contracts?months=6
router.get('/sla/contracts', getSlaContracts);

// GET /api/analytics/ma-dashboard?months=6
router.get('/ma-dashboard', getMaDashboard);

// GET /api/analytics/pm-dashboard?months=6
router.get('/pm-dashboard', getPmDashboard);

module.exports = router;

