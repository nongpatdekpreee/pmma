const db = require('../config/database');
const { applyReferSofToSiteLocation } = require('../backend/config/deviceSof');
/** @deprecated Prefer backend/server.js + backend/controllers/deviceController.js */
const multer = require('multer');
const xlsx = require('xlsx');

// Configure multer for file upload (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only excel files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('กรุณาอัปโหลดไฟล์ Excel เท่านั้น (.xlsx หรือ .xls)'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ─── Helper: slug ───────────────────────────────────────────────────────────
const _createSlug = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

// ─── Helper: generate random hex color ──────────────────────────────────────
const _randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

// ─── Get-or-Create helpers (ใช้ db pool โดยตรง) ─────────────────────────────
const _getOrCreateSite = async (siteName) => {
  if (!siteName) return null;
  const [[existing]] = await db.execute('SELECT Sid FROM sites WHERE Name = ? LIMIT 1', [siteName]);
  if (existing) return existing.Sid;
  const [r] = await db.execute('INSERT INTO sites (Name, Slug, Status) VALUES (?, ?, ?)', [siteName, _createSlug(siteName), 'Active']);
  return r.insertId;
};

const _getOrCreateLocation = async (location2) => {
  if (!location2) return null;
  const [[existing]] = await db.execute('SELECT lid FROM location WHERE Location2 = ? LIMIT 1', [location2]);
  if (existing) return existing.lid;
  const [r] = await db.execute('INSERT INTO location (Location2) VALUES (?)', [location2]);
  return r.insertId;
};

const _getOrCreateSitesLocation = async (sid, lid) => {
  if (!sid || !lid) return null;
  const [[existing]] = await db.execute('SELECT SLid FROM sites_location WHERE Sid = ? AND lid = ? LIMIT 1', [sid, lid]);
  if (existing) return existing.SLid;
  const [r] = await db.execute('INSERT INTO sites_location (Sid, lid) VALUES (?, ?)', [sid, lid]);
  return r.insertId;
};

const _getOrCreateManufacturer = async (brandName) => {
  if (!brandName) return null;
  const [[existing]] = await db.execute('SELECT Mid FROM manufacturer WHERE name = ? LIMIT 1', [brandName]);
  if (existing) return existing.Mid;
  const [r] = await db.execute('INSERT INTO manufacturer (name, slug) VALUES (?, ?)', [brandName, _createSlug(brandName)]);
  return r.insertId;
};

const _getOrCreateDeviceType = async (model, brandName) => {
  if (!model || !brandName) return null;
  const mid = await _getOrCreateManufacturer(brandName);
  if (!mid) return null;
  const [[existing]] = await db.execute('SELECT Dtypeid FROM device_type WHERE model = ? AND Mid = ? LIMIT 1', [model, mid]);
  if (existing) return existing.Dtypeid;
  const [r] = await db.execute('INSERT INTO device_type (model, slug, u_height, Mid) VALUES (?, ?, ?, ?)', [model, _createSlug(model), 1, mid]);
  return r.insertId;
};

const _getOrCreateDeviceRole = async (roleName) => {
  if (!roleName) return null;
  const [[existing]] = await db.execute('SELECT DeRoleid FROM device_role WHERE name = ? LIMIT 1', [roleName]);
  if (existing) return existing.DeRoleid;
  const [r] = await db.execute('INSERT INTO device_role (name, slug, color) VALUES (?, ?, ?)', [roleName, _createSlug(roleName), _randomColor()]);
  return r.insertId;
};

