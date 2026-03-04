# 📊 API สำหรับประมวลผลไฟล์ Excel และ CSV - Stats

## 🚀 Endpoint
**POST** `/api/stats/process-excel`

## 📁 รองรับไฟล์
- **Excel**: `.xlsx`, `.xls`, `.xlsm`
- **CSV**: `.csv`

## 📋 ข้อมูลที่ต้องการ

### Columns ที่จำเป็นในไฟล์ Excel/CSV:
- `mytimestamp` - วันที่และเวลา
- `username` - ชื่อผู้ใช้
- `user.email` - อีเมลผู้ใช้
- `source.ip` - IP Address
- `source.as.organization.name` - ชื่อองค์กร
- `source.geo.continent_name` - ชื่อทวีป
- `source.geo.country_name` - ชื่อประเทศ
- `source.geo.city_name` - ชื่อเมือง
- `@timestamp.min` - วันที่เริ่มต้น
- `@timestamp.max` - วันที่สิ้นสุด

## 📤 วิธีการส่ง Request

### ⚠️ หมายเหตุสำคัญ
**การส่งไฟล์ Excel ต้องใช้ `multipart/form-data` ไม่ใช่ JSON โดยตรง**

---

## 1️⃣ ใช้ Postman

### ขั้นตอน:
1. เปิด Postman
2. เลือก Method: **POST**
3. URL: `http://localhost:5000/api/stats/process-excel`
4. ไปที่แท็บ **Body**
5. เลือก **form-data**
6. เพิ่ม key: `excelFile` (เลือก Type เป็น **File**)
7. คลิก **Select Files** และเลือกไฟล์ Excel (.xlsx, .xls, .xlsm) หรือ CSV (.csv)
8. คลิก **Send**

### ตัวอย่าง Screenshot:
```
POST http://localhost:5000/api/stats/process-excel
Content-Type: multipart/form-data

Body (form-data):
  excelFile: [เลือกไฟล์ Excel หรือ CSV]
```

---

## 2️⃣ ใช้ cURL

```bash
# สำหรับไฟล์ Excel
curl -X POST http://localhost:5000/api/stats/process-excel \
  -F "excelFile=@/path/to/your/file.xlsx"

# สำหรับไฟล์ CSV
curl -X POST http://localhost:5000/api/stats/process-excel \
  -F "excelFile=@/path/to/your/file.csv"
```

### ตัวอย่าง:
```bash
# Windows PowerShell
curl -X POST http://localhost:5000/api/stats/process-excel -F "excelFile=@C:\Users\waritthon.p\Desktop\data.xlsx"

# Linux/Mac
curl -X POST http://localhost:5000/api/stats/process-excel -F "excelFile=@/home/user/data.xlsx"
```

---

## 3️⃣ ใช้ JavaScript (Fetch API)

```javascript
const formData = new FormData();
const fileInput = document.querySelector('input[type="file"]');
formData.append('excelFile', fileInput.files[0]);

fetch('http://localhost:5000/api/stats/process-excel', {
  method: 'POST',
  body: formData
})
  .then(response => response.json())
  .then(data => {
    console.log('Success:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

**หมายเหตุ**: ไฟล์ input ควรมี `accept=".xlsx,.xls,.xlsm,.csv"` เพื่อให้เลือกได้ทั้ง Excel และ CSV

### ตัวอย่าง HTML Form:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Upload Excel File</title>
</head>
<body>
  <form id="excelForm">
    <input type="file" id="excelFile" accept=".xlsx,.xls,.xlsm,.csv" required>
    <button type="submit">Upload</button>
  </form>

  <script>
    document.getElementById('excelForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData();
      const fileInput = document.getElementById('excelFile');
      formData.append('excelFile', fileInput.files[0]);

      try {
        const response = await fetch('http://localhost:5000/api/stats/process-excel', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        console.log('Response:', data);
        alert('สำเร็จ! จำนวนวันทั้งหมด: ' + data.summary.totalDays);
      } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    });
  </script>
</body>
</html>
```

---

## 4️⃣ ใช้ Axios

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const formData = new FormData();
formData.append('excelFile', fs.createReadStream('/path/to/your/file.xlsx'));

axios.post('http://localhost:5000/api/stats/process-excel', formData, {
  headers: {
    ...formData.getHeaders()
  }
})
  .then(response => {
    console.log('Success:', response.data);
  })
  .catch(error => {
    console.error('Error:', error.response.data);
  });
