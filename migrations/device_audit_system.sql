-- Migration: Device Audit System
-- 1. Add Description column to Devices (NOT NULL for new devices)
-- 2. Add Description to Devices_History for status change reason
-- 3. Create Triggers and Stored Procedures for automatic logging

-- =====================================================
-- 1. ALTER Devices table - Add Description column
-- =====================================================
ALTER TABLE `Devices` 
ADD COLUMN `Description` VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'คำอธิบายการเพิ่มอุปกรณ์';

-- After migration, remove default to enforce NOT NULL
-- ALTER TABLE `Devices` ALTER COLUMN `Description` DROP DEFAULT;

-- =====================================================
-- 2. ALTER Devices_History table - Add Description for status change reason
-- =====================================================
ALTER TABLE `Devices_History`
ADD COLUMN `Description` VARCHAR(500) DEFAULT NULL COMMENT 'เหตุผลในการเปลี่ยนสถานะ เช่น ซ่อม, เสีย, ยืม';

-- =====================================================
-- 3. Create Stored Procedures
-- =====================================================

-- Procedure สำหรับบันทึกประวัติการ INSERT
DELIMITER //
CREATE PROCEDURE sp_log_device_insert(
    IN p_did INT,
    IN p_user VARCHAR(100),
    IN p_description VARCHAR(500)
)
BEGIN
    INSERT INTO Devices_History (Did, Action, New_Value, Description, User, Created_At)
    VALUES (p_did, 'INSERT', 'New Device Created', p_description, p_user, NOW());
END //
DELIMITER ;

-- Procedure สำหรับบันทึกประวัติการ UPDATE
DELIMITER //
CREATE PROCEDURE sp_log_device_update(
    IN p_did INT,
    IN p_old_value VARCHAR(100),
    IN p_new_value VARCHAR(100),
    IN p_changed_fields TEXT,
    IN p_user VARCHAR(100),
    IN p_description VARCHAR(500)
)
BEGIN
    INSERT INTO Devices_History (Did, Action, Old_Value, New_Value, Changed_Fields, Description, User, Created_At)
    VALUES (p_did, 'UPDATE', p_old_value, p_new_value, p_changed_fields, p_description, p_user, NOW());
END //
DELIMITER ;

-- Procedure สำหรับบันทึกการเปลี่ยนสถานะ (Asset_State)
DELIMITER //
CREATE PROCEDURE sp_log_asset_state_change(
    IN p_did INT,
    IN p_old_state VARCHAR(100),
    IN p_new_state VARCHAR(100),
    IN p_user VARCHAR(100),
    IN p_description VARCHAR(500)
)
BEGIN
    IF p_description IS NULL OR p_description = '' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Description is required for status change';
    END IF;
    
    INSERT INTO Devices_History (Did, Action, Old_Value, New_Value, Description, User, Created_At)
    VALUES (p_did, 'ASSET_STATE_CHANGE', p_old_state, p_new_state, p_description, p_user, NOW());
END //
DELIMITER ;

-- =====================================================
-- 4. Create Triggers for automatic logging
-- =====================================================

-- Trigger AFTER INSERT
DELIMITER //
CREATE TRIGGER trg_device_after_insert
AFTER INSERT ON Devices
FOR EACH ROW
BEGIN
    INSERT INTO Devices_History (Did, Action, New_Value, Description, User, Created_At)
    VALUES (NEW.Did, 'INSERT', CONCAT('Asset: ', IFNULL(NEW.Asset_Number, 'N/A')), 
            NEW.Description, @current_user, NOW());
END //
DELIMITER ;

-- Trigger AFTER UPDATE (for Asset_State changes)
DELIMITER //
CREATE TRIGGER trg_device_after_update
AFTER UPDATE ON Devices
FOR EACH ROW
BEGIN
    -- Log Asset_State changes
    IF OLD.Asset_State <> NEW.Asset_State OR (OLD.Asset_State IS NULL AND NEW.Asset_State IS NOT NULL) THEN
        INSERT INTO Devices_History (Did, Action, Old_Value, New_Value, Description, User, Created_At)
        VALUES (NEW.Did, 'ASSET_STATE_CHANGE', OLD.Asset_State, NEW.Asset_State, 
                @status_change_description, @current_user, NOW());
    END IF;
END //
DELIMITER ;

-- =====================================================
-- 5. Helper procedure to set session variables before operations
-- =====================================================
DELIMITER //
CREATE PROCEDURE sp_set_audit_context(
    IN p_user VARCHAR(100),
    IN p_description VARCHAR(500)
)
BEGIN
    SET @current_user = p_user;
    SET @status_change_description = p_description;
END //
DELIMITER ;