// POST - สร้าง Device ใหม่ (รองรับทั้ง 1 device และหลาย devices)
// ถ้ามี Asset_Number และมีอยู่ใน database แล้ว จะ update แทน insert
// รองรับ Site (name), Brand (name), Model (name), Location2 (name), Role (name) → get-or-create อัตโนมัติ
const createDevice = async (req, res) => {
  try {

    // ตรวจสอบว่าเป็น array หรือ object เดียว
    const isArray = Array.isArray(req.body);
    const devices = isArray ? req.body : [req.body];

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (devices.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งข้อมูล Device'
      });
    }

    // ตรวจสอบข้อมูลที่จำเป็น: ต้องมี (Dtypeid) หรือ (Model + Brand)
    // รองรับทั้ง uppercase และ lowercase field names
    for (let i = 0; i < devices.length; i++) {
      const dtypeid = devices[i].Dtypeid || devices[i].dtypeid;
      const model   = devices[i].Model   || devices[i].model;
      const brand   = devices[i].Brand   || devices[i].brand;
      if (!dtypeid && !(model && brand)) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอก Dtypeid หรือ Model + Brand (จำเป็น) - Device ที่ ${i + 1}`
        });
      }
      const description = devices[i].Description || devices[i].description;
      if (!description || description.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Description (จำเป็น) - Device ที่ ${i + 1}`
        });
      }
    }

    // ดึง Asset_Numbers ทั้งหมดที่ต้องการตรวจสอบ (batch query - เพิ่มความเร็วมาก)
    // รองรับทั้ง uppercase และ lowercase field names
    const assetNumbers = devices
      .filter(d => d.Asset_Number || d.asset_number)
      .map(d => d.Asset_Number || d.asset_number);
    
    let existingAssetsMap = new Map();
    if (assetNumbers.length > 0) {
      const placeholders = assetNumbers.map(() => '?').join(',');
      const checkSql = `SELECT Did, Asset_Number FROM devices WHERE Asset_Number IN (${placeholders})`;
      const [existing] = await db.execute(checkSql, assetNumbers);
      
      // สร้าง map สำหรับค้นหาเร็ว
      existing.forEach(row => {
        existingAssetsMap.set(row.Asset_Number, row.Did);
      });
    }

    // แยก devices ออกเป็น 2 กลุ่ม
    const devicesToInsert = [];
    const devicesToUpdate = [];

    devices.forEach((device, index) => {
      const assetNumber = device.Asset_Number || device.asset_number;
      if (assetNumber && existingAssetsMap.has(assetNumber)) {
        devicesToUpdate.push({
          ...device,
          _index: index,
          _id: existingAssetsMap.get(assetNumber)
        });
      } else {
        devicesToInsert.push({
          ...device,
          _index: index
        });
      }
    });

    const insertedDevices = [];
    const updatedDevices = [];
    const errors = [];

    // INSERT devices ใหม่
    if (devicesToInsert.length > 0) {
      // INSERT devices ทีละตัว (แต่เร็วกว่าเดิมเพราะไม่ต้อง query ตรวจสอบทีละตัว)
      for (const device of devicesToInsert) {
        try {
          // ─── Resolve Site / Location2 / Brand / Model / Role → IDs ───────────
          const siteName   = device.Site       || device.site       || null;
          const location2  = device.Location2  || device.location2  || null;
          const brandName  = device.Brand      || device.brand      || null;
          const modelName  = device.Model      || device.model      || null;
          const roleName   = device.Role       || device.role       || null;

          // SLid: get-or-create Site + Location → sites_location
          let resolvedSLid = device.SLid || device.slid || null;
          if (!resolvedSLid && (siteName || location2)) {
            const sid  = await _getOrCreateSite(siteName);
            const lid  = await _getOrCreateLocation(location2);
            resolvedSLid = await _getOrCreateSitesLocation(sid, lid);
          }

          // Dtypeid: get-or-create Manufacturer + Device_Type
          let resolvedDtypeid = device.Dtypeid || device.dtypeid || null;
          if (!resolvedDtypeid && modelName && brandName) {
            resolvedDtypeid = await _getOrCreateDeviceType(modelName, brandName);
          }

          // DeRoleid: get-or-create Device_Role
          let resolvedDeRoleid = device.DeRoleid || device.deroleid || null;
          if (!resolvedDeRoleid && roleName) {
            resolvedDeRoleid = await _getOrCreateDeviceRole(roleName);
          }
          // ─────────────────────────────────────────────────────────────────────

          // รองรับทั้ง uppercase และ lowercase field names เหมือน importExcel
          const deviceData = {
            Asset_State: device.Asset_State || device.asset_state || null,
            serial: device.serial || null,
            CI_Name: device.CI_Name || device.ci_name || null,
            Asset_Number: device.Asset_Number || device.asset_number || null,
            PR_No: device.PR_No || device.pr_no || null,
            PO_No: device.PO_No || device.po_no || null,
            Vendor: device.Vendor || device.vendor || null,
            Project_code_purchase: device.Project_code_purchase || device.project_code_purchase || '',
            Project_purchase: device.Project_purchase || device.project_purchase || null,
            SLid: resolvedSLid,
            Loan_Start: device.Loan_Start || device.loan_start || null,
            Request_Date: device.Request_Date || device.request_date || null,
            Refer_SOF: device.Refer_SOF || device.refer_sof || null,
            Refer_Ticket: device.Refer_Ticket || device.refer_ticket || null,
            Assigned_Service: device.Assigned_Service || device.assigned_service || null,
            Reason: device.Reason || device.reason || null,
            Dtypeid: resolvedDtypeid,
            DeRoleid: resolvedDeRoleid,
            Waranty_start: device.Waranty_start || device.waranty_start || new Date().toISOString().split('T')[0],
            Waranty_end: device.Waranty_end || device.waranty_end || new Date().toISOString().split('T')[0],
            Received_date: device.Received_date || device.received_date || new Date().toISOString().split('T')[0],
            Description: device.Description || device.description || 'Created via API'
          };

          // SET session variable สำหรับ Description เพื่อให้ trigger อ่านค่าได้
          await db.execute('SET @status_change_description = ?', [deviceData.Description]);

          const [result] = await db.execute(
            `INSERT INTO devices (
              Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, 
              Project_purchase, SLid, PO_No, Loan_Start, Request_Date,
              Refer_Ticket, Assigned_Service, Reason, Dtypeid, DeRoleid,
              Project_code_purchase, Waranty_start, Waranty_end, Received_date, Description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              deviceData.Asset_State,
              deviceData.serial,
              deviceData.CI_Name,
              deviceData.Asset_Number,
              deviceData.PR_No,
              deviceData.Vendor,
              deviceData.Project_purchase,
              deviceData.SLid,
              deviceData.PO_No,
              deviceData.Loan_Start,
              deviceData.Request_Date,
              deviceData.Refer_Ticket,
              deviceData.Assigned_Service,
              deviceData.Reason,
              deviceData.Dtypeid,
              deviceData.DeRoleid,
              deviceData.Project_code_purchase,
              deviceData.Waranty_start,
              deviceData.Waranty_end,
              deviceData.Received_date,
              deviceData.Description
            ]
          );

          const deviceId = result.insertId;
          if (deviceData.Refer_SOF != null && deviceData.SLid != null) {
            await applyReferSofToSiteLocation(db, deviceData.SLid, deviceData.Refer_SOF);
          }

          insertedDevices.push({
            id: result.insertId,
            action: 'inserted',
            _index: device._index,
            Asset_State: deviceData.Asset_State,
            serial: deviceData.serial,
            CI_Name: deviceData.CI_Name,
            Asset_Number: deviceData.Asset_Number,
            PR_No: deviceData.PR_No,
            PO_No: deviceData.PO_No,
            Vendor: deviceData.Vendor,
            Project_purchase: deviceData.Project_purchase,
            Project_code_purchase: deviceData.Project_code_purchase || '',
            SLid: deviceData.SLid,
            Loan_Start: deviceData.Loan_Start,
            Request_Date: deviceData.Request_Date,
            Refer_SOF: deviceData.Refer_SOF,
            Refer_Ticket: deviceData.Refer_Ticket,
            Assigned_Service: deviceData.Assigned_Service,
            Reason: deviceData.Reason,
            Dtypeid: deviceData.Dtypeid,
            DeRoleid: deviceData.DeRoleid,
            Waranty_start: deviceData.Waranty_start || new Date().toISOString().split('T')[0],
            Waranty_end: deviceData.Waranty_end || new Date().toISOString().split('T')[0],
            Received_date: deviceData.Received_date || new Date().toISOString().split('T')[0],
            Description: deviceData.Description
          });
        } catch (error) {
          errors.push({
            index: device._index + 1,
            error: error.message,
            device: device
          });
        }
      }
    }

    // UPDATE devices ที่มีอยู่แล้ว
    for (const device of devicesToUpdate) {
      try {
        // ดึงข้อมูลเดิมก่อน update เพื่อตรวจสอบการเปลี่ยนแปลง Asset_State
        const [oldDeviceData] = await db.execute(
          'SELECT Asset_State FROM devices WHERE Did = ?',
          [device._id]
        );
        const oldAssetState = oldDeviceData[0]?.Asset_State || null;

        // ─── Resolve Site / Location2 / Brand / Model / Role → IDs ───────────
        const siteName_u  = device.Site       || device.site       || null;
        const location2_u = device.Location2  || device.location2  || null;
        const brandName_u = device.Brand      || device.brand      || null;
        const modelName_u = device.Model      || device.model      || null;
        const roleName_u  = device.Role       || device.role       || null;

        // SLid
        let resolvedSLid_u = device.SLid || device.slid || undefined;
        if (resolvedSLid_u === undefined && (siteName_u || location2_u)) {
          const sid_u = await _getOrCreateSite(siteName_u);
          const lid_u = await _getOrCreateLocation(location2_u);
          resolvedSLid_u = await _getOrCreateSitesLocation(sid_u, lid_u);
        }

        // Dtypeid
        let resolvedDtypeid_u = device.Dtypeid || device.dtypeid || undefined;
        if (resolvedDtypeid_u === undefined && modelName_u && brandName_u) {
          resolvedDtypeid_u = await _getOrCreateDeviceType(modelName_u, brandName_u);
        }

        // DeRoleid
        let resolvedDeRoleid_u = device.DeRoleid || device.deroleid || undefined;
        if (resolvedDeRoleid_u === undefined && roleName_u) {
          resolvedDeRoleid_u = await _getOrCreateDeviceRole(roleName_u);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Map ข้อมูลให้รองรับทั้ง uppercase และ lowercase field names เหมือน importExcel
        const updateData = {
          Asset_State: device.Asset_State !== undefined ? device.Asset_State : device.asset_state,
          serial: device.serial !== undefined ? device.serial : undefined,
          CI_Name: device.CI_Name !== undefined ? device.CI_Name : device.ci_name,
          Asset_Number: device.Asset_Number !== undefined ? device.Asset_Number : device.asset_number,
          PR_No: device.PR_No !== undefined ? device.PR_No : device.pr_no,
          PO_No: device.PO_No !== undefined ? device.PO_No : device.po_no,
          Vendor: device.Vendor !== undefined ? device.Vendor : device.vendor,
          Project_purchase: device.Project_purchase !== undefined ? device.Project_purchase : device.project_purchase,
          Project_code_purchase: device.Project_code_purchase !== undefined ? device.Project_code_purchase : device.project_code_purchase,
          SLid: resolvedSLid_u,
          Loan_Start: device.Loan_Start !== undefined ? device.Loan_Start : device.loan_start,
          Request_Date: device.Request_Date !== undefined ? device.Request_Date : device.request_date,
          Refer_SOF: device.Refer_SOF !== undefined ? device.Refer_SOF : device.refer_sof,
          Refer_Ticket: device.Refer_Ticket !== undefined ? device.Refer_Ticket : device.refer_ticket,
          Assigned_Service: device.Assigned_Service !== undefined ? device.Assigned_Service : device.assigned_service,
          Reason: device.Reason !== undefined ? device.Reason : device.reason,
          Dtypeid: resolvedDtypeid_u,
          DeRoleid: resolvedDeRoleid_u,
          Waranty_start: device.Waranty_start !== undefined ? device.Waranty_start : device.waranty_start,
          Waranty_end: device.Waranty_end !== undefined ? device.Waranty_end : device.waranty_end,
          Received_date: device.Received_date !== undefined ? device.Received_date : device.received_date,
          Description: device.Description !== undefined ? device.Description : device.description || 'Updated via API'
        };

        // SET session variable สำหรับ Description เพื่อให้ trigger อ่านค่าได้
        await db.execute('SET @status_change_description = ?', [updateData.Description]);

        const updates = [];
        const values = [];
        const changedFields = {};

        if (updateData.Asset_State !== undefined) {
          updates.push('Asset_State = ?');
          values.push(updateData.Asset_State);
          changedFields.Asset_State = updateData.Asset_State;
        }
        if (updateData.serial !== undefined) {
          updates.push('serial = ?');
          values.push(updateData.serial);
          changedFields.serial = updateData.serial;
        }
        if (updateData.CI_Name !== undefined) {
          updates.push('CI_Name = ?');
          values.push(updateData.CI_Name);
          changedFields.CI_Name = updateData.CI_Name;
        }
        if (updateData.Asset_Number !== undefined) {
          updates.push('Asset_Number = ?');
          values.push(updateData.Asset_Number);
          changedFields.Asset_Number = updateData.Asset_Number;
        }
        if (updateData.PR_No !== undefined) {
          updates.push('PR_No = ?');
          values.push(updateData.PR_No);
          changedFields.PR_No = updateData.PR_No;
        }
        if (updateData.PO_No !== undefined) {
          updates.push('PO_No = ?');
          values.push(updateData.PO_No);
          changedFields.PO_No = updateData.PO_No;
        }
        if (updateData.Vendor !== undefined) {
          updates.push('Vendor = ?');
          values.push(updateData.Vendor);
          changedFields.Vendor = updateData.Vendor;
        }
        if (updateData.Project_purchase !== undefined) {
          updates.push('Project_purchase = ?');
          values.push(updateData.Project_purchase);
          changedFields.Project_purchase = updateData.Project_purchase;
        }
        if (updateData.SLid !== undefined) {
          updates.push('SLid = ?');
          values.push(updateData.SLid);
          changedFields.SLid = updateData.SLid;
        }
        if (updateData.Loan_Start !== undefined) {
          updates.push('Loan_Start = ?');
          values.push(updateData.Loan_Start);
          changedFields.Loan_Start = updateData.Loan_Start;
        }
        if (updateData.Request_Date !== undefined) {
          updates.push('Request_Date = ?');
          values.push(updateData.Request_Date);
          changedFields.Request_Date = updateData.Request_Date;
        }
        const pendingReferSof =
          updateData.Refer_SOF !== undefined ? updateData.Refer_SOF : undefined;
        if (pendingReferSof !== undefined) {
          changedFields.Refer_SOF = pendingReferSof;
        }
        if (updateData.Refer_Ticket !== undefined) {
          updates.push('Refer_Ticket = ?');
          values.push(updateData.Refer_Ticket);
          changedFields.Refer_Ticket = updateData.Refer_Ticket;
        }
        if (updateData.Assigned_Service !== undefined) {
          updates.push('Assigned_Service = ?');
          values.push(updateData.Assigned_Service);
          changedFields.Assigned_Service = updateData.Assigned_Service;
        }
        if (updateData.Reason !== undefined) {
          updates.push('Reason = ?');
          values.push(updateData.Reason);
          changedFields.Reason = updateData.Reason;
        }
        if (updateData.Dtypeid !== undefined) {
          updates.push('Dtypeid = ?');
          values.push(updateData.Dtypeid);
          changedFields.Dtypeid = updateData.Dtypeid;
        }
        if (updateData.DeRoleid !== undefined) {
          updates.push('DeRoleid = ?');
          values.push(updateData.DeRoleid);
          changedFields.DeRoleid = updateData.DeRoleid;
        }
        if (updateData.Project_code_purchase !== undefined) {
          updates.push('Project_code_purchase = ?');
          values.push(updateData.Project_code_purchase);
          changedFields.Project_code_purchase = updateData.Project_code_purchase;
        }
        if (updateData.Waranty_start !== undefined) {
          updates.push('Waranty_start = ?');
          values.push(updateData.Waranty_start);
          changedFields.Waranty_start = updateData.Waranty_start;
        }
        if (updateData.Waranty_end !== undefined) {
          updates.push('Waranty_end = ?');
          values.push(updateData.Waranty_end);
          changedFields.Waranty_end = updateData.Waranty_end;
        }
        if (updateData.Received_date !== undefined) {
          updates.push('Received_date = ?');
          values.push(updateData.Received_date);
          changedFields.Received_date = updateData.Received_date;
        }
        if (updateData.Description !== undefined) {
          updates.push('Description = ?');
          values.push(updateData.Description);
          changedFields.Description = updateData.Description;
        }

        if (updates.length > 0) {
          values.push(device._id);
          const updateSql = `UPDATE devices SET ${updates.join(', ')} WHERE Did = ?`;
          await db.execute(updateSql, values);

          updatedDevices.push({
            id: device._id,
            action: 'updated',
            _index: device._index
          });
        } else if (pendingReferSof !== undefined) {
          updatedDevices.push({
            id: device._id,
            action: 'updated',
            _index: device._index
          });
        } else {
          updatedDevices.push({
            id: device._id,
            action: 'no_changes',
            _index: device._index
          });
        }

        if (pendingReferSof !== undefined) {
          let slidForSof = updateData.SLid;
          if (slidForSof == null) {
            const [slRows] = await db.execute('SELECT SLid FROM devices WHERE Did = ?', [device._id]);
            slidForSof = slRows[0]?.SLid;
          }
          if (slidForSof != null) {
            await applyReferSofToSiteLocation(db, slidForSof, pendingReferSof);
          }
        }
      } catch (error) {
        errors.push({
          index: device._index + 1,
          error: error.message,
          device: device
        });
      }
    }


    // ถ้ามี error บางตัว
    if (errors.length > 0 && insertedDevices.length === 0 && updatedDevices.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้าง/อัพเดท devices ทั้งหมด',
        errors: errors
      });
    }

    // เรียงผลลัพธ์ตาม index เดิม
    const allResults = [...insertedDevices, ...updatedDevices].sort((a, b) => a._index - b._index);
    
    // ลบ _index ออกก่อนส่ง response
    allResults.forEach(result => delete result._index);

    // Response
    if (isArray) {
      // ส่งหลาย devices
      res.status(201).json({
        success: true,
        message: `ประมวลผล devices สำเร็จ ${allResults.length} รายการ (สร้างใหม่ ${insertedDevices.length} รายการ, อัพเดท ${updatedDevices.length} รายการ)${errors.length > 0 ? ` (มีข้อผิดพลาด ${errors.length} รายการ)` : ''}`,
        count: allResults.length,
        inserted: insertedDevices.length,
        updated: updatedDevices.length,
        data: allResults,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      // ส่ง device เดียว
      res.status(201).json({
        success: true,
        message: allResults[0].action === 'updated' ? 'อัพเดท Device สำเร็จ' : 'สร้าง Device สำเร็จ',
        data: allResults[0]
      });
    }
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง Device',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล devices (พร้อม Pagination และ Search)
const getDevices = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // สร้าง WHERE condition สำหรับ search (ไม่แสดง Asset_State = 'Sell')
    let searchCondition = `WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'Sell')`;
    let searchParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition += ` AND (
        devices.Asset_State LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด (พร้อม search - ไม่รวม Sell)
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices
                      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                      LEFT JOIN sites ON sites_location.Sid = sites.Sid
                      LEFT JOIN location ON sites_location.lid = location.lid
                      JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                      JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination (พร้อม search) - ใช้แบบเดียวกับ getDeviceById แต่ไม่ต้องมี WHERE
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 ${searchCondition}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้ (ถ้ามี search)
    let assetStateStats = [];
    if (search) {
      const assetStateSql = `SELECT devices.Asset_State, COUNT(*) AS total
                             FROM devices
                             LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                             LEFT JOIN sites ON sites_location.Sid = sites.Sid
                             LEFT JOIN location ON sites_location.lid = location.lid
                             JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                             JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                             ${searchCondition}
                             GROUP BY devices.Asset_State`;
      const [assetStateResult] = await db.execute(assetStateSql, searchParams);
      assetStateStats = assetStateResult;
    }

    res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: search ? assetStateStats : null,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล devices ที่ไม่ใช่ Asset_State = "In Store" (พร้อม Pagination และ Search)
const getDevicesExcludeInStore = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // สร้าง WHERE condition สำหรับ search
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `AND (
        devices.Asset_State LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด (ไม่รวม "In Store" + search)
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices
                      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                      LEFT JOIN sites ON sites_location.Sid = sites.Sid
                      LEFT JOIN location ON sites_location.lid = location.lid
                      JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                      JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                      WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'In Store')
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination (ไม่รวม "In Store" + search)
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'In Store')
                 ${searchCondition}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้ (ถ้ามี search)
    let assetStateStats = [];
    if (search) {
      const assetStateSql = `SELECT devices.Asset_State, COUNT(*) AS total
                             FROM devices
                             LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                             LEFT JOIN sites ON sites_location.Sid = sites.Sid
                             LEFT JOIN location ON sites_location.lid = location.lid
                             JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                             JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                             WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'In Store')
                             ${searchCondition}
                             GROUP BY devices.Asset_State`;
      const [assetStateResult] = await db.execute(assetStateSql, searchParams);
      assetStateStats = assetStateResult;
    }

    res.status(200).json({
      success: true,
      excludedAssetState: 'In Store',
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: search ? assetStateStats : null,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices exclude In Store:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device',
      error: error.message
    });
  }
};

// GET - ค้นหา devices ตาม Asset_State (พร้อม Pagination และ Search)
const getDevicesByAssetState = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const assetState = req.query.assetState || req.query.asset_state || ''; // Asset_State ที่ต้องการค้นหา (สามารถส่งหลายค่าได้ เช่น "In Store,Out Store" หรือ array)
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // ตรวจสอบว่ามี Asset_State หรือไม่
    if (!assetState) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Asset_State ที่ต้องการค้นหา (assetState หรือ asset_state)'
      });
    }

    // แปลง Asset_State เป็น array (รองรับทั้ง string และ array)
    let assetStates = [];
    if (Array.isArray(assetState)) {
      assetStates = assetState;
    } else if (typeof assetState === 'string') {
      // แยกด้วย comma หรือ semicolon
      assetStates = assetState.split(/[,;]/).map(s => s.trim()).filter(s => s);
    }

    if (assetStates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Asset_State ที่ถูกต้อง'
      });
    }

    // สร้าง WHERE condition สำหรับ Asset_State
    const assetStatePlaceholders = assetStates.map(() => '?').join(',');
    const assetStateCondition = `devices.Asset_State IN (${assetStatePlaceholders})`;

    // สร้าง WHERE condition สำหรับ search
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `AND (
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices
                      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                      LEFT JOIN sites ON sites_location.Sid = sites.Sid
                      LEFT JOIN location ON sites_location.lid = location.lid
                      JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                      JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                      WHERE ${assetStateCondition}
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, [...assetStates, ...searchParams]);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 WHERE ${assetStateCondition}
                 ${searchCondition}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...assetStates, ...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้
    const assetStateStatsSql = `SELECT devices.Asset_State, COUNT(*) AS total
                                FROM devices
                                LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                                LEFT JOIN sites ON sites_location.Sid = sites.Sid
                                LEFT JOIN location ON sites_location.lid = location.lid
                                JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                                JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                                WHERE ${assetStateCondition}
                                ${searchCondition}
                                GROUP BY devices.Asset_State`;
    const [assetStateStatsResult] = await db.execute(assetStateStatsSql, [...assetStates, ...searchParams]);
    const assetStateStats = assetStateStatsResult;

    res.status(200).json({
      success: true,
      assetStates: assetStates,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: assetStateStats,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices by asset state:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการค้นหา Device ตาม Asset_State',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล devices ที่ไม่ใช่ Asset_State = "Out Store" (พร้อม Pagination และ Search)
const getDevicesExcludeOutStore = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // สร้าง WHERE condition สำหรับ search
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `AND (
        devices.Asset_State LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด (ไม่รวม "Out Store" + search)
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices
                      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                      LEFT JOIN sites ON sites_location.Sid = sites.Sid
                      LEFT JOIN location ON sites_location.lid = location.lid
                      JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                      JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                      WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'Out Store')
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination (ไม่รวม "Out Store" + search)
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'Out Store')
                 ${searchCondition}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้ (ถ้ามี search)
    let assetStateStats = [];
    if (search) {
      const assetStateSql = `SELECT devices.Asset_State, COUNT(*) AS total
                             FROM devices
                             LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                             LEFT JOIN sites ON sites_location.Sid = sites.Sid
                             LEFT JOIN location ON sites_location.lid = location.lid
                             JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                             JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                             WHERE (devices.Asset_State IS NULL OR devices.Asset_State != 'Out Store')
                             ${searchCondition}
                             GROUP BY devices.Asset_State`;
      const [assetStateResult] = await db.execute(assetStateSql, searchParams);
      assetStateStats = assetStateResult;
    }

    res.status(200).json({
      success: true,
      excludedAssetState: 'Out Store',
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: search ? assetStateStats : null,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices exclude Out Store:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล devices แยกตาม Site ID (พร้อม Pagination และ Search)
const getDevicesBySiteId = async (req, res) => {
  try {
    // ดึง query parameters
    const siteId = req.params.siteId || req.query.siteId; // Site ID (Sid)
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // ตรวจสอบว่ามี Site ID หรือไม่
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Site ID (siteId)'
      });
    }

    // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
    const [siteCheck] = await db.execute('SELECT Sid, Name FROM sites WHERE Sid = ?', [siteId]);
    if (siteCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบข้อมูล Site ID: ${siteId}`
      });
    }

    const siteName = siteCheck[0].Name;

    // สร้าง WHERE condition สำหรับ search
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `AND (
        devices.Asset_State LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices, device_type, sites, manufacturer 
                      WHERE device_type.Dtypeid = devices.Dtypeid 
                      AND device_type.Mid = manufacturer.Mid 
                      AND devices.Sid = sites.Sid 
                      AND devices.Sid = ?
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, [siteId, ...searchParams]);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT Did, Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, Project_purchase, 
                 devices.Sid as Sid, Location2, PO_No, Loan_Start, Request_Date, Refer_SOF, 
                 Refer_Ticket, Assigned_Service, Reason, devices.Dtypeid as Dtypeid, 
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices, device_type, sites, manufacturer 
                 WHERE device_type.Dtypeid = devices.Dtypeid 
                 AND device_type.Mid = manufacturer.Mid 
                 AND devices.Sid = sites.Sid 
                 AND devices.Sid = ?
                 ${searchCondition}
                 ORDER BY Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [siteId, ...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้
    const assetStateStatsSql = `SELECT devices.Asset_State, COUNT(*) AS total
                                FROM devices
                                LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                                LEFT JOIN sites ON sites_location.Sid = sites.Sid
                                LEFT JOIN location ON sites_location.lid = location.lid
                                JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                                JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                                WHERE sites.Sid = ?
                                ${searchCondition}
                                GROUP BY devices.Asset_State`;
    const [assetStateStatsResult] = await db.execute(assetStateStatsSql, [siteId, ...searchParams]);
    const assetStateStats = assetStateStatsResult;

    res.status(200).json({
      success: true,
      siteId: parseInt(siteId),
      siteName: siteName,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: assetStateStats,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices by site ID:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device ตาม Site ID',
      error: error.message
    });
  }
};

// GET - ค้นหา devices ตาม Site (รองรับทั้ง Site ID และ Site Name)
const getDevicesBySite = async (req, res) => {
  try {
    // ดึง query parameters
    const siteId = req.query.siteId || req.query.site_id; // Site ID (Sid)
    const siteName = req.query.siteName || req.query.site_name || req.query.site; // Site Name
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // ตรวจสอบว่ามี Site ID หรือ Site Name หรือไม่
    if (!siteId && !siteName) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Site ID (siteId) หรือ Site Name (siteName/site)'
      });
    }

    let siteCondition = '';
    let siteParams = [];
    let siteInfo = null;

    // ถ้ามี Site ID ให้ใช้ Site ID
    if (siteId) {
      siteCondition = 'devices.Sid = ?';
      siteParams = [siteId];
      
      // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
      const [siteCheck] = await db.execute('SELECT Sid, Name FROM sites WHERE Sid = ?', [siteId]);
      if (siteCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: `ไม่พบข้อมูล Site ID: ${siteId}`
        });
      }
      siteInfo = siteCheck[0];
    } 
    // ถ้ามี Site Name ให้ใช้ Site Name
    else if (siteName) {
      siteCondition = 'sites.Name = ?';
      siteParams = [siteName];
      
      // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
      const [siteCheck] = await db.execute('SELECT Sid, Name FROM sites WHERE Name = ?', [siteName]);
      if (siteCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: `ไม่พบข้อมูล Site Name: ${siteName}`
        });
      }
      siteInfo = siteCheck[0];
    }

    // สร้าง WHERE condition สำหรับ search
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `AND (
        devices.Asset_State LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices
                      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                      LEFT JOIN sites ON sites_location.Sid = sites.Sid
                      LEFT JOIN location ON sites_location.lid = location.lid
                      JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                      JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                      WHERE ${siteCondition}
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, [...siteParams, ...searchParams]);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 WHERE ${siteCondition}
                 ${searchCondition}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...siteParams, ...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้
    const assetStateStatsSql = `SELECT devices.Asset_State, COUNT(*) AS total
                                FROM devices
                                LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                                LEFT JOIN sites ON sites_location.Sid = sites.Sid
                                LEFT JOIN location ON sites_location.lid = location.lid
                                JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                                JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                                WHERE ${siteCondition}
                                ${searchCondition}
                                GROUP BY devices.Asset_State`;
    const [assetStateStatsResult] = await db.execute(assetStateStatsSql, [...siteParams, ...searchParams]);
    const assetStateStats = assetStateStatsResult;

    res.status(200).json({
      success: true,
      site: {
        id: siteInfo.Sid,
        name: siteInfo.Name
      },
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: assetStateStats,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices by site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการค้นหา Device ตาม Site',
      error: error.message
    });
  }
};

