-- Add vendor_tel column to tasks table (Tel number in Contract Information for MA)
ALTER TABLE tasks ADD COLUMN vendor_tel VARCHAR(100) DEFAULT NULL AFTER vendor_name;
