

CREATE TABLE `contract` (
  `contract_id` int(11) NOT NULL AUTO_INCREMENT,
  `contract_name` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites(SLid)',
  `sof_name` varchar(255) DEFAULT NULL,
  `sla_name` varchar(255) NOT NULL,
  `sla_detail` varchar(255) NOT NULL COMMENT 'เช่น ระยะเวลาการตอบกลับ 24/7',
  `sale_account` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`contract_id`),
  KEY `fk_contract_device` (`device_id`),
  KEY `fk_contract_site` (`site_id`),
  CONSTRAINT `fk_contract_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_contract_site` FOREIGN KEY (`site_id`) REFERENCES `Sites` (`SLid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `ma_shpm` (
  `ma_id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites(SLid)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `sla_status` enum('Pass','Fail') DEFAULT NULL COMMENT 'ผ่าน/ตก',
  `travel_how` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ma_id`),
  KEY `fk_ma_device` (`device_id`),
  KEY `fk_ma_site` (`site_id`),
  KEY `fk_ma_contract` (`contract_id`),
  CONSTRAINT `fk_ma_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_ma_site` FOREIGN KEY (`site_id`) REFERENCES `Sites` (`SLid`) ON DELETE SET NULL,
  CONSTRAINT `fk_ma_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `pm_shma` (
  `pm_id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date DEFAULT NULL COMMENT 'เดิน ไป',
  `end_date` date DEFAULT NULL COMMENT 'กลับ',
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites(SLid)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `status` varchar(100) DEFAULT NULL COMMENT 'ไม่ชัวร์ เหมือนจะได้ใช้',
  `travel_how` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pm_id`),
  KEY `fk_pm_device` (`device_id`),
  KEY `fk_pm_site` (`site_id`),
  KEY `fk_pm_contract` (`contract_id`),
  CONSTRAINT `fk_pm_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_pm_site` FOREIGN KEY (`site_id`) REFERENCES `Sites` (`SLid`) ON DELETE SET NULL,
  CONSTRAINT `fk_pm_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `contract_device` (
  `contract_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  PRIMARY KEY (`contract_id`, `device_id`),
  KEY `fk_cd_device` (`device_id`),
  CONSTRAINT `fk_cd_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cd_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