// GET - ค้นหา devices แบบ Advanced Search (รองรับ Site, Asset State, manufacturer พร้อมกัน)
const searchDevices = async (req, res) => {
  try {
    // ดึง query parameters
    const siteId = req.query.siteId || req.query.site_id; 
    const siteName = req.query.siteName || req.query.site_name || req.query.site; // Site Name
    const assetState = req.query.assetState || req.query.asset_state; // Asset State (รองรับหลายค่า)
    const manufacturerId = req.query.manufacturerId || req.query.manufacturer_id || req.query.mid; // manufacturer ID
    const manufacturerName = req.query.manufacturerName || req.query.manufacturer_name || req.query.manufacturer || req.query.brand; // manufacturer Name
    const serial = req.query.serial || req.query.Serial; // Serial Number
    const ciName = req.query.ciName || req.query.CI_Name || req.query.ci_name; // CI Name
    const poNo = req.query.poNo || req.query.PO_No || req.query.po_no; // PO Number
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const search = req.query.search || ''; // คำค้นหาทั่วไป (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // สร้าง WHERE conditions
    const whereConditions = [];
    const params = [];
    const filters = {};

    // Filter by SLid (รองรับหลายค่า) - เปลี่ยนจาก Sid เป็น SLid
    if (siteId) {
      let slids = [];
      if (Array.isArray(siteId)) {
        slids = siteId.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else if (typeof siteId === 'string') {
        slids = siteId.split(/[,;]/).map(s => parseInt(s.trim())).filter(id => !isNaN(id));
      } else {
        slids = [parseInt(siteId)].filter(id => !isNaN(id));
      }

      if (slids.length > 0) {
        if (slids.length === 1) {
          whereConditions.push('devices.SLid = ?');
          params.push(slids[0]);
          filters.siteId = slids[0];
        } else {
          const placeholders = slids.map(() => '?').join(',');
          whereConditions.push(`devices.SLid IN (${placeholders})`);
          params.push(...slids);
          filters.siteId = slids;
        }
      }
    }
    // Filter by Site Name (รองรับหลายค่า)
    else if (siteName) {
      let siteNames = [];
      if (Array.isArray(siteName)) {
        siteNames = siteName;
      } else if (typeof siteName === 'string') {
        siteNames = siteName.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }

      if (siteNames.length > 0) {
        if (siteNames.length === 1) {
          whereConditions.push('sites.Name = ?');
          params.push(siteNames[0]);
          filters.siteName = siteNames[0];
        } else {
          const placeholders = siteNames.map(() => '?').join(',');
          whereConditions.push(`sites.Name IN (${placeholders})`);
          params.push(...siteNames);
          filters.siteName = siteNames;
        }
      }
    }

    // Filter by Asset State (รองรับหลายค่า)
    if (assetState) {
      let assetStates = [];
      if (Array.isArray(assetState)) {
        assetStates = assetState;
      } else if (typeof assetState === 'string') {
        assetStates = assetState.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }

      if (assetStates.length > 0) {
        const placeholders = assetStates.map(() => '?').join(',');
        whereConditions.push(`devices.Asset_State IN (${placeholders})`);
        params.push(...assetStates);
        filters.assetState = assetStates;
      }
    }

    // Filter by manufacturer ID (รองรับหลายค่า)
    if (manufacturerId) {
      let manufacturerIds = [];
      if (Array.isArray(manufacturerId)) {
        manufacturerIds = manufacturerId.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else if (typeof manufacturerId === 'string') {
        manufacturerIds = manufacturerId.split(/[,;]/).map(s => parseInt(s.trim())).filter(id => !isNaN(id));
      } else {
        manufacturerIds = [parseInt(manufacturerId)].filter(id => !isNaN(id));
      }

      if (manufacturerIds.length > 0) {
        if (manufacturerIds.length === 1) {
          whereConditions.push('manufacturer.Mid = ?');
          params.push(manufacturerIds[0]);
          filters.manufacturerId = manufacturerIds[0];
        } else {
          const placeholders = manufacturerIds.map(() => '?').join(',');
          whereConditions.push(`manufacturer.Mid IN (${placeholders})`);
          params.push(...manufacturerIds);
          filters.manufacturerId = manufacturerIds;
        }
      }
    }
    // Filter by manufacturer Name (รองรับหลายค่า)
    else if (manufacturerName) {
      let manufacturerNames = [];
      if (Array.isArray(manufacturerName)) {
        manufacturerNames = manufacturerName;
      } else if (typeof manufacturerName === 'string') {
        manufacturerNames = manufacturerName.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }

      if (manufacturerNames.length > 0) {
        if (manufacturerNames.length === 1) {
          whereConditions.push('manufacturer.name = ?');
          params.push(manufacturerNames[0]);
          filters.manufacturerName = manufacturerNames[0];
        } else {
          const placeholders = manufacturerNames.map(() => '?').join(',');
          whereConditions.push(`manufacturer.name IN (${placeholders})`);
          params.push(...manufacturerNames);
          filters.manufacturerName = manufacturerNames;
        }
      }
    }

    // Filter by Serial Number
    if (serial) {
      const serialPattern = `%${serial}%`;
      whereConditions.push('devices.serial LIKE ?');
      params.push(serialPattern);
      filters.serial = serial;
    }

    // Filter by CI_Name
    if (ciName) {
      const ciNamePattern = `%${ciName}%`;
      whereConditions.push('devices.CI_Name LIKE ?');
      params.push(ciNamePattern);
      filters.ciName = ciName;
    }

    // Filter by PO_No
    if (poNo) {
      const poNoPattern = `%${poNo}%`;
      whereConditions.push('devices.PO_No LIKE ?');
      params.push(poNoPattern);
      filters.poNo = poNo;
    }

    // General Search (ค้นหาในหลาย fields)
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions.push(`(
        devices.Asset_State LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.PO_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ? OR
        device_type.model LIKE ? OR
        manufacturer.name LIKE ? OR
        sites.Name LIKE ?
      )`);
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      filters.search = search;
    }

    // สร้าง WHERE clause (ไม่แสดง Asset_State = 'Sell')
    const whereClause = whereConditions.length > 0 
      ? `WHERE sites_location.Sid = sites.Sid 
         AND sites_location.lid = location.lid 
         AND devices.SLid = sites_location.SLid
         AND device_type.Dtypeid = devices.Dtypeid 
         AND device_type.Mid = manufacturer.Mid 
         AND device_role.DeRoleid = devices.DeRoleid
         AND (devices.Asset_State IS NULL OR devices.Asset_State != 'Sell')
         AND ${whereConditions.join(' AND ')}`
      : `WHERE sites_location.Sid = sites.Sid 
         AND sites_location.lid = location.lid 
         AND devices.SLid = sites_location.SLid
         AND device_type.Dtypeid = devices.Dtypeid 
         AND device_type.Mid = manufacturer.Mid 
         AND device_role.DeRoleid = devices.DeRoleid
         AND (devices.Asset_State IS NULL OR devices.Asset_State != 'Sell')`;

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices, sites, location, sites_location, manufacturer, device_role, device_type
                      ${whereClause}`;
    const [countResult] = await db.execute(countSql, params);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 sites.Name as Sitename, location.Location2, manufacturer.name as Manufacturername, device_role.name, device_type.model
                 FROM devices, sites, location, sites_location, manufacturer, device_role, device_type
                 ${whereClause}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...params, limit, offset]);

    // นับจำนวนแยกตาม Asset_State
    const assetStateStatsSql = `SELECT devices.Asset_State, COUNT(*) AS total
                                FROM devices, sites, location, sites_location, manufacturer, device_role, device_type
                                ${whereClause}
                                GROUP BY devices.Asset_State`;
    const [assetStateStatsResult] = await db.execute(assetStateStatsSql, params);
    const assetStateStats = assetStateStatsResult;

    // นับจำนวนแยกตาม manufacturer
    const manufacturerStatsSql = `SELECT manufacturer.name as manufacturer, COUNT(*) AS total
                                  FROM devices, sites, location, sites_location, manufacturer, device_role, device_type
                                  ${whereClause}
                                  GROUP BY manufacturer.name`;
    const [manufacturerStatsResult] = await db.execute(manufacturerStatsSql, params);
    const manufacturerStats = manufacturerStatsResult;

    // นับจำนวนแยกตาม Site
    const siteStatsSql = `SELECT sites.Name as site, COUNT(*) AS total
                          FROM devices, sites, location, sites_location, manufacturer, device_role, device_type
                          ${whereClause}
                          GROUP BY sites.Name`;
    const [siteStatsResult] = await db.execute(siteStatsSql, params);
    const siteStats = siteStatsResult;

    res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      assetStateStats: assetStateStats.length > 0 ? assetStateStats : null,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error searching devices:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการค้นหา Device',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล Device ตาม ID
const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 WHERE devices.Did = ?`;
    
    const [rows] = await db.execute(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device'
      });
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error getting device by id:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device',
      error: error.message
    });
  }
};

// PUT - อัพเดท Asset_State (รองรับทั้ง 1 device และหลาย devices)
// รองรับการอัพเดท: Asset_State, Location2, Site (SLid), Request_Date, Refer_SOF, Refer_Ticket, Reason, Assigned_Service
const updateAssetState = async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น array หรือ object เดียว
    const isArray = Array.isArray(req.body);
    const updates = isArray ? req.body : [req.body];

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งข้อมูล Device ที่ต้องการอัพเดท'
      });
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    for (let i = 0; i < updates.length; i++) {
      if (!updates[i].Did) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Did (จำเป็น) - Record ที่ ${i + 1}`
        });
      }
      if (updates[i].Asset_State === undefined || updates[i].Asset_State === null) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Asset_State (จำเป็น) - Record ที่ ${i + 1}`
        });
      }
      if (!updates[i].Description || updates[i].Description.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Description (เหตุผลในการเปลี่ยนสถานะ) - Record ที่ ${i + 1}`
        });
      }
    }

    // ดึง Device IDs ทั้งหมดที่ต้องการอัพเดท
    const deviceIds = updates.map(u => u.Did);

    // ดึงข้อมูลเดิมทั้งหมด (batch query)
    const placeholders = deviceIds.map(() => '?').join(',');
    const checkSql = `SELECT d.Did, d.Asset_State, d.SLid, d.Request_Date, sl.SOF AS Refer_SOF,
                      d.Refer_Ticket, d.Reason, d.Assigned_Service
                      FROM devices d
                      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
                      WHERE d.Did IN (${placeholders})`;
    const [existingDevices] = await db.execute(checkSql, deviceIds);

    // สร้าง map สำหรับค้นหาเร็ว
    const existingMap = new Map();
    existingDevices.forEach(device => {
      existingMap.set(device.Did, {
        Asset_State: device.Asset_State,
        SLid: device.SLid,
        Request_Date: device.Request_Date,
        Refer_SOF: device.Refer_SOF,
        Refer_Ticket: device.Refer_Ticket,
        Reason: device.Reason,
        Assigned_Service: device.Assigned_Service
      });
    });

    // ตรวจสอบว่า Device ทั้งหมดมีอยู่จริงหรือไม่
    const notFoundIds = deviceIds.filter(id => !existingMap.has(id));
    if (notFoundIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบข้อมูล Device: ${notFoundIds.join(', ')}`
      });
    }

    const updatedDevices = [];
    const errors = [];

    // อัพเดท devices ทีละตัว
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      try {
        const deviceId = update.Did;
        const oldData = existingMap.get(deviceId);
        const newAssetState = update.Asset_State;
        const oldAssetState = oldData.Asset_State;

        // ดึงค่าจาก request (รองรับทั้ง uppercase และ lowercase)
        const newSLid = update.SLid || update.slid || update.sLid || null;
        const newSiteName = update.Site || update.site || update.site_name || update.SiteName || null;
        const newLocation2 = update.Location2 || update.location2 || null;
        const newRequestDate = update.Request_Date || update.request_date || update.RequestDate || null;
        const newReferSOF = update.Refer_SOF || update.refer_sof || update.SOF || update.sof || null;
        const newReferTicket = update.Refer_Ticket || update.refer_ticket || update.Ticket || update.ticket || null;
        const newReason = update.Reason || update.reason || null;
        const newAssignedService = update.Assigned_Service || update.assigned_service || update.AssignedService || null;

        // ค้นหา SLid จาก Site และ Location2 ถ้ามี
        let finalSLid = newSLid;
        
        if (!finalSLid && (newSiteName || newLocation2)) {
          // ค้นหา SLid จาก Site Name และ Location2
          let slQuery = `
            SELECT SL.SLid 
            FROM sites_location SL
            LEFT JOIN sites S ON SL.Sid = S.Sid
            LEFT JOIN location L ON SL.lid = L.lid
            WHERE 1=1
          `;
          const slParams = [];

          if (newSiteName) {
            slQuery += ` AND S.Name = ?`;
            slParams.push(newSiteName);
          }
          if (newLocation2) {
            slQuery += ` AND L.Location2 = ?`;
            slParams.push(newLocation2);
          }

          slQuery += ` LIMIT 1`;

          const [slResult] = await db.execute(slQuery, slParams);
          if (slResult.length > 0) {
            finalSLid = slResult[0].SLid;
          }
        }

        // สร้าง dynamic update query
        const updateFields = [];
        const updateParams = [];
        const changes = {};

        // Asset_State (จำเป็น)
        if (oldAssetState !== newAssetState) {
          updateFields.push('Asset_State = ?');
          updateParams.push(newAssetState);
          changes.Asset_State = { old: oldAssetState, new: newAssetState };
        }

        // SLid (Site + location)
        if (finalSLid && oldData.SLid !== finalSLid) {
          updateFields.push('SLid = ?');
          updateParams.push(finalSLid);
          changes.SLid = { old: oldData.SLid, new: finalSLid };
        }

        // Request_Date
        if (newRequestDate !== null && newRequestDate !== undefined) {
          updateFields.push('Request_Date = ?');
          updateParams.push(newRequestDate);
          changes.Request_Date = { old: oldData.Request_Date, new: newRequestDate };
        }

        // Refer_SOF → sites_location.SOF
        let pendingReferSofUpdate = null;
        if (newReferSOF !== null && newReferSOF !== undefined) {
          pendingReferSofUpdate = newReferSOF;
          changes.Refer_SOF = { old: oldData.Refer_SOF, new: newReferSOF };
        }

        // Refer_Ticket
        if (newReferTicket !== null && newReferTicket !== undefined) {
          updateFields.push('Refer_Ticket = ?');
          updateParams.push(newReferTicket);
          changes.Refer_Ticket = { old: oldData.Refer_Ticket, new: newReferTicket };
        }

        // Reason
        if (newReason !== null && newReason !== undefined) {
          updateFields.push('Reason = ?');
          updateParams.push(newReason);
          changes.Reason = { old: oldData.Reason, new: newReason };
        }

        // Assigned_Service
        if (newAssignedService !== null && newAssignedService !== undefined) {
          updateFields.push('Assigned_Service = ?');
          updateParams.push(newAssignedService);
          changes.Assigned_Service = { old: oldData.Assigned_Service, new: newAssignedService };
        }

        // ถ้ามีการเปลี่ยนแปลง
        if (updateFields.length > 0) {
          // SET session variable สำหรับ Description เพื่อให้ trigger อ่านค่าได้
          const description = update.Description || '';
          await db.execute('SET @status_change_description = ?', [description]);
          
          const updateSql = `UPDATE devices SET ${updateFields.join(', ')} WHERE Did = ?`;
          updateParams.push(deviceId);
          await db.execute(updateSql, updateParams);

          updatedDevices.push({
            Did: deviceId,
            oldAssetState: oldAssetState,
            newAssetState: newAssetState,
            changes: changes,
            action: 'updated'
          });
        } else if (pendingReferSofUpdate !== null) {
          updatedDevices.push({
            Did: deviceId,
            oldAssetState: oldAssetState,
            newAssetState: newAssetState,
            changes: changes,
            action: 'updated'
          });
        } else {
          // ถ้าไม่มีการเปลี่ยนแปลง
          updatedDevices.push({
            Did: deviceId,
            oldAssetState: oldAssetState,
            newAssetState: newAssetState,
            action: 'no_changes'
          });
        }

        if (pendingReferSofUpdate !== null) {
          const slidForSof = finalSLid || oldData.SLid;
          if (slidForSof != null) {
            await applyReferSofToSiteLocation(db, slidForSof, pendingReferSofUpdate);
          }
        }
      } catch (error) {
        errors.push({
          index: i + 1,
          Did: update.Did,
          error: error.message
        });
      }
    }

    // ถ้ามี error บางตัว
    if (errors.length > 0 && updatedDevices.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดท Asset_State Other ทั้งหมด',
        errors: errors
      });
    }

    // Response
    if (isArray) {
      // ส่งหลาย devices
      const updatedCount = updatedDevices.filter(d => d.action === 'updated').length;
      const noChangesCount = updatedDevices.filter(d => d.action === 'no_changes').length;

      res.status(200).json({
        success: true,
        message: `อัพเดท Asset_State สำเร็จ ${updatedCount} รายการ${noChangesCount > 0 ? ` (ไม่มีการเปลี่ยนแปลง ${noChangesCount} รายการ)` : ''}${errors.length > 0 ? ` (มีข้อผิดพลาด ${errors.length} รายการ)` : ''}`,
        count: updatedDevices.length,
        updated: updatedCount,
        noChanges: noChangesCount,
        data: updatedDevices,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      // ส่ง device เดียว
      res.status(200).json({
        success: true,
        message: updatedDevices[0].action === 'updated' ? 'อัพเดท Asset_State สำเร็จ' : 'ไม่มีการเปลี่ยนแปลง',
        data: updatedDevices[0]
      });
    }
  } catch (error) {
    console.error('Error updating asset state:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดท Asset_State',
      error: error.message
    });
  }
};

