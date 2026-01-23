const db = require('../config/database');

// POST - สร้าง Site ใหม่
const createSite = async (req, res) => {
  try {
    const { name, slug, status } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name || !slug || !status) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (Name, Slug, Status)'
      });
    }

    // SQL Query
    const sql = 'INSERT INTO Sites (Name, Slug, Status) VALUES (?, ?, ?)';
    const [result] = await db.execute(sql, [name, slug, status]);

    res.status(201).json({
      success: true,
      message: 'สร้าง Site สำเร็จ',
      data: {
        id: result.insertId,
        name,
        slug,
        status
      }
    });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง Site',
      error: error.message
    });
  }
};

// GET - ดึง Sites_Location (สำหรับ contract.site_id = SLid, dropdown Site)
const getSitesLocation = async (req, res) => {
  try {
    const sql = `
      SELECT SL.SLid, S.Name AS SiteName, L.Location2
      FROM Sites_Location SL
      JOIN Sites S ON SL.Sid = S.Sid
      JOIN Location L ON SL.lid = L.lid
      ORDER BY S.Name, L.Location2
    `;
    const [rows] = await db.execute(sql);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting sites-location:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Sites_Location',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล Sites
const getSites = async (req, res) => {
  try {
    // ดึงข้อมูล Sites ทั้งหมด พร้อมนับจำนวน Device ของแต่ละ Site
    // เรียงตาม Sid จากมากไปน้อย
    const sql = `
      SELECT 
        s.Sid, 
        s.Name, 
        s.Slug, 
        s.Status,
        COUNT(d.Did) AS device_count
      FROM Sites s
      LEFT JOIN Devices d ON s.Sid = d.SLid
      GROUP BY s.Sid, s.Name, s.Slug, s.Status
      ORDER BY s.Sid DESC
    `;
    const [rows] = await db.execute(sql);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting sites:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Site',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล Site
const updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, Slug, Status } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!Name && !Slug && !Status) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข'
      });
    }

    // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Sid FROM Sites WHERE Sid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Site ที่ต้องการแก้ไข'
      });
    }

    // สร้าง SQL query แบบ dynamic
    const updates = [];
    const values = [];

    if (Name) {
      updates.push('Name = ?');
      values.push(Name);
    }
    if (Slug) {
      updates.push('Slug = ?');
      values.push(Slug);
    }
    if (Status) {
      updates.push('Status = ?');
      values.push(Status);
    }

    values.push(id);

    const sql = `UPDATE Sites SET ${updates.join(', ')} WHERE Sid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง
    const [updated] = await db.execute('SELECT Sid, Name, Slug, Status FROM Sites WHERE Sid = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'แก้ไขข้อมูล Site สำเร็จ',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไข Site',
      error: error.message
    });
  }
};

// DELETE - ลบ Site
const deleteSite = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Sid, Name FROM Sites WHERE Sid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Site ที่ต้องการลบ'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM Sites WHERE Sid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบ Site สำเร็จ',
      data: {
        id: existing[0].Sid,
        Name: existing[0].Name
      }
    });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Site',
      error: error.message
    });
  }
};

module.exports = {
  createSite,       // POST
  getSites,         // GET
  getSitesLocation, // GET /locations
  updateSite,       // PUT
  deleteSite        // DELETE
};

