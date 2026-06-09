-- One-time: ย้าย Refer_SOF จาก devices → sites_location.SOF (ถ้า DB เก่ายังมีคอลัมน์ Refer_SOF)
-- รันครั้งเดียวหลัง migrate schema; ข้ามได้ถ้า sites_location.SOF มีข้อมูลครบแล้ว

UPDATE sites_location sl
INNER JOIN (
  SELECT d.SLid,
         MAX(TRIM(d.Refer_SOF)) AS refer_sof
  FROM devices d
  WHERE d.SLid IS NOT NULL
    AND d.Refer_SOF IS NOT NULL
    AND TRIM(d.Refer_SOF) != ''
    AND TRIM(d.Refer_SOF) != 'Not Assigned'
  GROUP BY d.SLid
) src ON sl.SLid = src.SLid
SET sl.SOF = src.refer_sof
WHERE TRIM(COALESCE(sl.SOF, '')) = '' OR sl.SOF IS NULL;
