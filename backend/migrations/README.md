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

### drop_contract_device_id_site_id.sql

ย้ายความสัมพันธ์ **device / site** ไปที่ **`contract_device` เท่านั้น** แล้วลบคอลัมน์ `device_id` และ `site_id` ออกจากตาราง **`contract`** (backend ใช้ `MIN(SLid)` จาก `contract_device` เป็น “ไซต์หลัก” ใน API แทน)

1. รันไฟล์เพื่อ **INSERT** ข้อมูลจากคอลัมน์เก่าเข้า `contract_device` (ถ้ายังไม่มีแถวเดียวกัน)
2. ดูชื่อ FK: `SHOW CREATE TABLE contract;` แล้ว `ALTER TABLE contract DROP FOREIGN KEY ...` สำหรับ FK ที่อ้าง `device_id` / `site_id`
3. Uncomment และรัน `ALTER TABLE contract DROP COLUMN device_id;` และ `DROP COLUMN site_id;` ท้ายไฟล์ (หรือรันเอง)

รัน: `mysql -u USER -p DB_NAME < migrations/drop_contract_device_id_site_id.sql`

---

### add_contract_history_fk.sql

เพิ่ม Foreign Key ให้ตาราง `contract_history` เพื่อความถูกต้องของข้อมูล (referential integrity):

- `contract_id` → `contract(contract_id)` ON DELETE CASCADE
- `old_contract_id` → `contract(contract_id)` ON DELETE SET NULL

รัน: `mysql -u USER -p app_db < migrations/add_contract_history_fk.sql`

---

### contract_snapshot ใน `contract_history` (แทน `device_json`)

เก็บ snapshot แถวจากตาราง `contract` (ไม่ใส่ `contract_id` ที่ซ้ำกับคอลัมน์ใน `contract_history`) และรายการ `devices[{ CI_Name }]` ใน JSON คอลัมน์ **`contract_snapshot`**

- **Renew:** สร้าง snapshot **ก่อน** `UPDATE contract` และ **ก่อน** ลบ/ใส่ `contract_device` ใหม่ จึงเป็นสถานะก่อนต่อสัญญา (SOF เดิม + เครื่องจาก `contract_device` ชุดเดิม) คอลัมน์ `old_sof` / `new_sof` ยังบอกการเปลี่ยน SOF แยกต่างหาก

- **DB ใหม่ / ยังไม่มี `device_json`:**  
  `mysql -u USER -p app_db < migrations/add_contract_history_contract_snapshot.sql`
- **เคยรัน migration เก่าแล้วมี `device_json`:**  
  `mysql -u USER -p app_db < migrations/migrate_contract_history_device_json_to_contract_snapshot.sql`  
  (เปลี่ยนชื่อคอลัมน์เป็น `contract_snapshot`)

ไฟล์ `add_contract_history_device_json.sql` เป็นเพียงคำอธิบาย — อย่ารันเป็น migration หลัก

---

### add_contract_history_status_history.sql

เพิ่มคอลัมน์ `status_history` (VARCHAR) ใน `contract_history` สำหรับเก็บ `Renew` (ต่อสัญญา) หรือ `Terminated` (ไม่ต่อสัญญา)

รัน: `mysql -u USER -p app_db < migrations/add_contract_history_status_history.sql`

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
