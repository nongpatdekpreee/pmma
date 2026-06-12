-- sites_location: เก็บ Assigned Service ของสัญญา (ตรงกับ app_db 6 / contract API)
-- ค่าเริ่มต้น backfill จาก devices.Assigned_Service ต่อ SLid

ALTER TABLE `sites_location`
  ADD COLUMN IF NOT EXISTS `Assigned_Service` varchar(100) NOT NULL DEFAULT '' AFTER `sla_term`;

UPDATE sites_location sl
INNER JOIN (
  SELECT d.SLid, MIN(TRIM(d.Assigned_Service)) AS svc
  FROM devices d
  WHERE d.SLid IS NOT NULL
    AND d.Assigned_Service IS NOT NULL
    AND TRIM(d.Assigned_Service) != ''
  GROUP BY d.SLid
) src ON sl.SLid = src.SLid
SET sl.Assigned_Service = src.svc
WHERE TRIM(COALESCE(sl.Assigned_Service, '')) = '';
