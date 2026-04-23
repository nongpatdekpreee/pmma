-- MA tasks: เคลียร์ค่าเก่าใน duration (ต้องมีคอลัมน์ duration ในตาราง tasks ก่อน)
-- downtime/uptime เก็บแยก (downtime_* / uptime_*)
-- รันครั้งเดียวถ้ามีข้อมูลเก่าใน duration สำหรับงาน MA

UPDATE tasks
SET duration = NULL
WHERE UPPER(TRIM(COALESCE(task_type, ''))) = 'MA'
  AND duration IS NOT NULL;
