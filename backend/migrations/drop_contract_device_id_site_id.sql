-- ย้าย device/site ไป contract_device แล้วลบคอลัมน์ device_id, site_id จาก contract
-- ขั้นตอน: (1) รันส่วน INSERT ด้านล่าง (2) ดูชื่อ FK: SHOW CREATE TABLE contract;
-- (3) DROP FOREIGN KEY ที่อ้าง device_id / site_id (4) รัน ALTER TABLE DROP COLUMN

-- --- ข้อมูลเดิมเข้า contract_device ---
INSERT INTO contract_device (contract_id, device_id, SLid)
SELECT c.contract_id, c.device_id, c.site_id
FROM contract c
WHERE c.device_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contract_device cd
    WHERE cd.contract_id = c.contract_id AND cd.device_id = c.device_id
  );

INSERT INTO contract_device (contract_id, device_id, SLid)
SELECT c.contract_id, NULL, c.site_id
FROM contract c
WHERE c.site_id IS NOT NULL
  AND c.device_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM contract_device cd
    WHERE cd.contract_id = c.contract_id AND cd.SLid = c.site_id
  );

-- --- หลัง DROP FK แล้วค่อย uncomment ---
-- ALTER TABLE contract DROP COLUMN device_id;
-- ALTER TABLE contract DROP COLUMN site_id;
