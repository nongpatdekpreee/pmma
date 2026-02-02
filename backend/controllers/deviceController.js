const db = require('../config/database');

// Helper function - บันทึกประวัติการเปลี่ยนแปลง Device
const logDeviceHistory = async (deviceId, action, oldValue = null, newValue = null, changedFields = null, user = null) => {
  try {
    const historySql = `INSERT INTO devices_history (
      Did, Action, Old_Value, New_Value, Changed_Fields, User
    ) VALUES (?, ?, ?, ?, ?, ?)`;

    const changedFieldsJson = changedFields ? JSON.stringify(changedFields) : null;

    await db.execute(historySql, [
      deviceId,
      action,
      oldValue,
      newValue,
      changedFieldsJson,
      user
    ]);
  } catch (error) {
    // Log error แต่ไม่ throw เพื่อไม่ให้กระทบการทำงานหลัก
    console.error('Error logging device history:', error);
  }
};

// POST - สร้าง Device ใหม่ (รองรับทั้ง 1 device และหลาย devices)
// ถ้ามี Asset_Number และมีอยู่ใน database แล้ว จะ update แทน insert
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

    // ตรวจสอบข้อมูลที่จำเป็น (Dtypeid เป็น required)
    for (let i = 0; i < devices.length; i++) {
      if (!devices[i].Dtypeid) {
        return res.status(400).json({
          success: false,
          message: `กรุณากรอกข้อมูล Dtypeid (จำเป็น) - Device ที่ ${i + 1}`
        });
      }
    }

    // ดึง Asset_Numbers ทั้งหมดที่ต้องการตรวจสอบ (batch query - เพิ่มความเร็วมาก)
    const assetNumbers = devices
      .filter(d => d.Asset_Number)
      .map(d => d.Asset_Number);

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
      if (device.Asset_Number && existingAssetsMap.has(device.Asset_Number)) {
        devicesToUpdate.push({
          ...device,
          _index: index,
          _id: existingAssetsMap.get(device.Asset_Number)
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
      // INSERT devices ทีละตัว 
      for (const device of devicesToInsert) {
        try {
          const [result] = await db.execute(
            `INSERT INTO devices (
              Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, 
               SLid,PO_No, Loan_Start, Request_Date, Refer_SOF, 
              Refer_Ticket, Assigned_Service, Reason, warranty, Dtypeid, DeRoleid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              device.Asset_State || null,
              device.serial || null,
              device.CI_Name || null,
              device.Asset_Number || null,
              device.PR_No || null,
              device.Vendor || null,
              device.SLid || null,
              device.Location2 || null,
              device.PO_No || null,
              device.Loan_Start || null,
              device.Request_Date || null,
              device.Refer_SOF || null,
              device.Refer_Ticket || null,
              device.Assigned_Service || null,
              device.Reason || null,
              device.warranty || null,
              device.Dtypeid,
              device.DeRoleid || null
            ]
          );

          const deviceId = result.insertId;

          // บันทึกประวัติ INSERT
          await logDeviceHistory(
            deviceId,
            'INSERT',
            null,
            device.Asset_State || null,
            device,
            req.user?.username || req.user?.id || null
          );

          insertedDevices.push({
            id: result.insertId,
            action: 'inserted',
            _index: device._index,
            Asset_State: device.Asset_State,
            serial: device.serial,
            CI_Name: device.CI_Name,
            Asset_Number: device.Asset_Number,
            PR_No: device.PR_No,
            Vendor: device.Vendor,
            Sid: device.Sid,
         
            PO_No: device.PO_No,
            Loan_Start: device.Loan_Start,
            Request_Date: device.Request_Date,
            Refer_SOF: device.Refer_SOF,
            Refer_Ticket: device.Refer_Ticket,
            Assigned_Service: device.Assigned_Service,
            Reason: device.Reason,
            warranty: device.warranty,
            Dtypeid: device.Dtypeid,
            DeRoleid: device.DeRoleid
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

        const updates = [];
        const values = [];
        const changedFields = {};

        if (device.Asset_State !== undefined) {
          updates.push('Asset_State = ?');
          values.push(device.Asset_State);
          changedFields.Asset_State = device.Asset_State;
        }
        if (device.serial !== undefined) {
          updates.push('serial = ?');
          values.push(device.serial);
          changedFields.serial = device.serial;
        }
        if (device.CI_Name !== undefined) {
          updates.push('CI_Name = ?');
          values.push(device.CI_Name);
          changedFields.CI_Name = device.CI_Name;
        }
        if (device.PR_No !== undefined) {
          updates.push('PR_No = ?');
          values.push(device.PR_No);
          changedFields.PR_No = device.PR_No;
        }
        if (device.Vendor !== undefined) {
          updates.push('Vendor = ?');
          values.push(device.Vendor);
          changedFields.Vendor = device.Vendor;
        }
        if (device.Sid !== undefined) {
          updates.push('Sid = ?');
          values.push(device.Sid);
          changedFields.Sid = device.Sid;
        }
        
        if (device.PO_No !== undefined) {
          updates.push('PO_No = ?');
          values.push(device.PO_No);
          changedFields.PO_No = device.PO_No;
        }
        if (device.Loan_Start !== undefined) {
          updates.push('Loan_Start = ?');
          values.push(device.Loan_Start);
          changedFields.Loan_Start = device.Loan_Start;
        }
        if (device.Request_Date !== undefined) {
          updates.push('Request_Date = ?');
          values.push(device.Request_Date);
          changedFields.Request_Date = device.Request_Date;
        }
        if (device.Refer_SOF !== undefined) {
          updates.push('Refer_SOF = ?');
          values.push(device.Refer_SOF);
          changedFields.Refer_SOF = device.Refer_SOF;
        }
        if (device.Refer_Ticket !== undefined) {
          updates.push('Refer_Ticket = ?');
          values.push(device.Refer_Ticket);
          changedFields.Refer_Ticket = device.Refer_Ticket;
        }
        if (device.Assigned_Service !== undefined) {
          updates.push('Assigned_Service = ?');
          values.push(device.Assigned_Service);
          changedFields.Assigned_Service = device.Assigned_Service;
        }
        if (device.Reason !== undefined) {
          updates.push('Reason = ?');
          values.push(device.Reason);
          changedFields.Reason = device.Reason;
        }
        if (device.warranty !== undefined) {
          updates.push('warranty = ?');
          values.push(device.warranty);
          changedFields.warranty = device.warranty;
        }
        if (device.Dtypeid !== undefined) {
          updates.push('Dtypeid = ?');
          values.push(device.Dtypeid);
          changedFields.Dtypeid = device.Dtypeid;
        }
        if (device.DeRoleid !== undefined) {
          updates.push('DeRoleid = ?');
          values.push(device.DeRoleid);
          changedFields.DeRoleid = device.DeRoleid;
        }

        if (updates.length > 0) {
          values.push(device._id);
          const updateSql = `UPDATE devices SET ${updates.join(', ')} WHERE Did = ?`;
          await db.execute(updateSql, values);

          const newAssetState = device.Asset_State !== undefined ? device.Asset_State : oldAssetState;

          // บันทึกประวัติ ASSET_STATE_CHANGE ถ้า Asset_State เปลี่ยน
          if (device.Asset_State !== undefined && oldAssetState !== newAssetState) {
            await logDeviceHistory(
              device._id,
              'ASSET_STATE_CHANGE',
              oldAssetState,
              newAssetState,
              null,
              req.user?.username || req.user?.id || null
            );
          }

          // บันทึกประวัติ UPDATE (ถ้าไม่ใช่แค่เปลี่ยน Asset_State)
          if (Object.keys(changedFields).length > 0 &&
            (Object.keys(changedFields).length > 1 || !changedFields.Asset_State)) {
            await logDeviceHistory(
              device._id,
              'UPDATE',
              null,
              null,
              changedFields,
              req.user?.username || req.user?.id || null
            );
          }

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
        message: 'เกิดข้อผิดพลาดในการสร้าง/อัพเดท Devices ทั้งหมด',
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
        message: `ประมวลผล Devices สำเร็จ ${allResults.length} รายการ (สร้างใหม่ ${insertedDevices.length} รายการ, อัพเดท ${updatedDevices.length} รายการ)${errors.length > 0 ? ` (มีข้อผิดพลาด ${errors.length} รายการ)` : ''}`,
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

// GET - ดึงข้อมูล Devices (พร้อม Pagination และ Search)
const getDevices = async (req, res) => {
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
        devices.Vendor LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด (พร้อม search)
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices, device_type, sites, manufacturer 
                      WHERE device_type.Dtypeid = devices.Dtypeid 
                      AND device_type.Mid = manufacturer.Mid 
                      AND devices.SLid = sites.Sid 
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination (พร้อม search)
    const sql = `SELECT Did, Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, 
                 devices.SLid as SLid,  PO_No, Loan_Start, Request_Date, Refer_SOF, 
                 Refer_Ticket, Assigned_Service, Reason, devices.Dtypeid as Dtypeid, 
                 device_type.model, manufacturer.name as manufacturername, sites.Name as Sitename 
                 FROM devices, device_type, sites, manufacturer 
                 WHERE device_type.Dtypeid = devices.Dtypeid 
                 AND device_type.Mid = manufacturer.Mid 
                 AND devices.SLid = sites.Sid 
                 ${searchCondition}
                 ORDER BY Did DESC 
                 LIMIT ? OFFSET ?`;

    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้ (ถ้ามี search)
    let assetStateStats = [];
    if (search) {
      const assetStateSql = `SELECT devices.Asset_State, COUNT(*) AS total
                             FROM devices, device_type, sites, manufacturer 
                             WHERE device_type.Dtypeid = devices.Dtypeid 
                             AND device_type.Mid = manufacturer.Mid 
                             AND devices.SLid = sites.Sid 
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

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ Asset_State = "In Store" (พร้อม Pagination และ Search)
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
        devices.Vendor LIKE ? 
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด (ไม่รวม "In Store" + search)
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices, device_type, sites, manufacturer 
                      WHERE device_type.Dtypeid = devices.Dtypeid 
                      AND device_type.Mid = manufacturer.Mid 
                      AND devices.SLid = sites.Sid 
                      AND (devices.Asset_State IS NULL OR devices.Asset_State != 'In Store')
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination (ไม่รวม "In Store" + search)
    const sql = `SELECT Did, Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor,
                 devices.SLid as Sid,  PO_No, Loan_Start, Request_Date, Refer_SOF, 
                 Refer_Ticket, Assigned_Service, Reason, devices.Dtypeid as Dtypeid, 
                 device_type.model, manufacturer.name as manufacturername, sites.Name as Sitename 
                 FROM devices, device_type, sites, manufacturer 
                 WHERE device_type.Dtypeid = devices.Dtypeid 
                 AND device_type.Mid = manufacturer.Mid 
                 AND devices.SLid = sites.Sid 
                 AND (devices.Asset_State IS NULL OR devices.Asset_State != 'In Store')
                 ${searchCondition}
                 ORDER BY Did DESC 
                 LIMIT ? OFFSET ?`;

    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้ (ถ้ามี search)
    let assetStateStats = [];
    if (search) {
      const assetStateSql = `SELECT devices.Asset_State, COUNT(*) AS total
                             FROM devices, device_type, sites, manufacturer 
                             WHERE device_type.Dtypeid = devices.Dtypeid 
                             AND device_type.Mid = manufacturer.Mid 
                             AND devices.SLid = sites.Sid 
                             AND (devices.Asset_State IS NULL OR devices.Asset_State != 'In Store')
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

// GET - ดึงข้อมูล Devices ที่ไม่ใช่ Asset_State = "Out Store" (พร้อม Pagination และ Search)
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
        devices.Vendor LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // นับจำนวน records ทั้งหมด (ไม่รวม "Out Store" + search)
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices, device_type, sites, manufacturer 
                      WHERE device_type.Dtypeid = devices.Dtypeid 
                      AND device_type.Mid = manufacturer.Mid 
                      AND devices.SLid = sites.Sid 
                      AND (devices.Asset_State IS NULL OR devices.Asset_State != 'Out Store')
                      ${searchCondition}`;
    const [countResult] = await db.execute(countSql, searchParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลตาม pagination (ไม่รวม "Out Store" + search)
    const sql = `SELECT Did, Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, 
                 devices.SLid as Sid, 2, PO_No, Loan_Start, Request_Date, Refer_SOF, 
                 Refer_Ticket, Assigned_Service, Reason, devices.Dtypeid as Dtypeid, 
                 device_type.model, manufacturer.name as manufacturername, sites.Name as Sitename 
                 FROM devices, device_type, sites, manufacturer 
                 WHERE device_type.Dtypeid = devices.Dtypeid 
                 AND device_type.Mid = manufacturer.Mid 
                 AND devices.SLid = sites.Sid 
                 AND (devices.Asset_State IS NULL OR devices.Asset_State != 'Out Store')
                 ${searchCondition}
                 ORDER BY Did DESC 
                 LIMIT ? OFFSET ?`;

    const [rows] = await db.execute(sql, [...searchParams, limit, offset]);

    // นับจำนวนแยกตาม Asset_State สำหรับผลลัพธ์ที่ค้นหาได้ (ถ้ามี search)
    let assetStateStats = [];
    if (search) {
      const assetStateSql = `SELECT devices.Asset_State, COUNT(*) AS total
                             FROM devices, device_type, sites, manufacturer 
                             WHERE device_type.Dtypeid = devices.Dtypeid 
                             AND device_type.Mid = manufacturer.Mid 
                             AND devices.SLid = sites.Sid 
                             AND (devices.Asset_State IS NULL OR devices.Asset_State != 'Out Store')
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

// GET - ดึงข้อมูล Device ตาม ID
const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get Location2 from location table via JOIN (Devices table may not have Location2 column)
    const sql = `SELECT Did, Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor,
                 devices.SLid as Sid, L.Location2 as Location2, PO_No, Loan_Start, Request_Date, Refer_SOF, 
                 Refer_Ticket, Assigned_Service, Reason, devices.Dtypeid as Dtypeid, 
                 device_type.model, manufacturer.name as manufacturername, sites.Name as Sitename 
                 FROM devices
                 LEFT JOIN device_type ON device_type.Dtypeid = devices.Dtypeid 
                 LEFT JOIN manufacturer ON device_type.Mid = manufacturer.Mid 
                 LEFT JOIN sites ON devices.SLid = sites.Sid 
                 LEFT JOIN sites_location SL ON devices.SLid = SL.SLid
                 LEFT JOIN location L ON SL.lid = L.lid
                 WHERE devices.Did = ? 
                 ORDER BY Did DESC`;

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
    }

    // ดึง Device IDs ทั้งหมดที่ต้องการอัพเดท
    const deviceIds = updates.map(u => u.Did);

    // ดึงข้อมูลเดิมทั้งหมด (batch query)
    const placeholders = deviceIds.map(() => '?').join(',');
    const checkSql = `SELECT Did, Asset_State FROM devices WHERE Did IN (${placeholders})`;
    const [existingDevices] = await db.execute(checkSql, deviceIds);

    // สร้าง map สำหรับค้นหาเร็ว
    const existingMap = new Map();
    existingdevices.forEach(device => {
      existingMap.set(device.Did, device.Asset_State);
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
        const newAssetState = update.Asset_State;
        const oldAssetState = existingMap.get(deviceId);

        // อัพเดทเฉพาะถ้า Asset_State เปลี่ยน
        if (oldAssetState !== newAssetState) {
          const updateSql = 'UPDATE devices SET Asset_State = ? WHERE Did = ?';
          await db.execute(updateSql, [newAssetState, deviceId]);

          // บันทึกประวัติ ASSET_STATE_CHANGE
          await logDeviceHistory(
            deviceId,
            'ASSET_STATE_CHANGE',
            oldAssetState,
            newAssetState,
            null,
            req.user?.username || req.user?.id || null
          );

          updatedDevices.push({
            Did: deviceId,
            oldAssetState: oldAssetState,
            newAssetState: newAssetState,
            action: 'updated'
          });
        } else {
          // ถ้า Asset_State ไม่เปลี่ยน
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
        message: updatedDevices[0].action === 'updated' ? 'อัพเดท Asset_State สำเร็จ' : 'Asset_State ไม่มีการเปลี่ยนแปลง',
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

// PUT - แก้ไขข้อมูล Device
const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Asset_State,
      serial,
      CI_Name,
      Asset_Number,
      PR_No,
      Vendor,
      Sid,
      Location2,
      PO_No,
      Loan_Start,
      Request_Date,
      Refer_SOF,
      Refer_Ticket,
      Assigned_Service,
      Reason,
      Dtypeid
    } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    const hasUpdate = Asset_State !== undefined || serial !== undefined ||
      CI_Name !== undefined || Asset_Number !== undefined ||
      PR_No !== undefined || Vendor !== undefined ||
      Sid !== undefined ||
      Location2 !== undefined || PO_No !== undefined ||
      Loan_Start !== undefined || Request_Date !== undefined ||
      Refer_SOF !== undefined || Refer_Ticket !== undefined ||
      Assigned_Service !== undefined || Reason !== undefined ||
      Dtypeid !== undefined;

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

    // สร้าง SQL query แบบ dynamic
    const updates = [];
    const values = [];
    const changedFields = {};

    if (Asset_State !== undefined) {
      updates.push('Asset_State = ?');
      values.push(Asset_State);
      changedFields.Asset_State = Asset_State;
    }
    if (serial !== undefined) {
      updates.push('serial = ?');
      values.push(serial);
      changedFields.serial = serial;
    }
    if (CI_Name !== undefined) {
      updates.push('CI_Name = ?');
      values.push(CI_Name);
      changedFields.CI_Name = CI_Name;
    }
    if (Asset_Number !== undefined) {
      updates.push('Asset_Number = ?');
      values.push(Asset_Number);
      changedFields.Asset_Number = Asset_Number;
    }
    if (PR_No !== undefined) {
      updates.push('PR_No = ?');
      values.push(PR_No);
      changedFields.PR_No = PR_No;
    }
    if (Vendor !== undefined) {
      updates.push('Vendor = ?');
      values.push(Vendor);
      changedFields.Vendor = Vendor;
    }
    if (Project !== undefined) {
      updates.push('Project = ?');
      values.push(Project);
      changedFields.Project = Project;
    }
    if (Sid !== undefined) {
      updates.push('Sid = ?');
      values.push(Sid);
      changedFields.Sid = Sid;
    }
    if (Location2 !== undefined) {
      updates.push('Location2 = ?');
      values.push(Location2);
      changedFields.Location2 = Location2;
    }
    if (PO_No !== undefined) {
      updates.push('PO_No = ?');
      values.push(PO_No);
      changedFields.PO_No = PO_No;
    }
    if (Loan_Start !== undefined) {
      updates.push('Loan_Start = ?');
      values.push(Loan_Start);
      changedFields.Loan_Start = Loan_Start;
    }
    if (Request_Date !== undefined) {
      updates.push('Request_Date = ?');
      values.push(Request_Date);
      changedFields.Request_Date = Request_Date;
    }
    if (Refer_SOF !== undefined) {
      updates.push('Refer_SOF = ?');
      values.push(Refer_SOF);
      changedFields.Refer_SOF = Refer_SOF;
    }
    if (Refer_Ticket !== undefined) {
      updates.push('Refer_Ticket = ?');
      values.push(Refer_Ticket);
      changedFields.Refer_Ticket = Refer_Ticket;
    }
    if (Assigned_Service !== undefined) {
      updates.push('Assigned_Service = ?');
      values.push(Assigned_Service);
      changedFields.Assigned_Service = Assigned_Service;
    }
    if (Reason !== undefined) {
      updates.push('Reason = ?');
      values.push(Reason);
      changedFields.Reason = Reason;
    }
    if (Dtypeid !== undefined) {
      updates.push('Dtypeid = ?');
      values.push(Dtypeid);
      changedFields.Dtypeid = Dtypeid;
    }

    values.push(id);

    const sql = `UPDATE devices SET ${updates.join(', ')} WHERE Did = ?`;
    await db.execute(sql, values);

    // บันทึกประวัติ ASSET_STATE_CHANGE ถ้า Asset_State เปลี่ยน
    if (Asset_State !== undefined && oldAssetState !== Asset_State) {
      await logDeviceHistory(
        id,
        'ASSET_STATE_CHANGE',
        oldAssetState,
        Asset_State,
        null,
        req.user?.username || req.user?.id || null
      );
    }

    // บันทึกประวัติ UPDATE (ถ้ามีการเปลี่ยนแปลงฟิลด์อื่นๆ)
    const otherChangedFields = { ...changedFields };
    delete otherChangedFields.Asset_State;

    if (Object.keys(otherChangedFields).length > 0) {
      await logDeviceHistory(
        id,
        'UPDATE',
        null,
        null,
        otherChangedFields,
        req.user?.username || req.user?.id || null
      );
    }

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง (พร้อม JOIN)
    const [updated] = await db.execute(
      `SELECT Did, Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, 
       devices.SLid as Sid, Location2, PO_No, Loan_Start, Request_Date, Refer_SOF, 
       Refer_Ticket, Assigned_Service, Reason, devices.Dtypeid as Dtypeid, 
       device_type.model, manufacturer.name as manufacturername, sites.Name as Sitename 
       FROM devices, device_type, sites, manufacturer 
       WHERE device_type.Dtypeid = devices.Dtypeid 
       AND device_type.Mid = manufacturer.Mid 
       AND devices.SLid = sites.Sid 
       AND devices.Did = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'แก้ไขข้อมูล Device สำเร็จ',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไข Device',
      error: error.message
    });
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

// GET - Dashboard Statistics
const getDashboard = async (req, res) => {
  try {
    // 1. จำนวน Devices ต่อ Site
    const siteStatsSql = `SELECT s.Name AS site_name, COUNT(*) AS total
                          FROM devices d
                          JOIN sites s ON d.SLid = s.Sid
                          GROUP BY s.Name`;
    const [siteStats] = await db.execute(siteStatsSql);

    // 2. จำนวน Devices ทั้งหมด
    const totalDevicesSql = `SELECT COUNT(*) AS total_devices FROM devices`;
    const [totalDevicesResult] = await db.execute(totalDevicesSql);
    const totalDevices = totalDevicesResult[0].total_devices;

    // 3. จำนวน Devices ต่อ Asset_State
    const assetStateSql = `SELECT Asset_State, COUNT(*) AS total
                           FROM devices
                           GROUP BY Asset_State`;
    const [assetStateStats] = await db.execute(assetStateSql);

    // 4. จำนวน Devices ที่ available (Request_Date IS NULL)
    const availableSql = `SELECT COUNT(*) AS available_devices
                         FROM devices
                         WHERE Request_Date IS NULL`;
    const [availableResult] = await db.execute(availableSql);
    const availableDevices = availableResult[0].available_devices;

    // 5. จำนวน Devices ที่ requested (Request_Date IS NOT NULL)
    const requestedSql = `SELECT COUNT(*) AS requested_devices
                         FROM devices
                         WHERE Request_Date IS NOT NULL`;
    const [requestedResult] = await db.execute(requestedSql);
    const requestedDevices = requestedResult[0].requested_devices;

    // 6. จำนวน Devices ต่อ Model
    const modelStatsSql = `SELECT dt.model, COUNT(*) AS total
                          FROM devices d
                          JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                          GROUP BY dt.model`;
    const [modelStats] = await db.execute(modelStatsSql);

    // 7. จำนวน Devices ต่อ manufacturer
    const manufacturerStatsSql = `SELECT m.name AS manufacturer, COUNT(*) AS total
                                 FROM devices d
                                 JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                                 JOIN manufacturer m ON dt.Mid = m.Mid
                                 GROUP BY m.name`;
    const [manufacturerStats] = await db.execute(manufacturerStatsSql);

    res.status(200).json({
      success: true,
      data: {
        totalDevices: totalDevices,
        availableDevices: availableDevices,
        requestedDevices: requestedDevices,
        siteStats: siteStats,
        assetStateStats: assetStateStats,
        modelStats: modelStats,
        manufacturerStats: manufacturerStats
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

// GET - ดึงข้อมูล Devices แยกตาม Model (พร้อม Asset_State breakdown และ manufacturer)
const getDevicesByModel = async (req, res) => {
  try {
    // ดึงข้อมูล model, manufacturer, และจำนวนทั้งหมด
    const modelSql = `SELECT 
                      dt.model,
                      m.name AS manufacturername,
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
        manufacturername: model.manufacturername,
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
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Devices แยกตาม Model',
      error: error.message
    });
  }
};

// GET - รายการ Vendor สำหรับ dropdown (DISTINCT จาก devices.Project_purchase, ORDER BY Project_purchase ASC)
// ถ้า Project_purchase ไม่มีใช้ Vendor แทน
const getVendors = async (req, res) => {
  try {
    let rows;
    try {
      [rows] = await db.execute(
        `SELECT DISTINCT Project_purchase AS name FROM devices
         WHERE Project_purchase IS NOT NULL AND TRIM(Project_purchase) != ''
         ORDER BY Project_purchase ASC`
      );
    } catch (e) {
      [rows] = await db.execute(
        `SELECT DISTINCT Vendor AS name FROM devices
         WHERE Vendor IS NOT NULL AND TRIM(Vendor) != ''
         ORDER BY Vendor ASC`
      );
    }
    res.status(200).json({ success: true, data: rows.map((r) => r.name) });
  } catch (error) {
    console.error('Error getting vendors:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงรายการ Vendor',
      error: error.message
    });
  }
};

// GET - ดึง Devices ตาม site_id (= SLid, sites_location) สำหรับ Contract / Asset Binding
// GET - ดึง unique Refer_SOF values จาก Devices table
const getReferSOFList = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT Refer_SOF as refer_sof
       FROM devices
       WHERE Refer_SOF IS NOT NULL AND Refer_SOF != '' AND Refer_SOF != 'Not Assigned'
       ORDER BY Refer_SOF ASC`
    );
    res.status(200).json({ 
      success: true, 
      data: rows.map(r => r.refer_sof).filter(Boolean)
    });
  } catch (error) {
    console.error('Error getting Refer_SOF list:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงรายการ Refer_SOF',
      error: error.message
    });
  }
};

// GET - ดึง Devices ตาม Refer_SOF และ Site (SLid)
const getDevicesBySOFAndSite = async (req, res) => {
  try {
    const referSOF = req.query.refer_sof;
    const siteId = req.query.site_id;
    
    if (!referSOF) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ refer_sof'
      });
    }
    
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ site_id (SLid)'
      });
    }
    
    const [rows] = await db.execute(
      `SELECT Did, CI_Name, Asset_Number, Asset_State, serial, SLid, Dtypeid, DeRoleid, Refer_SOF
       FROM devices
       WHERE Refer_SOF = ? AND SLid = ?
       ORDER BY COALESCE(CI_Name, Asset_Number, Did) ASC`,
      [referSOF, siteId]
    );
    
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting devices by SOF and site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Devices ตาม Refer_SOF และ Site',
      error: error.message
    });
  }
};

// GET - ดึง Devices ที่ยังไม่มีเลข SOF (Refer_SOF เป็น NULL, '' หรือ 'Not Assigned') และ Asset_State = 'In Store'
// ไม่แสดง device ที่ผูกกับสัญญาแล้ว (contract.device_id หรือ contract_device)
// ถ้ามี site_id = กรองตาม site นั้น; ถ้าไม่มี = แสดงทุกอันที่ SLid = 2
const getDevicesBySiteNoSOF = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    let sql, params;
    // รองรับทั้ง NULL, '', ช่องว่าง, และ 'Not Assigned' (ไม่สนใจตัวพิมพ์/ช่องว่าง)
    const noSofCondition = `(d.Refer_SOF IS NULL OR TRIM(COALESCE(d.Refer_SOF,'')) = '' OR LOWER(TRIM(d.Refer_SOF)) = 'not assigned')`;
    // รองรับ 'In Store' ไม่สนใจตัวพิมพ์และช่องว่าง
    const inStoreCondition = "LOWER(TRIM(COALESCE(d.Asset_State,''))) = 'in store'";
    const notInContract = `d.Did NOT IN (SELECT device_id FROM contract WHERE device_id IS NOT NULL)
      AND d.Did NOT IN (SELECT device_id FROM contract_device)`;
    
    if (siteId) {
      sql = `SELECT d.Did, d.CI_Name, d.Asset_Number, d.Asset_State, d.serial, d.SLid, d.Dtypeid, d.DeRoleid, d.Refer_SOF
             FROM devices d
             WHERE d.SLid = ?
               AND ${noSofCondition}
               AND ${inStoreCondition}
               AND (${notInContract})
             ORDER BY COALESCE(d.CI_Name, d.Asset_Number, d.Did) ASC`;
      params = [siteId];
    } else {
      sql = `SELECT d.Did, d.CI_Name, d.Asset_Number, d.Asset_State, d.serial, d.SLid, d.Dtypeid, d.DeRoleid, d.Refer_SOF
             FROM devices d
             WHERE d.SLid = 2
               AND ${noSofCondition}
               AND ${inStoreCondition}
               AND (${notInContract})
             ORDER BY COALESCE(d.CI_Name, d.Asset_Number, d.Did) ASC`;
      params = [];
    }
    
    const [rows] = await db.execute(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting devices (no SOF):', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Devices ที่ยังไม่มี SOF',
      error: error.message
    });
  }
};

