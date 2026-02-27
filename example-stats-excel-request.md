# ตัวอย่างการส่ง Request ไปยัง Stats API

## ⚠️ หมายเหตุสำคัญ
**การส่งไฟล์ Excel ต้องใช้ `multipart/form-data` ไม่ใช่ JSON โดยตรง**

---

## 📋 ตัวอย่าง Request (Postman/cURL)

### Postman:
```
Method: POST
URL: http://localhost:5000/api/stats/process-excel
Body Type: form-data
Key: excelFile (Type: File)
Value: [เลือกไฟล์ Excel]
```

### cURL:
```bash
curl -X POST http://localhost:5000/api/stats/process-excel \
  -F "excelFile=@/path/to/file.xlsx"
```

---

## 📋 ตัวอย่าง Response

### Success:
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
      "users": ["john.doe@example.com", "jane.smith", "bob.wilson@example.com"]
    },
    {
      "date": "2024-01-02",
      "userCount": 2,
      "users": ["john.doe@example.com", "alice.brown"]
    }
  ]
}
```

---

## 🔧 ตัวอย่างโค้ด JavaScript

```javascript
// ใช้ FormData สำหรับส่งไฟล์
const formData = new FormData();
formData.append('excelFile', fileInput.files[0]);

fetch('http://localhost:5000/api/stats/process-excel', {
  method: 'POST',
  body: formData
})
  .then(res => res.json())
  .then(data => console.log(data));
```

