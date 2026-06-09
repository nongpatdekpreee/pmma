-- =============================================================================
-- migrate_old_db_to_new_schema.sql
-- =============================================================================
-- ใช้กับ: Database เก่าที่ยังมี devices.Refer_SOF และ sites_location ไม่มี SOF
-- เป้าหมาย: ให้ schema + trigger ตรงกับ app_db (3) 2.sql (schema ใหม่)
--
-- วิธีใช้ (เก็บ DB เก่า — ไม่ต้องลบ):
--   1) Backup: phpMyAdmin → Export → app_db (Quick หรือ Custom ทั้งหมด)
--   2) Import ไฟล์นี้เข้า app_db ที่มีข้อมูลเก่าอยู่
--   3) ดูผล STEP 4 (verification) ด้านล่าง
--   4) Restart backend → ทดสอบ Contract Editor / Schedule / Import device
--
-- ไฟล์นี้รันซ้ำได้ (idempotent) — ข้ามส่วนที่ทำแล้ว
-- =============================================================================

SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET NAMES utf8mb4;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

USE `app_db`;

-- =============================================================================
-- STEP 1: คอลัมน์อื่นๆ ที่ schema ใหม่มี แต่ DB เก่าอาจยังไม่มี
-- =============================================================================
DROP PROCEDURE IF EXISTS `sp_add_missing_schema_columns`;

DELIMITER $$

CREATE PROCEDURE `sp_add_missing_schema_columns`()
BEGIN
  -- contract.created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract' AND COLUMN_NAME = 'created_at'
  ) THEN
    ALTER TABLE `contract`
      ADD COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp() AFTER `status`;
  END IF;

  -- contract_history.terminated_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_history' AND COLUMN_NAME = 'terminated_reason'
  ) THEN
    ALTER TABLE `contract_history`
      ADD COLUMN `terminated_reason` text DEFAULT NULL COMMENT 'Reason for termination/not renewing'
      AFTER `status_history`;
  END IF;

  -- tasks — MA downtime + assigned_service
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'downtime_date'
  ) THEN
    ALTER TABLE `tasks` ADD COLUMN `downtime_date` date DEFAULT NULL AFTER `end_date`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'downtime_time'
  ) THEN
    ALTER TABLE `tasks` ADD COLUMN `downtime_time` time DEFAULT NULL AFTER `downtime_date`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'uptime_date'
  ) THEN
    ALTER TABLE `tasks` ADD COLUMN `uptime_date` date DEFAULT NULL AFTER `downtime_time`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'uptime_time'
  ) THEN
    ALTER TABLE `tasks` ADD COLUMN `uptime_time` time DEFAULT NULL AFTER `uptime_date`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'downtime_total_hours'
  ) THEN
    ALTER TABLE `tasks` ADD COLUMN `downtime_total_hours` decimal(12,2) DEFAULT NULL AFTER `uptime_time`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'assigned_service'
  ) THEN
    ALTER TABLE `tasks` ADD COLUMN `assigned_service` varchar(255) DEFAULT NULL AFTER `updated_at`;
  END IF;

  -- user_profiles.type → ENUM รองรับ Engineer (schema ใหม่)
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'type'
      AND DATA_TYPE != 'enum'
  ) THEN
    UPDATE `user_profiles`
    SET `type` = 'Technical'
    WHERE TRIM(COALESCE(`type`, '')) = ''
       OR `type` NOT IN ('Technical', 'Management', 'Engineer');

    ALTER TABLE `user_profiles`
      MODIFY COLUMN `type` enum('Technical','Management','Engineer') NOT NULL;
  END IF;
END$$

DELIMITER ;

CALL `sp_add_missing_schema_columns`();
DROP PROCEDURE IF EXISTS `sp_add_missing_schema_columns`;

-- =============================================================================
-- STEP 2: ย้าย SOF — devices.Refer_SOF → sites_location.SOF แล้วลบคอลัมน์เก่า
-- =============================================================================
DROP PROCEDURE IF EXISTS `sp_migrate_sof_to_sites_location`;

DELIMITER $$

