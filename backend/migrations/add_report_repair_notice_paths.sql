-- MA Checklist: snapshot Repair notice paths (จาก tasks.photos) ตอนบันทึก report
-- รัน: mysql -u USER -p app_db < migrations/add_report_repair_notice_paths.sql
-- ถ้ารันซ้ำจะ error "Duplicate column" — ข้ามได้

ALTER TABLE report
  ADD COLUMN repair_notice_paths LONGTEXT NULL COMMENT 'JSON array of path strings (/uploads/tasks/...)';
