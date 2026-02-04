-- เพิ่มฟิลด์ contract_value ในตาราง contract
ALTER TABLE `contract` 
ADD COLUMN `contract_value` DECIMAL(15,2) DEFAULT NULL COMMENT 'มูลค่าสัญญา (บาท)' AFTER `sale_account`;
