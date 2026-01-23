const db = require('../config/database');

// POST - สร้าง Device_Type ใหม่
const createDeviceType = async (req, res) => {
  try {
    const { model, slug, u_height, Mid } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!model || !slug || u_height === undefined || !Mid) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (model, slug, u_height, Mid)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO Device_Type (model, slug, u_height, Mid) VALUES (?, ?, ?, ?)';
    const [result] = await db.execute(sql, [model, slug, u_height, Mid]);

    res.status(201).json({
      success: true,
      message: 'สร้าง Device_Type สำเร็จ',
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
      message: 'เกิดข้อผิดพลาดในการสร้าง Device_Type',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล Device_Types
const getDeviceTypes = async (req, res) => {
  try {
    // ดึงข้อมูล Device_Types ทั้งหมด พร้อมนับจำนวน Device ของแต่ละ Device_Type
    // JOIN กับ Manufacturer และ LEFT JOIN กับ Devices เพื่อนับจำนวน
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
      FROM Device_Type dt
      INNER JOIN Manufacturer m ON dt.Mid = m.Mid
      LEFT JOIN Devices d ON dt.Dtypeid = d.Dtypeid
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
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device_Type',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล Device_Type
const updateDeviceType = async (req, res) => {
  try {
    const { id } = req.params;
    const { model, slug, u_height, Mid } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!model && !slug && u_height === undefined && !Mid) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข (model, slug, u_height หรือ Mid)'
      });
    }

    // ตรวจสอบว่า Device_Type มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Dtypeid FROM Device_Type WHERE Dtypeid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device_Type ที่ต้องการแก้ไข'
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

    const sql = `UPDATE Device_Type SET ${updates.join(', ')} WHERE Dtypeid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง (พร้อม JOIN Manufacturer)
    const [updated] = await db.execute(
      `SELECT Dtypeid, model, Device_Type.slug, u_height, Device_Type.Mid, Manufacturer.name 
       FROM Device_Type, Manufacturer 
       WHERE Device_Type.Mid = Manufacturer.Mid AND Device_Type.Dtypeid = ?`,
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
      message: 'แก้ไขข้อมูล Device_Type สำเร็จ',
      data: formattedData[0]
    });
  } catch (error) {
    console.error('Error updating device type:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไข Device_Type',
      error: error.message
    });
  }
};

// DELETE - ลบ Device_Type
const deleteDeviceType = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า Device_Type มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Dtypeid, model FROM Device_Type WHERE Dtypeid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device_Type ที่ต้องการลบ'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM Device_Type WHERE Dtypeid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบ Device_Type สำเร็จ',
      data: {
        id: existing[0].Dtypeid,
        model: existing[0].model
      }
    });
  } catch (error) {
    console.error('Error deleting device type:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Device_Type',
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

