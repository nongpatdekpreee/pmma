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
