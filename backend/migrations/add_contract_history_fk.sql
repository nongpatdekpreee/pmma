-- Migration: เพิ่ม Foreign Key ให้ตาราง contract_history
-- รัน: mysql -u USER -p app_db < migrations/add_contract_history_fk.sql
-- หรือรันใน phpMyAdmin / MySQL Workbench
--
-- สิ่งที่ทำ:
-- 1. contract_id -> contract(contract_id) ON DELETE CASCADE
--    เมื่อลบ contract จะลบประวัติที่อ้างถึง contract นั้นด้วย
-- 2. old_contract_id -> contract(contract_id) ON DELETE SET NULL
--    เมื่อลบสัญญาเก่า จะ set old_contract_id เป็น NULL (เก็บประวัติไว้เพราะมี old_sof, new_sof)

ALTER TABLE contract_history
  ADD CONSTRAINT fk_ch_contract
    FOREIGN KEY (contract_id) REFERENCES contract(contract_id) ON DELETE CASCADE;

ALTER TABLE contract_history
  ADD CONSTRAINT fk_ch_old_contract
    FOREIGN KEY (old_contract_id) REFERENCES contract(contract_id) ON DELETE SET NULL;
