const db = require('../config/database');

// POST - สร้าง device_role ใหม่
const createDeviceRole = async (req, res) => {
  try {
    const { name, slug, color } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name || !slug || !color) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete data (name, slug, color)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO device_role (name, slug, color) VALUES (?, ?, ?)';
    const [result] = await db.execute(sql, [name, slug, color]);

    res.status(201).json({
      success: true,
      message: 'Device role created successfully',
      data: {
        id: result.insertId,
        name,
        slug,
        color
      }
    });
  } catch (error) {
    console.error('Error creating device role:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating device role',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล device_roles
const getDeviceRoles = async (req, res) => {
  try {
    // ดึงข้อมูล device_roles ทั้งหมด พร้อมนับจำนวน Device ของแต่ละ device_role
    // เรียงตาม DeRoleid จากมากไปน้อย
    const sql = `
      SELECT 
        dr.DeRoleid, 
        dr.name, 
        dr.slug, 
        dr.color,
        COUNT(d.Did) AS device_count
      FROM device_role dr
      LEFT JOIN devices d ON dr.DeRoleid = d.DeRoleid
      GROUP BY dr.DeRoleid, dr.name, dr.slug, dr.color
      ORDER BY dr.DeRoleid DESC
    `;
    const [rows] = await db.execute(sql);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting device roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting device roles',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล device_role
const updateDeviceRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, color } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!name && !slug && !color) {
      return res.status(400).json({
        success: false,
        message: 'Please provide data to update (name, slug or color)'
      });
    }

    // ตรวจสอบว่า device_role มีอยู่จริงหรือไม่
    const checkSql = 'SELECT DeRoleid FROM device_role WHERE DeRoleid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device role not found'
      });
    }

    // สร้าง SQL query แบบ dynamic
    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (slug) {
      updates.push('slug = ?');
      values.push(slug);
    }
    if (color) {
      updates.push('color = ?');
      values.push(color);
    }

    values.push(id);

    const sql = `UPDATE device_role SET ${updates.join(', ')} WHERE DeRoleid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง
    const [updated] = await db.execute('SELECT DeRoleid, name, slug, color FROM device_role WHERE DeRoleid = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Device role updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating device role:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating device role',
      error: error.message
    });
  }
};

// DELETE - ลบ device_role
const deleteDeviceRole = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า device_role มีอยู่จริงหรือไม่
    const checkSql = 'SELECT DeRoleid, name FROM device_role WHERE DeRoleid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device role not found'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM device_role WHERE DeRoleid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'Device role deleted successfully',
      data: {
        id: existing[0].DeRoleid,
        name: existing[0].name
      }
    });
  } catch (error) {
    console.error('Error deleting device role:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting device role',
      error: error.message
    });
  }
};

module.exports = {
  createDeviceRole,    // POST
  getDeviceRoles,      // GET
  updateDeviceRole,    // PUT
  deleteDeviceRole     // DELETE
};

