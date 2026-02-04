-- Migration: เพิ่มคอลัมน์ created_at ในตาราง report
-- รัน: mysql -u USER -p app_db < migrations/add_report_created_at.sql
-- หมายเหตุ: ถ้ารันซ้ำจะ error "Duplicate column" - ข้ามได้

ALTER TABLE report
  ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;