const getDevicesBySite = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ site'
      });
    }
    // TccStock: devices.SLid -> sites_location.SLid
    const [rows] = await db.execute(
      `SELECT Did, CI_Name, Asset_Number, Asset_State, serial, SLid, Dtypeid, DeRoleid
       FROM devices
       WHERE SLid = ?
       ORDER BY COALESCE(CI_Name, Asset_Number, Did) ASC`,
      [siteId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting devices by site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Devices ตาม Site',
      error: error.message
    });
  }
};

// GET - ดึง Devices ตาม Asset_State (เช่น In Store, In Store On Site) สำหรับ MA
const getDevicesByAssetState = async (req, res) => {
  try {
    const statesParam = req.query.states || 'In Store';
    const search = req.query.search || '';
    const states = statesParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (states.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ states อย่างน้อย 1 ค่า'
      });
    }

    const placeholders = states.map(() => '?').join(', ');
    const params = [...states];
    let searchSql = '';

    if (search) {
      const searchPattern = `%${search}%`;
      searchSql = `AND (
        CI_Name LIKE ? OR
        Asset_Number LIKE ? OR
        serial LIKE ?
      )`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const sql = `
      SELECT Did, CI_Name, Asset_Number, Asset_State, serial, SLid, Dtypeid, DeRoleid
      FROM devices
      WHERE Asset_State IN (${placeholders})
      ${searchSql}
      ORDER BY COALESCE(CI_Name, Asset_Number, Did) ASC
      LIMIT 200
    `;

    const [rows] = await db.execute(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting devices by asset state:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Devices ตาม Asset_State',
      error: error.message
    });
  }
};

