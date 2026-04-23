-- เวลาเริ่ม Down time (สคีมาเก่า: คู่กับ down_time_start_date)
-- DB ใหม่ใช้ downtime_time จาก add_tasks_ma_downtime.sql แทน — ไฟล์นี้สำหรับ DB เดิมที่ยังมี down_time_start_date เท่านั้น
-- ไม่ใช้ AFTER … เพื่อไม่ให้ล้มเมื่อไม่มีคอลัมน์ legacy

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS down_time_start_time TIME NULL;
