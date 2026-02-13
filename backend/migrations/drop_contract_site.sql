-- ลบตาราง contract_site (ใช้แค่ contract_device + SLid แล้ว)
-- แนะนำ: สำรองข้อมูลก่อน (SELECT * FROM contract_site; หรือ export)
-- รัน: mysql -u USER -p DB_NAME < migrations/drop_contract_site.sql

DROP TABLE IF EXISTS contract_site;
