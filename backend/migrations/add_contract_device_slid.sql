-- ใช้แค่ตาราง contract_device โดยเก็บ SLid (site) ไว้ในตารางนี้
-- ไม่ต้องใช้ contract_site อีก (sites ของสัญญา = DISTINCT SLid จาก contract_device)
-- รัน: mysql -u USER -p DB_NAME < migrations/add_contract_device_slid.sql
-- ถ้าคอลัมน์ SLid มีอยู่แล้วจะ error ได้ ให้ข้ามหรือ comment บรรทัด ADD COLUMN

ALTER TABLE contract_device
  ADD COLUMN SLid INT(11) DEFAULT NULL COMMENT 'FK -> sites_location(SLid)' AFTER device_id;

-- สร้าง Foreign Key จริง (จะเห็น key ใน phpMyAdmin)
ALTER TABLE contract_device
  ADD CONSTRAINT fk_contract_device_slid FOREIGN KEY (SLid) REFERENCES sites_location(SLid) ON DELETE SET NULL ON UPDATE CASCADE;
