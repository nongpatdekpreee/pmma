const db = require('../config/database');

// POST - สร้าง netbox ใหม่
const createNetbox = async (req, res) => {
  try {
    const { Token, Server } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!Token || !Server) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (Token, Server)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO netbox (Token, Server) VALUES (?, ?)';
    const [result] = await db.execute(sql, [Token, Server]);

    res.status(201).json({
      success: true,
      message: 'สร้าง netbox สำเร็จ',
      data: {
        id: result.insertId,
        Token,
        Server
      }
    });
  } catch (error) {
    console.error('Error creating netbox:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง netbox',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล netbox
const getNetbox = async (req, res) => {
  try {
    const sql = 'SELECT Netid, Token, Server FROM netbox';
    const [rows] = await db.execute(sql);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting netbox:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล netbox',
      error: error.message
    });
  }
};

module.exports = {
  createNetbox,
  getNetbox
};

