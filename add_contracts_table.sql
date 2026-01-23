-- --------------------------------------------------------
-- Schema ตามที่กำหนด: contract, ma_shpm, pm_shma, sla
-- PM / MA ดึงข้อมูลจาก contract ผ่าน contract_id
-- อ้างอิง Devices(Did), Sites(Sid) ที่มีอยู่แล้ว
-- --------------------------------------------------------

-- 1) sla – ต้องสร้างก่อน (ถูกอ้างอิงโดย contract)
CREATE TABLE `sla` (
  `sla_id` int(11) NOT NULL AUTO_INCREMENT,
  `sla_name` varchar(255) DEFAULT NULL,
  `sla_detail` text DEFAULT NULL,
  `sla_text` varchar(255) DEFAULT NULL COMMENT 'เช่น 24/7',
  PRIMARY KEY (`sla_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) contract – ตัวกลาง ให้ PM/MA ดึง
CREATE TABLE `contract` (
  `contract_id` int(11) NOT NULL AUTO_INCREMENT,
  `contract_name` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites(Sid)',
  `sof_name` varchar(255) DEFAULT NULL,
  `sla_id` int(11) DEFAULT NULL COMMENT 'FK -> sla(sla_id)',
  `sale_account` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`contract_id`),
  KEY `fk_contract_device` (`device_id`),
  KEY `fk_contract_site` (`site_id`),
  KEY `fk_contract_sla` (`sla_id`),
  CONSTRAINT `fk_contract_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_contract_site` FOREIGN KEY (`site_id`) REFERENCES `Sites` (`Sid`) ON DELETE SET NULL,
  CONSTRAINT `fk_contract_sla` FOREIGN KEY (`sla_id`) REFERENCES `sla` (`sla_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) ma_shpm – MA อ้างอิง contract (ดึงข้อมูลจาก contract ผ่าน contract_id)
CREATE TABLE `ma_shpm` (
  `ma_id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites(Sid)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `reshce` varchar(255) DEFAULT NULL COMMENT 'เปลี่ยน วันไป',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `sla_status` enum('ผ่าน','ตก') DEFAULT NULL COMMENT 'ผ่าน/ตก',
  `travel_how` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ma_id`),
  KEY `fk_ma_device` (`device_id`),
  KEY `fk_ma_site` (`site_id`),
  KEY `fk_ma_contract` (`contract_id`),
  CONSTRAINT `fk_ma_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_ma_site` FOREIGN KEY (`site_id`) REFERENCES `Sites` (`Sid`) ON DELETE SET NULL,
  CONSTRAINT `fk_ma_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) pm_shma – PM อ้างอิง contract (ดึงข้อมูลจาก contract ผ่าน contract_id)
CREATE TABLE `pm_shma` (
  `pm_id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date DEFAULT NULL COMMENT 'เดิน ไป',
  `end_date` date DEFAULT NULL COMMENT 'กลับ',
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites(Sid)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `reshce` varchar(255) DEFAULT NULL COMMENT 'เปลี่ยน วันไป',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `status` varchar(100) DEFAULT NULL COMMENT 'ไม่ชัวร์ เหมือนจะได้ใช้',
  `travel_how` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pm_id`),
  KEY `fk_pm_device` (`device_id`),
  KEY `fk_pm_site` (`site_id`),
  KEY `fk_pm_contract` (`contract_id`),
  CONSTRAINT `fk_pm_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_pm_site` FOREIGN KEY (`site_id`) REFERENCES `Sites` (`Sid`) ON DELETE SET NULL,
  CONSTRAINT `fk_pm_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- ตัวอย่างการดึงข้อมูล PM/MA จาก contract
-- --------------------------------------------------------
-- MA ที่ผูกกับสัญญา พร้อมข้อมูล contract, device, site
-- SELECT m.*, c.contract_name, c.start_date AS contract_start, c.end_date AS contract_end, c.sof_name, s.Name AS site_name, d.CI_Name AS device_name
-- FROM ma_shpm m
-- LEFT JOIN contract c ON m.contract_id = c.contract_id
-- LEFT JOIN Sites s ON m.site_id = s.Sid
-- LEFT JOIN Devices d ON m.device_id = d.Did
-- WHERE m.contract_id = ?;

-- PM ที่ผูกกับสัญญา
-- SELECT p.*, c.contract_name, c.start_date AS contract_start, c.end_date AS contract_end, s.Name AS site_name, d.CI_Name AS device_name
-- FROM pm_shma p
-- LEFT JOIN contract c ON p.contract_id = c.contract_id
-- LEFT JOIN Sites s ON p.site_id = s.Sid
-- LEFT JOIN Devices d ON p.device_id = d.Did
-- WHERE p.contract_id = ?;

-- สัญญาพร้อม SLA
-- SELECT c.*, s.sla_name, s.sla_detail, s.sla_text
-- FROM contract c
-- LEFT JOIN sla s ON c.sla_id = s.sla_id;