CREATE PROCEDURE `sp_migrate_sof_to_sites_location`()
BEGIN
  DECLARE v_has_sof_col INT DEFAULT 0;
  DECLARE v_has_refer_sof_col INT DEFAULT 0;

  SELECT COUNT(*) INTO v_has_sof_col
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sites_location'
    AND COLUMN_NAME = 'SOF';

  IF v_has_sof_col = 0 THEN
    ALTER TABLE `sites_location`
      ADD COLUMN `SOF` varchar(255) NOT NULL DEFAULT '' AFTER `lid`;
  END IF;

  SELECT COUNT(*) INTO v_has_refer_sof_col
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devices'
    AND COLUMN_NAME = 'Refer_SOF';

  IF v_has_refer_sof_col > 0 THEN
    -- 2a) ย้าย Refer_SOF → sites_location.SOF (เลือกค่าที่ device ใน SLid ใช้มากที่สุด)
    UPDATE `sites_location` sl
    INNER JOIN (
      SELECT `SLid`, `refer_sof`
      FROM (
        SELECT d.`SLid`,
               TRIM(d.`Refer_SOF`) AS refer_sof,
               COUNT(*) AS cnt,
               ROW_NUMBER() OVER (
                 PARTITION BY d.`SLid`
                 ORDER BY COUNT(*) DESC, TRIM(d.`Refer_SOF`)
               ) AS rn
        FROM `devices` d
        WHERE d.`SLid` IS NOT NULL
          AND d.`Refer_SOF` IS NOT NULL
          AND TRIM(d.`Refer_SOF`) != ''
          AND TRIM(d.`Refer_SOF`) != 'Not Assigned'
        GROUP BY d.`SLid`, TRIM(d.`Refer_SOF`)
      ) ranked
      WHERE rn = 1
    ) src ON sl.`SLid` = src.`SLid`
    SET sl.`SOF` = src.refer_sof
    WHERE TRIM(COALESCE(sl.`SOF`, '')) = '';

    -- 2b) fallback จาก contract.sof_name
    UPDATE `sites_location` sl
    INNER JOIN (
      SELECT cd.`SLid`,
             MAX(TRIM(c.`sof_name`)) AS sof_name
      FROM `contract_device` cd
      INNER JOIN `contract` c ON c.`contract_id` = cd.`contract_id`
      WHERE cd.`SLid` IS NOT NULL
        AND c.`sof_name` IS NOT NULL
        AND TRIM(c.`sof_name`) != ''
      GROUP BY cd.`SLid`
    ) ctr ON sl.`SLid` = ctr.`SLid`
    SET sl.`SOF` = ctr.sof_name
    WHERE TRIM(COALESCE(sl.`SOF`, '')) = '';

    -- 2c) ลบ Refer_SOF จาก devices
    ALTER TABLE `devices` DROP COLUMN `Refer_SOF`;
  END IF;

  UPDATE `sites_location` SET `SOF` = '' WHERE `SOF` IS NULL;
END$$

DELIMITER ;

CALL `sp_migrate_sof_to_sites_location`();
DROP PROCEDURE IF EXISTS `sp_migrate_sof_to_sites_location`;

-- =============================================================================
-- STEP 3: อัปเดต triggers — history.Refer_SOF จาก sites_location.SOF
-- =============================================================================
DROP TRIGGER IF EXISTS `trg_devices_insert`;
DROP TRIGGER IF EXISTS `trg_devices_update`;

DELIMITER $$

CREATE TRIGGER `trg_devices_insert` AFTER INSERT ON `devices` FOR EACH ROW
BEGIN
  DECLARE v_sid INT DEFAULT NULL;
  DECLARE v_location2 VARCHAR(255) DEFAULT NULL;
  DECLARE v_sof VARCHAR(255) DEFAULT NULL;

  IF NEW.SLid IS NOT NULL THEN
    SELECT sl.Sid, l.Location2, sl.SOF
    INTO v_sid, v_location2, v_sof
    FROM sites_location sl
    JOIN location l ON sl.lid = l.lid
    WHERE sl.SLid = NEW.SLid
    LIMIT 1;
  END IF;

  INSERT INTO devices_history (
    action_type, changed_at, Did, Asset_State, serial, CI_Name, Asset_Number,
    PR_No, Vendor, Project_purchase, Sid, Location2, PO_No, Loan_Start, Request_Date,
    Refer_SOF, Refer_Ticket, Assigned_Service, Reason, Project_code_purchase,
    Waranty_start, Waranty_end, Received_date, Asset_Type, Owner, Dtypeid, DeRoleid, Description
  ) VALUES (
    'INSERT', NOW(), NEW.Did, NEW.Asset_State, NEW.serial, NEW.CI_Name, NEW.Asset_Number,
    NEW.PR_No, NEW.Vendor, NEW.Project_purchase, v_sid, v_location2, NEW.PO_No, NEW.Loan_Start,
    NEW.Request_Date, v_sof, NEW.Refer_Ticket, NEW.Assigned_Service, NEW.Reason,
    NEW.Project_code_purchase, NEW.Waranty_start, NEW.Waranty_end, NEW.Received_date,
    NEW.Asset_Type, NEW.Owner, NEW.Dtypeid, NEW.DeRoleid, COALESCE(@status_change_description, 'Import from Excel')
  );
