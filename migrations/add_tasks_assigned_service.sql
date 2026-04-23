-- MA plan: เก็บ Assigned Service ที่เลือกจาก dropdown (ค่า DISTINCT จาก devices.Assigned_Service)
-- รันครั้งเดียวต่อ DB; backend ใช้ taskColumnExists('assigned_service') ถ้ายังไม่รัน migration

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_service VARCHAR(255) NULL;
