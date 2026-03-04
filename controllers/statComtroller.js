const multer = require('multer');
const xlsx = require('xlsx');

// ตั้งค่า multer สำหรับรับไฟล์ Excel และ CSV
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    // ตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV หรือไม่
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
      'text/csv', // .csv
      'application/csv', // .csv (บางระบบ)
      'text/plain' // .csv (บางระบบใช้ text/plain)
    ];
    
    // ตรวจสอบจาก mimetype หรือ extension
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['xlsx', 'xls', 'xlsm', 'csv'];
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('กรุณาอัปโหลดไฟล์ Excel (.xlsx, .xls, .xlsm) หรือ CSV (.csv) เท่านั้น'), false);
    }
  }
});

// Helper function - แปลงวันที่เป็นรูปแบบ YYYY-MM-DD
const formatDate = (dateValue) => {
  if (!dateValue) return null;
  
  let date;
  
  // ถ้าเป็น string
  if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  }
  // ถ้าเป็น number (Excel serial date)
  else if (typeof dateValue === 'number') {
    // Excel serial date: วันที่ 1 มกราคม 1900 = 1
    const excelEpoch = new Date(1899, 11, 30);
    date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
  }
  // ถ้าเป็น Date object
  else if (dateValue instanceof Date) {
    date = dateValue;
  }
  else {
    return null;
  }
  
  // ตรวจสอบว่าเป็นวันที่ที่ถูกต้องหรือไม่
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // แปลงเป็น YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Helper function - ดึงวันที่จากข้อมูล row
const getDateFromRow = (row) => {
  // ลองดึงจาก mytimestamp ก่อน
  if (row.mytimestamp) {
    const date = formatDate(row.mytimestamp);
    if (date) return date;
  }
  
  // ถ้าไม่มี ลองจาก @timestamp.min
  if (row['@timestamp.min']) {
    const date = formatDate(row['@timestamp.min']);
    if (date) return date;
  }
  
  // ถ้าไม่มี ลองจาก @timestamp.max
  if (row['@timestamp.max']) {
    const date = formatDate(row['@timestamp.max']);
    if (date) return date;
  }
  
  return null;
};

// Helper function - แปลง timestamp เป็น Date object
const parseTimestamp = (timestampValue) => {
  if (!timestampValue) return null;
  
  let date;
  
  // ถ้าเป็น string
  if (typeof timestampValue === 'string') {
    date = new Date(timestampValue);
  }
  // ถ้าเป็น number (Excel serial date หรือ Unix timestamp)
  else if (typeof timestampValue === 'number') {
    // ถ้าเป็น Excel serial date (มักจะ < 100000)
    if (timestampValue < 100000) {
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + timestampValue * 24 * 60 * 60 * 1000);
    } else {
      // ถ้าเป็น Unix timestamp (milliseconds)
      date = new Date(timestampValue);
    }
  }
  // ถ้าเป็น Date object
  else if (timestampValue instanceof Date) {
    date = timestampValue;
  }
  else {
    return null;
  }
  
  // ตรวจสอบว่าเป็นวันที่ที่ถูกต้องหรือไม่
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
};

// Helper function - ตรวจสอบว่าเป็นไฟล์ CSV หรือไม่
const isCSVFile = (filename) => {
  const extension = filename.toLowerCase().split('.').pop();
  return extension === 'csv';
};

