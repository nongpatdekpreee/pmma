-- Add MA client reporter fields: reporter name, phone number, ticket
ALTER TABLE tasks ADD COLUMN reporter_name VARCHAR(255) DEFAULT NULL AFTER vendor_tel;
ALTER TABLE tasks ADD COLUMN reporter_tel VARCHAR(100) DEFAULT NULL AFTER reporter_name;
ALTER TABLE tasks ADD COLUMN ticket VARCHAR(255) DEFAULT NULL AFTER reporter_tel;
