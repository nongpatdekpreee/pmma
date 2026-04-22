-- Add Engineer to employee position type
-- Run this on the target database if `user_profiles.type` is an ENUM.
-- If `user_profiles.type` is already VARCHAR, no schema change is required.

ALTER TABLE user_profiles
  MODIFY COLUMN `type` ENUM('Technical', 'Management', 'Engineer') NOT NULL;
