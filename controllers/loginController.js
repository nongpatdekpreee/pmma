const db = require('../config/database');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

// POST - สร้าง user ใหม่
const createUser = async (req, res) => {
  try {
    const { Username, Password, Role } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!Username || !Password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก Username และ Password'
      });
    }

    // ตรวจสอบว่า Username ซ้ำหรือไม่
    const [existing] = await db.execute(
      'SELECT Username FROM user WHERE Username = ?',
      [Username]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username นี้มีอยู่ในระบบแล้ว'
      });
    }

    // เข้ารหัส Password ด้วย argon2
    const hashedPassword = await argon2.hash(Password);

    // INSERT user
    const [result] = await db.execute(
      'INSERT INTO user (Username, Password, Role) VALUES (?, ?, ?)',
      [Username, hashedPassword, Role || 'user']
    );

    res.status(201).json({
      success: true,
      message: 'สร้าง user สำเร็จ',
      data: {
        id: result.insertId,
        Username: Username,
        Role: Role || 'user'
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง user',
      error: error.message
    });
  }
};

// POST - Login
const login = async (req, res) => {
  try {
    const { Username, Password } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!Username || !Password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก Username และ Password'
      });
    }

    // ค้นหา user
    const [users] = await db.execute(
      'SELECT * FROM user WHERE Username = ?',
      [Username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username หรือ Password ไม่ถูกต้อง'
      });
    }

    const user = users[0];

    // ตรวจสอบ Password ด้วย argon2
    const isValidPassword = await argon2.verify(user.Password, Password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Username หรือ Password ไม่ถูกต้อง'
      });
    }

    // สร้าง JWT Token
    const token = jwt.sign(
      {
        id: user.User_id ,
        Username: user.Username,
        Role: user.Role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login สำเร็จ',
      data: {
        id: user.User_id ,
        Username: user.Username,
        Role: user.Role,
        token: token
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการ Login',
      error: error.message
    });
  }
};

// GET - ดึง user ทั้งหมด
const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT User_id , Username, Role FROM user ORDER BY User_id  ASC'
    );

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล user',
      error: error.message
    });
  }
};

// PUT - อัปเดต Username หรือ Password
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { Username, Password } = req.body;

    // ตรวจสอบว่ามี user อยู่หรือไม่
    const [existing] = await db.execute(
      'SELECT * FROM user WHERE User_id  = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ user ที่ต้องการแก้ไข'
      });
    }

    // ต้องมีอย่างน้อย 1 ฟิลด์ที่จะอัปเดต
    if (!Username && !Password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Username หรือ Password ที่ต้องการเปลี่ยน'
      });
    }

    // ถ้าเปลี่ยน Username ต้องตรวจสอบว่าไม่ซ้ำ
    if (Username) {
      const [duplicate] = await db.execute(
        'SELECT User_id  FROM user WHERE Username = ? AND User_id  != ?',
        [Username, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username นี้มีอยู่ในระบบแล้ว'
        });
      }
    }

    // สร้าง query แบบ dynamic
    const updates = [];
    const values = [];

    if (Username) {
      updates.push('Username = ?');
      values.push(Username);
    }

    if (Password) {
      const hashedPassword = await argon2.hash(Password);
      updates.push('Password = ?');
      values.push(hashedPassword);
    }

    values.push(id);

    await db.execute(
      `UPDATE user SET ${updates.join(', ')} WHERE User_id  = ?`,
      values
    );

    res.status(200).json({
      success: true,
      message: 'อัปเดต user สำเร็จ',
      data: {
        id: parseInt(id),
        Username: Username || existing[0].Username
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดต user',
      error: error.message
    });
  }
};

// DELETE - ลบ user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่ามี user อยู่หรือไม่
    const [existing] = await db.execute(
      'SELECT User_id , Username FROM user WHERE User_id  = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ user ที่ต้องการลบ'
      });
    }

    await db.execute('DELETE FROM user WHERE User_id  = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'ลบ user สำเร็จ',
      data: {
        id: existing[0].User_id ,
        Username: existing[0].Username
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ user',
      error: error.message
    });
  }
};

module.exports = {
  createUser,
  login,
  getAllUsers,
  updateUser,
  deleteUser
};

