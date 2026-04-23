-- วันสิ้นสุด down time และเวลา uptime ถูกกรอกตอนส่ง MA Checklist Report
-- ระหว่างวางแผนควรเป็น NULL — รันถ้าตารางมีคอลัมน์เหล่านี้เป็น NOT NULL อยู่

ALTER TABLE tasks
  MODIFY COLUMN down_time_end_date DATE NULL,
  MODIFY COLUMN down_time_end_time TIME NULL;
