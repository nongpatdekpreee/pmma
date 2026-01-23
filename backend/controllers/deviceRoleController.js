const db = require('../config/database');

// POST - สร้าง Device_Role ใหม่
const createDeviceRole = async (req, res) => {
  try {
    const { name, slug, color } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name || !slug || !color) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (name, slug, color)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO Device_Role (name, slug, color) VALUES (?, ?, ?)';
    const [result] = await db.execute(sql, [name, slug, color]);

    res.status(201).json({
      success: true,
      message: 'สร้าง Device_Role สำเร็จ',
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
      message: 'เกิดข้อผิดพลาดในการสร้าง Device_Role',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล Device_Roles
const getDeviceRoles = async (req, res) => {
  try {
    // ดึงข้อมูล Device_Roles ทั้งหมด พร้อมนับจำนวน Device ของแต่ละ Device_Role
    // เรียงตาม DeRoleid จากมากไปน้อย
    const sql = `
      SELECT 
        dr.DeRoleid, 
        dr.name, 
        dr.slug, 
        dr.color,
        COUNT(d.Did) AS device_count
      FROM Device_Role dr
      LEFT JOIN Devices d ON dr.DeRoleid = d.DeRoleid
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
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device_Role',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล Device_Role
const updateDeviceRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, color } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!name && !slug && !color) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข (name, slug หรือ color)'
      });
    }

    // ตรวจสอบว่า Device_Role มีอยู่จริงหรือไม่
    const checkSql = 'SELECT DeRoleid FROM Device_Role WHERE DeRoleid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device_Role ที่ต้องการแก้ไข'
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

    const sql = `UPDATE Device_Role SET ${updates.join(', ')} WHERE DeRoleid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง
    const [updated] = await db.execute('SELECT DeRoleid, name, slug, color FROM Device_Role WHERE DeRoleid = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'แก้ไขข้อมูล Device_Role สำเร็จ',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating device role:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไข Device_Role',
      error: error.message
    });
  }
};

// DELETE - ลบ Device_Role
const deleteDeviceRole = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า Device_Role มีอยู่จริงหรือไม่
    const checkSql = 'SELECT DeRoleid, name FROM Device_Role WHERE DeRoleid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device_Role ที่ต้องการลบ'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM Device_Role WHERE DeRoleid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบ Device_Role สำเร็จ',
      data: {
        id: existing[0].DeRoleid,
        name: existing[0].name
      }
    });
  } catch (error) {
    console.error('Error deleting device role:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Device_Role',
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

