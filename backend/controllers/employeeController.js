const db = require('../config/database');

// GET - ดึงข้อมูล Employees ทั้งหมด
const getEmployees = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    // สร้าง WHERE condition สำหรับ search
    let searchCondition = '';
    let searchParams = [];    

    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `WHERE (
        user_id LIKE ? OR 
        name LIKE ? OR 
        gmail LIKE ? OR 
        phone LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total FROM user_profiles ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT 
      profile_id,
      user_id,
      name,
      phone,
      gmail,
      type,
      employment
    FROM user_profiles 
    ${searchCondition}
    ORDER BY profile_id DESC 
    LIMIT ? OFFSET ?`;

    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);
    console.log(`Found ${rows.length} employees from database`);

    // Map data to match frontend format
    const employees = rows.map((row) => ({
      id: String(row.user_id),
      name: row.name || '',
      gmail: row.gmail || '',
      tel: row.phone || '',
      positionType: row.type || 'Technical',
      employmentType: row.employment || 'Full-Time',
    }));

    console.log(`Mapped ${employees.length} employees for response`);

    res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Employees',
      error: error.message,
    });
  }
};

// GET - ดึงข้อมูล Employee ตาม ID
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT 
      profile_id,
      user_id,
      name,
      phone,
      gmail,
      type,
      employment
    FROM user_profiles 
    WHERE user_id = ?`;

    const [rows] = await db.execute(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Employee',
      });
    }

    const employee = {
      id: String(rows[0].user_id),
      name: rows[0].name || '',
      gmail: rows[0].gmail || '',
      tel: rows[0].phone || '',
      positionType: rows[0].type || 'Technical',
      employmentType: rows[0].employment || 'Full-Time',
    };

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Employee',
      error: error.message,
    });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
};
