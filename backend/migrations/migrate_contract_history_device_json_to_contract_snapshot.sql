-- Migration: เปลี่ยนชื่อ device_json → contract_snapshot (เก็บ snapshot แถว contract + devices)
-- ใช้เมื่อเคยรัน add_contract_history_device_json.sql แล้ว
-- รัน: mysql -u USER -p app_db < migrations/migrate_contract_history_device_json_to_contract_snapshot.sql
-- หมายเหตุ: ถ้าไม่มีคอลัมน์ device_json จะ error — ให้ใช้ add_contract_history_contract_snapshot.sql แทน

ALTER TABLE contract_history
  CHANGE COLUMN device_json contract_snapshot LONGTEXT NULL
  COMMENT 'JSON: contract row snapshot (no contract_id) + devices[{CI_Name}]';
