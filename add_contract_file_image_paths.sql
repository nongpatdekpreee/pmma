-- เพิ่มคอลัมน์สำหรับเก็บ path ไฟล์และรูปภาพในตาราง contract
-- file_paths: JSON array ของ path ไฟล์ (เช่น PDF, DOC, XLS) จาก /uploads/contracts/
-- image_paths: JSON array ของ path รูปภาพจาก /uploads/contracts/

ALTER TABLE `contract` ADD COLUMN `file_paths` TEXT DEFAULT NULL COMMENT 'JSON array of file paths';
ALTER TABLE `contract` ADD COLUMN `image_paths` TEXT DEFAULT NULL COMMENT 'JSON array of image paths';