// Helper function - แปลง Date เป็น string format YYYY-MM-DD HH:mm:ss
const formatDateTime = (date) => {
  if (!date) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// POST - รับไฟล์ Excel/CSV และประมวลผลข้อมูล
const processExcelFile = async (req, res) => {
  try {
    // ตรวจสอบว่ามีไฟล์หรือไม่
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดไฟล์ Excel หรือ CSV'
      });
    }

    let data;
    const isCSV = isCSVFile(req.file.originalname);

    if (isCSV) {
      // อ่านไฟล์ CSV
      let csvString;
      try {
        csvString = req.file.buffer.toString('utf8');
      } catch (e) {
        try {
          csvString = req.file.buffer.toString('utf-8');
        } catch (e2) {
          csvString = req.file.buffer.toString('latin1');
        }
      }
      
      // ใช้ xlsx.read() กับ CSV โดยระบุ type เป็น 'string'
      const workbook = xlsx.read(csvString, { 
        type: 'string',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      // ดึง sheet แรก
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ CSV ไม่มีข้อมูล'
        });
      }
      
      const worksheet = workbook.Sheets[sheetName];
      
      // แปลงเป็น JSON
      data = xlsx.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false
      });
    } else {
      // อ่านไฟล์ Excel
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      
      // ดึง sheet แรก
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ Excel ไม่มี Sheet'
        });
      }
      
      const worksheet = workbook.Sheets[sheetName];
      
      // แปลงเป็น JSON
      data = xlsx.utils.sheet_to_json(worksheet);
    }
    
    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: `ไฟล์${isCSV ? ' CSV' : ' Excel'} ไม่มีข้อมูล`
      });
    }

    // ตรวจสอบ columns ที่จำเป็น
    const requiredColumns = [
      'mytimestamp',
      'username',
      'user.email',
      'source.ip',
      'source.as.organization.name',
      'source.geo.continent_name',
      'source.geo.country_name',
      'source.geo.city_name',
      '@timestamp.min',
      '@timestamp.max'
    ];
    
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `ไม่พบ columns ที่จำเป็น: ${missingColumns.join(', ')}`,
        missingColumns
      });
    }

    // Helper function - ตรวจสอบว่าเวลาอยู่ในช่วง firstLogin (5:30 - 12:00)
    const isInFirstLoginTimeRange = (date) => {
      if (!date) return false;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      // 5:30 AM = 330 minutes, 12:00 PM = 720 minutes
      return totalMinutes >= 330 && totalMinutes < 720;
    };

    // Helper function - ตรวจสอบว่าเวลาอยู่ในช่วง lastLogout (12:01 - 21:00)
    const isInLastLogoutTimeRange = (date) => {
      if (!date) return false;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      // 12:01 PM = 721 minutes, 21:00 PM = 1260 minutes
      return totalMinutes >= 721 && totalMinutes < 1260;
    };

    // ประมวลผลข้อมูล - จัดกลุ่มตามวันและ user
    // dailyData structure: Map<date, Map<userIdentifier, { firstLogin, lastLogout, firstSource, lastSource }>>
    const dailyData = new Map();
    
    data.forEach(row => {
      const date = getDateFromRow(row);
      
      if (!date) {
        // ข้าม row ที่ไม่มีวันที่
        return;
      }
      
      // ดึง username และ email
      const username = row.username || null;
      const email = row['user.email'] || null;
      
      // สร้าง unique user identifier (username หรือ email)
      const userIdentifier = username || email || 'Unknown';
      
      // ดึง timestamp
      const timestampMin = parseTimestamp(row['@timestamp.min']);
      const timestampMax = parseTimestamp(row['@timestamp.max']);
      
      // ดึง source info
      const sourceOrganization = row['source.as.organization.name'] || null;
      const sourceCity = row['source.geo.city_name'] || null;
      
      // เริ่มต้น dailyData สำหรับวันนี้ถ้ายังไม่มี
      if (!dailyData.has(date)) {
        dailyData.set(date, new Map());
      }
      
      const dayUsers = dailyData.get(date);
      
      // ถ้ายังไม่มี user นี้ในวันนี้ ให้สร้างใหม่
      if (!dayUsers.has(userIdentifier)) {
        dayUsers.set(userIdentifier, {
          firstLogin: null,
          lastLogout: null,
          firstSource: { organization: null, city: null },
          lastSource: { organization: null, city: null }
        });
      }
      
      const userData = dayUsers.get(userIdentifier);
      
      // หา @timestamp.min ที่น้อยที่สุด ในช่วง 8:00-12:00 (เวลาที่เข้ามาครั้งแรก)
      if (timestampMin && isInFirstLoginTimeRange(timestampMin)) {
        if (!userData.firstLogin || timestampMin < userData.firstLogin) {
          userData.firstLogin = timestampMin;
          userData.firstSource = {
            organization: sourceOrganization,
            city: sourceCity
          };
        }
      }
      
      // หา @timestamp.max ที่มากที่สุด ในช่วง 12:00-21:00 (เวลาที่ออกครั้งสุดท้าย)
      if (timestampMax && isInLastLogoutTimeRange(timestampMax)) {
        if (!userData.lastLogout || timestampMax > userData.lastLogout) {
          userData.lastLogout = timestampMax;
          userData.lastSource = {
            organization: sourceOrganization,
            city: sourceCity
          };
        }
      }
    });

    // แปลง Map เป็น Array และเรียงตามวันที่
    // กรองเฉพาะ user ที่มีทั้ง firstLogin และ lastLogout ในช่วงเวลาที่กำหนด
    const dailyStats = Array.from(dailyData.entries())
      .map(([date, usersMap]) => {
        const users = Array.from(usersMap.entries())
          // กรองเฉพาะ user ที่มีทั้ง firstLogin และ lastLogout
          .filter(([userIdentifier, userData]) => {
            return userData.firstLogin !== null && userData.lastLogout !== null;
          })
          .map(([userIdentifier, userData]) => ({
            user: userIdentifier || 'Unknown',
            firstLogin: formatDateTime(userData.firstLogin),
            firstSource: userData.firstSource || { organization: null, city: null },
            lastLogout: formatDateTime(userData.lastLogout),
            lastSource: userData.lastSource || { organization: null, city: null }
          }))
          .sort((a, b) => {
            const userA = String(a.user || '');
            const userB = String(b.user || '');
            return userA.localeCompare(userB);
          });
        
        return {
          date,
          userCount: users.length,
          users
        };
      })
      // กรองเฉพาะวันที่มี user อย่างน้อย 1 คน
      .filter(day => day.userCount > 0)
      .sort((a, b) => {
        // เรียงวันจากน้อยไปมาก (จากเก่าไปใหม่)
        return a.date.localeCompare(b.date);
      });

    // สร้าง response
    const totalDays = dailyStats.length;
    const totalUsers = new Set();
    
    dailyStats.forEach(day => {
      day.users.forEach(userObj => totalUsers.add(userObj.user));
    });

    res.status(200).json({
      success: true,
      message: 'ประมวลผลข้อมูลสำเร็จ',
      summary: {
        totalDays,
        totalUniqueUsers: totalUsers.size,
        totalRecords: data.length
      },
      dailyStats
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์',
      error: error.message
    });
  }
};

