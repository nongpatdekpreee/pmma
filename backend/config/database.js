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
const originalExecute = promisePool.execute.bind(promisePool);
promisePool.execute = function (sql, params) {
  return promisePool.query(sql, params);
};

// ทดสอบการเชื่อมต่อ (retry สำหรับ Docker — MySQL อาจยังไม่พร้อมตอน backend start)
async function testDbConnection(retries = 15, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = await promisePool.getConnection();
      console.log('✅ เชื่อมต่อ Database สำเร็จ!');
      connection.release();
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= retries) {
        console.error('❌ เชื่อมต่อ Database ไม่สำเร็จ:', msg);
        return;
      }
      console.warn(`⏳ รอ Database... (${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

void testDbConnection();

/** ปิด pool — ใช้ก่อน process.exit ใน CLI scripts เพื่อไม่ให้ libuv assertion crash บน Windows */
async function closePool() {
  return new Promise((resolve, reject) => {
    pool.end((err) => (err ? reject(err) : resolve()));
  });
}

promisePool.closePool = closePool;

module.exports = promisePool;