// PUT - อัพเดท Asset_State Other (รองรับทั้ง 1 device และหลาย devices)
// รองรับการอัพเดท: Asset_State, Request_Date, Reason, Site, Location2
const updateAssetStateOther = async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น array หรือ object เดียว
    const isArray = Array.isArray(req.body);
    const updates = isArray ? req.body : [req.body];

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งข้อมูล Device ที่ต้องการอัพเดท'
      });
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    for (let i = 0; i < updates.length; i++) {
      if (!updates[i].Did) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Did (จำเป็น) - Record ที่ ${i + 1}`
        });
      }
      if (updates[i].Asset_State === undefined || updates[i].Asset_State === null) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Asset_State (จำเป็น) - Record ที่ ${i + 1}`
        });
      }
      if (!updates[i].Description || updates[i].Description.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Description (เหตุผลในการเปลี่ยนสถานะ) - Record ที่ ${i + 1}`
        });
      }
    }

    // ดึง Device IDs ทั้งหมดที่ต้องการอัพเดท
    const deviceIds = updates.map(u => u.Did);

    // ดึงข้อมูลเดิมทั้งหมด (batch query)
    const placeholders = deviceIds.map(() => '?').join(',');
    const checkSql = `SELECT Did, Asset_State, SLid, Request_Date, Reason FROM devices WHERE Did IN (${placeholders})`;
    const [existingDevices] = await db.execute(checkSql, deviceIds);

    // สร้าง map สำหรับค้นหาเร็ว
    const existingMap = new Map();
    existingDevices.forEach(device => {
      existingMap.set(device.Did, {
        Asset_State: device.Asset_State,
        SLid: device.SLid,
        Request_Date: device.Request_Date,
        Reason: device.Reason
      });
    });

    // ตรวจสอบว่า Device ทั้งหมดมีอยู่จริงหรือไม่
    const notFoundIds = deviceIds.filter(id => !existingMap.has(id));
    if (notFoundIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบข้อมูล Device: ${notFoundIds.join(', ')}`
      });
    }

    const updatedDevices = [];
    const errors = [];

    // อัพเดท devices ทีละตัว
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      try {
        const deviceId = update.Did;
        const oldData = existingMap.get(deviceId);
        const newAssetState = update.Asset_State;
        const oldAssetState = oldData.Asset_State;

        // ดึงค่าจาก request (รองรับทั้ง uppercase และ lowercase)
        const newSLid = update.SLid || update.slid || update.sLid || null;
        const newSiteName = update.Site || update.site || update.site_name || update.SiteName || null;
        const newLocation2 = update.Location2 || update.location2 || null;
        const newRequestDate = update.Request_Date || update.request_date || update.RequestDate || null;
        const newReason = update.Reason || update.reason || null;

        // ค้นหา SLid จาก Site และ Location2 ถ้ามี
        let finalSLid = newSLid;
        
        if (!finalSLid && (newSiteName || newLocation2)) {
          // ค้นหา SLid จาก Site Name และ Location2
          let slQuery = `
            SELECT SL.SLid 
            FROM sites_location SL
            LEFT JOIN sites S ON SL.Sid = S.Sid
            LEFT JOIN location L ON SL.lid = L.lid
            WHERE 1=1
          `;
          const slParams = [];

          if (newSiteName) {
            slQuery += ` AND S.Name = ?`;
            slParams.push(newSiteName);
          }
          if (newLocation2) {
            slQuery += ` AND L.Location2 = ?`;
            slParams.push(newLocation2);
          }

          slQuery += ` LIMIT 1`;

          const [slResult] = await db.execute(slQuery, slParams);
          if (slResult.length > 0) {
            finalSLid = slResult[0].SLid;
          }
        }

        // สร้าง dynamic update query
        const updateFields = [];
        const updateParams = [];
        const changes = {};

        // Asset_State (จำเป็น)
        if (oldAssetState !== newAssetState) {
          updateFields.push('Asset_State = ?');
          updateParams.push(newAssetState);
          changes.Asset_State = { old: oldAssetState, new: newAssetState };
        }

        // SLid (Site + location)
        if (finalSLid && oldData.SLid !== finalSLid) {
          updateFields.push('SLid = ?');
          updateParams.push(finalSLid);
          changes.SLid = { old: oldData.SLid, new: finalSLid };
        }

        // Request_Date
        if (newRequestDate !== null && newRequestDate !== undefined) {
          updateFields.push('Request_Date = ?');
          updateParams.push(newRequestDate);
          changes.Request_Date = { old: oldData.Request_Date, new: newRequestDate };
        }

        // Reason
        if (newReason !== null && newReason !== undefined) {
          updateFields.push('Reason = ?');
          updateParams.push(newReason);
          changes.Reason = { old: oldData.Reason, new: newReason };
        }

        // ถ้ามีการเปลี่ยนแปลง
        if (updateFields.length > 0) {
          // SET session variable สำหรับ Description เพื่อให้ trigger อ่านค่าได้
          const description = update.Description || '';
          await db.execute('SET @status_change_description = ?', [description]);
          
          const updateSql = `UPDATE devices SET ${updateFields.join(', ')} WHERE Did = ?`;
          updateParams.push(deviceId);
          await db.execute(updateSql, updateParams);

          updatedDevices.push({
            Did: deviceId,
            oldAssetState: oldAssetState,
            newAssetState: newAssetState,
            changes: changes,
            action: 'updated'
          });
        } else {
          // ถ้าไม่มีการเปลี่ยนแปลง
          updatedDevices.push({
            Did: deviceId,
            oldAssetState: oldAssetState,
            newAssetState: newAssetState,
            action: 'no_changes'
          });
        }
      } catch (error) {
        errors.push({
          index: i + 1,
          Did: update.Did,
          error: error.message
        });
      }
    }

    // ถ้ามี error บางตัว
    if (errors.length > 0 && updatedDevices.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดท Asset_State ทั้งหมด',
        errors: errors
      });
    }

    // Response
    if (isArray) {
      // ส่งหลาย devices
      const updatedCount = updatedDevices.filter(d => d.action === 'updated').length;
      const noChangesCount = updatedDevices.filter(d => d.action === 'no_changes').length;

      res.status(200).json({
        success: true,
        message: `อัพเดท Asset_State สำเร็จ ${updatedCount} รายการ${noChangesCount > 0 ? ` (ไม่มีการเปลี่ยนแปลง ${noChangesCount} รายการ)` : ''}${errors.length > 0 ? ` (มีข้อผิดพลาด ${errors.length} รายการ)` : ''}`,
        count: updatedDevices.length,
        updated: updatedCount,
        noChanges: noChangesCount,
        data: updatedDevices,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      // ส่ง device เดียว
      res.status(200).json({
        success: true,
        message: updatedDevices[0].action === 'updated' ? 'อัพเดท Asset_State สำเร็จ' : 'ไม่มีการเปลี่ยนแปลง',
        data: updatedDevices[0]
      });
    }
  } catch (error) {
    console.error('Error updating asset state other:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดท Asset_State',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล Device
const updateDevice = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    // รองรับทั้ง uppercase และ lowercase field names เหมือน importExcel
    const {
      Asset_State,
      asset_state,
      serial,
      CI_Name,
      ci_name,
      Asset_Number,
      asset_number,
      PR_No,
      pr_no,
      PO_No,
      po_no,
      Vendor,
      vendor,
      Project_purchase,
      project_purchase,
      Project_code_purchase,
      project_code_purchase: project_code_purchase_lower,
      Site,
      site,
      Location2,
      location2,
      Loan_Start,
      loan_start,
      Request_Date,
      request_date,
      Refer_SOF,
      refer_sof,
      Refer_Ticket,
      refer_ticket,
      Assigned_Service,
      assigned_service,
      Reason,
      reason,
      Dtypeid,
      dtypeid,
      DeRoleid,
      deroleid,
      Waranty_start,
      waranty_start,
      Waranty_end,
      waranty_end,
      Received_date,
      received_date,
      Asset_Type,
      asset_type,
      Owner,
      owner,
      Description,
      description
    } = req.body;

    // Helper functions (เหมือน importExcel)
    const createSlug = (text) => {
      if (!text) return '';
      return text.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    };

    // Get or Create Site
    const getOrCreateSite = async (siteName) => {
      if (!siteName) return null;
      const [existing] = await connection.execute(
        'SELECT Sid FROM sites WHERE Name = ?',
        [siteName]
      );
      if (existing.length > 0) {
        return existing[0].Sid;
      }
      const slug = createSlug(siteName);
      const [result] = await connection.execute(
        'INSERT INTO sites (Name, Slug, Status) VALUES (?, ?, ?)',
        [siteName, slug, 'Active']
      );
      return result.insertId;
    };

    // Get or Create location
    const getOrCreateLocation = async (location2) => {
      if (!location2) return null;
      const [existing] = await connection.execute(
        'SELECT lid FROM location WHERE Location2 = ?',
        [location2]
      );
      if (existing.length > 0) {
        return existing[0].lid;
      }
      const [result] = await connection.execute(
        'INSERT INTO location (Location2) VALUES (?)',
        [location2]
      );
      return result.insertId;
    };

    // Get or Create sites_location
    const getOrCreateSitesLocation = async (sid, lid) => {
      if (!sid || !lid) return null;
      const [existing] = await connection.execute(
        'SELECT SLid FROM sites_location WHERE Sid = ? AND lid = ?',
        [sid, lid]
      );
      if (existing.length > 0) {
        return existing[0].SLid;
      }
      const [result] = await connection.execute(
        'INSERT INTO sites_location (Sid, lid, SOF) VALUES (?, ?, ?)',
        [sid, lid, '']
      );
      return result.insertId;
    };

    // Map ข้อมูลให้รองรับทั้ง uppercase และ lowercase
    const siteName = Site !== undefined ? Site : site;
    const location2Value = Location2 !== undefined ? Location2 : location2;
    
    const updateData = {
      Asset_State: Asset_State !== undefined ? Asset_State : asset_state,
      serial: serial !== undefined ? serial : undefined,
      CI_Name: CI_Name !== undefined ? CI_Name : ci_name,
      Asset_Number: Asset_Number !== undefined ? Asset_Number : asset_number,
      PR_No: PR_No !== undefined ? PR_No : pr_no,
      PO_No: PO_No !== undefined ? PO_No : po_no,
      Vendor: Vendor !== undefined ? Vendor : vendor,
      Project_purchase: Project_purchase !== undefined ? Project_purchase : project_purchase,
      Project_code_purchase: Project_code_purchase !== undefined ? Project_code_purchase : project_code_purchase_lower,
      Loan_Start: Loan_Start !== undefined ? Loan_Start : loan_start,
      Request_Date: Request_Date !== undefined ? Request_Date : request_date,
      Refer_SOF: Refer_SOF !== undefined ? Refer_SOF : refer_sof,
      Refer_Ticket: Refer_Ticket !== undefined ? Refer_Ticket : refer_ticket,
      Assigned_Service: Assigned_Service !== undefined ? Assigned_Service : assigned_service,
      Reason: Reason !== undefined ? Reason : reason,
      Dtypeid: Dtypeid !== undefined ? Dtypeid : dtypeid,
      DeRoleid: DeRoleid !== undefined ? DeRoleid : deroleid,
      Waranty_start: Waranty_start !== undefined ? Waranty_start : waranty_start,
      Waranty_end: Waranty_end !== undefined ? Waranty_end : waranty_end,
      Received_date: Received_date !== undefined ? Received_date : received_date,
      Asset_Type: Asset_Type !== undefined ? Asset_Type : asset_type,
      Owner: Owner !== undefined ? Owner : owner,
      Description: Description !== undefined ? Description : description
    };

    // จัดการ Site และ Location2 เพื่อสร้าง SLid
    let slid = null;
    if (siteName || location2Value) {
      const sid = siteName ? await getOrCreateSite(siteName) : null;
      const lid = location2Value ? await getOrCreateLocation(location2Value) : null;
      if (sid && lid) {
        slid = await getOrCreateSitesLocation(sid, lid);
      }
    }

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    // Note: Description ไม่นับเป็น field ที่จะ update ใน devices table (ใช้สำหรับ trigger เท่านั้น)
    const hasUpdate = updateData.Asset_State !== undefined || updateData.serial !== undefined || 
                     updateData.CI_Name !== undefined || updateData.Asset_Number !== undefined || 
                     updateData.PR_No !== undefined || updateData.PO_No !== undefined || 
                     updateData.Vendor !== undefined || updateData.Project_purchase !== undefined || 
                     updateData.Project_code_purchase !== undefined || slid !== null || 
                     updateData.Loan_Start !== undefined || 
                     updateData.Request_Date !== undefined || updateData.Refer_SOF !== undefined || 
                     updateData.Refer_Ticket !== undefined || updateData.Assigned_Service !== undefined || 
                     updateData.Reason !== undefined || updateData.Dtypeid !== undefined || 
                     updateData.DeRoleid !== undefined || updateData.Waranty_start !== undefined || 
                     updateData.Waranty_end !== undefined || updateData.Received_date !== undefined ||
                     updateData.Asset_Type !== undefined || updateData.Owner !== undefined;

    if (!hasUpdate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข'
      });
    }

    // ตรวจสอบว่า Device มีอยู่จริงหรือไม่ และดึงข้อมูลเดิม
    const checkSql = 'SELECT Did, Asset_State FROM devices WHERE Did = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device ที่ต้องการแก้ไข'
      });
    }

    const oldAssetState = existing[0].Asset_State;

    // SET session variable สำหรับ Description เพื่อให้ trigger อ่านค่าได้ (ถ้ามี)
    if (updateData.Description !== undefined) {
      await db.execute('SET @status_change_description = ?', [updateData.Description]);
    }

    // สร้าง SQL query แบบ dynamic
    const updates = [];
    const values = [];
    const changedFields = {};

    if (updateData.Asset_State !== undefined) {
      updates.push('Asset_State = ?');
      values.push(updateData.Asset_State);
      changedFields.Asset_State = updateData.Asset_State;
    }
    if (updateData.serial !== undefined) {
      updates.push('serial = ?');
      values.push(updateData.serial);
      changedFields.serial = updateData.serial;
    }
    if (updateData.CI_Name !== undefined) {
      updates.push('CI_Name = ?');
      values.push(updateData.CI_Name);
      changedFields.CI_Name = updateData.CI_Name;
    }
    if (updateData.Asset_Number !== undefined) {
      updates.push('Asset_Number = ?');
      values.push(updateData.Asset_Number);
      changedFields.Asset_Number = updateData.Asset_Number;
    }
    if (updateData.PR_No !== undefined) {
      updates.push('PR_No = ?');
      values.push(updateData.PR_No);
      changedFields.PR_No = updateData.PR_No;
    }
    if (updateData.PO_No !== undefined) {
      updates.push('PO_No = ?');
      values.push(updateData.PO_No);
      changedFields.PO_No = updateData.PO_No;
    }
    if (updateData.Vendor !== undefined) {
      updates.push('Vendor = ?');
      values.push(updateData.Vendor);
      changedFields.Vendor = updateData.Vendor;
    }
    if (updateData.Project_purchase !== undefined) {
      updates.push('Project_purchase = ?');
      values.push(updateData.Project_purchase);
      changedFields.Project_purchase = updateData.Project_purchase;
    }
    if (slid !== null) {
      updates.push('SLid = ?');
      values.push(slid);
      changedFields.SLid = slid;
    }
    if (updateData.Loan_Start !== undefined) {
      updates.push('Loan_Start = ?');
      values.push(updateData.Loan_Start);
      changedFields.Loan_Start = updateData.Loan_Start;
    }
    if (updateData.Request_Date !== undefined) {
      updates.push('Request_Date = ?');
      values.push(updateData.Request_Date);
      changedFields.Request_Date = updateData.Request_Date;
    }
    const pendingReferSofSingle =
      updateData.Refer_SOF !== undefined ? updateData.Refer_SOF : undefined;
    if (pendingReferSofSingle !== undefined) {
      changedFields.Refer_SOF = pendingReferSofSingle;
    }
    if (updateData.Refer_Ticket !== undefined) {
      updates.push('Refer_Ticket = ?');
      values.push(updateData.Refer_Ticket);
      changedFields.Refer_Ticket = updateData.Refer_Ticket;
    }
    if (updateData.Assigned_Service !== undefined) {
      updates.push('Assigned_Service = ?');
      values.push(updateData.Assigned_Service);
      changedFields.Assigned_Service = updateData.Assigned_Service;
    }
    if (updateData.Reason !== undefined) {
      updates.push('Reason = ?');
      values.push(updateData.Reason);
      changedFields.Reason = updateData.Reason;
    }
    if (updateData.Dtypeid !== undefined) {
      updates.push('Dtypeid = ?');
      values.push(updateData.Dtypeid);
      changedFields.Dtypeid = updateData.Dtypeid;
    }
    if (updateData.DeRoleid !== undefined) {
      updates.push('DeRoleid = ?');
      values.push(updateData.DeRoleid);
      changedFields.DeRoleid = updateData.DeRoleid;
    }
    if (updateData.Project_code_purchase !== undefined) {
      updates.push('Project_code_purchase = ?');
      values.push(updateData.Project_code_purchase);
      changedFields.Project_code_purchase = updateData.Project_code_purchase;
    }
    if (updateData.Waranty_start !== undefined) {
      updates.push('Waranty_start = ?');
      values.push(updateData.Waranty_start);
      changedFields.Waranty_start = updateData.Waranty_start;
    }
    if (updateData.Waranty_end !== undefined) {
      updates.push('Waranty_end = ?');
      values.push(updateData.Waranty_end);
      changedFields.Waranty_end = updateData.Waranty_end;
    }
    if (updateData.Received_date !== undefined) {
      updates.push('Received_date = ?');
      values.push(updateData.Received_date);
      changedFields.Received_date = updateData.Received_date;
    }
    // Note: Description ไม่ใช่ column ใน devices table
    // ใช้สำหรับ trigger เท่านั้น (ผ่าน session variable @status_change_description)
    // ไม่ต้อง UPDATE Description ใน devices table

    values.push(id);

    if (updates.length > 0) {
      const sql = `UPDATE devices SET ${updates.join(', ')} WHERE Did = ?`;
      await connection.execute(sql, values);
    }

    if (pendingReferSofSingle !== undefined) {
      const slidForSof = slid ?? (await connection.execute('SELECT SLid FROM devices WHERE Did = ?', [id]))[0][0]?.SLid;
      if (slidForSof != null) {
        await applyReferSofToSiteLocation(connection, slidForSof, pendingReferSofSingle);
      }
    }

    await connection.commit();

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง (พร้อม JOIN)
    const [updated] = await db.execute(
      `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
       devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
       sites.Sid, location.Location2, 
       devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
       devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
       devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
       devices.Asset_Type, devices.Owner,
       device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
       FROM devices
       LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
       LEFT JOIN sites ON sites_location.Sid = sites.Sid
       LEFT JOIN location ON sites_location.lid = location.lid
       JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
       JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
       WHERE devices.Did = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'แก้ไขข้อมูล Device สำเร็จ',
      data: updated[0]
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไข Device',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// DELETE - ลบ Device
const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า Device มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Did, CI_Name FROM devices WHERE Did = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device ที่ต้องการลบ'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM devices WHERE Did = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบ Device สำเร็จ',
      data: {
        id: existing[0].Did,
        CI_Name: existing[0].CI_Name
      }
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Device',
      error: error.message
    });
  }
};

// DELETE - ลบ Devices หลายตัวจาก Excel (ตรวจสอบด้วย Serial)
// รับไฟล์ Excel จริง (.xlsx หรือ .xls) ผ่าน form-data field: "file"
const deleteDevicesByExcel = [
  upload.single('file'),
  async (req, res) => {
    try {
      // ตรวจสอบว่ามีไฟล์หรือไม่
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาอัปโหลดไฟล์ Excel'
        });
      }

      // อ่านไฟล์ Excel จาก buffer
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      
      // ใช้ sheet แรก
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // แปลง sheet เป็น JSON
      const excelData = xlsx.utils.sheet_to_json(worksheet);

      // ตรวจสอบว่ามีข้อมูลหรือไม่
      if (!excelData || excelData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลในไฟล์ Excel หรือไฟล์ว่างเปล่า'
        });
      }

      // ดึง Serial Numbers ทั้งหมด (รองรับทั้ง uppercase และ lowercase)
      const serialNumbers = excelData
        .map(d => d.serial || d.Serial || d.SERIAL || d['Serial Number'] || d['serial number'])
        .filter(s => s && String(s).trim() !== '')
        .map(s => String(s).trim());

      if (serialNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบ Serial Number ในไฟล์ Excel (กรุณาตรวจสอบว่ามี column "Serial" หรือ "serial")'
        });
      }

      // ค้นหา devices ที่ตรงกับ Serial Numbers และมี Asset_State = 'Sell' (batch query)
      const placeholders = serialNumbers.map(() => '?').join(',');
      const checkSql = `SELECT Did, serial, CI_Name, Asset_State FROM devices WHERE serial IN (${placeholders}) AND Asset_State = 'Sell'`;
      const [existingDevices] = await db.execute(checkSql, serialNumbers);

      // สร้าง map สำหรับค้นหาเร็ว
      const existingMap = new Map();
      existingDevices.forEach(device => {
        existingMap.set(device.serial, device);
      });

      // แยก Serial Numbers ที่พบและไม่พบ
      const foundSerials = [];
      const notFoundSerials = [];

      serialNumbers.forEach(serial => {
        if (existingMap.has(serial)) {
          foundSerials.push(serial);
        } else {
          notFoundSerials.push(serial);
        }
      });

      // ถ้าไม่พบ Serial ใดเลย
      if (foundSerials.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบ Device ใดๆ ที่ตรงกับ Serial Number ที่ระบุ',
          notFoundSerials: notFoundSerials
        });
      }

      // ลบ devices ที่พบ (เฉพาะ Asset_State = 'Sell' เท่านั้น)
      const deletePlaceholders = foundSerials.map(() => '?').join(',');
      const deleteSql = `DELETE FROM devices WHERE serial IN (${deletePlaceholders}) AND Asset_State = 'Sell'`;
      const [deleteResult] = await db.execute(deleteSql, foundSerials);

      // สร้างรายการ devices ที่ถูกลบ
      const deletedDevices = foundSerials.map(serial => {
        const device = existingMap.get(serial);
        return {
          Did: device.Did,
          serial: device.serial,
          CI_Name: device.CI_Name,
          Asset_State: device.Asset_State
        };
      });

      // Response
      res.status(200).json({
        success: true,
        message: `ลบ Device สำเร็จ ${deletedDevices.length} รายการ`,
        summary: {
          fileName: req.file.originalname,
          totalRowsInExcel: excelData.length,
          totalSerialNumbers: serialNumbers.length,
          deleted: deletedDevices.length,
          notFound: notFoundSerials.length
        },
        deletedDevices: deletedDevices,
        notFoundSerials: notFoundSerials.length > 0 ? notFoundSerials : null
      });
    } catch (error) {
      console.error('Error deleting devices by excel:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบ Device',
        error: error.message
      });
    }
  }
];

// GET - Dashboard Summary (Essential data only - Fast loading)
const getDashboardSummary = async (req, res) => {
  try {
    // ====== 1. Overview Statistics (Single Query) ======
    const overviewSql = `
      SELECT 
        COUNT(*) AS total_devices,
        SUM(CASE WHEN Asset_State = 'In Store' THEN 1 ELSE 0 END) AS in_store,
        SUM(CASE WHEN Asset_State = 'In Use' THEN 1 ELSE 0 END) AS in_use,
        SUM(CASE WHEN Asset_State = 'Out Store' THEN 1 ELSE 0 END) AS out_store,
        SUM(CASE WHEN Asset_State = 'In Store On Site' THEN 1 ELSE 0 END) AS in_store_on_site,
        SUM(CASE WHEN Asset_State = 'Waiting to sell' THEN 1 ELSE 0 END) AS waiting_to_sell
      FROM devices
    `;
    const [overviewResult] = await db.execute(overviewSql);
    const overview = overviewResult[0];

    // ====== 2. devices by Site (Top 10) ======
    const siteStatsSql = `
      SELECT 
        sites.Name AS site_name, 
        COUNT(devices.Did) AS total,
        SUM(CASE WHEN devices.Asset_State = 'In Store' THEN 1 ELSE 0 END) AS in_store,
        SUM(CASE WHEN devices.Asset_State = 'In Use' THEN 1 ELSE 0 END) AS in_use
      FROM devices
      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
      LEFT JOIN sites ON sites_location.Sid = sites.Sid
      WHERE sites.Name IS NOT NULL
      GROUP BY sites.Sid, sites.Name
      ORDER BY total DESC
      LIMIT 10
    `;
    const [siteStats] = await db.execute(siteStatsSql);

    // ====== 3. devices by manufacturer (Top 5) ======
    const manufacturerStatsSql = `
      SELECT 
        m.name AS manufacturer, 
        COUNT(*) AS total
      FROM devices d
      JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
      JOIN manufacturer m ON dt.Mid = m.Mid
      GROUP BY m.Mid, m.name
      ORDER BY total DESC
      LIMIT 5
    `;
    const [manufacturerStats] = await db.execute(manufacturerStatsSql);

    // ====== 4. devices by Model (Top 10) ======
    const modelStatsSql = `
      SELECT 
        dt.model, 
        m.name AS manufacturer, 
        COUNT(*) AS total,
        SUM(CASE WHEN d.Asset_State = 'In Store' THEN 1 ELSE 0 END) AS in_store,
        SUM(CASE WHEN d.Asset_State = 'In Use' THEN 1 ELSE 0 END) AS in_use
      FROM devices d
      JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
      JOIN manufacturer m ON dt.Mid = m.Mid
      GROUP BY dt.Dtypeid, dt.model, m.name
      ORDER BY total DESC
      LIMIT 10
    `;
    const [modelStats] = await db.execute(modelStatsSql);

    // ====== 5. Asset State Stats ======
    const assetStateSql = `
      SELECT Asset_State, COUNT(*) AS total
      FROM devices
      WHERE Asset_State IS NOT NULL AND Asset_State != ''
      GROUP BY Asset_State
      ORDER BY total DESC
    `;
    const [assetStateStats] = await db.execute(assetStateSql);

    // ====== 6. Recent Activity (Last 7 days) ======
    const recentActivitySql = `
      SELECT 
        action_type,
        COUNT(*) AS total
      FROM devices_history
      WHERE changed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY action_type
    `;
    const [recentActivity] = await db.execute(recentActivitySql);

    // ====== Response ======
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalDevices: overview.total_devices || 0,
          inStore: overview.in_store || 0,
          inUse: overview.in_use || 0,
          outStore: overview.out_store || 0,
          inStoreOnSite: overview.in_store_on_site || 0,
          waitingToSell: overview.waiting_to_sell || 0
        },
        assetStateStats: assetStateStats,
        siteStats: siteStats,
        manufacturerStats: manufacturerStats,
        modelStats: modelStats,
        recentActivity: recentActivity
      }
    });
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard Summary',
      error: error.message
    });
  }
};

// GET - Dashboard Statistics (Enhanced with useful insights)
const getDashboard = async (req, res) => {
  try {
    // ====== Overview Statistics ======
    // 1. จำนวน devices ทั้งหมด
    const totalDevicesSql = `SELECT COUNT(*) AS total_devices FROM devices`;
    const [totalDevicesResult] = await db.execute(totalDevicesSql);
    const totalDevices = totalDevicesResult[0].total_devices;

    // 2. จำนวน devices ต่อ Asset_State
    const assetStateSql = `SELECT Asset_State, COUNT(*) AS total
                           FROM devices
                           GROUP BY Asset_State
                           ORDER BY total DESC`;
    const [assetStateStats] = await db.execute(assetStateSql);

    // 3. จำนวน devices ที่ available (Request_Date IS NULL)
    const availableSql = `SELECT COUNT(*) AS available_devices
                         FROM devices
                         WHERE Request_Date IS NULL OR Request_Date = ''`;
    const [availableResult] = await db.execute(availableSql);
    const availableDevices = availableResult[0].available_devices;

    // 4. จำนวน devices ที่ requested (Request_Date IS NOT NULL)
    const requestedSql = `SELECT COUNT(*) AS requested_devices
                         FROM devices
                         WHERE Request_Date IS NOT NULL AND Request_Date != ''`;
    const [requestedResult] = await db.execute(requestedSql);
    const requestedDevices = requestedResult[0].requested_devices;

    // ====== location & Site Statistics ======
    // 5. จำนวน devices ต่อ Site (ใช้ LEFT JOIN กับ sites_location)
    const siteStatsSql = `SELECT sites.Name AS site_name, COUNT(devices.Did) AS total
                          FROM devices
                          LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                          LEFT JOIN sites ON sites_location.Sid = sites.Sid
                          GROUP BY sites.Sid, sites.Name
                          HAVING total > 0
                          ORDER BY total DESC`;
    const [siteStats] = await db.execute(siteStatsSql);

    // 6. จำนวน devices ต่อ location
    const locationStatsSql = `SELECT location.Location2 AS location_name, COUNT(devices.Did) AS total
                              FROM devices
                              LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                              LEFT JOIN location ON sites_location.lid = location.lid
                              WHERE location.Location2 IS NOT NULL
                              GROUP BY location.lid, location.Location2
                              ORDER BY total DESC
                              LIMIT 20`;
    const [locationStats] = await db.execute(locationStatsSql);

    // 7. จำนวน devices ที่ไม่มี Site หรือ location
    const noLocationSql = `SELECT COUNT(*) AS no_location_devices
                          FROM devices
                          WHERE SLid IS NULL`;
    const [noLocationResult] = await db.execute(noLocationSql);
    const noLocationDevices = noLocationResult[0].no_location_devices;

    // ====== Device Type & manufacturer Statistics ======
    // 8. จำนวน devices ต่อ manufacturer (Top 10)
    const manufacturerStatsSql = `SELECT m.name AS manufacturer, COUNT(*) AS total
                                 FROM devices d
                                 JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                                 JOIN manufacturer m ON dt.Mid = m.Mid
                                 GROUP BY m.name
                                 ORDER BY total DESC
                                 LIMIT 10`;
    const [manufacturerStats] = await db.execute(manufacturerStatsSql);

    // 9. จำนวน devices ต่อ Model (Top 15)
    const modelStatsSql = `SELECT dt.model, m.name AS manufacturer, COUNT(*) AS total
                          FROM devices d
                          JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                          JOIN manufacturer m ON dt.Mid = m.Mid
                          GROUP BY dt.model, m.name
                          ORDER BY total DESC
                          LIMIT 15`;
    const [modelStats] = await db.execute(modelStatsSql);

    // 10. จำนวน devices ต่อ Device Role
    const deviceRoleStatsSql = `SELECT dr.name AS role_name, dr.color, COUNT(*) AS total
                               FROM devices d
                               LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid
                               WHERE d.DeRoleid IS NOT NULL
                               GROUP BY dr.DeRoleid, dr.name, dr.color
                               ORDER BY total DESC`;
    const [deviceRoleStats] = await db.execute(deviceRoleStatsSql);

    // ====== Vendor & Project Statistics ======
    // 11. จำนวน devices ต่อ Vendor (Top 10)
    const vendorStatsSql = `SELECT Vendor, COUNT(*) AS total
                           FROM devices
                           WHERE Vendor IS NOT NULL AND Vendor != ''
                           GROUP BY Vendor
                           ORDER BY total DESC
                           LIMIT 10`;
    const [vendorStats] = await db.execute(vendorStatsSql);

    // 12. จำนวน devices ต่อ Asset Type
    const assetTypeStatsSql = `SELECT Asset_Type, COUNT(*) AS total
                               FROM devices
                               WHERE Asset_Type IS NOT NULL AND Asset_Type != ''
                               GROUP BY Asset_Type
                               ORDER BY total DESC`;
    const [assetTypeStats] = await db.execute(assetTypeStatsSql);

    // 13. จำนวน devices ต่อ Owner
    const ownerStatsSql = `SELECT Owner, COUNT(*) AS total
                          FROM devices
                          WHERE Owner IS NOT NULL AND Owner != ''
                          GROUP BY Owner
                          ORDER BY total DESC
                          LIMIT 15`;
    const [ownerStats] = await db.execute(ownerStatsSql);

    // 14. จำนวน devices ต่อ Assigned Service
    const assignedServiceStatsSql = `SELECT Assigned_Service, COUNT(*) AS total
                                    FROM devices
                                    WHERE Assigned_Service IS NOT NULL AND Assigned_Service != ''
                                    GROUP BY Assigned_Service
                                    ORDER BY total DESC
                                    LIMIT 15`;
    const [assignedServiceStats] = await db.execute(assignedServiceStatsSql);

    // ====== Warranty Statistics ======
    // 15. จำนวน devices ที่ Warranty หมดอายุแล้ว
    const expiredWarrantySql = `SELECT COUNT(*) AS expired_warranty
                               FROM devices
                               WHERE Waranty_end IS NOT NULL 
                               AND Waranty_end < CURDATE()`;
    const [expiredWarrantyResult] = await db.execute(expiredWarrantySql);
    const expiredWarranty = expiredWarrantyResult[0].expired_warranty;

    // 16. จำนวน devices ที่ Warranty ใกล้หมดอายุ (ภายใน 30 วัน)
    const expiringSoonSql = `SELECT COUNT(*) AS expiring_soon
                            FROM devices
                            WHERE Waranty_end IS NOT NULL 
                            AND Waranty_end >= CURDATE()
                            AND Waranty_end <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`;
    const [expiringSoonResult] = await db.execute(expiringSoonSql);
    const expiringSoon = expiringSoonResult[0].expiring_soon;

    // 17. จำนวน devices ที่ Warranty หมดอายุภายใน 90 วัน
    const expiring90DaysSql = `SELECT COUNT(*) AS expiring_90_days
                              FROM devices
                              WHERE Waranty_end IS NOT NULL 
                              AND Waranty_end >= CURDATE()
                              AND Waranty_end <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`;
    const [expiring90DaysResult] = await db.execute(expiring90DaysSql);
    const expiring90Days = expiring90DaysResult[0].expiring_90_days;

    // ====== Recent Activity Statistics ======
    // 18. จำนวนการเปลี่ยนแปลงล่าสุด (7 วันล่าสุด)
    const recentActivitySql = `SELECT 
                               DATE(changed_at) AS date,
                               action_type,
                               COUNT(*) AS total
                               FROM devices_history
                               WHERE changed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                               GROUP BY DATE(changed_at), action_type
                               ORDER BY date DESC, action_type`;
    const [recentActivity] = await db.execute(recentActivitySql);

    // 19. จำนวนการเปลี่ยนแปลงทั้งหมด (30 วันล่าสุด)
    const totalActivitySql = `SELECT COUNT(*) AS total_activity
                             FROM devices_history
                             WHERE changed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
    const [totalActivityResult] = await db.execute(totalActivitySql);
    const totalActivity = totalActivityResult[0].total_activity;

    // ====== Summary Calculations ======
    const assetStateMap = new Map();
    assetStateStats.forEach(stat => {
      assetStateMap.set(stat.Asset_State, stat.total);
    });

    res.status(200).json({
      success: true,
      data: {
        // Overview
        overview: {
          totalDevices: totalDevices,
          availableDevices: availableDevices,
          requestedDevices: requestedDevices,
          noLocationDevices: noLocationDevices
        },
        // Asset State Breakdown
        assetStateStats: assetStateStats,
        assetStateSummary: {
          inStore: assetStateMap.get('In Store') || 0,
          inUse: assetStateMap.get('In Use') || 0,
          outStore: assetStateMap.get('Out Store') || 0,
          inStoreOnSite: assetStateMap.get('In Store On Site') || 0,
          other: totalDevices - (assetStateMap.get('In Store') || 0) - (assetStateMap.get('In Use') || 0) - (assetStateMap.get('Out Store') || 0) - (assetStateMap.get('In Store On Site') || 0)
        },
        // location & Site
        siteStats: siteStats,
        locationStats: locationStats,
        // Device Type & manufacturer
        manufacturerStats: manufacturerStats,
        modelStats: modelStats,
        deviceRoleStats: deviceRoleStats,
        // Vendor & Project
        vendorStats: vendorStats,
        assetTypeStats: assetTypeStats,
        ownerStats: ownerStats,
        assignedServiceStats: assignedServiceStats,
        // Warranty
        warranty: {
          expired: expiredWarranty,
          expiringSoon: expiringSoon, // 30 days
          expiring90Days: expiring90Days,
          totalWithWarranty: totalDevices - (expiredWarranty + expiringSoon + expiring90Days)
        },
        // Recent Activity
        recentActivity: recentActivity,
        totalActivity30Days: totalActivity
      }
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล devices แยกตาม Model (พร้อม Asset_State breakdown และ manufacturer)
const getDevicesByModel = async (req, res) => {
  try {
    // ดึงข้อมูล model, manufacturer, และจำนวนทั้งหมด
    const modelSql = `SELECT 
                      dt.model,
                      m.name AS Manufacturername,
                      COUNT(*) AS total
                      FROM devices d
                      JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                      JOIN manufacturer m ON dt.Mid = m.Mid
                      GROUP BY dt.model, m.name
                      ORDER BY dt.model`;

    const [modelRows] = await db.execute(modelSql);

    // ดึงข้อมูล Asset_State breakdown สำหรับแต่ละ model
    const assetStateSql = `SELECT 
                          dt.model,
                          d.Asset_State,
                          COUNT(*) AS count
                          FROM devices d
                          JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                          GROUP BY dt.model, d.Asset_State
                          ORDER BY dt.model, d.Asset_State`;

    const [assetStateRows] = await db.execute(assetStateSql);

    // รวมข้อมูล Asset_State เข้ากับแต่ละ model
    const result = modelRows.map(model => {
      const assetStates = assetStateRows
        .filter(row => row.model === model.model)
        .map(row => ({
          Asset_State: row.Asset_State,
          count: row.count
        }));

      return {
        model: model.model,
        Manufacturername: model.Manufacturername,
        total: model.total,
        assetStates: assetStates
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('Error getting devices by model:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล devices แยกตาม Model',
      error: error.message
    });
  }
};

// GET - ดูประวัติการเปลี่ยนแปลงของ devices ทั้งหมด (พร้อมข้อมูล Device)
const viewDeviceHistory = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1; // หน้าปัจจุบัน (default: 1)
    const limit = parseInt(req.query.limit) || 50; // จำนวน records ต่อหน้า (default: 50)
    const action = req.query.action; // Filter by action (INSERT, UPDATE, ASSET_STATE_CHANGE)
    const deviceId = req.query.deviceId; // Filter by Device ID
    const search = req.query.search || ''; // คำค้นหา (optional)
    const offset = (page - 1) * limit; // คำนวณ offset

    // สร้าง WHERE conditions
    let whereConditions = [];
    let params = [];

    // Filter by action
    if (action && ['INSERT', 'UPDATE', 'ASSET_STATE_CHANGE'].includes(action.toUpperCase())) {
      whereConditions.push('dh.action_type = ?');
      params.push(action.toUpperCase());
    }

    // Filter by device ID
    if (deviceId) {
      whereConditions.push('dh.Did = ?');
      params.push(deviceId);
    }

    // Search condition (ใช้ dh.* จาก history เพื่อให้ค้นหา device ที่ถูกลบได้ด้วย)
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions.push(`(
        dh.CI_Name LIKE ? OR 
        dh.Asset_Number LIKE ? OR 
        dh.serial LIKE ? OR 
        dt.model LIKE ? OR 
        m.name LIKE ? OR
        s.Name LIKE ? OR
        dh.Description LIKE ?
      )`);
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices_history dh
                      LEFT JOIN devices d ON dh.Did = d.Did
                      LEFT JOIN device_type dt ON dh.Dtypeid = dt.Dtypeid
                      LEFT JOIN manufacturer m ON dt.Mid = m.Mid
                      LEFT JOIN sites s ON dh.Sid = s.Sid
                      ${whereClause}`;
    const [countResult] = await db.execute(countSql, params);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลประวัติพร้อมข้อมูล Device - แสดงคอลัมน์ทั้งหมดจาก devices_history
    const sql = `SELECT 
                  dh.log_id,
                  dh.action_type,
                  dh.changed_at,
                  dh.Did,
                  dh.Asset_State,
                  dh.serial,
                  dh.CI_Name,
                  dh.Asset_Number,
                  dh.PR_No,
                  dh.Vendor,
                  dh.Project_purchase,
                  dh.Sid,
                  dh.Location2,
                  dh.PO_No,
                  dh.Loan_Start,
                  dh.Request_Date,
                  dh.Refer_SOF,
                  dh.Refer_Ticket,
                  dh.Assigned_Service,
                  dh.Reason,
                  dh.Dtypeid,
                  dh.DeRoleid,
                  dh.Project_code_purchase,
                  dh.Waranty_start,
                  dh.Waranty_end,
                  dh.Received_date,
                  dh.Asset_Type,
                  dh.Owner,
                  dh.Description,
                  d.Asset_State AS current_Asset_State,
                  d.serial AS current_serial,
                  d.CI_Name AS current_CI_Name,
                  d.Asset_Number AS current_Asset_Number,
                  dt.model,
                  m.name AS Manufacturername,
                  s.Name AS Sitename
                  FROM devices_history dh
                  LEFT JOIN devices d ON dh.Did = d.Did
                  LEFT JOIN device_type dt ON dh.Dtypeid = dt.Dtypeid
                  LEFT JOIN manufacturer m ON dt.Mid = m.Mid
                  LEFT JOIN sites s ON dh.Sid = s.Sid
                  ${whereClause}
                  ORDER BY dh.changed_at DESC
                  LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...params, limit, offset]);

    // Map ข้อมูลตาม schema ของ devices_history
    const history = rows.map(row => ({
      log_id: row.log_id,
      action_type: row.action_type,
      changed_at: row.changed_at,
      Did: row.Did,
        Asset_State: row.Asset_State,
        serial: row.serial,
        CI_Name: row.CI_Name,
        Asset_Number: row.Asset_Number,
        PR_No: row.PR_No,
        Vendor: row.Vendor,
        Project_purchase: row.Project_purchase,
      Sid: row.Sid,
        Location2: row.Location2,
      PO_No: row.PO_No,
      Loan_Start: row.Loan_Start,
      Request_Date: row.Request_Date,
      Refer_SOF: row.Refer_SOF,
      Refer_Ticket: row.Refer_Ticket,
      Assigned_Service: row.Assigned_Service,
      Reason: row.Reason,
      Dtypeid: row.Dtypeid,
      DeRoleid: row.DeRoleid,
      Project_code_purchase: row.Project_code_purchase,
      Waranty_start: row.Waranty_start,
      Waranty_end: row.Waranty_end,
      Received_date: row.Received_date,
      Asset_Type: row.Asset_Type,
      Owner: row.Owner,
      Description: row.Description,
      CurrentDevice: {
        Asset_State: row.current_Asset_State,
        serial: row.current_serial,
        CI_Name: row.current_CI_Name,
        Asset_Number: row.current_Asset_Number,
        model: row.model,
        Manufacturername: row.Manufacturername,
        Sitename: row.Sitename
      }
    }));

    res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      filters: {
        action: action || null,
        deviceId: deviceId || null,
        search: search || null
      },
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error viewing device history:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดูประวัติ Device',
      error: error.message
    });
  }
};

