const db = require('../config/database');

// POST - สร้าง Manufacturer ใหม่
const createManufacturer = async (req, res) => {
  try {
    const { name, slug } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (name, slug)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO Manufacturer (name, slug) VALUES (?, ?)';
    const [result] = await db.execute(sql, [name, slug]);

    res.status(201).json({
      success: true,
      message: 'สร้าง Manufacturer สำเร็จ',
      data: {
        id: result.insertId,
        name,
        slug
      }
    });
  } catch (error) {
    console.error('Error creating manufacturer:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง Manufacturer',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล Manufacturers
const getManufacturers = async (req, res) => {
  try {
    // ดึงข้อมูล Manufacturers ทั้งหมด พร้อมนับจำนวน Device ของแต่ละ Manufacturer
    // โดย JOIN ผ่าน Device_Type (Manufacturer -> Device_Type -> Devices)
    // เรียงตาม Mid จากมากไปน้อย
    const sql = `
      SELECT 
        m.Mid, 
        m.name, 
        m.slug,
        COUNT(d.Did) AS device_count
      FROM Manufacturer m
      LEFT JOIN Device_Type dt ON m.Mid = dt.Mid
      LEFT JOIN Devices d ON dt.Dtypeid = d.Dtypeid
      GROUP BY m.Mid, m.name, m.slug
      ORDER BY m.Mid DESC
    `;
    const [rows] = await db.execute(sql);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting manufacturers:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Manufacturer',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล Manufacturer
const updateManufacturer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!name && !slug) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข (name หรือ slug)'
      });
    }

    // ตรวจสอบว่า Manufacturer มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Mid FROM Manufacturer WHERE Mid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Manufacturer ที่ต้องการแก้ไข'
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

    values.push(id);

    const sql = `UPDATE Manufacturer SET ${updates.join(', ')} WHERE Mid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง
    const [updated] = await db.execute('SELECT Mid, name, slug FROM Manufacturer WHERE Mid = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'แก้ไขข้อมูล Manufacturer สำเร็จ',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating manufacturer:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไข Manufacturer',
      error: error.message
    });
  }
};

// DELETE - ลบ Manufacturer
const deleteManufacturer = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า Manufacturer มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Mid, name FROM Manufacturer WHERE Mid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Manufacturer ที่ต้องการลบ'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM Manufacturer WHERE Mid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบ Manufacturer สำเร็จ',
      data: {
        id: existing[0].Mid,
        name: existing[0].name
      }
    });
  } catch (error) {
    console.error('Error deleting manufacturer:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Manufacturer',
      error: error.message
    });
  }
};

module.exports = {
  createManufacturer,    // POST
  getManufacturers,      // GET
  updateManufacturer,    // PUT
  deleteManufacturer     // DELETE
};

