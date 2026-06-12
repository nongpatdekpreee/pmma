-- Compatibility for contract API on sites_location_sof_history (schema: app_db (7).sql)
-- app_db (7) มี: old_sof, new_sof, terminated_reason, created_at — ไม่มี changed_at
-- SOF ใหม่เก็บในคอลัมน์ SOF; API map new_sof จาก SOF

ALTER TABLE `sites_location_sof_history`
  ADD COLUMN IF NOT EXISTS `old_sof` varchar(255) DEFAULT NULL AFTER `action_type`,
  ADD COLUMN IF NOT EXISTS `terminated_reason` text DEFAULT NULL AFTER `SOF`;