// GET - ดึงประวัติการเปลี่ยนแปลงของ Device
// แสดงเฉพาะฟิลด์ที่เปลี่ยนไปในแต่ละ record โดยเทียบกับ record ก่อนหน้า
const getDeviceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.query; // Filter by action (INSERT, UPDATE, ASSET_STATE_CHANGE)

    // ตรวจสอบว่า Device มีอยู่จริงหรือไม่ พร้อมดึงข้อมูลปัจจุบัน
    const checkSql = `SELECT d.Did, d.Asset_State, d.serial, d.CI_Name, d.Asset_Number,
                      d.PR_No, d.Vendor, d.Project_purchase, d.SLid,
                      sl.Sid, l.Location2,
                      d.PO_No, d.Loan_Start, d.Request_Date, sl.SOF AS Refer_SOF,
                      d.Refer_Ticket, d.Assigned_Service, d.Reason, d.Dtypeid, d.DeRoleid,
                      d.Project_code_purchase, d.Waranty_start, d.Waranty_end, d.Received_date,
                      d.Asset_Type, d.Owner
                      FROM devices d
                      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
                      LEFT JOIN location l ON sl.lid = l.lid
                      WHERE d.Did = ?`;
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device'
      });
    }

    const currentDevice = existing[0];

    // สร้าง WHERE condition สำหรับ filter action
    let actionCondition = '';
    let params = [id];
    
    if (action && ['INSERT', 'UPDATE', 'ASSET_STATE_CHANGE', 'DELETE'].includes(action.toUpperCase())) {
      actionCondition = 'AND action_type = ?';
      params.push(action.toUpperCase());
    }

    // ดึงประวัติ - เรียงจากเก่าไปใหม่เพื่อเปรียบเทียบทีละคู่
    const sql = `SELECT 
                  log_id, action_type, changed_at, Did,
                  Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor,
                  Project_purchase, Sid, Location2, PO_No, Loan_Start,
                  Request_Date, Refer_SOF, Refer_Ticket, Assigned_Service, Reason,
                  Dtypeid, DeRoleid, Project_code_purchase, Waranty_start, Waranty_end,
                  Received_date, Asset_Type, Owner, Description
                  FROM devices_history
                  WHERE Did = ? ${actionCondition}
                  ORDER BY changed_at ASC, log_id ASC`;
    
    const [rows] = await db.execute(sql, params);

    // ฟิลด์ที่จะเปรียบเทียบ
    const compareFields = [
      'Asset_State', 'serial', 'CI_Name', 'Asset_Number', 'PR_No', 'Vendor',
      'Project_purchase', 'Sid', 'Location2', 'PO_No', 'Loan_Start',
      'Request_Date', 'Refer_SOF', 'Refer_Ticket', 'Assigned_Service', 'Reason',
      'Dtypeid', 'DeRoleid', 'Project_code_purchase', 'Waranty_start', 'Waranty_end',
      'Received_date', 'Asset_Type', 'Owner'
    ];

    // Helper: normalize value สำหรับเปรียบเทียบ (แปลง Date → string, null → null)
    const normalize = (val) => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val);
    };

    // สร้าง history พร้อม changes โดยเทียบกับ record ก่อนหน้า
    const history = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const entry = {
        log_id: row.log_id,
        action_type: row.action_type,
        changed_at: row.changed_at,
        Did: row.Did,
        Description: row.Description
      };

      if (row.action_type === 'INSERT') {
        // INSERT → แสดงค่าทั้งหมดที่ถูกเซ็ต (ไม่ต้องเทียบ)
        entry.changes = {};
        for (const field of compareFields) {
          if (row[field] !== null && row[field] !== undefined) {
            entry.changes[field] = { old: null, new: row[field] };
          }
        }
      } else if (row.action_type === 'UPDATE' || row.action_type === 'ASSET_STATE_CHANGE') {
        // UPDATE → เทียบกับ record ก่อนหน้า (rows[i-1])
        const prev = i > 0 ? rows[i - 1] : null;
        entry.changes = {};
        if (prev) {
          for (const field of compareFields) {
            const oldVal = normalize(prev[field]);
            const newVal = normalize(row[field]);
            if (oldVal !== newVal) {
              entry.changes[field] = { old: prev[field], new: row[field] };
            }
          }
        } else {
          // ไม่มี record ก่อนหน้า → แสดงค่าทั้งหมดเป็น changes
          for (const field of compareFields) {
            if (row[field] !== null && row[field] !== undefined) {
              entry.changes[field] = { old: null, new: row[field] };
            }
          }
        }
      } else if (row.action_type === 'DELETE') {
        // DELETE → แสดงค่าสุดท้ายที่ถูกลบ
        entry.changes = {};
        for (const field of compareFields) {
          if (row[field] !== null && row[field] !== undefined) {
            entry.changes[field] = { old: row[field], new: null };
          }
        }
      }

      // สรุปจำนวนฟิลด์ที่เปลี่ยน
      entry.changed_fields = Object.keys(entry.changes);
      entry.changed_count = entry.changed_fields.length;

      history.push(entry);
    }

    // กลับเรียงจากใหม่ไปเก่า (DESC) สำหรับ response
    history.reverse();

    // เปรียบเทียบ record ล่าสุดกับค่าปัจจุบัน (current device)
    const latestHistory = rows.length > 0 ? rows[rows.length - 1] : null;
    let diffFromCurrent = {};
    if (latestHistory) {
      for (const field of compareFields) {
        const histVal = normalize(latestHistory[field]);
        const curVal = normalize(currentDevice[field]);
        if (histVal !== curVal) {
          diffFromCurrent[field] = { history: latestHistory[field], current: currentDevice[field] };
        }
      }
    }

    res.status(200).json({
      success: true,
      count: history.length,
      currentDevice: {
        Did: currentDevice.Did,
        Asset_State: currentDevice.Asset_State,
        serial: currentDevice.serial,
        CI_Name: currentDevice.CI_Name,
        Asset_Number: currentDevice.Asset_Number,
        Sid: currentDevice.Sid,
        Location2: currentDevice.Location2
      },
      diffFromCurrent: Object.keys(diffFromCurrent).length > 0 ? diffFromCurrent : null,
      data: history
    });
  } catch (error) {
    console.error('Error getting device history:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงประวัติ Device',
      error: error.message
    });
  }
};

