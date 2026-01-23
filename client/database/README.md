# PM/MA Management System Database

ฐานข้อมูลสำหรับระบบจัดการ Preventive Maintenance (PM) และ Maintenance Agreement (MA)

## โครงสร้างฐานข้อมูล

### ตารางหลัก

1. **sites** - ข้อมูลสถานที่/ไซต์
2. **employees** - ข้อมูลพนักงาน/วิศวกร
3. **vendors** - ข้อมูลผู้ขาย/ผู้ให้บริการ
4. **device_types** - ประเภทอุปกรณ์
5. **assets** - ข้อมูลอุปกรณ์/ทรัพย์สิน
6. **contracts** - ข้อมูลสัญญา Maintenance Agreement (MA)
7. **contract_asset_bindings** - การเชื่อมโยงสัญญากับอุปกรณ์
8. **tasks** - งาน PM และ MA
9. **task_assignments** - การมอบหมายงานให้พนักงาน
10. **task_assets** - การเชื่อมโยงงานกับอุปกรณ์
11. **pm_history** - ประวัติการทำ PM
12. **task_photos** - รูปภาพที่เกี่ยวข้องกับงาน
13. **sla_compliance** - ข้อมูลการปฏิบัติตาม SLA
14. **departments** - ข้อมูลแผนก
15. **positions** - ข้อมูลตำแหน่งงาน

### Views (มุมมองข้อมูล)

1. **vw_task_details** - รายละเอียดงานพร้อมข้อมูลที่เกี่ยวข้อง
2. **vw_asset_pm_summary** - สรุปข้อมูล PM ของอุปกรณ์
3. **vw_contract_sla_summary** - สรุปข้อมูล SLA ของสัญญา

## การติดตั้ง

รันไฟล์เดียวเพื่อสร้างฐานข้อมูลทั้งหมด (รวม Schema และ Seed Data):

```bash
mysql -u username -p < database/database.sql
```

หรือถ้าต้องการระบุ database name:

```bash
mysql -u username -p < database/database.sql
```

ไฟล์ `database.sql` จะ:
1. สร้างฐานข้อมูล `pm_ma_management`
2. สร้างตารางทั้งหมด (15 ตาราง)
3. สร้าง Views (3 views)
4. เพิ่มข้อมูลตัวอย่าง (Seed Data)

## ความสัมพันธ์ระหว่างตาราง

```
sites
  ├── assets (site_id)
  ├── contracts (site_id)
  └── tasks (site_id)

vendors
  ├── assets (vendor_id)
  ├── contracts (vendor_id)
  └── sla_compliance (vendor_id)

assets
  ├── contract_asset_bindings (device_id)
  ├── task_assets (device_id)
  └── pm_history (device_id)

contracts
  ├── contract_asset_bindings (contract_id)
  ├── tasks (contract_id)
  └── sla_compliance (contract_id)

tasks
  ├── task_assignments (task_id)
  ├── task_assets (task_id)
  ├── task_photos (task_id)
  └── pm_history (task_id)

employees
  ├── task_assignments (employee_id)
  └── pm_history (technician_id)
```

## ตัวอย่างการใช้งาน

### Query งานทั้งหมดพร้อมข้อมูลที่เกี่ยวข้อง

```sql
SELECT * FROM vw_task_details;
```

### Query อุปกรณ์ที่ต้องทำ PM ในเดือนถัดไป

```sql
SELECT * FROM assets 
WHERE next_pm_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
AND status = 'Active';
```

### Query สัญญาที่ใกล้หมดอายุ

```sql
SELECT * FROM contracts 
WHERE end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
AND status = 'Active';
```

### Query งานที่มอบหมายให้พนักงานคนหนึ่ง

```sql
SELECT t.*, e.display_name 
FROM tasks t
JOIN task_assignments ta ON t.task_id = ta.task_id
JOIN employees e ON ta.employee_id = e.employee_id
WHERE e.employee_id = 'EMP001';
```

## การสร้าง ER Diagram ด้วย dbdiagram.io

ไฟล์ `database.dbml` เป็นไฟล์ DBML (Database Markup Language) สำหรับใช้กับ [dbdiagram.io](https://dbdiagram.io)

### วิธีใช้งาน:

1. ไปที่ https://dbdiagram.io
2. คลิก "New Project" หรือ "Import"
3. Copy เนื้อหาจากไฟล์ `database/database.dbml` 
4. Paste ลงใน editor
5. dbdiagram จะสร้าง ER Diagram ให้อัตโนมัติ

### ไฟล์ที่เกี่ยวข้อง:

- `database.sql` - SQL schema สำหรับสร้างฐานข้อมูลจริง
- `database.dbml` - DBML format สำหรับสร้าง ER Diagram
- `types.ts` - TypeScript type definitions

## TypeScript Types

ไฟล์ `types.ts` มี TypeScript type definitions ที่สอดคล้องกับโครงสร้างฐานข้อมูล สามารถนำไปใช้ในโปรเจกต์ Next.js ได้เลย

## หมายเหตุ

- ฐานข้อมูลใช้ MySQL/MariaDB
- Character set: utf8mb4 สำหรับรองรับภาษาไทย
- มี Foreign Key constraints เพื่อความถูกต้องของข้อมูล
- มี Indexes สำหรับเพิ่มประสิทธิภาพการค้นหา
- ใช้ ENUM types สำหรับค่าที่กำหนดไว้แล้ว
