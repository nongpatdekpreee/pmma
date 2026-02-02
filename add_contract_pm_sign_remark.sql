-- เพิ่มคอลัมน์สำหรับ PM time/year, วันที่ทำสัญญา, และ remark
-- pm_time_per_year: จำนวนครั้ง PM ต่อปี (เช่น 4, 12)
-- contract_sign_date: วันที่ทำสัญญาฉบับนี้
-- remark: หมายเหตุเพิ่มเติม

-- เพิ่มคอลัมน์สำหรับ PM time/year, วันที่ทำสัญญา, และ remark
-- รันทีละคำสั่ง ถ้า column มีอยู่แล้วจะ error ให้ข้ามไป
ALTER TABLE `contract` ADD COLUMN `pm_time_per_year` INT DEFAULT NULL COMMENT 'จำนวนครั้ง PM ต่อปี';
ALTER TABLE `contract` ADD COLUMN `contract_sign_date` DATE DEFAULT NULL COMMENT 'วันที่ทำสัญญาฉบับนี้';
ALTER TABLE `contract` ADD COLUMN `remark` TEXT DEFAULT NULL COMMENT 'หมายเหตุ';