// Helper function - Generate random hex color
const generateRandomColor = () => {
  return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
};

// Helper function - Create slug from text
const createSlug = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

// POST - Import Excel (JSON format) - Full implementation with all relationships
const importExcel = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // ตรวจสอบว่าเป็น array หรือ object เดียว
    const isArray = Array.isArray(req.body);
    const excelData = isArray ? req.body : [req.body];

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (excelData.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งข้อมูล Excel'
      });
    }

    const results = [];
    const errors = [];
    
    // Caches
    const siteCache = new Map(); // Site Name -> Sid
    const locationCache = new Map(); // Location2 -> lid
    const sitesLocationCache = new Map(); // "Sid_lid" -> SLid
    const manufacturerCache = new Map(); // Brand Name -> Mid
    const deviceTypeCache = new Map(); // "Model_Brand" -> Dtypeid
    const deviceRoleCache = new Map(); // Role Name -> DeRoleid

    // Batch size สำหรับ bulk operations
    const BATCH_SIZE = 1000;

    // Pre-load all unique values from data
    const uniqueSites = new Set();
    const uniqueLocations = new Set();
    const uniqueBrands = new Set();
    const uniqueModels = new Map(); // model -> brand
    const uniqueRoles = new Set();

    excelData.forEach(row => {
      const siteName = row.Site || row.site;
      const location2 = row.Location2 || row.location2;
      const brandName = row.Brand || row.brand;
      const model = row.Model || row.model;
      const role = row.role || row.Role;
      
      if (siteName) uniqueSites.add(siteName);
      if (location2) uniqueLocations.add(location2);
      if (brandName) uniqueBrands.add(brandName);
      if (model && brandName) uniqueModels.set(model, brandName);
      if (role) uniqueRoles.add(role);
    });

    // ====== 1. Batch load sites ======
    if (uniqueSites.size > 0) {
      const siteNames = Array.from(uniqueSites);
      const placeholders = siteNames.map(() => '?').join(',');
      const [existingSites] = await connection.execute(
        `SELECT Sid, Name FROM sites WHERE Name IN (${placeholders})`,
        siteNames
      );
      existingSites.forEach(site => {
        siteCache.set(site.Name, site.Sid);
      });
    }

    // ====== 2. Batch load Locations ======
    if (uniqueLocations.size > 0) {
      const location2Values = Array.from(uniqueLocations);
      const placeholders = location2Values.map(() => '?').join(',');
      const [existingLocations] = await connection.execute(
        `SELECT lid, Location2 FROM location WHERE Location2 IN (${placeholders})`,
        location2Values
      );
      existingLocations.forEach(loc => {
        locationCache.set(loc.Location2, loc.lid);
      });
    }

    // ====== 3. Batch load Manufacturers ======
    if (uniqueBrands.size > 0) {
      const brandNames = Array.from(uniqueBrands);
      const placeholders = brandNames.map(() => '?').join(',');
      const [existingManufacturers] = await connection.execute(
        `SELECT Mid, name FROM manufacturer WHERE name IN (${placeholders})`,
        brandNames
      );
      existingManufacturers.forEach(m => {
        manufacturerCache.set(m.name, m.Mid);
      });
    }

    // ====== 4. Batch load Device_Types ======
    if (uniqueModels.size > 0) {
      const modelBrandPairs = Array.from(uniqueModels.entries());
      const mids = modelBrandPairs.map(([model, brand]) => manufacturerCache.get(brand)).filter(Boolean);
      
      if (mids.length > 0) {
        const models = modelBrandPairs.map(([model]) => model);
        const placeholders = models.map(() => '?').join(',');
        const midPlaceholders = [...new Set(mids)].map(() => '?').join(',');
        
        const [existingTypes] = await connection.execute(
          `SELECT Dtypeid, model, Mid FROM device_type WHERE model IN (${placeholders}) AND Mid IN (${midPlaceholders})`,
          [...models, ...Array.from(new Set(mids))]
        );
        
        existingTypes.forEach(dt => {
          const brand = modelBrandPairs.find(([m]) => m === dt.model)?.[1];
          if (brand) {
            const cacheKey = `${dt.model}_${brand}`;
            deviceTypeCache.set(cacheKey, dt.Dtypeid);
          }
        });
      }
    }

    // ====== 5. Batch load Device_Roles ======
    if (uniqueRoles.size > 0) {
      const roleNames = Array.from(uniqueRoles);
      const placeholders = roleNames.map(() => '?').join(',');
      const [existingRoles] = await connection.execute(
        `SELECT DeRoleid, name FROM device_role WHERE name IN (${placeholders})`,
        roleNames
      );
      existingRoles.forEach(role => {
        deviceRoleCache.set(role.name, role.DeRoleid);
      });
    }

    // ====== Helper Functions ======

    // Get or Create Site
    const getOrCreateSite = async (siteName) => {
      if (!siteName) return null;

      if (siteCache.has(siteName)) {
        return siteCache.get(siteName);
      }

      const slug = createSlug(siteName);
      const [siteResult] = await connection.execute(
        'INSERT INTO sites (Name, Slug, Status) VALUES (?, ?, ?)',
        [siteName, slug, 'Active']
      );
      
      const sid = siteResult.insertId;
      siteCache.set(siteName, sid);
      return sid;
    };

    // Get or Create location
    const getOrCreateLocation = async (location2) => {
      if (!location2) return null;

      if (locationCache.has(location2)) {
        return locationCache.get(location2);
      }

      const [locationResult] = await connection.execute(
        'INSERT INTO location (Location2) VALUES (?)',
        [location2]
      );
      
      const lid = locationResult.insertId;
      locationCache.set(location2, lid);
      return lid;
    };

    // Get or Create sites_location
    const getOrCreateSitesLocation = async (sid, lid) => {
      if (!sid || !lid) return null;

      const cacheKey = `${sid}_${lid}`;
      if (sitesLocationCache.has(cacheKey)) {
        return sitesLocationCache.get(cacheKey);
      }

      // ตรวจสอบว่ามีอยู่แล้วหรือไม่
      const [existing] = await connection.execute(
        'SELECT SLid FROM sites_location WHERE Sid = ? AND lid = ?',
        [sid, lid]
      );

      if (existing.length > 0) {
        const slid = existing[0].SLid;
        sitesLocationCache.set(cacheKey, slid);
        return slid;
      }

      // สร้างใหม่
      const [slResult] = await connection.execute(
        'INSERT INTO sites_location (Sid, lid) VALUES (?, ?)',
        [sid, lid]
      );
      
      const slid = slResult.insertId;
      sitesLocationCache.set(cacheKey, slid);
      return slid;
    };

    // Get or Create manufacturer
    const getOrCreateManufacturer = async (brandName) => {
      if (!brandName) return null;

      if (manufacturerCache.has(brandName)) {
        return manufacturerCache.get(brandName);
      }

      const slug = createSlug(brandName);
      const [manufacturerResult] = await connection.execute(
        'INSERT INTO manufacturer (name, slug) VALUES (?, ?)',
        [brandName, slug]
      );
      
      const mid = manufacturerResult.insertId;
      manufacturerCache.set(brandName, mid);
      return mid;
    };

    // Get or Create Device Type
    const getOrCreateDeviceType = async (model, brandName) => {
      if (!model || !brandName) return null;

      const cacheKey = `${model}_${brandName}`;
      
      if (deviceTypeCache.has(cacheKey)) {
        return deviceTypeCache.get(cacheKey);
      }

      const mid = await getOrCreateManufacturer(brandName);
      if (!mid) return null;

      const slug = createSlug(model);
      const [deviceTypeResult] = await connection.execute(
        'INSERT INTO device_type (model, slug, u_height, Mid) VALUES (?, ?, ?, ?)',
        [model, slug, 1, mid]
      );
      
      const dtypeid = deviceTypeResult.insertId;
      deviceTypeCache.set(cacheKey, dtypeid);
      return dtypeid;
    };

    // Get or Create Device Role
    const getOrCreateDeviceRole = async (roleName) => {
      if (!roleName) return null;

      if (deviceRoleCache.has(roleName)) {
        return deviceRoleCache.get(roleName);
      }

      const slug = createSlug(roleName);
      const color = generateRandomColor();
      const [roleResult] = await connection.execute(
        'INSERT INTO device_role (name, slug, color) VALUES (?, ?, ?)',
        [roleName, slug, color]
      );
      
      const deRoleid = roleResult.insertId;
      deviceRoleCache.set(roleName, deRoleid);
      return deRoleid;
    };

    // ====== Prepare Device Data ======
    const preparedDevices = [];
    const assetNumbers = [];

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      try {
        const model = row.Model || row.model || null;
        const brandName = row.Brand || row.brand || null;
        const siteName = row.Site || row.site;
        const location2 = row.Location2 || row.location2;
        const roleName = row.role || row.Role;

        // Validation
        if (!model) {
          errors.push({
            index: i + 1,
            error: 'กรุณากรอกข้อมูล Model (จำเป็น)',
            row: row
          });
          continue;
        }

        if (!brandName) {
          errors.push({
            index: i + 1,
            error: 'กรุณากรอกข้อมูล Brand (จำเป็น)',
            row: row
          });
          continue;
        }

        // Get or Create IDs ตามลำดับ
        const sid = await getOrCreateSite(siteName);
        const lid = await getOrCreateLocation(location2);
        const slid = await getOrCreateSitesLocation(sid, lid);
        const dtypeid = await getOrCreateDeviceType(model, brandName);
        const deRoleid = roleName ? await getOrCreateDeviceRole(roleName) : null;

        if (!dtypeid) {
          errors.push({
            index: i + 1,
            error: `ไม่สามารถสร้าง Device Type สำหรับ Model: ${model}, Brand: ${brandName}`,
            row: row
          });
          continue;
        }

        const assetNumber = row.Asset_Number || row.asset_number || null;
        if (assetNumber) assetNumbers.push(assetNumber);

        // แปลง Received_date เป็น timestamp format
        let receivedDate = null;
        if (row.Received_date || row.received_date) {
          const dateValue = row.Received_date || row.received_date;
          if (typeof dateValue === 'string') {
            const parsedDate = new Date(dateValue);
            if (!isNaN(parsedDate.getTime())) {
              receivedDate = parsedDate.toISOString().slice(0, 19).replace('T', ' ');
            }
          } else if (dateValue instanceof Date) {
            receivedDate = dateValue.toISOString().slice(0, 19).replace('T', ' ');
          }
        } else {
          receivedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        // ดึง Description จาก JSON
        const description = row.Description || row.description || 'Import from Excel';

        preparedDevices.push({
          index: i + 1,
          row: row,
          description: description,
          deviceData: {
            Asset_State: row.Asset_State || row.asset_state || null,
            serial: row.serial || null,
            CI_Name: row.CI_Name || row.ci_name || null,
            Asset_Number: assetNumber,
            PR_No: row.PR_No || row.pr_no || null,
            PO_No: row.PO_No || row.po_no || null,
            Vendor: row.Vendor || row.vendor || null,
            Project_code_purchase: row.Project_code_purchase || row.project_code_purchase || '',
            Project_purchase: row.Project_purchase || row.project_purchase || null,
            SLid: slid,
            Loan_Start: row.Loan_Start || row.loan_start || null,
            Request_Date: row.Request_Date || row.request_date || null,
            Refer_SOF: row.Refer_SOF || row.refer_sof || null,
            Refer_Ticket: row.Refer_Ticket || row.refer_ticket || null,
            Assigned_Service: row.Assigned_Service || row.assigned_service || null,
            Reason: row.Reason || row.reason || null,
            Dtypeid: dtypeid,
            DeRoleid: deRoleid,
            Waranty_start: row.Waranty_start || row.waranty_start || new Date().toISOString().split('T')[0],
            Waranty_end: row.Waranty_end || row.waranty_end || new Date().toISOString().split('T')[0],
            Received_date: receivedDate,
            Asset_Type: row.Asset_Type || row.asset_type || null,
            Owner: row.Owner || row.owner || null
          }
        });
      } catch (error) {
        errors.push({
          index: i + 1,
          error: error.message,
          row: row
        });
      }
    }

    // ====== Batch check existing Asset_Numbers ======
    const existingAssetsMap = new Map();
    if (assetNumbers.length > 0) {
      const uniqueAssetNumbers = [...new Set(assetNumbers)];
      const placeholders = uniqueAssetNumbers.map(() => '?').join(',');
      const [existing] = await connection.execute(
        `SELECT Did, Asset_Number FROM devices WHERE Asset_Number IN (${placeholders})`,
        uniqueAssetNumbers
      );
      existing.forEach(row => {
        existingAssetsMap.set(row.Asset_Number, row.Did);
      });
    }

    // ====== Separate devices into insert and update batches ======
    const devicesToInsert = [];
    const devicesToUpdate = [];

    preparedDevices.forEach(prep => {
      const { deviceData } = prep;
      const deviceId = deviceData.Asset_Number ? existingAssetsMap.get(deviceData.Asset_Number) : null;

      if (deviceId) {
        devicesToUpdate.push({ ...prep, deviceId });
      } else {
        devicesToInsert.push(prep);
      }
    });

    // ====== Bulk INSERT devices ======
    if (devicesToInsert.length > 0) {
      for (let i = 0; i < devicesToInsert.length; i += BATCH_SIZE) {
        const batch = devicesToInsert.slice(i, i + BATCH_SIZE);
        
        for (const prep of batch) {
          try {
            const insertFields = [];
            const insertValues = [];
            const placeholders = [];
            
            // Fields that are NOT NULL in database
            const requiredFields = ['Project_code_purchase', 'Waranty_start', 'Waranty_end', 'Received_date', 'Dtypeid'];
            
            requiredFields.forEach(key => {
              if (prep.deviceData[key] !== undefined) {
                insertFields.push(key);
                insertValues.push(prep.deviceData[key]);
                placeholders.push('?');
              }
            });

            // Add other fields (Refer_SOF → sites_location.SOF, not devices column)
            Object.keys(prep.deviceData).forEach(key => {
              if (key === 'Refer_SOF') return;
              if (!requiredFields.includes(key) && prep.deviceData[key] !== undefined && prep.deviceData[key] !== null) {
                insertFields.push(key);
                insertValues.push(prep.deviceData[key]);
                placeholders.push('?');
              }
            });

            if (insertFields.length > 0) {
              // SET session variable สำหรับ Description เพื่อให้ trigger อ่านค่าได้
              await connection.execute('SET @status_change_description = ?', [prep.description]);
              
              const [result] = await connection.execute(
                `INSERT INTO devices (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
                insertValues
              );

              if (prep.deviceData.Refer_SOF != null && prep.deviceData.SLid != null) {
                await applyReferSofToSiteLocation(connection, prep.deviceData.SLid, prep.deviceData.Refer_SOF);
              }

              results.push({
                index: prep.index,
                action: 'inserted',
                Did: result.insertId,
                Asset_Number: prep.deviceData.Asset_Number
              });
            }
          } catch (error) {
            errors.push({
              index: prep.index,
              error: error.message,
              row: prep.row
            });
          }
        }
      }
    }

    // ====== Bulk UPDATE devices ======
    if (devicesToUpdate.length > 0) {
      for (const prep of devicesToUpdate) {
        try {
          const updates = [];
          const values = [];

          const pendingReferSofExcel = prep.deviceData.Refer_SOF;

          Object.keys(prep.deviceData).forEach(key => {
            if (key === 'Refer_SOF') return;
            if (prep.deviceData[key] !== undefined && prep.deviceData[key] !== null) {
              updates.push(`${key} = ?`);
              values.push(prep.deviceData[key]);
            }
          });

          if (updates.length > 0) {
            // SET session variable สำหรับ Description
            await connection.execute('SET @status_change_description = ?', [prep.description]);
            
            values.push(prep.deviceId);
            await connection.execute(
              `UPDATE devices SET ${updates.join(', ')} WHERE Did = ?`,
              values
            );

            results.push({
              index: prep.index,
              action: 'updated',
              Did: prep.deviceId,
              Asset_Number: prep.deviceData.Asset_Number
            });
          } else if (pendingReferSofExcel !== undefined && pendingReferSofExcel !== null) {
            results.push({
              index: prep.index,
              action: 'updated',
              Did: prep.deviceId,
              Asset_Number: prep.deviceData.Asset_Number
            });
          } else {
            results.push({
              index: prep.index,
              action: 'no_changes',
              Did: prep.deviceId,
              Asset_Number: prep.deviceData.Asset_Number
            });
          }

          if (pendingReferSofExcel !== undefined && pendingReferSofExcel !== null) {
            const slidForSof = prep.deviceData.SLid;
            if (slidForSof != null) {
              await applyReferSofToSiteLocation(connection, slidForSof, pendingReferSofExcel);
            } else {
              const [slRows] = await connection.execute('SELECT SLid FROM devices WHERE Did = ?', [prep.deviceId]);
              const slid = slRows[0]?.SLid;
              if (slid != null) {
                await applyReferSofToSiteLocation(connection, slid, pendingReferSofExcel);
              }
            }
          }
        } catch (error) {
          errors.push({
            index: prep.index,
            error: error.message,
            row: prep.row
          });
        }
      }
    }

    await connection.commit();

    // Response
    const insertedCount = results.filter(r => r.action === 'inserted').length;
    const updatedCount = results.filter(r => r.action === 'updated').length;
    const noChangesCount = results.filter(r => r.action === 'no_changes').length;

    res.status(201).json({
      success: true,
      message: `Import Excel สำเร็จ ${results.length} รายการ (สร้างใหม่ ${insertedCount} รายการ, อัพเดท ${updatedCount} รายการ${noChangesCount > 0 ? `, ไม่มีการเปลี่ยนแปลง ${noChangesCount} รายการ` : ''})${errors.length > 0 ? ` (มีข้อผิดพลาด ${errors.length} รายการ)` : ''}`,
      count: results.length,
      inserted: insertedCount,
      updated: updatedCount,
      noChanges: noChangesCount,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error importing Excel:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการ Import Excel',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PUT - Batch อัพเดท Asset_State ผ่าน JSON array
// ส่ง JSON array: [{Did, Asset_State, Description}, ...]
// Flow: Update Asset_State (trigger บันทึก history)
const updateAndDeleteDevices = async (req, res) => {
  try {
    // รองรับทั้ง single object และ array
    const isArray = Array.isArray(req.body);
    const items = isArray ? req.body : [req.body];

    // Validate
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งข้อมูล Device ที่ต้องการอัพเดท'
      });
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].Did) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอก Did (จำเป็น) - Record ที่ ${i + 1}`
        });
      }
      if (!items[i].Asset_State && !items[i].asset_state) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอก Asset_State (จำเป็น) - Record ที่ ${i + 1}`
        });
      }
      const desc = items[i].Description || items[i].description;
      if (!desc || desc.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอก Description (เหตุผล) - Record ที่ ${i + 1}`
        });
      }
    }

    // ดึง Device IDs ทั้งหมด
    const deviceIds = items.map(i => i.Did);
    const placeholders = deviceIds.map(() => '?').join(',');
    const checkSql = `SELECT Did, Asset_State, serial, CI_Name, Asset_Number FROM devices WHERE Did IN (${placeholders})`;
    const [existingDevices] = await db.execute(checkSql, deviceIds);

    // Map เพื่อค้นหาเร็ว
    const existingMap = new Map();
    existingDevices.forEach(d => existingMap.set(d.Did, d));

    // ตรวจสอบว่าพบทุก Did
    const notFoundIds = deviceIds.filter(id => !existingMap.has(id));
    if (notFoundIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบ Device: ${notFoundIds.join(', ')}`
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const deviceId = item.Did;
        const existing = existingMap.get(deviceId);
        const newAssetState = item.Asset_State || item.asset_state;
        const description = item.Description || item.description || '';
        const oldAssetState = existing.Asset_State;

        // Step 1: SET session variable สำหรับ trigger
        await db.execute('SET @status_change_description = ?', [description]);

        // Step 2: Update Asset_State (trigger จะบันทึกลง devices_history)
        await db.execute('UPDATE devices SET Asset_State = ? WHERE Did = ?', [newAssetState, deviceId]);

        results.push({
          Did: deviceId,
          serial: existing.serial,
          CI_Name: existing.CI_Name,
          Asset_Number: existing.Asset_Number,
          oldAssetState: oldAssetState,
          newAssetState: newAssetState,
          description: description,
          action: oldAssetState !== newAssetState ? 'updated' : 'no_changes'
        });
      } catch (error) {
        errors.push({
          index: i + 1,
          Did: item.Did,
          error: error.message
        });
      }
    }

    // ถ้า error ทั้งหมด
    if (errors.length > 0 && results.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดทั้งหมด',
        errors: errors
      });
    }

    const updatedCount = results.filter(r => r.action === 'updated').length;
    const noChangesCount = results.filter(r => r.action === 'no_changes').length;

    // Response
    if (isArray) {
      res.status(200).json({
        success: true,
        message: `อัพเดท Asset_State สำเร็จ ${updatedCount} รายการ${noChangesCount > 0 ? ` (ไม่มีการเปลี่ยนแปลง ${noChangesCount} รายการ)` : ''}${errors.length > 0 ? ` (ข้อผิดพลาด ${errors.length} รายการ)` : ''}`,
        count: results.length,
        updated: updatedCount,
        noChanges: noChangesCount,
        data: results,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(200).json({
        success: true,
        message: results[0].action === 'updated' ? 'อัพเดท Asset_State สำเร็จ' : 'ไม่มีการเปลี่ยนแปลง',
        data: results[0]
      });
    }
  } catch (error) {
    console.error('Error update devices:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดท Asset_State',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล devices เฉพาะสถานะ Sell (พร้อม Pagination และ Search)
const getDevicesSell = async (req, res) => {
  try {
    // ดึง query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    // สร้าง WHERE condition - เฉพาะ Asset_State = 'Sell'
    let searchCondition = `WHERE devices.Asset_State = 'Sell'`;
    let searchParams = [];

    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition += ` AND (
        devices.serial LIKE ? OR 
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.PR_No LIKE ? OR 
        devices.Vendor LIKE ? OR 
        devices.Project_purchase LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices
                      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                      LEFT JOIN sites ON sites_location.Sid = sites.Sid
                      LEFT JOIN location ON sites_location.lid = location.lid
                      JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                      JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination
    const sql = `SELECT devices.Did, devices.Asset_State, devices.serial, devices.CI_Name, devices.Asset_Number, 
                 devices.PR_No, devices.Vendor, devices.Project_purchase, devices.SLid,
                 sites.Sid, location.Location2, 
                 devices.PO_No, devices.Loan_Start, devices.Request_Date, sites_location.SOF AS Refer_SOF, 
                 devices.Refer_Ticket, devices.Assigned_Service, devices.Reason, devices.Dtypeid, devices.DeRoleid,
                 devices.Project_code_purchase, devices.Waranty_start, devices.Waranty_end, devices.Received_date, 
                 devices.Asset_Type, devices.Owner,
                 device_type.model, manufacturer.name as Manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
                 LEFT JOIN sites ON sites_location.Sid = sites.Sid
                 LEFT JOIN location ON sites_location.lid = location.lid
                 JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 ${searchCondition}
                 ORDER BY devices.Did DESC 
                 LIMIT ? OFFSET ?`;
    
    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    res.status(200).json({
      success: true,
      assetState: 'Sell',
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      search: search || null,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting sold devices:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Device ที่ถูก Sell',
      error: error.message
    });
  }
};

