# เช็ค Asset Binding: ใช้ SLid กับ Contract ID อะไร

## ค่าที่ต้องเช็ค

| ค่า | ความหมาย | ใช้ที่ไหน |
|-----|----------|-----------|
| **SLid** | รหัส site/location จากตาราง `sites_location.SLid` (ตัวที่เลือกใน SITE NAME) | ส่งเป็น `site_id` ใน API และใช้กรองใน `contract_device.SLid` หรือ `devices.SLid` |
| **Contract ID** | รหัสสัญญาจาก `contract.contract_id` (ตัวที่เลือกใน CONTRACT) | ส่งใน path ของ API และใช้กรองใน `contract_device.contract_id` |

## วิธีดูค่าที่ระบบใช้จริง

1. เปิด DevTools (F12) → แท็บ **Network**
2. เลือก **SITE NAME** แล้วเลือก **CONTRACT** (ให้มี request โหลด devices)
3. หา request:  
   `GET .../api/contracts/XXXX/devices?site_id=YYYY`
4. จาก URL:
   - **Contract ID** = `XXXX` (ตัวเลขหลัง `/contracts/` และก่อน `/devices`)
   - **SLid** = `YYYY` (ค่าหลัง `site_id=`)

## เช็คใน Database

แทน `@contract_id` และ `@slid` ด้วยค่าจาก URL ด้านบน แล้วรันใน DB:

```sql
-- 1) มีแถวใน contract_device สำหรับสัญญานี้ + site นี้หรือไม่
SELECT contract_id, device_id, SLid
FROM contract_device
WHERE contract_id = @contract_id
  AND (SLid = @slid OR (SLid IS NULL AND device_id IN (SELECT Did FROM devices WHERE SLid = @slid)));

-- 2) devices ของสัญญานี้ที่ SLid ตรง (จาก contract_device.SLid หรือ devices.SLid)
SELECT d.Did, d.CI_Name, d.Asset_Number, d.SLid AS device_SLid, cd.SLid AS contract_SLid
FROM contract_device cd
INNER JOIN devices d ON cd.device_id = d.Did
WHERE cd.contract_id = @contract_id
  AND (cd.SLid = @slid OR d.SLid = @slid);
```

- ถ้า (1) หรือ (2) ไม่มีแถว = ไม่มี device ผูกกับ **contract นั้น** ที่ **site (SLid) นั้น** จึงแสดง 0 ใน Asset Binding
- แก้โดยเพิ่ม/แก้ข้อมูลใน `contract_device` (ให้มี `contract_id`, `device_id`, `SLid` ตรงกับสัญญาและ site ที่เลือก)

## ตารางที่เกี่ยวข้อง

- **contract_device**: `contract_id`, `device_id`, `SLid` (site ตอนผูก device กับสัญญา)
- **devices**: `Did`, `SLid` (site ปัจจุบันของ device), `Refer_SOF`
- **sites_location**: `SLid` (รหัส site/location ที่ใช้ใน dropdown SITE NAME)

---

# สร้าง Contract ใหม่ – Device ไม่ขึ้น ต้องเช็คตรงไหน

ตอนสร้าง contract ใหม่ โฟลว์คือ: **เลือก Refer SOF → เลือก Site → กด "เลือก Device"** แล้วถึงจะเห็นรายการ device ถ้า device ไม่ขึ้น ให้เช็คตามลำดับด้านล่าง

## 1) Dropdown "Refer SOF" ว่างหรือไม่มีตัวเลือก

**API:** `GET /api/devices/refer-sof`

**เช็คใน DB:** ระบบดึงจาก `devices.Refer_SOF` ที่ไม่ใช่ NULL, ไม่ใช่ `''`, ไม่ใช่ `'Not Assigned'`

```sql
-- ต้องมีอย่างน้อย 1 แถวถึงจะมีใน dropdown
SELECT DISTINCT Refer_SOF
FROM devices
WHERE Refer_SOF IS NOT NULL AND Refer_SOF != '' AND Refer_SOF != 'Not Assigned'
ORDER BY Refer_SOF;
```

