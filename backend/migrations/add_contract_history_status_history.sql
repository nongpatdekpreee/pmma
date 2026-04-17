-- Migration: เพิ่ม status_history ใน contract_history (Renew | Terminated)
-- รัน: mysql -u USER -p app_db < migrations/add_contract_history_status_history.sql
-- หมายเหตุ: ถ้ารันซ้ำจะ error "Duplicate column" - ข้ามได้

ALTER TABLE contract_history
  ADD COLUMN status_history VARCHAR(32) NULL COMMENT 'Renew | Terminated';
