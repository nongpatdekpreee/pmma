-- Copy legacy down_time_* / down_time_total_hours into downtime_* / uptime_* / downtime_total_hours.
-- ใช้เฉพาะเมื่อตาราง tasks ยังมีคอลัมน์เก่าอยู่ (แล้วรัน add_tasks_ma_downtime.sql เพื่อเพิ่มคอลัมน์ใหม่).
-- Safe to re-run: only fills NULL targets when legacy has a value.

UPDATE tasks
SET downtime_date = down_time_start_date
WHERE downtime_date IS NULL AND down_time_start_date IS NOT NULL;

UPDATE tasks
SET downtime_time = down_time_start_time
WHERE downtime_time IS NULL AND down_time_start_time IS NOT NULL;

UPDATE tasks
SET uptime_date = down_time_end_date
WHERE uptime_date IS NULL AND down_time_end_date IS NOT NULL;

UPDATE tasks
SET uptime_time = down_time_end_time
WHERE uptime_time IS NULL AND down_time_end_time IS NOT NULL;

UPDATE tasks
SET downtime_total_hours = down_time_total_hours
WHERE downtime_total_hours IS NULL AND down_time_total_hours IS NOT NULL;