// GET - ดึง Devices ที่เป็น "In Store" และ filter ตาม Dtypeid และ DeRoleid (สำหรับ Replacement Device)
const getReplacementDevices = async (req, res) => {
  try {
    const { dtypeid, deroleid } = req.query;

    if (!dtypeid || !deroleid) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ dtypeid และ deroleid'
      });
    }

    const sql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        d.Dtypeid,
        d.DeRoleid,
        d.SLid,
        s.Name AS SiteName
      FROM devices d
      LEFT JOIN sites s ON d.SLid = s.Sid
      WHERE d.Asset_State = 'In Store'
        AND d.Dtypeid = ?
        AND d.DeRoleid = ?
      ORDER BY d.CI_Name ASC, d.Asset_Number ASC
      LIMIT 100
    `;

    const [rows] = await db.execute(sql, [parseInt(dtypeid, 10), parseInt(deroleid, 10)]);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting replacement devices:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Replacement Devices',
      error: error.message
    });
  }
};

// GET - ดูประวัติการเปลี่ยนแปลงของ Devices ทั้งหมด (พร้อมข้อมูล Device)
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
      whereConditions.push('dh.Action = ?');
      params.push(action.toUpperCase());
    }

    // Filter by device ID
    if (deviceId) {
      whereConditions.push('dh.Did = ?');
      params.push(deviceId);
    }

    // Search condition
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions.push(`(
        d.CI_Name LIKE ? OR 
        d.Asset_Number LIKE ? OR 
        d.serial LIKE ? OR 
        dt.model LIKE ? OR 
        m.name LIKE ? OR
        s.Name LIKE ?
      )`);
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // นับจำนวน records ทั้งหมด
    const countSql = `SELECT COUNT(*) as total 
                      FROM devices_history dh
                      JOIN devices d ON dh.Did = d.Did
                      JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                      JOIN manufacturer m ON dt.Mid = m.Mid
                      LEFT JOIN sites s ON d.Sid = s.Sid
                      ${whereClause}`;
    const [countResult] = await db.execute(countSql, params);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // ดึงข้อมูลประวัติพร้อมข้อมูล Device
    const sql = `SELECT 
                  dh.Historyid,
                  dh.Did,
                  dh.Action,
                  dh.Old_Value,
                  dh.New_Value,
                  dh.Changed_Fields,
                  dh.Created_At,
                  dh.User,
                  d.Asset_State,
                  d.serial,
                  d.CI_Name,
                  d.Asset_Number,
                  d.PR_No,
                  d.Vendor,
                  d.Project,
                  d.Location2,
                  dt.model,
                  m.name AS manufacturername,
                  s.Name AS Sitename
                  FROM devices_history dh
                  JOIN devices d ON dh.Did = d.Did
                  JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
                  JOIN manufacturer m ON dt.Mid = m.Mid
                  LEFT JOIN sites s ON d.Sid = s.Sid
                  ${whereClause}
                  ORDER BY dh.Created_At DESC
                  LIMIT ? OFFSET ?`;

    const [rows] = await db.execute(sql, [...params, limit, offset]);

    // Parse Changed_Fields JSON
    const history = rows.map(row => ({
      Historyid: row.Historyid,
      Did: row.Did,
      Action: row.Action,
      Old_Value: row.Old_Value,
      New_Value: row.New_Value,
      Changed_Fields: row.Changed_Fields ? JSON.parse(row.Changed_Fields) : null,
      Created_At: row.Created_At,
      User: row.User,
      Device: {
        Asset_State: row.Asset_State,
        serial: row.serial,
        CI_Name: row.CI_Name,
        Asset_Number: row.Asset_Number,
        PR_No: row.PR_No,
        Vendor: row.Vendor,
        
     
        model: row.model,
        manufacturername: row.manufacturername,
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
const getDeviceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.query; // Filter by action (INSERT, UPDATE, ASSET_STATE_CHANGE)

    // ตรวจสอบว่า Device มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Did FROM devices WHERE Did = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล Device'
      });
    }

    // สร้าง WHERE condition สำหรับ filter action
    let actionCondition = '';
    let params = [id];

    if (action && ['INSERT', 'UPDATE', 'ASSET_STATE_CHANGE'].includes(action.toUpperCase())) {
      actionCondition = 'AND Action = ?';
      params.push(action.toUpperCase());
    }

    // ดึงประวัติ
    const sql = `SELECT 
                  Historyid, Did, Action, Old_Value, New_Value, 
                  Changed_Fields, Created_At, User
                  FROM devices_history
                  WHERE Did = ? ${actionCondition}
                  ORDER BY Created_At DESC`;

    const [rows] = await db.execute(sql, params);

    // Parse Changed_Fields JSON
    const history = rows.map(row => ({
      ...row,
      Changed_Fields: row.Changed_Fields ? JSON.parse(row.Changed_Fields) : null
    }));

    res.status(200).json({
      success: true,
      count: history.length,
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
// GET - ดึง Devices พร้อม PM Information สำหรับ Asset & Site Database
const getDevicesWithPM = async (req, res) => {
  try {
    console.log('[getDevicesWithPM] Request received:', {
      search: req.query.search,
      deviceType: req.query.DeRoleid,
      site: req.query.site

    });

    const search = req.query.search || '';
    const filterDeviceRole = req.query.deviceRole || '';
    const filterSite = req.query.site || '';

    // Build search condition
    let searchCondition = '';
    let searchParams = [];

    if (search) {
      const searchPattern = `%${search}%`;
      searchCondition = `AND (
        devices.CI_Name LIKE ? OR 
        devices.Asset_Number LIKE ? OR 
        devices.serial LIKE ? OR 
        devices.Vendor LIKE ? OR
        sites.Name LIKE ?
      )`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // Build device role filter
    let deviceRoleCondition = '';
    if (filterDeviceRole && filterDeviceRole !== 'all') {
      deviceRoleCondition = 'AND device_role.name = ?';
      searchParams.push(filterDeviceRole);
    }

    // Build site filter
    let siteCondition = '';
    if (filterSite && filterSite !== 'all') {
      siteCondition = 'AND sites.Name = ?';
      searchParams.push(filterSite);
    }
// yyyyyyydqw
     console.log('BBBB');

    // Get devices that exist in contract_device table
    // Note: Devices table uses SLid (not Sid) to reference Sites
    // Use device_role.name instead of device_type.model
    const devicesSql = `
      SELECT DISTINCT
        devices.Did,
        devices.CI_Name,
        devices.Asset_Number,
        devices.Asset_State,
        devices.serial,
        devices.Vendor,
        devices.SLid,
        location.Province,        
        devices.Dtypeid,
        devices.DeRoleid,
        device_role.name AS DeviceRole,
        sites.Name AS SiteName,
        location.Province,
        contract_device.contract_id
      FROM contract_device
      INNER JOIN devices ON contract_device.device_id = devices.Did
      LEFT JOIN device_role ON devices.DeRoleid = device_role.DeRoleid
      LEFT JOIN location ON location.Province = location.Province
      LEFT JOIN sites ON devices.SLid = sites.Sid WHERE 1=1 
      ${searchCondition} 
      ${deviceRoleCondition} 
      ${siteCondition}
       ORDER BY devices.Did DESC`;
    const [devices] = await db.execute(devicesSql, searchParams);

    // Get all PM tasks (task_type = 'PM')
    const [pmTasks] = await db.execute(`
      SELECT id, assets, start_date, end_date, status, engineers, notes
      FROM tasks
      WHERE task_type = 'PM'
      ORDER BY start_date DESC
    `);

    console.log(`[getDevicesWithPM] Found ${pmTasks.length} PM tasks`);

    // Process devices and attach PM information
    const devicesWithPM = devices.map(device => {
      const deviceId = device.Did;

      // Find last PM (most recent completed PM task that includes this device)
      let lastPM = null;
      let lastPMTask = null;

      // Find next PM (future PM task that includes this device)
      let nextPM = null;

      // Find all PM history for this device
      const pmHistory = [];

      for (const task of pmTasks) {
        if (!task.assets) continue;

        try {
          const assets = typeof task.assets === 'string' ? JSON.parse(task.assets) : task.assets;
          if (!Array.isArray(assets)) continue;

          // Check if this device is in the task's assets
          const deviceInTask = assets.some(asset => {
            if (typeof asset === 'object') {
              // Try multiple possible field names
              const assetId = asset.id || asset.Did || asset.deviceId || asset.device_id;
              return assetId && String(assetId) === String(deviceId);
            } else {
              // If asset is a number/string directly
              return String(asset) === String(deviceId);
            }
          });

          if (deviceInTask) {
            const taskDate = task.start_date || task.end_date;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const taskDateObj = new Date(taskDate);
            taskDateObj.setHours(0, 0, 0, 0);

            // Last PM: most recent completed task before today
            if (task.status === 'done' && taskDateObj < today) {
              if (!lastPM || new Date(taskDate) > new Date(lastPM)) {
                lastPM = taskDate;
                lastPMTask = task;
              }
            }

            // Next PM: future task
            if (taskDateObj >= today) {
              if (!nextPM || new Date(taskDate) < new Date(nextPM)) {
                nextPM = taskDate;
              }
            }

            // PM History
            const engineers = task.engineers ? (typeof task.engineers === 'string' ? JSON.parse(task.engineers) : task.engineers) : [];
            const technicianName = engineers.length > 0
              ? (engineers[0].name || engineers[0].id || 'Unknown')
              : 'Unassigned';

            pmHistory.push({
              id: `PM${task.id}`,
              date: taskDate,
              status: task.status === 'done' ? 'Done' : task.status === 'working' ? 'In Progress' : task.status === 'stuck' ? 'Failed' : 'Scheduled',
              technician: technicianName,
              notes: task.notes || null
            });
          }
        } catch (error) {
          // Skip invalid JSON
          continue;
        }
      }

      // Sort PM history by date descending
      pmHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Use device_role.name as device role
      const deviceRoleName = device.DeviceRole || 'Unknown';

      return {
        deviceId: `AS${String(device.Did).padStart(3, '0')}`,
        deviceName: device.CI_Name || device.Asset_Number || `Device ${device.Did}`,
        deviceRole: deviceRoleName,
        site: device.SiteName || 'Unknown',
        location: device.Province || 'N/A',
        vendor: device.Vendor || 'Unknown',
        model: device.DeviceRole || 'Unknown',
        serialNumber: device.serial || 'N/A',
        lastPM: lastPM,
        nextPM: nextPM,
        pmHistory: pmHistory,
        status: device.Asset_State === 'In Use' || device.Asset_State === 'In Store On Site' ? 'Active' :
          device.Asset_State === 'In Store' ? 'Inactive' :
            device.Asset_State === 'Maintenance' ? 'Maintenance' : 'Active',
      };
    });

    console.log(`[getDevicesWithPM] Processed ${devicesWithPM.length} devices with PM info`);

    // Calculate statistics
    const totalDevices = devicesWithPM.length;
    const activeDevices = devicesWithPM.filter(d => d.status === 'Active').length;
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const upcomingPM = devicesWithPM.filter(d => {
      if (!d.nextPM) return false;
      const nextPMDate = new Date(d.nextPM);
      return nextPMDate <= thirtyDaysFromNow;
    }).length;

    console.log(`[getDevicesWithPM] Returning ${devicesWithPM.length} devices with statistics:`, {
      totalDevices,
      activeDevices,
      upcomingPM
    });

    res.status(200).json({
      success: true,
      data: devicesWithPM,
      statistics: {
        totalDevices,
        activeDevices,
        upcomingPM
      }
    });
  } catch (error) {
    console.error('[getDevicesWithPM] Error:', error);
    console.error('[getDevicesWithPM] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Devices พร้อม PM',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  createDevice,              // POST
  getDevices,                // GET (all with pagination)
  getDevicesExcludeInStore,  // GET (exclude "In Store")
  getDevicesExcludeOutStore, // GET (exclude "Out Store")
  getDeviceById,             // GET (by id)
  getDashboard,              // GET (dashboard statistics)
  getDevicesByModel,         // GET (grouped by model)
  getVendors,                // GET (distinct Project_purchase สำหรับ dropdown)
  getReferSOFList,           // GET (unique Refer_SOF values)
  getDevicesBySOFAndSite,    // GET (devices ตาม Refer_SOF และ site_id)
  getDevicesBySiteNoSOF,     // GET (devices ตาม site_id ที่ยังไม่มี SOF)
  getDevicesBySite,          // GET (devices ตาม site_id สำหรับ Asset Binding)
  getDevicesByAssetState,    // GET (devices ตาม Asset_State สำหรับ MA)
  getReplacementDevices,    // GET (devices In Store สำหรับ replacement ตาม Dtypeid และ DeRoleid)
  getDevicesWithPM,          // GET (devices with PM information for Asset & Site Database)
  viewDeviceHistory,         // GET (view all device history)
  getDeviceHistory,          // GET (device history by id)
  updateAssetState,          // PUT (update asset state - multiple)
  updateDevice,              // PUT
  deleteDevice               // DELETE
};

