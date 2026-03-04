/**
 * ตัวอย่างการใช้งาน Stats Excel API
 * 
 * ⚠️ หมายเหตุ: การส่งไฟล์ Excel ต้องใช้ multipart/form-data ไม่ใช่ JSON
 * 
 * ไฟล์นี้แสดงตัวอย่างการใช้งาน API ในหลายรูปแบบ
 */

// ============================================
// 1. ใช้ Fetch API (Browser)
// ============================================
async function uploadExcelFileFetch(fileInput) {
  const formData = new FormData();
  formData.append('excelFile', fileInput.files[0]);

  try {
    const response = await fetch('http://localhost:5000/api/stats/process-excel', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ ประมวลผลสำเร็จ!');
      console.log('📊 จำนวนวันทั้งหมด:', data.summary.totalDays);
      console.log('👥 จำนวนผู้ใช้ทั้งหมด:', data.summary.totalUniqueUsers);
      console.log('📝 จำนวน records:', data.summary.totalRecords);
      console.log('📅 ข้อมูลรายวัน:', data.dailyStats);
    } else {
      console.error('❌ เกิดข้อผิดพลาด:', data.message);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// ============================================
// 2. ใช้ Axios (Node.js/Browser)
// ============================================
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function uploadExcelFileAxios(filePath) {
  const formData = new FormData();
  formData.append('excelFile', fs.createReadStream(filePath));

  try {
    const response = await axios.post(
      'http://localhost:5000/api/stats/process-excel',
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );

    const data = response.data;
    
    if (data.success) {
      console.log('✅ ประมวลผลสำเร็จ!');
      console.log('📊 จำนวนวันทั้งหมด:', data.summary.totalDays);
      console.log('👥 จำนวนผู้ใช้ทั้งหมด:', data.summary.totalUniqueUsers);
      console.log('📝 จำนวน records:', data.summary.totalRecords);
      
      // แสดงข้อมูลรายวัน
      data.dailyStats.forEach(day => {
        console.log(`\n📅 วันที่: ${day.date}`);
        console.log(`   👥 จำนวนผู้ใช้: ${day.userCount}`);
        console.log(`   📋 ผู้ใช้: ${day.users.join(', ')}`);
      });
    }
    
    return data;
  } catch (error) {
    if (error.response) {
      console.error('❌ Error Response:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
    throw error;
  }
}

// ============================================
// 3. ใช้ XMLHttpRequest (Browser - แบบเก่า)
// ============================================
function uploadExcelFileXHR(fileInput) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('excelFile', fileInput.files[0]);

    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', 'http://localhost:5000/api/stats/process-excel');
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data);
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error('Network Error'));
    };
    
    xhr.send(formData);
  });
}

// ============================================
// 4. ตัวอย่าง HTML Form
// ============================================
const htmlExample = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Excel File - Stats API</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
    }
    .upload-form {
      border: 2px dashed #ccc;
      border-radius: 10px;
      padding: 30px;
      text-align: center;
    }
    input[type="file"] {
      margin: 20px 0;
      padding: 10px;
    }
    button {
      background-color: #4CAF50;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    .result {
      margin-top: 30px;
      padding: 20px;
      background-color: #f5f5f5;
      border-radius: 5px;
    }
    .error {
      color: red;
    }
    .success {
      color: green;
    }
  </style>
</head>
<body>
  <h1>📊 Upload Excel File - Stats API</h1>
  
  <form id="excelForm" class="upload-form">
    <h2>เลือกไฟล์ Excel</h2>
    <input type="file" id="excelFile" accept=".xlsx,.xls,.xlsm" required>
    <br>
    <button type="submit">📤 อัปโหลดและประมวลผล</button>
  </form>

  <div id="result" class="result" style="display: none;"></div>

  <script>
    document.getElementById('excelForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('excelFile');
      const resultDiv = document.getElementById('result');
      
      if (!fileInput.files[0]) {
        alert('กรุณาเลือกไฟล์');
        return;
      }

      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<p>⏳ กำลังประมวลผล...</p>';

      const formData = new FormData();
      formData.append('excelFile', fileInput.files[0]);

      try {
        const response = await fetch('http://localhost:5000/api/stats/process-excel', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.success) {
          let html = '<div class="success">';
          html += '<h2>✅ ประมวลผลสำเร็จ!</h2>';
          html += '<p><strong>📊 จำนวนวันทั้งหมด:</strong> ' + data.summary.totalDays + '</p>';
          html += '<p><strong>👥 จำนวนผู้ใช้ทั้งหมด:</strong> ' + data.summary.totalUniqueUsers + '</p>';
          html += '<p><strong>📝 จำนวน records:</strong> ' + data.summary.totalRecords + '</p>';
          html += '<h3>📅 ข้อมูลรายวัน:</h3>';
          html += '<ul>';
          
          data.dailyStats.forEach(day => {
            html += '<li>';
            html += '<strong>' + day.date + '</strong> - ';
            html += day.userCount + ' ผู้ใช้: ';
            html += day.users.join(', ');
            html += '</li>';
          });
          
          html += '</ul>';
          html += '</div>';
          resultDiv.innerHTML = html;
        } else {
          resultDiv.innerHTML = '<div class="error"><h2>❌ เกิดข้อผิดพลาด</h2><p>' + data.message + '</p></div>';
        }
      } catch (error) {
        resultDiv.innerHTML = '<div class="error"><h2>❌ Error</h2><p>' + error.message + '</p></div>';
      }
    });
  </script>
</body>
</html>
`;

// ============================================
// 5. ตัวอย่าง Response ที่คาดหวัง
// ============================================
const expectedResponse = {
  "success": true,
  "message": "ประมวลผลข้อมูลสำเร็จ",
  "summary": {
    "totalDays": 5,
    "totalUniqueUsers": 10,
    "totalRecords": 150
  },
  "dailyStats": [
    {
      "date": "2024-01-01",
      "userCount": 3,
      "users": ["john.doe@example.com", "jane.smith", "bob.wilson@example.com"]
    },
    {
      "date": "2024-01-02",
      "userCount": 2,
      "users": ["john.doe@example.com", "alice.brown"]
    },
    {
      "date": "2024-01-03",
      "userCount": 5,
      "users": ["jane.smith", "bob.wilson@example.com", "charlie.davis", "diana.prince", "edward.norton"]
    }
  ]
};

// ============================================
// Export สำหรับใช้ใน Node.js
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    uploadExcelFileFetch,
    uploadExcelFileAxios,
    uploadExcelFileXHR,
    htmlExample,
    expectedResponse
  };
}

// ============================================
// ตัวอย่างการใช้งาน (Node.js)
// ============================================
// const { uploadExcelFileAxios } = require('./example-stats-excel-usage');
// uploadExcelFileAxios('./data.xlsx')
//   .then(data => console.log('Success:', data))
//   .catch(error => console.error('Error:', error));

