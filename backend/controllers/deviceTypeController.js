const db = require('../config/database');

// POST - สร้าง device_type ใหม่
const createDeviceType = async (req, res) => {
  try {
    const { model, slug, u_height, Mid } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!model || !slug || u_height === undefined || !Mid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete data (model, slug, u_height, Mid)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO device_type (model, slug, u_height, Mid) VALUES (?, ?, ?, ?)';
    const [result] = await db.execute(sql, [model, slug, u_height, Mid]);

    res.status(201).json({
      success: true,
      message: 'Device type created successfully',
      data: {
        id: result.insertId,
        model,
        slug,
        u_height,
        Mid
      }
    });
  } catch (error) {
    console.error('Error creating device type:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating device type',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล device_types
const getDeviceTypes = async (req, res) => {
  try {
    // ดึงข้อมูล device_types ทั้งหมด พร้อมนับจำนวน Device ของแต่ละ device_type
    // JOIN กับ manufacturer และ LEFT JOIN กับ devices เพื่อนับจำนวน
    // เรียงตาม Dtypeid จากมากไปน้อย
    const sql = `
      SELECT 
        dt.Dtypeid, 
        dt.model, 
        dt.slug, 
        dt.u_height, 
        dt.Mid, 
        m.name AS manufacturer_name,
        COUNT(d.Did) AS device_count
      FROM device_type dt
      INNER JOIN manufacturer m ON dt.Mid = m.Mid
      LEFT JOIN devices d ON dt.Dtypeid = d.Dtypeid
      GROUP BY dt.Dtypeid, dt.model, dt.slug, dt.u_height, dt.Mid, m.name
      ORDER BY dt.Dtypeid DESC
    `;
    const [rows] = await db.execute(sql);

    // แปลงข้อมูลให้มีชื่อฟิลด์ที่ชัดเจน
    const formattedData = rows.map(row => ({
      Dtypeid: row.Dtypeid,
      model: row.model,
      slug: row.slug,
      u_height: row.u_height,
      Mid: row.Mid,
      manufacturer_name: row.manufacturer_name,
      device_count: row.device_count
    }));

    res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData
    });
  } catch (error) {
    console.error('Error getting device types:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting device types',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล device_type
const updateDeviceType = async (req, res) => {
  try {
    const { id } = req.params;
    const { model, slug, u_height, Mid } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!model && !slug && u_height === undefined && !Mid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide data to update (model, slug, u_height or Mid)'
      });
    }

    // ตรวจสอบว่า device_type มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Dtypeid FROM device_type WHERE Dtypeid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device type not found'
      });
    }

    // สร้าง SQL query แบบ dynamic
    const updates = [];
    const values = [];

    if (model) {
      updates.push('model = ?');
      values.push(model);
    }
    if (slug) {
      updates.push('slug = ?');
      values.push(slug);
    }
    if (u_height !== undefined) {
      updates.push('u_height = ?');
      values.push(u_height);
    }
    if (Mid) {
      updates.push('Mid = ?');
      values.push(Mid);
    }

    values.push(id);

    const sql = `UPDATE device_type SET ${updates.join(', ')} WHERE Dtypeid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง (พร้อม JOIN manufacturer)
    const [updated] = await db.execute(
      `SELECT Dtypeid, model, device_type.slug, u_height, device_type.Mid, manufacturer.name 
       FROM device_type, manufacturer 
       WHERE device_type.Mid = manufacturer.Mid AND device_type.Dtypeid = ?`,
      [id]
    );

    const formattedData = updated.map(row => ({
      Dtypeid: row.Dtypeid,
      model: row.model,
      slug: row.slug,
      u_height: row.u_height,
      Mid: row.Mid,
      manufacturer_name: row.name
    }));

    res.status(200).json({
      success: true,
      message: 'Device type updated successfully',
      data: formattedData[0]
    });
  } catch (error) {
    console.error('Error updating device type:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating device type',
      error: error.message
    });
  }
};

// DELETE - ลบ device_type
const deleteDeviceType = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า device_type มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Dtypeid, model FROM device_type WHERE Dtypeid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device type not found'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM device_type WHERE Dtypeid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'Device type deleted successfully',
      data: {
        id: existing[0].Dtypeid,
        model: existing[0].model
      }
    });
  } catch (error) {
    console.error('Error deleting device type:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting device type',
      error: error.message
    });
  }
};

module.exports = {
  createDeviceType,    // POST
  getDeviceTypes,      // GET
  updateDeviceType,    // PUT
  deleteDeviceType     // DELETE
};