// POST - รับไฟล์ Excel/CSV และประมวลผลข้อมูล location
const processLocationFile = async (req, res) => {
  try {
    // ตรวจสอบว่ามีไฟล์หรือไม่
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดไฟล์ Excel หรือ CSV'
      });
    }

    let data;
    const isCSV = isCSVFile(req.file.originalname);

    if (isCSV) {
      let csvString;
      try {
        csvString = req.file.buffer.toString('utf8');
      } catch (e) {
        try {
          csvString = req.file.buffer.toString('utf-8');
        } catch (e2) {
          csvString = req.file.buffer.toString('latin1');
        }
      }
      
      const workbook = xlsx.read(csvString, { 
        type: 'string',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ CSV ไม่มีข้อมูล'
        });
      }
      
      const worksheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false
      });
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ Excel ไม่มี Sheet'
        });
      }
      
      const worksheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(worksheet);
    }
    
    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: `ไฟล์${isCSV ? ' CSV' : ' Excel'} ไม่มีข้อมูล`
      });
    }

    // ตรวจสอบ columns ที่จำเป็น
    const requiredColumns = [
      'mytimestamp',
      'username',
      'location.country',
      'location.city',
      'location.building',
      'location.site',
      '@timestamp.min',
      '@timestamp.max'
    ];
    
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `ไม่พบ columns ที่จำเป็น: ${missingColumns.join(', ')}`,
        missingColumns
      });
    }

    // Helper function - ตรวจสอบว่าเวลาอยู่ในช่วง firstLogin (5:30 - 12:00)
    const isInFirstLoginRange = (date) => {
      if (!date) return false;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      // 5:30 AM = 330 minutes, 12:00 PM = 720 minutes
      return totalMinutes >= 330 && totalMinutes < 720;
    };

    // Helper function - ตรวจสอบว่าเวลาอยู่ในช่วง lastLogout (12:01 - 21:00)
    const isInLastLogoutRange = (date) => {
      if (!date) return false;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      // 12:01 PM = 721 minutes, 21:00 PM = 1260 minutes
      return totalMinutes >= 721 && totalMinutes < 1260;
    };

    // ประมวลผลข้อมูล - จัดกลุ่มตามวันและ user
    const dailyData = new Map();
    
    data.forEach(row => {
      const date = getDateFromRow(row);
      
      if (!date) return;
      
      const username = row.username || 'Unknown';
      const timestampMin = parseTimestamp(row['@timestamp.min']);
      const timestampMax = parseTimestamp(row['@timestamp.max']);
      
      // ดึง location info
      const building = row['location.building'] || null;
      const site = row['location.site'] || null;
      
      if (!dailyData.has(date)) {
        dailyData.set(date, new Map());
      }
      
      const dayUsers = dailyData.get(date);
      
      if (!dayUsers.has(username)) {
        dayUsers.set(username, {
          firstLogin: null,
          lastLogout: null,
          firstLocation: { building: null, site: null },
          lastLocation: { building: null, site: null }
        });
      }
      
      const userData = dayUsers.get(username);
      
      // หา @timestamp.min ที่น้อยที่สุด ในช่วง 5:30-12:00
      if (timestampMin && isInFirstLoginRange(timestampMin)) {
        if (!userData.firstLogin || timestampMin < userData.firstLogin) {
          userData.firstLogin = timestampMin;
          userData.firstLocation = { building, site };
        }
      }
      
      // หา @timestamp.max ที่มากที่สุด ในช่วง 12:01-21:00
      if (timestampMax && isInLastLogoutRange(timestampMax)) {
        if (!userData.lastLogout || timestampMax > userData.lastLogout) {
          userData.lastLogout = timestampMax;
          userData.lastLocation = { building, site };
        }
      }
    });

    // แปลง Map เป็น Array
    const dailyStats = Array.from(dailyData.entries())
      .map(([date, usersMap]) => {
        const users = Array.from(usersMap.entries())
          .filter(([username, userData]) => {
            return userData.firstLogin !== null && userData.lastLogout !== null;
          })
          .map(([username, userData]) => ({
            user: username,
            firstLogin: formatDateTime(userData.firstLogin),
            firstLocation: userData.firstLocation,
            lastLogout: formatDateTime(userData.lastLogout),
            lastLocation: userData.lastLocation
          }))
          .sort((a, b) => String(a.user).localeCompare(String(b.user)));
        
        return {
          date,
          userCount: users.length,
          users
        };
      })
      .filter(day => day.userCount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Helper function - แปลงวันที่เป็นชื่อวัน (Mon, Tue, Wed, etc.)
    const getDayName = (dateString) => {
      const date = new Date(dateString);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[date.getDay()];
    };

    // Helper function - แปลงชั่วโมงเป็นช่วงเวลา (เช่น 11.00 - 12.00)
    const formatHourRange = (hour) => {
      const startHour = String(hour).padStart(2, '0');
      const endHour = String((hour + 1) % 24).padStart(2, '0');
      return `${startHour}.00 - ${endHour}.00`;
    };

    // เก็บข้อมูลตาม building สำหรับคำนวณสรุป
    // buildingStats: Map<building, { dayCounts: Map<dayName, count>, hourCounts: Map<hour, count>, totalUsers: Set }>
    const buildingStats = new Map();
    
    dailyStats.forEach(day => {
      const dayName = getDayName(day.date);
      
      day.users.forEach(user => {
        // ใช้ firstLocation.building หรือ lastLocation.building
        const building = user.firstLocation?.building || user.lastLocation?.building || 'Unknown';
        
        if (!buildingStats.has(building)) {
          buildingStats.set(building, {
            dayCounts: new Map(),
            hourCounts: new Map(),
            totalUsers: new Set(),
            allHourCounts: [] // เก็บจำนวนผู้ใช้ทุกชั่วโมงเพื่อคำนวณ off-peak avg
          });
        }
        
        const stats = buildingStats.get(building);
        stats.totalUsers.add(user.user);
        
        // นับตามวัน
        if (!stats.dayCounts.has(dayName)) {
          stats.dayCounts.set(dayName, 0);
        }
        stats.dayCounts.set(dayName, stats.dayCounts.get(dayName) + 1);
        
        // นับตามชั่วโมง (ใช้ firstLogin)
        if (user.firstLogin) {
          const loginDate = new Date(user.firstLogin);
          const hour = loginDate.getHours();
          
          if (!stats.hourCounts.has(hour)) {
            stats.hourCounts.set(hour, 0);
          }
          stats.hourCounts.set(hour, stats.hourCounts.get(hour) + 1);
          
          // เก็บจำนวนผู้ใช้ทุกชั่วโมง
          stats.allHourCounts.push(hour);
        }
      });
    });

    // คำนวณสรุปตาม building
    const buildingSummary = Array.from(buildingStats.entries())
      .map(([building, stats]) => {
        // หา Peak Day
        let peakDay = 'N/A';
        let peakDayCount = 0;
        stats.dayCounts.forEach((count, dayName) => {
          if (count > peakDayCount) {
            peakDayCount = count;
            peakDay = dayName;
          }
        });
        
        // หา Peak Hour
        let peakHour = 'N/A';
        let peakHourValue = -1;
        let peakOccupancy = 0;
        stats.hourCounts.forEach((count, hour) => {
          if (count > peakOccupancy) {
            peakOccupancy = count;
            peakHourValue = hour;
            peakHour = formatHourRange(hour);
          }
        });
        
        // คำนวณ Off-peak Avg (ค่าเฉลี่ยชั่วโมงที่ไม่ใช่ peak hour)
        let offPeakAvg = 0;
        if (stats.allHourCounts.length > 0) {
          // นับจำนวนผู้ใช้ในแต่ละชั่วโมง (ไม่รวม peak hour)
          const hourCounts = new Map();
          stats.allHourCounts.forEach(hour => {
            if (hour !== peakHourValue) {
              if (!hourCounts.has(hour)) {
                hourCounts.set(hour, 0);
              }
              hourCounts.set(hour, hourCounts.get(hour) + 1);
            }
          });
          
          // คำนวณค่าเฉลี่ย
          if (hourCounts.size > 0) {
            const totalOffPeak = Array.from(hourCounts.values()).reduce((sum, count) => sum + count, 0);
            offPeakAvg = Math.round((totalOffPeak / hourCounts.size) * 100) / 100;
          }
        }
        
        // คำนวณ Utilization (เปอร์เซ็นต์การใช้งาน)
        // Utilization = (Peak Occupancy / Total Unique Users) * 100
        // หมายถึง: เปอร์เซ็นต์ของผู้ใช้ทั้งหมดที่ใช้งานพร้อมกันในชั่วโมง peak
        // ตัวอย่าง: Peak Occupancy = 45, Total Unique Users = 150
        // Utilization = (45 / 150) * 100 = 30%
        // หมายความว่า 30% ของผู้ใช้ทั้งหมดใช้งานพร้อมกันในชั่วโมง peak
        const totalUniqueUsers = stats.totalUsers.size;
        let utilization = 0;
        if (totalUniqueUsers > 0) {
          utilization = Math.round((peakOccupancy / totalUniqueUsers) * 100);
        }
        
        // ให้ Recommendation ตาม Utilization
        let recommendation = 'สถานะปกติ';
        if (utilization >= 90) {
          recommendation = 'เพิ่มที่นั่ง/พื้นที่ - การใช้งานสูงมาก';
        } else if (utilization >= 75) {
          recommendation = 'พิจารณาเพิ่มที่นั่ง/พื้นที่ - การใช้งานสูง';
        } else if (utilization >= 50) {
          recommendation = 'สถานะเหมาะสม';
        } else if (utilization >= 25) {
          recommendation = 'การใช้งานปานกลาง';
        } else {
          recommendation = 'การใช้งานต่ำ - พิจารณาปรับปรุงพื้นที่';
        }
        
        return {
          'location.building': building,
          'Peak Day': peakDay,
          'Peak Hour': peakHour,
          'Peak Occupancy': peakOccupancy,
          'Off-peak Avg': offPeakAvg,
          'Utilization': `${utilization}%`,
          'Recommendation': recommendation
        };
      })
      .sort((a, b) => String(a['location.building']).localeCompare(String(b['location.building'])));

    const totalDays = dailyStats.length;
    const totalUsers = new Set();
    dailyStats.forEach(day => {
      day.users.forEach(u => totalUsers.add(u.user));
    });

    res.status(200).json({
      success: true,
      message: 'ประมวลผลข้อมูลสำเร็จ',
      summary: {
        totalDays,
        totalUniqueUsers: totalUsers.size,
        totalRecords: data.length,
        buildingSummary
      },
      dailyStats
    });

  } catch (error) {
    console.error('Error processing location file:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์',
      error: error.message
    });
  }
};