```

---

## 5️⃣ ใช้ Node.js (FormData)

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

const formData = new FormData();
formData.append('excelFile', fs.createReadStream('./data.xlsx'));

axios({
  method: 'post',
  url: 'http://localhost:5000/api/stats/process-excel',
  data: formData,
  headers: {
    ...formData.getHeaders()
  }
})
  .then(response => {
    console.log('Response:', response.data);
  })
  .catch(error => {
    console.error('Error:', error.response?.data || error.message);
  });
```

---

## 📥 Response Format

### Success Response (200):
```json
{
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
      "users": ["user1@example.com", "user2", "user3@example.com"]
    },
    {
      "date": "2024-01-02",
      "userCount": 2,
      "users": ["user1@example.com", "user4"]
    },
    {
      "date": "2024-01-03",
      "userCount": 5,
      "users": ["user2", "user3@example.com", "user5", "user6", "user7"]
    }
  ]
}
```

### Error Response (400):
```json
{
  "success": false,
  "message": "กรุณาอัปโหลดไฟล์ Excel"
}
```

### Error Response - Missing Columns (400):
```json
{
  "success": false,
  "message": "ไม่พบ columns ที่จำเป็น: mytimestamp, username",
  "missingColumns": ["mytimestamp", "username"]
}
```

### Error Response (500):
```json
{
  "success": false,
  "message": "เกิดข้อผิดพลาดในการประมวลผลไฟล์ Excel",
  "error": "Error message details"
}
```

---

## 📝 ตัวอย่างโครงสร้างข้อมูลในไฟล์ Excel

| mytimestamp | username | user.email | source.ip | source.as.organization.name | source.geo.continent_name | source.geo.country_name | source.geo.city_name | @timestamp.min | @timestamp.max |
|-------------|----------|------------|-----------|----------------------------|---------------------------|------------------------|---------------------|----------------|----------------|
| 2024-01-01 10:00:00 | john.doe | john.doe@example.com | 192.168.1.1 | Example Corp | Asia | Thailand | Bangkok | 2024-01-01 00:00:00 | 2024-01-01 23:59:59 |
| 2024-01-01 14:30:00 | jane.smith | jane.smith@example.com | 192.168.1.2 | Example Corp | Asia | Thailand | Bangkok | 2024-01-01 00:00:00 | 2024-01-01 23:59:59 |
| 2024-01-02 09:15:00 | john.doe | john.doe@example.com | 192.168.1.1 | Example Corp | Asia | Thailand | Bangkok | 2024-01-02 00:00:00 | 2024-01-02 23:59:59 |

---

## ⚙️ ข้อกำหนด

- **File Size Limit**: 50MB
- **Supported Formats**: `.xlsx`, `.xls`, `.xlsm`, `.csv`
- **Field Name**: `excelFile` (ต้องใช้ชื่อนี้เท่านั้น)
- **Content-Type**: `multipart/form-data` (อัตโนมัติ)
- **CSV Encoding**: รองรับ UTF-8, UTF-8 BOM, และ Latin1

---

## 🔍 ข้อมูลที่ API จะประมวลผล

1. **นับจำนวนวันทั้งหมด** - จากข้อมูลในไฟล์
2. **แสดงผู้ใช้ในแต่ละวัน** - จัดกลุ่มตามวันที่ (ใช้ `mytimestamp`, `@timestamp.min`, หรือ `@timestamp.max`)
3. **นับผู้ใช้ที่ไม่ซ้ำกัน** - ทั้งหมดในไฟล์
4. **เรียงข้อมูลตามวันที่** - จากเก่าไปใหม่

---

## 💡 Tips

- **Excel**: ไฟล์ต้องมี Sheet อย่างน้อย 1 Sheet, API จะอ่าน Sheet แรกเท่านั้น
- **CSV**: รองรับ encoding UTF-8, UTF-8 BOM, และ Latin1
- วันที่จะถูกแปลงเป็นรูปแบบ `YYYY-MM-DD` อัตโนมัติ
- ผู้ใช้จะถูกระบุด้วย `username` หรือ `user.email` (ถ้าไม่มี username)
- ถ้าไม่มีทั้ง username และ email จะใช้ `Unknown`
- CSV ควรมี header row ที่ตรงกับ columns ที่ต้องการ

