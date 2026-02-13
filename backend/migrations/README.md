# Migrations (TccStock (7) compatibility)

เมื่อใช้ database จากไฟล์ **tccstock (7).sql** ให้รัน migration นี้เพื่อให้ backend ทำงานได้ครบ:

```bash
# จากโฟลเดอร์ backend หรือที่ที่ mysql client ชี้ไปที่ DB
mysql -u USER -p DB_NAME < migrations/apply_tccstock7_compat.sql
```

หรือเปิด `apply_tccstock7_compat.sql` แล้วรันใน phpMyAdmin / MySQL Workbench ต่อ DB ที่ใช้อยู่

**สิ่งที่ migration ทำ:**

1. **contract_device** — เพิ่มคอลัมน์ `SLid` (FK -> sites_location) เพราะ TccStock (7) มีแค่ (contract_id, device_id) แต่ backend เก็บ SLid ต่อ device ต่อสัญญา
2. **contract** — เพิ่ม `pm_time_per_year`,  `remark` ถ้าไม่มี (TccStock (7) ไม่มีคอลัมน์เหล่านี้)

**หมายเหตุ:** ใน TccStock (7) ชื่อตารางเป็นตัวเล็ก (`devices`, `sites`, `sites_location`, `location`). Backend ปรับให้ใช้ชื่อตารางตามนี้ใน contractController แล้ว

---

### add_contract_device_slid.sql (ใช้แค่ contract_device + SLid)

ใช้ตาราง **contract_device** อย่างเดียว โดยเก็บ **SLid** (site) ไว้ในตารางนี้ — ไม่ต้องใช้ `contract_site` อีก (รายการ site ของสัญญา = DISTINCT SLid จาก contract_device)

- เพิ่มคอลัมน์ `SLid` (INT NULL, FK -> sites_location.SLid) ใน `contract_device`
- ถ้าคอลัมน์มีอยู่แล้วจะ error ได้ ให้ข้ามหรือ comment บรรทัด ALTER

รัน: `mysql -u USER -p DB_NAME < migrations/add_contract_device_slid.sql`

---

### drop_contract_site.sql (ลบตาราง contract_site)

เมื่อใช้แค่ `contract_device` + SLid แล้ว สามารถลบตาราง `contract_site` ได้ — แนะนำสำรองข้อมูลก่อน

รัน: `mysql -u USER -p DB_NAME < migrations/drop_contract_site.sql`

---

### add_contract_history_fk.sql

เพิ่ม Foreign Key ให้ตาราง `contract_history` เพื่อความถูกต้องของข้อมูล (referential integrity):

- `contract_id` → `contract(contract_id)` ON DELETE CASCADE
- `old_contract_id` → `contract(contract_id)` ON DELETE SET NULL

รัน: `mysql -u USER -p app_db < migrations/add_contract_history_fk.sql`

---

### add_report_detail_columns.sql

เพิ่มคอลัมน์เก็บรายละเอียด Report (checklist, comment, technician, pm_date, device) เพื่อให้แสดงข้อมูลที่กรอกเมื่อคลิกดู Report:

- `checklist_items` (JSON)
- `comment` (TEXT)
- `technician_name` (VARCHAR)
- `pm_date` (DATE)
- `device_id` (INT)
- `device_json` (JSON)

รัน: `mysql -u USER -p app_db < migrations/add_report_detail_columns.sql`

---

### add_report_created_at.sql

เพิ่มคอลัมน์ `created_at` ในตาราง `report` เพื่อแสดงวันที่สร้าง Report:

- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

รัน: `mysql -u USER -p app_db < migrations/add_report_created_at.sql`
