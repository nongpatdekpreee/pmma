-- Fix Trigger to use SLid instead of Sid and Location2
-- This script fixes the trigger to get Sid and Location2 from sites_location and location tables

DELIMITER $$

-- Drop existing triggers
DROP TRIGGER IF EXISTS `trg_devices_insert`;
DROP TRIGGER IF EXISTS `trg_devices_update`;

-- Create fixed INSERT trigger
CREATE TRIGGER `trg_devices_insert` AFTER INSERT ON `devices` FOR EACH ROW 
BEGIN
  DECLARE v_sid INT DEFAULT NULL;
  DECLARE v_location2 VARCHAR(255) DEFAULT NULL;
  
  -- Get Sid and Location2 from SLid
  IF NEW.SLid IS NOT NULL THEN
    SELECT sl.Sid, l.Location2 
    INTO v_sid, v_location2
    FROM sites_location sl
    JOIN location l ON sl.lid = l.lid
    WHERE sl.SLid = NEW.SLid
    LIMIT 1;
  END IF;
  
  INSERT INTO devices_history (
    action_type,
    changed_at,
    Did,
    Asset_State,
    serial,
    CI_Name,
    Asset_Number,
    PR_No,
    Vendor,
    Project_purchase,
    Sid,
    Location2,
    PO_No,
    Loan_Start,
    Request_Date,
    Refer_SOF,
    Refer_Ticket,
    Assigned_Service,
    Reason,
    Project_code_purchase,
    Waranty_start,
    Waranty_end,
    Received_date,
    Asset_Type,
    Owner,
    Dtypeid,
    DeRoleid,
    Description
  )
  VALUES (
    'INSERT',
    NOW(),
    NEW.Did,
    NEW.Asset_State,
    NEW.serial,
    NEW.CI_Name,
    NEW.Asset_Number,
    NEW.PR_No,
    NEW.Vendor,
    NEW.Project_purchase,
    v_sid,
    v_location2,
    NEW.PO_No,
    NEW.Loan_Start,
    NEW.Request_Date,
    NEW.Refer_SOF,
    NEW.Refer_Ticket,
    NEW.Assigned_Service,
    NEW.Reason,
    NEW.Project_code_purchase,
    NEW.Waranty_start,
    NEW.Waranty_end,
    NEW.Received_date,
    NEW.Asset_Type,
    NEW.Owner,
    NEW.Dtypeid,
    NEW.DeRoleid,
    COALESCE(@status_change_description, 'Import from Excel')
  );
END$$

-- Create fixed UPDATE trigger
CREATE TRIGGER `trg_devices_update` AFTER UPDATE ON `devices` FOR EACH ROW 
BEGIN
  DECLARE v_sid INT DEFAULT NULL;
  DECLARE v_location2 VARCHAR(255) DEFAULT NULL;
  
  -- Get Sid and Location2 from SLid (use OLD.SLid for history)
  IF OLD.SLid IS NOT NULL THEN
    SELECT sl.Sid, l.Location2 
    INTO v_sid, v_location2
    FROM sites_location sl
    JOIN location l ON sl.lid = l.lid
    WHERE sl.SLid = OLD.SLid
    LIMIT 1;
  END IF;
  
  INSERT INTO devices_history (
    action_type,
    changed_at,
    Did,
    Asset_State,
    serial,
    CI_Name,
    Asset_Number,
    PR_No,
    Vendor,
    Project_purchase,
    Sid,
    Location2,
    PO_No,
    Loan_Start,
    Request_Date,
    Refer_SOF,
    Refer_Ticket,
    Assigned_Service,
    Reason,
    Project_code_purchase,
    Waranty_start,
    Waranty_end,
    Received_date,
    Asset_Type,
    Owner,
    Dtypeid,
    DeRoleid,
    Description
  )
  VALUES (
    'UPDATE',
    NOW(),
    OLD.Did,
    OLD.Asset_State,
    OLD.serial,
    OLD.CI_Name,
    OLD.Asset_Number,
    OLD.PR_No,
    OLD.Vendor,
    OLD.Project_purchase,
    v_sid,
    v_location2,
    OLD.PO_No,
    OLD.Loan_Start,
    OLD.Request_Date,
    OLD.Refer_SOF,
    OLD.Refer_Ticket,
    OLD.Assigned_Service,
    OLD.Reason,
    OLD.Project_code_purchase,
    OLD.Waranty_start,
    OLD.Waranty_end,
    OLD.Received_date,
    OLD.Asset_Type,
    OLD.Owner,
    OLD.Dtypeid,
    OLD.DeRoleid,
    COALESCE(@status_change_description, 'Update from Excel')
  );
END$$

DELIMITER ;

