-- Migration: เพิ่ม contract_snapshot ใน contract_history (สำหรับ DB ใหม่ที่ยังไม่มี device_json)
-- รัน: mysql -u USER -p app_db < migrations/add_contract_history_contract_snapshot.sql
-- หมายเหตุ: ถ้ามี device_json อยู่แล้ว ให้รัน migrate_contract_history_device_json_to_contract_snapshot.sql แทน

ALTER TABLE contract_history
  ADD COLUMN contract_snapshot LONGTEXT NULL
  COMMENT 'JSON: contract row snapshot (no contract_id) + devices[{CI_Name}]';
