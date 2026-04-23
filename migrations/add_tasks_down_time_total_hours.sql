-- ชั่วโมงรวม Down time (ชื่อคอลัมน์เก่า — DB ใหม่ใช้ downtime_total_hours จาก add_tasks_ma_downtime.sql)
-- ไม่ใช้ AFTER … เพื่อไม่ให้ล้มเมื่อไม่มี down_time_end_time

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS down_time_total_hours DECIMAL(12, 2) NULL;
