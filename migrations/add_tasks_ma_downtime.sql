-- MA plan / downtime บนตาราง tasks — ใช้ downtime_* / uptime_* / downtime_total_hours (MySQL 8+)
-- รันครั้งเดียวต่อ DB
-- ถ้ามีระบบเก่าที่มี down_time_* อยู่แล้ว ให้รัน migrate_tasks_legacy_downtime_to_new_columns.sql

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS downtime_date DATE NULL AFTER end_date,
  ADD COLUMN IF NOT EXISTS downtime_time TIME NULL,
  ADD COLUMN IF NOT EXISTS uptime_date DATE NULL,
  ADD COLUMN IF NOT EXISTS uptime_time TIME NULL,
  ADD COLUMN IF NOT EXISTS downtime_total_hours DECIMAL(12, 2) NULL;
