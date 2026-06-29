const db = require('../config/database');
const argon2 = require('argon2');
const { signAccessToken } = require('../services/tokenService');
const {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  findValidToken,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_TOKEN_COOKIE_NAME,
} = require('../services/refreshTokenService');
const { normalizeRole, toDbRole } = require('../utils/roleUtils');

// POST - สร้าง user ใหม่
const createUser = async (req, res) => {
  try {
    const { Username, Password } = req.body;

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
      [Username, hashedPassword, toDbRole('user')]
    );

    res.status(201).json({
      success: true,
      message: 'สร้าง user สำเร็จ',
      data: {
        id: result.insertId,
        Username: Username,
        Role: 'user'
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

    const role = normalizeRole(user.Role);
    const token = signAccessToken({
      id: user.User_id,
      Username: user.Username,
      Role: role,
    });
    const refreshToken = await createRefreshToken(user.User_id);
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login สำเร็จ',
      data: {
        id: user.User_id,
        Username: user.Username,
        Role: role,
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

// GET - ดึงข้อมูลผู้ใช้ที่ Login อยู่ (อ่าน Role จาก DB ล่าสุด)
const getMe = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT User_id, Username, Role FROM user WHERE User_id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้',
      });
    }

    const user = users[0];
    res.status(200).json({
      success: true,
      data: {
        id: user.User_id,
        Username: user.Username,
        Role: normalizeRole(user.Role),
      },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้',
      error: error.message,
    });
  }
};

// GET - ตรวจ session จาก refresh cookie (ไม่หมุน token) — สำหรับ middleware
const checkSession = async (req, res) => {
  try {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!raw) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบ session',
      });
    }

    const row = await findValidToken(raw);
    if (!row) {
      return res.status(401).json({
        success: false,
        message: 'session หมดอายุ',
      });
    }

    const [users] = await db.execute(
      'SELECT User_id, Username, Role FROM user WHERE User_id = ?',
      [row.user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบผู้ใช้',
      });
    }

    const user = users[0];
    res.status(200).json({
      success: true,
      data: {
        id: user.User_id,
        Username: user.Username,
        Role: normalizeRole(user.Role),
      },
    });
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบ session',
      error: error.message,
    });
  }
};

// POST - ต่ออายุ access token ด้วย refresh cookie (rotation)
const refresh = async (req, res) => {
  try {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!raw) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบ refresh token กรุณา Login ใหม่',
      });
    }

    const rotated = await rotateRefreshToken(raw);
    if (!rotated) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'refresh token ไม่ถูกต้องหรือหมดอายุ กรุณา Login ใหม่',
      });
    }

    const [users] = await db.execute(
      'SELECT User_id, Username, Role FROM user WHERE User_id = ?',
      [rotated.userId]
    );

    if (users.length === 0) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'ไม่พบผู้ใช้ กรุณา Login ใหม่',
      });
    }

    const user = users[0];
    const role = normalizeRole(user.Role);
    const token = signAccessToken({
      id: user.User_id,
      Username: user.Username,
      Role: role,
    });
    setRefreshCookie(res, rotated.refreshToken);

    res.status(200).json({
      success: true,
      message: 'ต่ออายุ token สำเร็จ',
      data: {
        id: user.User_id,
        Username: user.Username,
        Role: role,
        token,
      },
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการต่ออายุ token',
      error: error.message,
    });
  }
};

// POST - Logout (revoke refresh token + clear cookie)
const logout = async (req, res) => {
  try {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (raw) {
      await revokeRefreshToken(raw);
    }
    clearRefreshCookie(res);
    res.status(200).json({
      success: true,
      message: 'Logout สำเร็จ',
    });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการ Logout',
      error: error.message,
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
      data: users.map((u) => ({
        id: u.User_id,
        Username: u.Username,
        Role: normalizeRole(u.Role),
      })),
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
    const { Username, Password, Role, adminPassword } = req.body;

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
    if (!Username && !Password && Role === undefined) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Username, Password หรือ Role ที่ต้องการเปลี่ยน'
      });
    }

    // เปลี่ยนรหัสผ่านได้เฉพาะบัญชีตัวเอง
    if (Password && Number(id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'ไม่สามารถเปลี่ยนรหัสผ่านของผู้อื่นได้',
      });
    }

    // ห้าม ADMIN ลดสิทธิ์ตัวเอง
    if (
      Role !== undefined &&
      Number(id) === Number(req.user.id) &&
      normalizeRole(Role) !== 'ADMIN'
    ) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลดสิทธิ์บัญชีของตัวเองได้',
      });
    }

    // เปลี่ยน Role ต้องยืนยันรหัสผ่านของ admin ที่กำลังทำรายการ
    if (Role !== undefined) {
      const nextRole = normalizeRole(Role);
      const curRole = normalizeRole(existing[0].Role);
      if (nextRole !== curRole) {
        if (!adminPassword || String(adminPassword).trim() === '') {
          return res.status(400).json({
            success: false,
            message: 'กรุณายืนยันรหัสผ่านของคุณก่อนเปลี่ยน Role',
          });
        }
        const [actorRows] = await db.execute(
          'SELECT Password FROM user WHERE User_id = ?',
          [req.user.id]
        );
        if (actorRows.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'ไม่พบบัญชีผู้ดำเนินการ',
          });
        }
        const passwordOk = await argon2.verify(actorRows[0].Password, adminPassword);
        if (!passwordOk) {
          return res.status(403).json({
            success: false,
            message: 'รหัสผ่านยืนยันไม่ถูกต้อง',
          });
        }
      }
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

    if (Role !== undefined) {
      updates.push('Role = ?');
      values.push(toDbRole(Role));
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
        Username: Username || existing[0].Username,
        Role: Role !== undefined ? normalizeRole(Role) : normalizeRole(existing[0].Role),
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

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบบัญชีของตัวเองได้',
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
  getMe,
  checkSession,
  refresh,
  logout,
  getAllUsers,
  updateUser,
  deleteUser
};