- ถ้า query นี้ไม่มีแถว → dropdown Refer SOF จะว่าง  
- **แก้:** อัปเดต `devices.Refer_SOF` ให้ device ที่ต้องการมีค่า (เช่น SOF number จริง)

---

## 2) Dropdown "Site" ว่างหรือไม่มีตัวเลือก

**API:** `GET /api/sites/locations`

**เช็คใน DB:** ระบบดึงจาก `sites_location` รวมกับ `sites` และ `location`

```sql
-- ต้องมีแถวถึงจะมีใน dropdown Site
SELECT SL.SLid, SL.Sid, S.Name AS SiteName, L.Location2
FROM sites_location SL
JOIN sites S ON SL.Sid = S.Sid
JOIN location L ON SL.lid = L.lid
ORDER BY S.Name, L.Location2;
```

- ถ้าไม่มีแถว → dropdown Site จะว่าง  
- **แก้:** ใส่ข้อมูลใน `sites_location`, `sites`, `location` ให้ครบ

---

## 3) เลือก Refer SOF + Site แล้วกด "เลือก Device" แต่ไม่มี device ใน modal

**API:** `GET /api/devices/by-sof-and-site?refer_sof=XXX&site_id=YYY`  
- `XXX` = ค่า Refer SOF ที่เลือก  
- `YYY` = **SLid** ของ Site ที่เลือก (ไม่ใช่ Sid)

**วิธีดูค่าที่ระบบใช้จริง:** เปิด DevTools (F12) → Network → เลือก Refer SOF แล้วเลือก Site แล้วกด "เลือก Device" → หา request ชื่อ `by-sof-and-site` → ดู query string ว่า `refer_sof` และ `site_id` เป็นอะไร

**เช็คใน DB:** Device จะขึ้นก็ต่อเมื่อมีใน `devices` โดย  
- `devices.SLid` = **SLid ของ Site ที่เลือก**  
- และ `devices.Refer_SOF` ตรงกับ Refer SOF ที่เลือก (รองรับทั้งแบบมี 0 นำหน้าและไม่มี)

```sql
-- แทน @refer_sof และ @slid ด้วยค่าจาก URL (site_id = SLid)
SELECT d.Did, d.CI_Name, d.Asset_Number, d.Refer_SOF, d.SLid
FROM devices d
WHERE d.SLid = @slid
  AND (
    d.Refer_SOF = @refer_sof
    OR TRIM(LEADING '0' FROM COALESCE(d.Refer_SOF, '')) = TRIM(LEADING '0' FROM COALESCE(@refer_sof, ''))
  )
ORDER BY d.CI_Name, d.Asset_Number;
```

- ถ้า query นี้ไม่มีแถว = ไม่มี device ที่ **อยู่ที่ Site (SLid) นั้น** และมี **Refer_SOF ตรง** จึงไม่ขึ้นใน modal  
- **แก้:**  
  - ให้ device ที่ต้องการมี `SLid` = SLid ของ Site ที่เลือก และ  
  - มี `Refer_SOF` = ค่า Refer SOF ที่เลือก (หรือตรงกันหลังตัด 0 นำหน้าออก)

---

## สรุปจุดที่ต้องเช็ค (สร้าง contract ใหม่ – device ไม่ขึ้น)

| ลำดับ | อาการ | เช็ค | API / ตาราง |
|------|--------|------|-------------|
| 1 | Refer SOF dropdown ว่าง | มีค่า `Refer_SOF` ใน `devices` หรือไม่ (ไม่ใช่ NULL, '', 'Not Assigned') | GET /api/devices/refer-sof, ตาราง `devices` |
| 2 | Site dropdown ว่าง | มีข้อมูลใน `sites_location`, `sites`, `location` หรือไม่ | GET /api/sites/locations |
| 3 | กด "เลือก Device" แล้วไม่มีรายการ | มี device ที่ `SLid` = SLid ของ Site ที่เลือก และ `Refer_SOF` ตรงกับที่เลือก หรือไม่ | GET /api/devices/by-sof-and-site?refer_sof=...&site_id=... (site_id = **SLid**), ตาราง `devices` |
