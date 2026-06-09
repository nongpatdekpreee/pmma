-- =============================================================================
-- Migration: ย้าย SOF จาก devices.Refer_SOF → sites_location.SOF
-- =============================================================================
-- ใช้เมื่อ: DB เก่ามี Refer_SOF บน devices หรือ trigger ยังอ้าง NEW.Refer_SOF
-- สำหรับ upgrade DB เก่าทั้งหมด → ใช้ migrate_old_db_to_new_schema.sql แทน (ครอบคลุมกว่า)
-- รองรับ: MariaDB / MySQL (phpMyAdmin, DBeaver, mysql client)
--
-- ลำดับแนะนำ:
--   1) Backup DB ก่อน
--   2) Import ไฟล์นี้
--   3) Restart backend แล้วทดสอบ API / เปิดหน้า Contract Editor
-- =============================================================================

SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET NAMES utf8mb4;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- เปลี่ยนชื่อ DB ถ้าไม่ใช่ app_db
USE `app_db`;

-- -----------------------------------------------------------------------------
-- STEP 1: เพิ่มคอลัมน์ sites_location.SOF + backfill + ลบ Refer_SOF จาก devices
-- -----------------------------------------------------------------------------
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
    -- 1a) ย้าย Refer_SOF จาก devices → sites_location (ต่อ SLid)
    UPDATE `sites_location` sl
    INNER JOIN (
      SELECT d.`SLid`,
             MAX(TRIM(d.`Refer_SOF`)) AS refer_sof
      FROM `devices` d
      WHERE d.`SLid` IS NOT NULL
        AND d.`Refer_SOF` IS NOT NULL
        AND TRIM(d.`Refer_SOF`) != ''
        AND TRIM(d.`Refer_SOF`) != 'Not Assigned'
      GROUP BY d.`SLid`
    ) src ON sl.`SLid` = src.`SLid`
    SET sl.`SOF` = src.refer_sof
    WHERE TRIM(COALESCE(sl.`SOF`, '')) = '';

    -- 1b) fallback: ใช้ contract.sof_name จาก contract_device ถ้า location ยังว่าง
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

    -- 1c) ลบคอลัมน์ Refer_SOF จาก devices (schema ใหม่)
    ALTER TABLE `devices` DROP COLUMN `Refer_SOF`;
  END IF;

  -- ให้ NOT NULL ครบทุกแถว
  UPDATE `sites_location` SET `SOF` = '' WHERE `SOF` IS NULL;
END$$

DELIMITER ;

CALL `sp_migrate_sof_to_sites_location`();
DROP PROCEDURE IF EXISTS `sp_migrate_sof_to_sites_location`;

-- -----------------------------------------------------------------------------
-- STEP 2: อัปเดต triggers — ดึง Refer_SOF ใน history จาก sites_location.SOF
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- STEP 3: ตรวจผล (optional — ดูใน phpMyAdmin หลัง import)
-- -----------------------------------------------------------------------------
-- SELECT COUNT(*) AS locations_with_sof FROM sites_location WHERE TRIM(SOF) != '';
-- SELECT SLid, Sid, lid, SOF FROM sites_location WHERE TRIM(SOF) != '' LIMIT 20;
-- SHOW TRIGGERS LIKE 'devices';
