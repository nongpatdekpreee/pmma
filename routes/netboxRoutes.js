const express = require('express');
const router = express.Router();
const {
  createNetbox,
  getNetbox
} = require('../controllers/netboxController');

// POST - สร้าง Netbox ใหม่
router.post('/', createNetbox);

// GET - ดึงข้อมูล Netbox
router.get('/', getNetbox);

module.exports = router;

