# 📋 POST Device - ตัวอย่าง JSON

## 🚀 Endpoint
**POST** `/api/devices`

## 📝 รูปแบบการส่งข้อมูล

### 1. Single Object Format (1 device)
```json
{
  "Dtypeid": 1,
  "Asset_State": "In Store",
  ...
}
```

### 2. Array Format (หลาย devices) - **แนะนำ**
```json
[
  {
    "Dtypeid": 1,
    "Asset_State": "In Store",
    ...
  },
  {
    "Dtypeid": 2,
    "Asset_State": "Out Store",
    ...
  }
]
```

## ✅ Fields ที่รองรับ

### 🔴 Fields จำเป็น (Required)
- **Dtypeid** - Device Type ID (จำเป็น)

### 🟡 Fields อื่นๆ (Optional)
- **Asset_State** - สถานะ Asset (เช่น "In Store", "Out Store")
- **serial** - Serial Number
- **CI_Name** - CI Name
- **Asset_Number** - เลข Asset (ถ้ามีและมีใน DB แล้วจะ UPDATE แทน INSERT)
- **PR_No** - PR Number
- **PO_No** - PO Number
- **Vendor** - ผู้ขาย
- **Project_purchase** - ชื่อโปรเจค
- **Project_code_purchase** - รหัสโปรเจค (NOT NULL - ถ้าไม่มีจะใช้ empty string)
- **Sid** - Site ID
- **Location2** - Location
- **Loan_Start** - วันที่เริ่มยืม
- **Request_Date** - วันที่ Request
- **Refer_SOF** - Refer SOF
- **Refer_Ticket** - Refer Ticket
- **Assigned_Service** - Service ที่ Assign
- **Reason** - เหตุผล (New Installation, Not Assigned, Replacement)
- **DeRoleid** - Device Role ID
- **Waranty_start** - วันที่เริ่มรับประกัน (NOT NULL - ถ้าไม่มีจะใช้ current date)
- **Waranty_end** - วันที่สิ้นสุดรับประกัน (NOT NULL - ถ้าไม่มีจะใช้ current date)
- **Received_date** - วันที่รับของ (NOT NULL - ถ้าไม่มีจะใช้ current date)

## 📁 ไฟล์ตัวอย่าง

### 1. `example-post-device.json` - ตัวอย่างแบบเต็ม (1 device)
ตัวอย่างที่ครอบคลุมทุก fields

### 2. `example-post-device-array.json` - ตัวอย่างแบบ array (หลาย devices)
ตัวอย่างการส่งหลาย devices พร้อมกัน

### 3. `example-post-device-minimal.json` - ตัวอย่างแบบ minimal (เฉพาะ fields จำเป็น)
เหมาะสำหรับการทดสอบ

## 📊 ตัวอย่างการใช้งาน

### ตัวอย่าง 1: Minimal (เฉพาะ fields จำเป็น)
```json
{
  "Dtypeid": 1,
  "Project_code_purchase": "PRJ-2024-001",
  "Waranty_start": "2024-01-01",
  "Waranty_end": "2025-01-01",
  "Received_date": "2024-01-15"
}
```

### ตัวอย่าง 2: Full (ทุก fields)
```json
{
  "Asset_State": "In Store",
  "serial": "ABC123456789",
  "CI_Name": "Server-Production-01",
  "Asset_Number": "AST-2024-001",
  "PR_No": "PR-2024-001",
  "PO_No": "PO-2024-001",
  "Vendor": "Dell Technologies",
  "Project_purchase": "Data Center Expansion",
  "Project_code_purchase": "PRJ-2024-001",
  "Sid": 1,
  "Location2": "Data Center Room A",
  "Loan_Start": "2024-01-15",
  "Request_Date": "2024-01-10",
  "Refer_SOF": "SOF-2024-001",
  "Refer_Ticket": "TKT-2024-001",
  "Assigned_Service": "IT Infrastructure",
  "Reason": "New Installation",
  "Dtypeid": 1,
  "DeRoleid": 1,
  "Waranty_start": "2024-01-01",
  "Waranty_end": "2027-01-01",
  "Received_date": "2024-01-05"
}
```

### ตัวอย่าง 3: Array (หลาย devices)
```json
[
  {
    "Dtypeid": 1,
    "Asset_State": "In Store",
    "CI_Name": "Server-01",
    "Asset_Number": "AST-001",
    "Project_code_purchase": "PRJ-001",
    "Waranty_start": "2024-01-01",
    "Waranty_end": "2025-01-01",
    "Received_date": "2024-01-15"
  },
  {
    "Dtypeid": 2,
    "Asset_State": "Out Store",
    "CI_Name": "Server-02",
    "Asset_Number": "AST-002",
    "Project_code_purchase": "PRJ-002",
    "Waranty_start": "2024-02-01",
    "Waranty_end": "2025-02-01",
    "Received_date": "2024-01-25"
  }
]
```

## 📤 Response Format

