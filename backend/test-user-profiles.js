// Script สำหรับทดสอบการดึงข้อมูลจาก user_profiles
const db = require('./config/database');

async function testUserProfiles() {
  try {
    console.log('🔍 Testing user_profiles table...\n');
    
    // ทดสอบนับจำนวน records
    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM user_profiles');
    console.log(`✅ Found ${countResult[0].total} records in user_profiles\n`);
    
    // ดึงข้อมูลทั้งหมด
    const [rows] = await db.execute(`
      SELECT 
        profile_id,
        user_id,
        name,
        phone,
        gmail,
        type,
        employment
      FROM user_profiles 
      ORDER BY profile_id DESC
    `);
    
    console.log('📋 Employee Data:');
    console.log('='.repeat(80));
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   ID: ${row.user_id}, Phone: ${row.phone}, Email: ${row.gmail}`);
      console.log(`   Type: ${row.type}, Employment: ${row.employment}`);
      console.log('');
    });
    
    // ทดสอบ query ที่ใช้ใน controller
    console.log('🧪 Testing controller query...');
    const [testRows] = await db.execute(`
      SELECT 
        profile_id,
        user_id,
        name,
        phone,
        gmail,
        type,
        employment
      FROM user_profiles 
      ORDER BY profile_id DESC 
      LIMIT 1000 OFFSET 0
    `);
    
    console.log(`✅ Controller query returned ${testRows.length} records\n`);
    
    // Map data เหมือนใน controller
    const employees = testRows.map((row) => ({
      id: String(row.user_id),
      name: row.name || '',
      gmail: row.gmail || '',
      tel: row.phone || '',
      positionType: row.type || 'Technical',
      employmentType: row.employment || 'Full-Time',
    }));
    
    console.log('📦 Mapped Employee Data (for API response):');
    console.log(JSON.stringify(employees.slice(0, 2), null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testUserProfiles();
