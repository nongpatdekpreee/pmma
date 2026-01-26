-- --------------------------------------------------------
-- ตารางผูก contract กับ devices: หลาย device ต่อ 1 สัญญา
-- ใช้แทน contract.device_id (คอลัมน์ device_id ใน contract ยังไว้สำหรับ backward compatibility)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `contract_device` (
  `contract_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  PRIMARY KEY (`contract_id`, `device_id`),
  KEY `fk_cd_device` (`device_id`),
  CONSTRAINT `fk_cd_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cd_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
