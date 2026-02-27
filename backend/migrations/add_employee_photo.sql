-- Add em_picture column to user_profiles (path to uploaded image)
-- Run once: mysql -u user -p your_database < backend/migrations/add_employee_photo.sql

ALTER TABLE user_profiles
ADD COLUMN em_picture VARCHAR(500) NULL DEFAULT NULL
COMMENT 'Path to employee photo e.g. /uploads/employees/xxx.jpg';