// GET - Dynamic Dropdown Data (sites, Asset States, Manufacturers, Models)
// รองรับ filter แบบ dynamic เช่น เลือก site แล้วจะแสดงเฉพาะ asset state ที่มีใน site นั้น
// รองรับ filter จาก model (Dtypeid หรือ model name)
// รองรับ general search ที่ค้นหาใน sites.Name, location.Location2, manufacturer.name, device_type.model, devices.Asset_State, devices.serial
const getDropdownData = async (req, res) => {
  try {
    // ดึง query parameters สำหรับ filter
    const slid = req.query.slid || req.query.slid_id;
    const siteId = req.query.siteId || req.query.site_id;
    const siteName = req.query.siteName || req.query.site_name || req.query.site;
    const location2 = req.query.location2 || req.query.location;
    const assetState = req.query.assetState || req.query.asset_state;
    const manufacturerId = req.query.manufacturerId || req.query.manufacturer_id || req.query.mid;
    const manufacturerName = req.query.manufacturerName || req.query.manufacturer_name || req.query.manufacturer || req.query.brand;
    const modelId = req.query.modelId || req.query.model_id || req.query.dtypeid;
    const modelName = req.query.modelName || req.query.model_name || req.query.model;
    const serial = req.query.serial || req.query.Serial || req.query.serialNumber; // Serial Number filter
    const search = req.query.search || req.query.q; // General search parameter

    // สร้าง WHERE conditions สำหรับ filter
    const whereConditions = [
      'device_type.Dtypeid = devices.Dtypeid',
      'device_type.Mid = manufacturer.Mid'
    ];
    const params = [];

    // Filter by SLid (sites_location ID)
    if (slid) {
      let slids = [];
      if (Array.isArray(slid)) {
        slids = slid.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else if (typeof slid === 'string') {
        slids = slid.split(/[,;]/).map(s => parseInt(s.trim())).filter(id => !isNaN(id));
      } else {
        slids = [parseInt(slid)].filter(id => !isNaN(id));
      }
      if (slids.length > 0) {
        const placeholders = slids.map(() => '?').join(',');
        whereConditions.push(`devices.SLid IN (${placeholders})`);
        params.push(...slids);
      }
    }
    // Filter by Site ID
    else if (siteId) {
      let siteIds = [];
      if (Array.isArray(siteId)) {
        siteIds = siteId.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else if (typeof siteId === 'string') {
        siteIds = siteId.split(/[,;]/).map(s => parseInt(s.trim())).filter(id => !isNaN(id));
      } else {
        siteIds = [parseInt(siteId)].filter(id => !isNaN(id));
      }
      if (siteIds.length > 0) {
        const placeholders = siteIds.map(() => '?').join(',');
        whereConditions.push(`sites_location.Sid IN (${placeholders})`);
        params.push(...siteIds);
      }
    }
    // Filter by Site Name
    else if (siteName) {
      let siteNames = [];
      if (Array.isArray(siteName)) {
        siteNames = siteName;
      } else if (typeof siteName === 'string') {
        siteNames = siteName.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }
      if (siteNames.length > 0) {
        const placeholders = siteNames.map(() => '?').join(',');
        whereConditions.push(`sites.Name IN (${placeholders})`);
        params.push(...siteNames);
      }
    }
    // Filter by Location2
    if (location2) {
      let location2s = [];
      if (Array.isArray(location2)) {
        location2s = location2;
      } else if (typeof location2 === 'string') {
        location2s = location2.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }
      if (location2s.length > 0) {
        const placeholders = location2s.map(() => '?').join(',');
        whereConditions.push(`location.Location2 IN (${placeholders})`);
        params.push(...location2s);
      }
    }

    // Filter by Asset State
    if (assetState) {
      let assetStates = [];
      if (Array.isArray(assetState)) {
        assetStates = assetState;
      } else if (typeof assetState === 'string') {
        assetStates = assetState.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }
      if (assetStates.length > 0) {
        const placeholders = assetStates.map(() => '?').join(',');
        whereConditions.push(`devices.Asset_State IN (${placeholders})`);
        params.push(...assetStates);
      }
    }

    // Filter by manufacturer ID
    if (manufacturerId) {
      let manufacturerIds = [];
      if (Array.isArray(manufacturerId)) {
        manufacturerIds = manufacturerId.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else if (typeof manufacturerId === 'string') {
        manufacturerIds = manufacturerId.split(/[,;]/).map(s => parseInt(s.trim())).filter(id => !isNaN(id));
      } else {
        manufacturerIds = [parseInt(manufacturerId)].filter(id => !isNaN(id));
      }
      if (manufacturerIds.length > 0) {
        const placeholders = manufacturerIds.map(() => '?').join(',');
        whereConditions.push(`manufacturer.Mid IN (${placeholders})`);
        params.push(...manufacturerIds);
      }
    }
    // Filter by manufacturer Name
    else if (manufacturerName) {
      let manufacturerNames = [];
      if (Array.isArray(manufacturerName)) {
        manufacturerNames = manufacturerName;
      } else if (typeof manufacturerName === 'string') {
        manufacturerNames = manufacturerName.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }
      if (manufacturerNames.length > 0) {
        const placeholders = manufacturerNames.map(() => '?').join(',');
        whereConditions.push(`manufacturer.name IN (${placeholders})`);
        params.push(...manufacturerNames);
      }
    }

    // Filter by Model ID (Dtypeid)
    if (modelId) {
      let modelIds = [];
      if (Array.isArray(modelId)) {
        modelIds = modelId.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else if (typeof modelId === 'string') {
        modelIds = modelId.split(/[,;]/).map(s => parseInt(s.trim())).filter(id => !isNaN(id));
      } else {
        modelIds = [parseInt(modelId)].filter(id => !isNaN(id));
      }
      if (modelIds.length > 0) {
        if (modelIds.length === 1) {
          whereConditions.push('device_type.Dtypeid = ?');
          params.push(modelIds[0]);
        } else {
          const placeholders = modelIds.map(() => '?').join(',');
          whereConditions.push(`device_type.Dtypeid IN (${placeholders})`);
          params.push(...modelIds);
        }
      }
    }
    // Filter by Model Name
    else if (modelName) {
      let modelNames = [];
      if (Array.isArray(modelName)) {
        modelNames = modelName;
      } else if (typeof modelName === 'string') {
        modelNames = modelName.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }
      if (modelNames.length > 0) {
        if (modelNames.length === 1) {
          whereConditions.push('device_type.model = ?');
          params.push(modelNames[0]);
        } else {
          const placeholders = modelNames.map(() => '?').join(',');
          whereConditions.push(`device_type.model IN (${placeholders})`);
          params.push(...modelNames);
        }
      }
    }

    // Filter by Serial Number
    if (serial) {
      let serials = [];
      if (Array.isArray(serial)) {
        serials = serial;
      } else if (typeof serial === 'string') {
        serials = serial.split(/[,;]/).map(s => s.trim()).filter(s => s);
      }
      if (serials.length > 0) {
        if (serials.length === 1) {
          // ค้นหาแบบ LIKE สำหรับ serial เดียว
          whereConditions.push('devices.serial LIKE ?');
          params.push(`%${serials[0]}%`);
        } else {
          // ค้นหาแบบ IN สำหรับหลาย serials
          const placeholders = serials.map(() => '?').join(',');
          whereConditions.push(`devices.serial IN (${placeholders})`);
          params.push(...serials);
        }
      }
    }

    // General Search - ค้นหาในหลายๆ field พร้อมกัน (sites, Asset State, Model, Serial Number)
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions.push(`(
        sites.Name LIKE ? OR 
        location.Location2 LIKE ? OR 
        manufacturer.name LIKE ? OR 
        device_type.model LIKE ? OR 
        devices.Asset_State LIKE ? OR
        devices.serial LIKE ?
      )`);
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // ดึง sites ที่มี Device (filtered) - จาก sites_location JOIN กับ sites และ location
    const sitesSql = `
      SELECT DISTINCT 
        sites_location.SLid as id,
        sites_location.Sid as siteId,
        sites_location.lid as locationId,
        sites.Name as name,
        location.Location2 as location2,
        COUNT(devices.Did) as deviceCount
      FROM devices
      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
      LEFT JOIN sites ON sites_location.Sid = sites.Sid
      LEFT JOIN location ON sites_location.lid = location.lid
      LEFT JOIN device_type ON devices.Dtypeid = device_type.Dtypeid
      LEFT JOIN manufacturer ON device_type.Mid = manufacturer.Mid
      ${whereClause}
      GROUP BY sites_location.SLid, sites_location.Sid, sites_location.lid, sites.Name, location.Location2
      ORDER BY sites.Name, location.Location2
    `;
    const [sites] = await db.execute(sitesSql, params);

    // ดึง Asset States ที่มี Device (filtered)
    const assetStatesSql = `
      SELECT DISTINCT devices.Asset_State as value, COUNT(devices.Did) as deviceCount
      FROM devices
      LEFT JOIN device_type ON devices.Dtypeid = device_type.Dtypeid
      LEFT JOIN manufacturer ON device_type.Mid = manufacturer.Mid
      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
      LEFT JOIN sites ON sites_location.Sid = sites.Sid
      LEFT JOIN location ON sites_location.lid = location.lid
      ${whereClause}
      GROUP BY devices.Asset_State
      ORDER BY devices.Asset_State
    `;
    const [assetStates] = await db.execute(assetStatesSql, params);

    // ดึง Manufacturers ที่มี Device (filtered)
    const manufacturersSql = `
      SELECT DISTINCT manufacturer.Mid as id, manufacturer.name as name, COUNT(devices.Did) as deviceCount
      FROM devices
      LEFT JOIN device_type ON devices.Dtypeid = device_type.Dtypeid
      LEFT JOIN manufacturer ON device_type.Mid = manufacturer.Mid
      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
      LEFT JOIN sites ON sites_location.Sid = sites.Sid
      LEFT JOIN location ON sites_location.lid = location.lid
      ${whereClause}
      GROUP BY manufacturer.Mid, manufacturer.name
      ORDER BY manufacturer.name
    `;
    const [manufacturers] = await db.execute(manufacturersSql, params);

    // ดึง Models ที่มี Device (filtered)
    const modelsSql = `
      SELECT DISTINCT 
        device_type.Dtypeid as id, 
        device_type.model as name, 
        manufacturer.Mid as manufacturerId, 
        manufacturer.name as manufacturer, 
        COUNT(devices.Did) as deviceCount
      FROM devices
      LEFT JOIN device_type ON devices.Dtypeid = device_type.Dtypeid
      LEFT JOIN manufacturer ON device_type.Mid = manufacturer.Mid
      LEFT JOIN sites_location ON devices.SLid = sites_location.SLid
      LEFT JOIN sites ON sites_location.Sid = sites.Sid
      LEFT JOIN location ON sites_location.lid = location.lid
      ${whereClause}
      GROUP BY device_type.Dtypeid, device_type.model, manufacturer.Mid, manufacturer.name
      ORDER BY device_type.model
    `;
    const [models] = await db.execute(modelsSql, params);

    // สร้าง response
    res.status(200).json({
      success: true,
      filters: {
        slid: slid || null,
        siteId: siteId || null,
        siteName: siteName || null,
        location2: location2 || null,
        assetState: assetState || null,
        manufacturerId: manufacturerId || null,
        manufacturerName: manufacturerName || null,
        modelId: modelId || null,
        modelName: modelName || null,
        serial: serial || null,
        search: search || null
      },
      data: {
        sites: sites.map(s => ({
          id: s.id,
          siteId: s.siteId,
          locationId: s.locationId,
          name: s.name,
          location2: s.location2,
          deviceCount: s.deviceCount
        })),
        assetStates: assetStates
          .filter(a => a.value !== null)
          .map(a => ({
            value: a.value,
            deviceCount: a.deviceCount
          })),
        manufacturers: manufacturers.map(m => ({
          id: m.id,
          name: m.name,
          deviceCount: m.deviceCount
        })),
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          manufacturerId: m.manufacturerId,
          manufacturer: m.manufacturer,
          deviceCount: m.deviceCount
        }))
      }
    });
  } catch (error) {
    console.error('Error getting dropdown data:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dropdown',
      error: error.message
    });
  }
};

