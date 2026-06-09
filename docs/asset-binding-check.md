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
- **devices**: `Did`, `SLid` (site ปัจจุบันของ device)
- **sites_location**: `SLid`, `SOF` (SOF อยู่ที่ location — device ใน SLid เดียวกันใช้ SOF เดียวกัน)
- API ยังส่งฟิลด์ `Refer_SOF` ใน JSON device เป็น alias จาก `sites_location.SOF`

---

# สร้าง Contract ใหม่ – Device ไม่ขึ้น ต้องเช็คตรงไหน

ตอนสร้าง contract ใหม่ โฟลว์คือ: **เลือก Refer SOF → เลือก Site → กด "เลือก Device"** แล้วถึงจะเห็นรายการ device ถ้า device ไม่ขึ้น ให้เช็คตามลำดับด้านล่าง

## 1) Dropdown "Refer SOF" ว่างหรือไม่มีตัวเลือก

**API:** `GET /api/devices/refer-sof`

**เช็คใน DB:** ระบบดึงจาก `sites_location.SOF` ที่ไม่ใช่ NULL, ไม่ใช่ `''`, ไม่ใช่ `'Not Assigned'`

```sql
-- ต้องมีอย่างน้อย 1 แถวถึงจะมีใน dropdown
SELECT DISTINCT SOF
FROM sites_location
WHERE SOF IS NOT NULL AND TRIM(SOF) != '' AND TRIM(SOF) != 'Not Assigned'
ORDER BY SOF;
```

- ถ้า query นี้ไม่มีแถว → dropdown Refer SOF จะว่าง  
- **แก้:** อัปเดต `sites_location.SOF` ของ location ที่ device อยู่  
  - ผ่าน API: `PATCH /api/sites/locations/:slid/sof` body `{ "SOF": "..." }`  
  - หรือ import/update device ที่มีคอลัมน์ Refer_SOF (backend จะ sync ไป `sites_location.SOF`)  
  - หรือบันทึกสัญญาที่มี `sof_name` (sync ไป location ในสัญญา)

---

## 2) Dropdown "Site" ว่างหรือไม่มีตัวเลือก

**API:** `GET /api/sites/locations`

**เช็คใน DB:**

```sql
SELECT SL.SLid, SL.Sid, SL.SOF, S.Name AS SiteName, L.Location2
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

**เช็คใน DB:** Device จะขึ้นเมื่อ `devices.SLid` = SLid ที่เลือก และ `sites_location.SOF` ของ SLid นั้นตรง Refer SOF

```sql
-- แทน @refer_sof และ @slid ด้วยค่าจาก URL (site_id = SLid)
SELECT d.Did, d.CI_Name, d.Asset_Number, sl.SOF AS Refer_SOF, d.SLid
FROM devices d
INNER JOIN sites_location sl ON d.SLid = sl.SLid
WHERE d.SLid = @slid
  AND (
    sl.SOF = @refer_sof
    OR TRIM(LEADING '0' FROM COALESCE(sl.SOF, '')) = TRIM(LEADING '0' FROM COALESCE(@refer_sof, ''))
  )
ORDER BY d.CI_Name, d.Asset_Number;
```

- ถ้า query นี้ไม่มีแถว = ไม่มี device ที่ location นั้น หรือ SOF ของ location ไม่ตรง  
- **แก้:** ให้ device มี `SLid` ถูกต้อง และ `sites_location.SOF` ตรงกับ Refer SOF ที่เลือก

---

## สรุปจุดที่ต้องเช็ค (สร้าง contract ใหม่ – device ไม่ขึ้น)

| ลำดับ | อาการ | เช็ค | API / ตาราง |
|------|--------|------|-------------|
| 1 | Refer SOF dropdown ว่าง | มีค่า `SOF` ใน `sites_location` หรือไม่ | GET /api/devices/refer-sof |
| 2 | Site dropdown ว่าง | มีข้อมูลใน `sites_location`, `sites`, `location` หรือไม่ | GET /api/sites/locations |
| 3 | กด "เลือก Device" แล้วไม่มีรายการ | device อยู่ SLid ที่เลือก และ `sites_location.SOF` ตรง Refer SOF หรือไม่ | GET /api/devices/by-sof-and-site |
