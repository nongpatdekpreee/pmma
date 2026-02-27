-- Migration: เพิ่มคอลัมน์เก็บข้อมูลรายละเอียด Report (checklist, comment, technician, pm_date, device)
-- รัน: mysql -u USER -p app_db < migrations/add_report_detail_columns.sql
-- หมายเหตุ: ถ้ารันซ้ำจะ error "Duplicate column" - ข้ามได้

ALTER TABLE report
  ADD COLUMN checklist_items LONGTEXT NULL COMMENT 'JSON array of checklist items',
  ADD COLUMN comment TEXT NULL,
  ADD COLUMN technician_name VARCHAR(255) NULL,
  ADD COLUMN pm_date DATE NULL,
  ADD COLUMN device_id INT NULL,
  ADD COLUMN device_json LONGTEXT NULL COMMENT 'JSON of device object';
