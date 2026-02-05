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
        User_id LIKE ? OR 
        Username LIKE ? OR 
        gmail LIKE ? OR 
        tel LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total FROM employees ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT 
      employee_id,
      name,
      gmail,
      tel,
      position_type,
      employment_type,
      created_at,
      updated_at
    FROM employees 
    ${searchCondition}
    ORDER BY employee_id DESC 
    LIMIT ? OFFSET ?`;

    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // Map data to match frontend format
    const employees = rows.map((row) => ({
      id: row.employee_id,
      name: row.name,
      gmail: row.gmail || '',
      tel: row.tel || '',
      positionType: row.position_type || 'Technical',
      employmentType: row.employment_type || 'Full-time',
    }));

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
      employee_id,
      name,
      gmail,
      tel,
      position_type,
      employment_type,
      created_at,
      updated_at
    FROM employees 
    WHERE employee_id = ?`;

    const [rows] = await db.execute(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Employee',
      });
    }

    const employee = {
      id: rows[0].employee_id,
      name: rows[0].name,
      gmail: rows[0].gmail || '',
      tel: rows[0].tel || '',
      positionType: rows[0].position_type || 'Technical',
      employmentType: rows[0].employment_type || 'Full-time',
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
