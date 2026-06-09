-- SOF อยู่ที่ sites_location.SOF (ไม่ใช่ devices.Refer_SOF)
-- อัปเดต triggers ให้บันทึก Refer_SOF ใน devices_history จาก sites_location

DELIMITER $$

DROP TRIGGER IF EXISTS `trg_devices_insert`$$
DROP TRIGGER IF EXISTS `trg_devices_update`$$

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
