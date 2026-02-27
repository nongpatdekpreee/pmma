-- Migration: Report table สำหรับเก็บ PM/MA Checklist Report
-- รันไฟล์นี้ใน database ที่มี tasks table อยู่แล้ว
--
-- ถ้า table report มีอยู่แล้วแต่ยังไม่มี task_type ให้รัน:
--   ALTER TABLE `report` ADD COLUMN `task_type` enum('PM','MA') NOT NULL DEFAULT 'PM' AFTER `id`;
--   ALTER TABLE `report` ADD KEY `idx_task_type` (`task_type`);

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- สร้าง table report ตาม schema ที่กำหนด + task_type สำหรับแยก PM/MA
CREATE TABLE IF NOT EXISTS `report` (
  `report_id` int(11) NOT NULL AUTO_INCREMENT,
  `id` int(11) NOT NULL COMMENT 'task id',
  `task_type` enum('PM','MA') NOT NULL COMMENT 'ประเภท report (PM/MA)',
  `file_path` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'JSON array of file paths',
  `image_path` longtext NOT NULL COMMENT 'JSON array of image paths',
  `sla_result` int(11) NOT NULL COMMENT '1=Pass, 0=Fail',
  `status` enum('Pass','Fail') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`report_id`),
  KEY `idx_task_id` (`id`),
  KEY `idx_task_type` (`task_type`),
  CONSTRAINT `fk_report_task_id` FOREIGN KEY (`id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;
