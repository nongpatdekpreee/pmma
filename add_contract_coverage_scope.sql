-- เพิ่มคอลัมน์ coverage_scope ในตาราง contract (สำหรับ Coverage Scope ในฟอร์ม Add Contract)
ALTER TABLE `contract` ADD COLUMN `coverage_scope` TEXT DEFAULT NULL;