END$$

CREATE TRIGGER `trg_devices_update` AFTER UPDATE ON `devices` FOR EACH ROW
BEGIN
  DECLARE v_sid INT DEFAULT NULL;
  DECLARE v_location2 VARCHAR(255) DEFAULT NULL;
  DECLARE v_sof VARCHAR(255) DEFAULT NULL;

  IF NEW.SLid IS NOT NULL THEN
    SELECT sl.Sid, l.Location2, sl.SOF
    INTO v_sid, v_location2, v_sof
    FROM sites_location sl
    JOIN location l ON sl.lid = l.lid
    WHERE sl.SLid = NEW.SLid
    LIMIT 1;
  END IF;

  INSERT INTO devices_history (
    action_type, changed_at, Did, Asset_State, serial, CI_Name, Asset_Number,
    PR_No, Vendor, Project_purchase, Sid, Location2, PO_No, Loan_Start, Request_Date,
    Refer_SOF, Refer_Ticket, Assigned_Service, Reason, Project_code_purchase,
    Waranty_start, Waranty_end, Received_date, Asset_Type, Owner, Dtypeid, DeRoleid, Description
  ) VALUES (
    'UPDATE', NOW(), NEW.Did, NEW.Asset_State, NEW.serial, NEW.CI_Name, NEW.Asset_Number,
    NEW.PR_No, NEW.Vendor, NEW.Project_purchase, v_sid, v_location2, NEW.PO_No, NEW.Loan_Start,
    NEW.Request_Date, v_sof, NEW.Refer_Ticket, NEW.Assigned_Service, NEW.Reason,
    NEW.Project_code_purchase, NEW.Waranty_start, NEW.Waranty_end, NEW.Received_date,
    NEW.Asset_Type, NEW.Owner, NEW.Dtypeid, NEW.DeRoleid, COALESCE(@status_change_description, 'Updated')
  );
END$$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- =============================================================================
-- STEP 4: ตรวจผลหลัง migration (รันใน phpMyAdmin → SQL)
-- =============================================================================
-- 4.1 ไม่ควรมี Refer_SOF บน devices แล้ว
-- SHOW COLUMNS FROM devices LIKE 'Refer_SOF';

-- 4.2 ต้องมี SOF บน sites_location
-- SHOW COLUMNS FROM sites_location LIKE 'SOF';

-- 4.3 จำนวน location ที่มี SOF
-- SELECT COUNT(*) AS locations_with_sof FROM sites_location WHERE TRIM(SOF) != '';

-- 4.4 location ที่ยังไม่มี SOF แต่มี device อยู่ (ควรแก้ manual ถ้ามี)
-- SELECT sl.SLid, sl.Sid, sl.lid, sl.SOF, COUNT(d.Did) AS device_count
-- FROM sites_location sl
-- INNER JOIN devices d ON d.SLid = sl.SLid
-- WHERE TRIM(COALESCE(sl.SOF, '')) = ''
-- GROUP BY sl.SLid, sl.Sid, sl.lid, sl.SOF;

-- 4.5 trigger ใหม่
-- SHOW TRIGGERS WHERE `Table` = 'devices';

-- =============================================================================
-- STEP 5: หลัง migration — ทำในแอป (ไม่ใช่ SQL)
-- =============================================================================
-- • Restart backend (nodemon จะ restart เองถ้ารันอยู่)
-- • เปิด Contract Editor หรือ Schedule Management
--   → ระบบจะ sync contract จาก SOF อัตโนมัติ (POST /api/contracts/sync-from-refer-sof)
-- • ทดสอบ dropdown Refer SOF ตอน Add Contract
-- • ทดสอบ import device Excel (คอลัมน์ Refer_SOF จะไปอัปเดต sites_location.SOF)
