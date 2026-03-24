const express = require('express');
const router = express.Router();
const {
  getHolidays,
  addHoliday,
  deleteHoliday,
  clearCustomHolidays,
  restoreOfficialHolidays,
} = require('../controllers/holidayController');

// Specific paths before /:id
router.post('/clear-custom', clearCustomHolidays);
router.post('/restore-official', restoreOfficialHolidays);

router.get('/', getHolidays);
router.post('/', addHoliday);
router.delete('/:id', deleteHoliday);

module.exports = router;
