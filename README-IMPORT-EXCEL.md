# ตัวอย่าง JSON สำหรับ Import Excel (Optimized Version)

## 🚀 Endpoint
**POST** `/api/devices/import-excel`

## 📋 รูปแบบการส่งข้อมูล

### 1. Array Format (หลาย records) - **แนะนำสำหรับ bulk import**
```json
[
  {
    "Model": "Dell PowerEdge R740",
    "Brand": "Dell",
    ...
  },
  {
    "Model": "HP ProLiant DL380",
    "Brand": "HP",
    ...
  }
]
```

### 2. Single Object Format (1 record)
```json
{
  "Model": "Dell PowerEdge R740",
  "Brand": "Dell",
  ...
}
```

## ✅ Fields ที่รองรับ

### 🔴 Fields จำเป็น (Required)
- **Model** - รุ่นของ Device (ใช้ร่วมกับ Brand เพื่อหา/สร้าง Dtypeid)
- **Brand** - ยี่ห้อ/Manufacturer (ใช้ร่วมกับ Model เพื่อหา/สร้าง Dtypeid)
- **Project_code_purchase** - รหัสโปรเจค (NOT NULL - ถ้าไม่มีจะใช้ empty string)
- **Waranty_start** - วันที่เริ่มรับประกัน (NOT NULL - ถ้าไม่มีจะใช้ current date)
- **Waranty_end** - วันที่สิ้นสุดรับประกัน (NOT NULL - ถ้าไม่มีจะใช้ current date)
- **Received_date** - วันที่รับของ (NOT NULL - ถ้าไม่มีจะใช้ current date)

### 🟡 Fields อื่นๆ (Optional)
- **Asset_State** - สถานะ Asset (เช่น "In Store", "Out Store")
- **serial** - Serial Number
- **CI_Name** - CI Name
- **Asset_Number** - เลข Asset (ถ้ามีและมีใน DB แล้วจะ UPDATE แทน INSERT)
- **PR_No** - PR Number
- **PO_No** - PO Number
- **Vendor** - ผู้ขาย
- **Project_purchase** - ชื่อโปรเจค
- **Site** - ชื่อ Site (ถ้าไม่มีจะสร้างใหม่)
- **Location2** - Location
- **Loan_Start** - วันที่เริ่มยืม
- **Request_Date** - วันที่ Request
- **Refer_SOF** - Refer SOF
- **Refer_Ticket** - Refer Ticket
- **Assigned_Service** - Service ที่ Assign
- **Reason** - เหตุผล (New Installation, Not Assigned, Replacement)
- **DeRoleid** - Device Role ID

### 🟢 Fields สำหรับ Site (ถ้า Site ยังไม่มีจะสร้างใหม่)
- **District** - อำเภอ
- **Province** - จังหวัด
- **Subdistrict** - ตำบล
- **Address_code** - รหัสไปรษณีย์
- **Description** - คำอธิบาย Site

## 📁 ไฟล์ตัวอย่าง

### 1. `example-import-excel.json` - ตัวอย่างแบบเต็ม (4 records)
ตัวอย่างที่ครอบคลุมทุก fields พร้อมข้อมูล Site, District, Province, etc.

### 2. `example-import-excel-minimal.json` - ตัวอย่างแบบ minimal (เฉพาะ fields จำเป็น)
เหมาะสำหรับการทดสอบหรือข้อมูลที่ไม่มีครบทุก fields

### 3. `example-import-excel-single.json` - ตัวอย่างแบบ single object (1 record)
ตัวอย่างการส่งข้อมูล device เดียว

### 4. `example-import-excel-bulk.json` - ตัวอย่างสำหรับ bulk import
ตัวอย่างสำหรับการ import หลาย records พร้อมกัน

## ⚡ การทำงาน (Optimized Version)

### 1. **Pre-load Reference Data**
- โหลด Sites, Manufacturers, Device_Types ทั้งหมดใน batch queries ก่อน
- ลดการ query จาก 60,000+ queries เหลือ ~3 queries

### 2. **Auto-create Missing References**
- **Manufacturer**: ถ้า Brand ยังไม่มี → สร้างใหม่อัตโนมัติ
- **Device_Type**: ถ้า Model + Brand ยังไม่มี → สร้างใหม่อัตโนมัติ
- **Site**: ถ้า Site ยังไม่มี → สร้างใหม่อัตโนมัติ

### 3. **Batch Processing**
- แบ่งการประมวลผลเป็น batches (1,000 records ต่อ batch)
- ใช้ Transaction เพื่อความปลอดภัยของข้อมูล

### 4. **Bulk Operations**
- ตรวจสอบ Asset_Numbers ที่มีอยู่แล้วใน batch query เดียว
- แยก devices ออกเป็น INSERT และ UPDATE

### 5. **Cache System**
- Cache Sites, Manufacturers, Device_Types เพื่อเพิ่มประสิทธิภาพ

## 📊 ตัวอย่างการใช้งาน

### ตัวอย่าง 1: Minimal (เฉพาะ fields จำเป็น)
```json
[
  {
    "Model": "Dell PowerEdge R740",
    "Brand": "Dell",
    "Asset_State": "In Store",
    "CI_Name": "Server-01",
    "Asset_Number": "AST-001",
    "Project_code_purchase": "PRJ001",
    "Site": "Bangkok Office",
    "Waranty_start": "2024-01-01",
    "Waranty_end": "2025-01-01",
    "Received_date": "2024-01-15"
  }
]
```