// Middleware สำหรับ upload file
const uploadMiddleware = upload.single('excelFile');

// Middleware สำหรับ upload 2 files
const uploadMultipleMiddleware = upload.fields([
  { name: 'sourceFile', maxCount: 1 },
  { name: 'locationFile', maxCount: 1 }
]);

// Helper function - อ่านไฟล์และแปลงเป็น JSON
const readFileToJson = (file) => {
  const isCSV = isCSVFile(file.originalname);
  let data;

  if (isCSV) {
    let csvString;
    try {
      csvString = file.buffer.toString('utf8');
    } catch (e) {
      try {
        csvString = file.buffer.toString('utf-8');
      } catch (e2) {
        csvString = file.buffer.toString('latin1');
      }
    }
    
    const workbook = xlsx.read(csvString, { 
      type: 'string',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    
    const worksheet = workbook.Sheets[sheetName];
    data = xlsx.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false
    });
  } else {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    
    const worksheet = workbook.Sheets[sheetName];
    data = xlsx.utils.sheet_to_json(worksheet);
  }

  return data;
};

// POST - รับ 2 ไฟล์และรวมข้อมูล (source + location)
const processCombinedFiles = async (req, res) => {
  try {
    // ตรวจสอบว่ามีไฟล์ทั้ง 2 หรือไม่
    if (!req.files || !req.files.sourceFile || !req.files.locationFile) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดทั้ง 2 ไฟล์ (sourceFile และ locationFile)'
      });
    }

    const sourceFile = req.files.sourceFile[0];
    const locationFile = req.files.locationFile[0];

    // อ่านข้อมูลจากทั้ง 2 ไฟล์
    const sourceData = readFileToJson(sourceFile);
    const locationData = readFileToJson(locationFile);

    if (sourceData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไฟล์ sourceFile ไม่มีข้อมูล'
      });
    }

    if (locationData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไฟล์ locationFile ไม่มีข้อมูล'
      });
    }

    // ตรวจสอบ columns ที่จำเป็นสำหรับ sourceFile
    const sourceRequiredColumns = [
      'mytimestamp', 'username', 'source.as.organization.name', 
      'source.geo.city_name', '@timestamp.min', '@timestamp.max'
    ];
    const sourceFirstRow = sourceData[0];
    const sourceMissingColumns = sourceRequiredColumns.filter(col => !(col in sourceFirstRow));
    
    if (sourceMissingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `sourceFile ไม่พบ columns ที่จำเป็น: ${sourceMissingColumns.join(', ')}`
      });
    }

    // ตรวจสอบ columns ที่จำเป็นสำหรับ locationFile
    const locationRequiredColumns = [
      'mytimestamp', 'username', 'location.building', 
      'location.site', '@timestamp.min', '@timestamp.max'
    ];
    const locationFirstRow = locationData[0];
    const locationMissingColumns = locationRequiredColumns.filter(col => !(col in locationFirstRow));
    
    if (locationMissingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `locationFile ไม่พบ columns ที่จำเป็น: ${locationMissingColumns.join(', ')}`
      });
    }

    // Helper functions สำหรับตรวจสอบช่วงเวลา
    const isInFirstLoginRange = (date) => {
      if (!date) return false;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      return totalMinutes >= 330 && totalMinutes < 720; // 5:30 AM - 12:00 PM
    };

    const isInLastLogoutRange = (date) => {
      if (!date) return false;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      return totalMinutes >= 721 && totalMinutes < 1260; // 12:01 PM - 21:00 PM
    };

    // ประมวลผล sourceData
    const sourceUserData = new Map(); // Map<date_user, { firstLogin, lastLogout, firstSource, lastSource }>
    
    sourceData.forEach(row => {
      const date = getDateFromRow(row);
      if (!date) return;
      
      const username = row.username || row['user.email'] || 'Unknown';
      const key = `${date}_${username}`;
      
      const timestampMin = parseTimestamp(row['@timestamp.min']);
      const timestampMax = parseTimestamp(row['@timestamp.max']);
      const organization = row['source.as.organization.name'] || null;
      const city = row['source.geo.city_name'] || null;
      
      if (!sourceUserData.has(key)) {
        sourceUserData.set(key, {
          date,
          username,
          firstLogin: null,
          lastLogout: null,
          firstSource: { organization: null, city: null },
          lastSource: { organization: null, city: null }
        });
      }
      
      const userData = sourceUserData.get(key);
      
      if (timestampMin && isInFirstLoginRange(timestampMin)) {
        if (!userData.firstLogin || timestampMin < userData.firstLogin) {
          userData.firstLogin = timestampMin;
          userData.firstSource = { organization, city };
        }
      }
      
      if (timestampMax && isInLastLogoutRange(timestampMax)) {
        if (!userData.lastLogout || timestampMax > userData.lastLogout) {
          userData.lastLogout = timestampMax;
          userData.lastSource = { organization, city };
        }
      }
    });

    // ประมวลผล locationData
    const locationUserData = new Map(); // Map<date_user, { firstLogin, lastLogout, firstLocation, lastLocation }>
    
    locationData.forEach(row => {
      const date = getDateFromRow(row);
      if (!date) return;
      
      const username = row.username || 'Unknown';
      const key = `${date}_${username}`;
      
      const timestampMin = parseTimestamp(row['@timestamp.min']);
      const timestampMax = parseTimestamp(row['@timestamp.max']);
      const building = row['location.building'] || null;
      const site = row['location.site'] || null;
      
      if (!locationUserData.has(key)) {
        locationUserData.set(key, {
          date,
          username,
          firstLogin: null,
          lastLogout: null,
          firstLocation: { building: null, site: null },
          lastLocation: { building: null, site: null }
        });
      }
      
      const userData = locationUserData.get(key);
      
      if (timestampMin && isInFirstLoginRange(timestampMin)) {
        if (!userData.firstLogin || timestampMin < userData.firstLogin) {
          userData.firstLogin = timestampMin;
          userData.firstLocation = { building, site };
        }
      }
      
      if (timestampMax && isInLastLogoutRange(timestampMax)) {
        if (!userData.lastLogout || timestampMax > userData.lastLogout) {
          userData.lastLogout = timestampMax;
          userData.lastLocation = { building, site };
        }
      }
    });

    // รวมข้อมูลจากทั้ง 2 แหล่ง
    const combinedData = new Map(); // Map<date, Map<username, combinedUserData>>
    
    // เพิ่มข้อมูลจาก sourceData
    sourceUserData.forEach((userData, key) => {
      const { date, username } = userData;
      
      if (!combinedData.has(date)) {
        combinedData.set(date, new Map());
      }
      
      const dayUsers = combinedData.get(date);
      
      if (!dayUsers.has(username)) {
        dayUsers.set(username, {
          firstLogin: null,
          lastLogout: null,
          firstSource: { organization: null, city: null },
          lastSource: { organization: null, city: null },
          firstLocation: { building: null, site: null },
          lastLocation: { building: null, site: null }
        });
      }
      
      const combined = dayUsers.get(username);
      combined.firstLogin = userData.firstLogin;
      combined.lastLogout = userData.lastLogout;
      combined.firstSource = userData.firstSource;
      combined.lastSource = userData.lastSource;
    });

    // เพิ่มข้อมูลจาก locationData
    locationUserData.forEach((userData, key) => {
      const { date, username } = userData;
      
      if (!combinedData.has(date)) {
        combinedData.set(date, new Map());
      }
      
      const dayUsers = combinedData.get(date);
      
      if (!dayUsers.has(username)) {
        dayUsers.set(username, {
          firstLogin: null,
          lastLogout: null,
          firstSource: { organization: null, city: null },
          lastSource: { organization: null, city: null },
          firstLocation: { building: null, site: null },
          lastLocation: { building: null, site: null }
        });
      }
      
      const combined = dayUsers.get(username);
      
      // ถ้ายังไม่มี firstLogin จาก source หรือ location มี firstLogin ที่เร็วกว่า
      if (userData.firstLogin) {
        if (!combined.firstLogin || userData.firstLogin < combined.firstLogin) {
          combined.firstLogin = userData.firstLogin;
        }
      }
      
      // ถ้ายังไม่มี lastLogout จาก source หรือ location มี lastLogout ที่ช้ากว่า
      if (userData.lastLogout) {
        if (!combined.lastLogout || userData.lastLogout > combined.lastLogout) {
          combined.lastLogout = userData.lastLogout;
        }
      }
      
      combined.firstLocation = userData.firstLocation;
      combined.lastLocation = userData.lastLocation;
    });

    // Group ตาม username - รวมข้อมูลหลายวันของแต่ละ user
    const userGroupedData = new Map(); // Map<username, Array<dayData>>
    
    combinedData.forEach((usersMap, date) => {
      usersMap.forEach((userData, username) => {
        // ข้าม user ที่ชื่อเป็น null, undefined, empty string หรือ 'Unknown'
        if (!username || username === 'Unknown' || String(username).trim() === '') return;
        
        // กรองเฉพาะ user ที่มีทั้ง firstLogin และ lastLogout
        if (userData.firstLogin === null || userData.lastLogout === null) return;
        
        if (!userGroupedData.has(username)) {
          userGroupedData.set(username, []);
        }
        
        userGroupedData.get(username).push({
          date,
          firstLogin: formatDateTime(userData.firstLogin),
          firstSource: userData.firstSource,
          firstLocation: userData.firstLocation,
          lastLogout: formatDateTime(userData.lastLogout),
          lastSource: userData.lastSource,
          lastLocation: userData.lastLocation
        });
      });
    });

    // แปลง Map เป็น Array และเรียงตาม username
    const userStats = Array.from(userGroupedData.entries())
      .map(([username, days]) => {
        // เรียงวันจากเก่าไปใหม่
        days.sort((a, b) => a.date.localeCompare(b.date));
        
        return {
          user: username,
          totalDays: days.length,
          days
        };
      })
      .sort((a, b) => String(a.user).localeCompare(String(b.user)));

    const totalUsers = userStats.length;
    const totalDays = new Set();
    userStats.forEach(user => {
      user.days.forEach(day => totalDays.add(day.date));
    });

    res.status(200).json({
      success: true,
      message: 'รวมข้อมูลสำเร็จ (Group by user)',
      summary: {
        totalUniqueUsers: totalUsers,
        totalUniqueDays: totalDays.size,
        sourceRecords: sourceData.length,
        locationRecords: locationData.length
      },
      userStats
    });

  } catch (error) {
    console.error('Error processing combined files:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์',
      error: error.message
    });
  }
};

module.exports = {
  processExcelFile,
  processLocationFile,
  processCombinedFiles,
  uploadMiddleware,
  uploadMultipleMiddleware
};
