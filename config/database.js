const mysql = require('mysql2');
require('dotenv').config();

// สร้าง connection pool สำหรับ database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ใช้ promise wrapper เพื่อใช้ async/await
const promisePool = pool.promise();

// ทดสอบการเชื่อมต่อ
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ เชื่อมต่อ Database ไม่สำเร็จ:', err.message);
  } else {
    console.log('✅ เชื่อมต่อ Database สำเร็จ!');
    connection.release();
  }
});

module.exports = promisePool;