### ตัวอย่าง 2: Full (ทุก fields)
```json
[
  {
    "Model": "Dell PowerEdge R740",
    "Asset_State": "In Store",
    "serial": "ABC123456789",
    "CI_Name": "Server-Production-01",
    "Brand": "Dell",
    "Asset_Number": "AST-2024-001",
    "PR_No": "PR-2024-001",
    "PO_No": "PO-2024-001",
    "Vendor": "Dell Technologies",
    "Project_code_purchase": "PRJ-2024-001",
    "Project_purchase": "Data Center Expansion",
    "Site": "Bangkok Office",
    "Location2": "Data Center Room A",
    "Loan_Start": "2024-01-15",
    "Request_Date": "2024-01-10",
    "Refer_SOF": "SOF-2024-001",
    "Refer_Ticket": "TKT-2024-001",
    "Assigned_Service": "IT Infrastructure",
    "Reason": "New Installation",
    "Waranty_start": "2024-01-01",
    "Waranty_end": "2027-01-01",
    "District": "Bang Rak",
    "Province": "Bangkok",
    "Subdistrict": "Silom",
    "Address_code": "10500",
    "Description": "Main Data Center",
    "Received_date": "2024-01-05"
  }
]
```

## 📤 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Import Excel สำเร็จ 1000 รายการ (สร้างใหม่ 800 รายการ, อัพเดท 200 รายการ)",
  "count": 1000,
  "inserted": 800,
  "updated": 200,
  "noChanges": 0,
  "data": [
    {
      "index": 1,
      "action": "inserted",
      "Did": 123,
      "Asset_Number": "AST-2024-001"
    },
    ...
  ],
  "errors": [] // หรือ undefined ถ้าไม่มี error
}
```

### Error Response
```json
{
  "success": false,
  "message": "เกิดข้อผิดพลาดในการ Import Excel",
  "error": "Error message here"
}
```

## ⚠️ หมายเหตุสำคัญ

1. **Case Insensitive**: Fields สามารถใช้ทั้งตัวพิมพ์ใหญ่และตัวพิมพ์เล็กได้ (เช่น `Model` หรือ `model`)

2. **Date Format**: ใช้รูปแบบ `YYYY-MM-DD` (เช่น `2024-01-01`)

3. **Reason Enum**: ต้องเป็นหนึ่งใน:
   - `"New Installation"`
   - `"Not Assigned"`
   - `"Replacement"`
   - `""` (empty string)

4. **Asset_Number**: 
   - ถ้ามีและมีใน DB แล้ว → จะทำการ **UPDATE** แทน INSERT
   - ถ้าไม่มี → จะทำการ **INSERT** ใหม่

5. **Auto-create References**:
   - **Brand** → สร้าง Manufacturer อัตโนมัติ
   - **Model + Brand** → สร้าง Device_Type อัตโนมัติ
   - **Site** → สร้าง Site อัตโนมัติ (พร้อม District, Province, etc.)

6. **Performance**:
   - รองรับการ import จำนวนมาก (60,000+ records)
   - ใช้ batch processing และ transaction
   - Pre-load reference data เพื่อเพิ่มความเร็ว

7. **Transaction**:
   - ใช้ transaction เพื่อความปลอดภัย
   - ถ้าเกิด error จะ rollback ทั้งหมด

## 🔧 การใช้งาน

### cURL
```bash
curl -X POST http://localhost:5000/api/devices/import-excel \
  -H "Content-Type: application/json" \
  -d @example-import-excel.json
```

### Postman/Insomnia
- **Method**: POST
- **URL**: `http://localhost:5000/api/devices/import-excel`
- **Headers**: 
  - `Content-Type: application/json`
- **Body**: เลือก `raw` และ `JSON` แล้ววาง JSON data

### JavaScript (Fetch API)
```javascript
const response = await fetch('http://localhost:5000/api/devices/import-excel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([
    {
      "Model": "Dell PowerEdge R740",
      "Brand": "Dell",
      "Asset_State": "In Store",
      "CI_Name": "Server-01",
      "Asset_Number": "AST-001",
      "Project_code_purchase": "PRJ001",
      "Site": "Bangkok Office",
      "Waranty_start": "2024-01-01",
      "Waranty_end": "2025-01-01",
      "Received_date": "2024-01-15"
    }
  ])
});

const result = await response.json();
console.log(result);
```

## 🎯 Best Practices

1. **สำหรับ Bulk Import (60,000+ records)**:
   - แบ่งไฟล์เป็น chunks (เช่น 10,000 records ต่อไฟล์)
   - ใช้ array format
   - ตรวจสอบข้อมูลก่อน import

2. **สำหรับ Small Import (< 100 records)**:
   - ใช้ single object หรือ array format
   - สามารถส่งข้อมูลได้ทันที

3. **Error Handling**:
   - ตรวจสอบ response.errors สำหรับรายการที่ผิดพลาด
   - แก้ไขข้อมูลและ import ใหม่เฉพาะส่วนที่ผิดพลาด
