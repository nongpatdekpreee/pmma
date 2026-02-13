const db = require('../config/database');

// Helper function - สร้าง user_id ถัดไปโดยอัตโนมัติ (ใช้เลขที่ว่างก่อน)
const generateNextUserId = async () => {
  try {
    // ดึง user_id ทั้งหมดจาก database
    const sql = `SELECT user_id FROM user_profiles ORDER BY user_id DESC`;
    const [rows] = await db.execute(sql);
    
    if (rows.length === 0) {
      // ถ้ายังไม่มีข้อมูลเลย ให้เริ่มที่ 1
      return '1';
    }
    
    // แปลง user_id ทั้งหมดเป็นตัวเลขและเก็บไว้ใน array
    const numericIds = [];
    for (const row of rows) {
      const userId = String(row.user_id);
      // ดึงเฉพาะตัวเลขออกมา
      const numericPart = userId.replace(/\D/g, '');
      if (numericPart) {
        const num = parseInt(numericPart, 10);
        if (!isNaN(num)) {
          numericIds.push(num);
        }
      }
    }
    
    if (numericIds.length === 0) {
      // ถ้าไม่มี user_id ที่เป็นตัวเลขเลย ให้เริ่มที่ 1
      return '1';
    }
    
    // เรียงลำดับตัวเลขจากน้อยไปมาก
    numericIds.sort((a, b) => a - b);
    
    // หาเลขที่ว่างที่น้อยที่สุด (gap filling)
    // เริ่มจาก 1 ไปจนถึง max + 1
    const maxId = Math.max(...numericIds);
    
    // สร้าง Set เพื่อหาง่ายขึ้น
    const idSet = new Set(numericIds);
    
    // หาเลขที่ว่างที่น้อยที่สุด
    for (let i = 1; i <= maxId; i++) {
      if (!idSet.has(i)) {
        console.log(`Found gap: using user_id ${i} (max was: ${maxId})`);
        return i.toString();
      }
    }
    
    // ถ้าไม่มีเลขว่างแล้ว ให้ใช้เลขถัดไปจาก max
    const nextId = (maxId + 1).toString();
    console.log(`No gaps found: using next user_id ${nextId} (max was: ${maxId})`);
    return nextId;
  } catch (error) {
    console.error('Error generating next user_id:', error);
    throw error;
  }
};

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

    // Map data to match frontend format (รองรับทั้ง name, Name, Username จาก DB)
    const employees = rows.map((row) => ({
      id: String(row.user_id),
      name: row.name ?? row.Name ?? row.Username ?? row.username ?? '',
      gmail: row.gmail || '',
      tel: row.phone || row.Phone || '',
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

    const row = rows[0];
    const employee = {
      id: String(row.user_id),
      name: row.name ?? row.Name ?? row.Username ?? row.username ?? '',
      gmail: row.gmail || '',
      tel: (row.phone ?? row.Phone) || '',
      positionType: row.type || 'Technical',
      employmentType: row.employment || 'Full-Time',
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

// POST - สร้าง Employee ใหม่
const createEmployee = async (req, res) => {
  try {
    const { name, gmail, tel, positionType, employmentType } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name || !gmail || !tel) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (name, gmail, tel)',
      });
    }

    // สร้าง user_id ใหม่โดยอัตโนมัติ (ใช้เลขที่ว่างก่อน)
    let newUserId = await generateNextUserId();

    // ตรวจสอบว่า user_id นี้มีอยู่แล้วหรือไม่ (ป้องกัน race condition)
    const checkSql = `SELECT user_id FROM user_profiles WHERE user_id = ?`;
    const [existing] = await db.execute(checkSql, [newUserId]);
    
    if (existing.length > 0) {
      // ถ้ามีแล้ว (อาจเกิดจาก race condition) ให้ลองหาใหม่
      newUserId = await generateNextUserId();
      const [retryExisting] = await db.execute(checkSql, [newUserId]);
      if (retryExisting.length > 0) {
        throw new Error('ไม่สามารถสร้าง user_id ที่ไม่ซ้ำได้ กรุณาลองใหม่อีกครั้ง');
      }
    }

    // แปลง employmentType ให้ตรงกับ enum ใน database
    let employment = employmentType || 'Full-Time';
    if (employment.toLowerCase().includes('full')) {
      employment = 'Full-Time';
    } else if (employment.toLowerCase().includes('contract')) {
      employment = 'Contract';
    } else if (employment.toLowerCase().includes('part')) {
      employment = 'Part-Time';
    }

    // แปลง positionType
    let type = positionType || 'Technical';
    if (type !== 'Technical' && type !== 'Management') {
      type = 'Technical';
    }

    // สร้าง employee ใหม่
    const insertSql = `INSERT INTO user_profiles 
      (user_id, name, gmail, phone, type, employment) 
      VALUES (?, ?, ?, ?, ?, ?)`;
    
    await db.execute(insertSql, [
      newUserId,
      name,
      gmail,
      tel,
      type,
      employment,
    ]);

    // ดึงข้อมูล employee ที่สร้างใหม่
    const getSql = `SELECT 
      profile_id,
      user_id,
      name,
      phone,
      gmail,
      type,
      employment
    FROM user_profiles 
    WHERE user_id = ?`;

    const [newEmployee] = await db.execute(getSql, [newUserId]);

    const row = newEmployee[0];
    const employee = {
      id: String(row.user_id),
      name: row.name ?? row.Name ?? row.Username ?? row.username ?? '',
      gmail: row.gmail || '',
      tel: (row.phone ?? row.Phone) || '',
      positionType: row.type || 'Technical',
      employmentType: row.employment || 'Full-Time',
    };

    res.status(201).json({
      success: true,
      message: 'สร้าง Employee สำเร็จ',
      data: employee,
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง Employee',
      error: error.message,
    });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
};