### Success Response (Single Object)
```json
{
  "success": true,
  "message": "สร้าง Device สำเร็จ",
  "data": {
    "id": 123,
    "action": "inserted",
    "Asset_State": "In Store",
    "serial": "ABC123456789",
    ...
  }
}
```

### Success Response (Array)
```json
{
  "success": true,
  "message": "ประมวลผล Devices สำเร็จ 3 รายการ (สร้างใหม่ 2 รายการ, อัพเดท 1 รายการ)",
  "count": 3,
  "inserted": 2,
  "updated": 1,
  "data": [
    {
      "id": 123,
      "action": "inserted",
      ...
    },
    {
      "id": 124,
      "action": "inserted",
      ...
    },
    {
      "id": 125,
      "action": "updated",
      ...
    }
  ],
  "errors": [] // หรือ undefined ถ้าไม่มี error
}
```

### Error Response (400 - Missing Dtypeid)
```json
{
  "success": false,
  "message": "กรุณากรอกข้อมูล Dtypeid (จำเป็น) - Device ที่ 1"
}
```

## ⚠️ หมายเหตุสำคัญ

1. **Dtypeid**: จำเป็นต้องระบุ (Required)

2. **Asset_Number**: 
   - ถ้ามีและมีใน DB แล้ว → จะทำการ **UPDATE** แทน INSERT
   - ถ้าไม่มี → จะทำการ **INSERT** ใหม่

3. **Fields ที่เป็น NOT NULL**:
   - `Project_code_purchase` - ถ้าไม่มีจะใช้ empty string (`""`)
   - `Waranty_start` - ถ้าไม่มีจะใช้ current date
   - `Waranty_end` - ถ้าไม่มีจะใช้ current date
   - `Received_date` - ถ้าไม่มีจะใช้ current date

4. **Date Format**: ใช้รูปแบบ `YYYY-MM-DD` (เช่น `2024-01-01`)

5. **Reason Enum**: ต้องเป็นหนึ่งใน:
   - `"New Installation"`
   - `"Not Assigned"`
   - `"Replacement"`
   - `""` (empty string)
   - `null`

6. **Array vs Single Object**:
   - Array: รองรับการสร้าง/อัพเดทหลาย devices พร้อมกัน
   - Single Object: สร้าง/อัพเดท device เดียว

## 🔧 การใช้งาน

### cURL
```bash
# Single Object
curl -X POST http://localhost:5000/api/devices \
  -H "Content-Type: application/json" \
  -d @example-post-device.json

# Array
curl -X POST http://localhost:5000/api/devices \
  -H "Content-Type: application/json" \
  -d @example-post-device-array.json
```

### Postman/Insomnia
- **Method**: POST
- **URL**: `http://localhost:5000/api/devices`
- **Headers**: 
  - `Content-Type: application/json`
- **Body**: เลือก `raw` และ `JSON` แล้ววาง JSON data

### JavaScript (Fetch API)
```javascript
// Single Object
const response = await fetch('http://localhost:5000/api/devices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    "Dtypeid": 1,
    "Asset_State": "In Store",
    "CI_Name": "Server-01",
    "Asset_Number": "AST-001",
    "Project_code_purchase": "PRJ-001",
    "Waranty_start": "2024-01-01",
    "Waranty_end": "2025-01-01",
    "Received_date": "2024-01-15"
  })
});

const result = await response.json();
console.log(result);

// Array
const response2 = await fetch('http://localhost:5000/api/devices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([
    {
      "Dtypeid": 1,
      "Asset_State": "In Store",
      "CI_Name": "Server-01",
      "Asset_Number": "AST-001",
      "Project_code_purchase": "PRJ-001",
      "Waranty_start": "2024-01-01",
      "Waranty_end": "2025-01-01",
      "Received_date": "2024-01-15"
    },
    {
      "Dtypeid": 2,
      "Asset_State": "Out Store",
      "CI_Name": "Server-02",
      "Asset_Number": "AST-002",
      "Project_code_purchase": "PRJ-002",
      "Waranty_start": "2024-02-01",
      "Waranty_end": "2025-02-01",
      "Received_date": "2024-01-25"
    }
  ])
});

const result2 = await response2.json();
console.log(result2);
```

## 🎯 Best Practices

1. **สำหรับ Bulk Create (หลาย devices)**:
   - ใช้ array format
   - ตรวจสอบข้อมูลก่อนส่ง
   - ใช้ Asset_Number เพื่อป้องกันการสร้างซ้ำ

2. **สำหรับ Single Create**:
   - ใช้ single object format
   - ระบุ Dtypeid เสมอ

3. **Error Handling**:
   - ตรวจสอบ response.errors สำหรับรายการที่ผิดพลาด
   - แก้ไขข้อมูลและส่งใหม่เฉพาะส่วนที่ผิดพลาด

4. **Performance**:
   - สำหรับจำนวนมาก (100+ records) ควรใช้ importExcel endpoint แทน

