module.exports = {
  createDevice,              // POST
  getDevices,                // GET (all with pagination)
  getDevicesExcludeInStore,  // GET (exclude "In Store")
  getDevicesExcludeOutStore, // GET (exclude "Out Store")
  getDevicesByAssetState,    // GET (search by Asset_State)
  getDevicesBySiteId,        // GET (by Site ID - path param)
  getDevicesBySite,          // GET (search by Site - query param)
  searchDevices,             // GET (advanced search - multiple filters)
  getDeviceById,             // GET (by id)
  getDashboardSummary,       // GET (dashboard summary - fast loading)
  getDashboard,              // GET (dashboard statistics - full)
  getDevicesByModel,         // GET (grouped by model)
  viewDeviceHistory,         // GET (view all device history)
  getDeviceHistory,          // GET (device history by id)
  updateAssetState,          // PUT (update asset state - multiple)
  updateAssetStateOther,     // PUT (update asset state other - Site, location, Reason)
  updateDevice,              // PUT
  deleteDevice,              // DELETE (single)
  deleteDevicesByExcel,      // DELETE (multiple by Serial - Excel)
  importExcel,               // POST (import Excel JSON)
  getDropdownData,           // GET (dynamic dropdown data)
  updateAndDeleteDevices,    // PUT+DELETE (update asset state then delete - batch)
  getDevicesSell             // GET (devices with Asset_State = 'Sell')
};

