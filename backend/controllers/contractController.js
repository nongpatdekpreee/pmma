const db = require('../config/database');

// POST /api/contracts/upload - อัปโหลดไฟล์หรือรูป เก็บ path
const uploadContractFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });
    }
    const path = `/uploads/contracts/${req.file.filename}`;
    res.status(200).json({ success: true, path });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message,
    });
  }
};

// POST - สร้าง Contract ใหม่ (ตรงตามตาราง contract ใน TccStock)
// ฟิลด์: contract_name, start_date, end_date, device_id, site_id(SLid), sof_name, sla_name, sale_account
const createContract = async (req, res) => {
  try {
    const {
      contract_name,
      start_date,
      end_date,
      device_id,
      device_ids,
      site_id,
      site_ids,
      site_device_pairs,
      sof_name,
      sof_id,
      assigned_service,
      sla_name,
      sla_term,
      sale_account,
      coverage_scope,
      file_paths,
      image_paths,
      pm_time_per_year,
      contract_sign_date,
      remark,
      old_contract_id,
      old_sof,
    } = req.body;

    // sla_term (int) หรือ sla_name (รองรับทั้งสอง)
    const slaTermVal = sla_term != null && sla_term !== ''
      ? (parseInt(sla_term, 10) || 1)
      : (sla_name != null && String(sla_name).trim() !== ''
        ? (parseInt(sla_name, 10) || 1)
        : null);
    if (slaTermVal === null) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก sla_term หรือ sla_name (required)'
      });
    }
    
    // site_device_pairs: [{ site_id, device_ids }] - แต่ละ site มี devices แยกกัน
    // หรือ device_ids + site_ids สำหรับ backward compatibility
    let deviceIdList = [];
    let siteIdList = [];
    let pairs = [];

    if (Array.isArray(site_device_pairs) && site_device_pairs.length > 0) {
      pairs = site_device_pairs
        .map((p) => ({
          site_id: p.site_id != null ? parseInt(p.site_id, 10) : null,
          device_ids: Array.isArray(p.device_ids)
            ? p.device_ids.map((d) => parseInt(d, 10)).filter((n) => !isNaN(n))
            : [],
        }))
        .filter((p) => p.site_id != null && !isNaN(p.site_id) && p.device_ids.length > 0);
      if (pairs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาเลือก Site และ Device อย่างน้อย 1 รายการในแต่ละ Site (site_id และ device_ids ต้องไม่ว่าง)',
        });
      }
      deviceIdList = [...new Set(pairs.flatMap((p) => p.device_ids))];
      siteIdList = [...new Set(pairs.map((p) => p.site_id))];
    } else {
      if (Array.isArray(device_ids) && device_ids.length > 0) {
        deviceIdList = [...new Set(device_ids.map((d) => parseInt(d, 10)).filter((n) => !isNaN(n)))];
      } else if (device_id != null && device_id !== '') {
        const single = parseInt(device_id, 10);
        if (!isNaN(single)) deviceIdList = [single];
      }
      if (Array.isArray(site_ids) && site_ids.length > 0) {
        siteIdList = [...new Set(site_ids.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)))];
      } else if (site_id != null && site_id !== '') {
        const single = parseInt(site_id, 10);
        if (!isNaN(single)) siteIdList = [single];
      }
    }
    const firstDeviceId = deviceIdList.length > 0 ? deviceIdList[0] : null;
    const siteId = siteIdList.length > 0 ? siteIdList[0] : null;

    // เช็คว่า device ที่เลือกมี contract อยู่แล้วหรือยัง (contract.device_id หรือ contract_device)
    // แต่ถ้าเป็นการต่อสัญญา (มี old_contract_id) ให้ข้ามการตรวจสอบนี้
    if (deviceIdList.length > 0 && !old_contract_id) {
      const placeholders = deviceIdList.map(() => '?').join(',');
      const [inContractCol] = await db.execute(
        `SELECT device_id FROM contract WHERE device_id IN (${placeholders}) AND device_id IS NOT NULL`,
        deviceIdList
      );
      const [inContractDevice] = await db.execute(
        `SELECT DISTINCT device_id FROM contract_device WHERE device_id IN (${placeholders})`,
        deviceIdList
      );
      const alreadyInContract = [
        ...new Set([
          ...(Array.isArray(inContractCol) ? inContractCol : []).map((r) => r.device_id),
          ...(Array.isArray(inContractDevice) ? inContractDevice : []).map((r) => r.device_id),
        ]),
      ].filter((id) => id != null);
      if (alreadyInContract.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'อุปกรณ์บางรายการผูกกับสัญญาอื่นแล้ว กรุณาเลือกเฉพาะอุปกรณ์ที่ยังไม่มีสัญญา',
          device_ids: alreadyInContract,
        });
      }
    }

    const filePathsJson = Array.isArray(file_paths)
      ? JSON.stringify(file_paths)
      : file_paths && String(file_paths).trim()
        ? String(file_paths).trim()
        : null;
    const imagePathsJson = Array.isArray(image_paths)
      ? JSON.stringify(image_paths)
      : image_paths && String(image_paths).trim()
        ? String(image_paths).trim()
        : null;

    const sofValue = (sof_id != null && sof_id !== '') ? String(sof_id).trim() : (sof_name && String(sof_name).trim() ? sof_name.trim() : null);
    const pmTime = pm_time_per_year != null && pm_time_per_year !== '' ? parseInt(pm_time_per_year, 10) : null;
    const signDate = contract_sign_date || null;
    const remarkVal = remark && String(remark).trim() ? remark.trim() : null;

    const assignedServiceVal = assigned_service && String(assigned_service).trim() ? assigned_service.trim() : null;
    const oldContractIdVal = old_contract_id != null && old_contract_id !== '' ? parseInt(old_contract_id, 10) : null;
    const oldSofVal = old_sof && String(old_sof).trim() ? old_sof.trim() : null;
    
    let insertCols = 'contract_name, start_date, end_date, device_id, site_id, sof_name, sla_term, Assigned_Service, sale_account, coverage_scope, file_paths, image_paths';
    let insertVals = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
    const insertParams = [
      contract_name && String(contract_name).trim() ? contract_name.trim() : null,
      start_date || null,
      end_date || null,
      firstDeviceId,
      siteId && !isNaN(siteId) ? siteId : null,
      sofValue,
      slaTermVal,
      assignedServiceVal,
      sale_account && String(sale_account).trim() ? sale_account.trim() : null,
      coverage_scope && String(coverage_scope).trim() ? coverage_scope.trim() : null,
      filePathsJson,
      imagePathsJson
    ];

    // เพิ่ม pm_time_per_year ถ้ามี column (ตาม schema)
    let insertContractSql = `INSERT INTO contract (${insertCols}) VALUES (${insertVals})`;
    try {
      const [pmCols] = await db.execute("SHOW COLUMNS FROM contract LIKE 'pm_time_per_year'");
      if (pmCols && pmCols.length > 0) {
        insertCols += ', pm_time_per_year';
        insertVals += ', ?';
        insertParams.push(isNaN(pmTime) ? 2 : pmTime); // default 2 ตาม schema
      }
    } catch (_) { /* ข้าม */ }

    insertContractSql = `INSERT INTO contract (${insertCols}) VALUES (${insertVals})`;
    try {
      const [cols] = await db.execute("SHOW COLUMNS FROM contract LIKE 'contract_sign_date'");
      if (cols && cols.length > 0) {
        insertContractSql = `INSERT INTO contract (${insertCols}, contract_sign_date, remark) VALUES (${insertVals}, ?, ?)`;
        insertParams.push(signDate, remarkVal);
      }
    } catch (_) { /* ข้าม */ }

    // TccStock (7): contract_device อาจมีแค่ (contract_id, device_id) ไม่มี SLid — ตรวจก่อน insert
    let contractDeviceHasSLid = false;
    try {
      const [cdCols] = await db.execute("SHOW COLUMNS FROM contract_device LIKE 'SLid'");
      contractDeviceHasSLid = cdCols && cdCols.length > 0;
    } catch (_) { /* ตารางไม่มีหรือ error ข้าม */ }

    let contractId;
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      // ถ้าเป็นการต่อสัญญา (มี old_contract_id) ให้ UPDATE แทน INSERT
      if (oldContractIdVal) {
        // ตรวจสอบว่าสัญญาเก่ามีอยู่จริง
        const [existingContract] = await conn.execute(
          'SELECT contract_id, sof_name, start_date, end_date FROM contract WHERE contract_id = ?',
          [oldContractIdVal]
        );

        if (existingContract.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            success: false,
            message: 'ไม่พบสัญญาเก่าที่ต้องการต่ออายุ'
          });
        }

        const oldContract = existingContract[0];
        const oldSofFromDb = oldContract.sof_name || oldSofVal;

        // สร้าง UPDATE statement
        const updateFields = [];
        const updateValues = [];

        if (contract_name) {
          updateFields.push('contract_name = ?');
          updateValues.push(contract_name.trim());
        }
        if (start_date) {
          updateFields.push('start_date = ?');
          updateValues.push(start_date);
        }
        if (end_date) {
          updateFields.push('end_date = ?');
          updateValues.push(end_date);
        }
        if (sofValue) {
          updateFields.push('sof_name = ?');
          updateValues.push(sofValue);
        }
        if (assignedServiceVal) {
          updateFields.push('Assigned_Service = ?');
          updateValues.push(assignedServiceVal);
        }
        if (sale_account) {
          updateFields.push('sale_account = ?');
          updateValues.push(sale_account.trim());
        }
        if (coverage_scope !== undefined) {
          updateFields.push('coverage_scope = ?');
          updateValues.push(coverage_scope ? coverage_scope.trim() : null);
        }
        if (filePathsJson !== undefined) {
          updateFields.push('file_paths = ?');
          updateValues.push(filePathsJson);
        }
        if (imagePathsJson !== undefined) {
          updateFields.push('image_paths = ?');
          updateValues.push(imagePathsJson);
        }
        if (pmTime !== null && pmTime !== undefined) {
          updateFields.push('pm_time_per_year = ?');
          updateValues.push(pmTime);
        }

        // เพิ่ม contract_sign_date และ remark ถ้ามี column
        try {
          const [cols] = await conn.execute("SHOW COLUMNS FROM contract LIKE 'contract_sign_date'");
          if (cols && cols.length > 0) {
            if (signDate !== null && signDate !== undefined) {
              updateFields.push('contract_sign_date = ?');
              updateValues.push(signDate);
            }
            if (remarkVal !== null && remarkVal !== undefined) {
              updateFields.push('remark = ?');
              updateValues.push(remarkVal);
            }
          }
        } catch (_) { /* ข้าม */ }

        if (updateFields.length === 0) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: 'ไม่มีข้อมูลที่จะอัพเดท'
          });
        }

        updateValues.push(oldContractIdVal);
        const updateSql = `UPDATE contract SET ${updateFields.join(', ')} WHERE contract_id = ?`;
        await conn.execute(updateSql, updateValues);

        contractId = oldContractIdVal;

        // อัพเดท contract_device (ลบเก่าและเพิ่มใหม่)
        // ลบ devices เก่าออก
        await conn.execute(
          'DELETE FROM contract_device WHERE contract_id = ?',
          [contractId]
        );

        // เพิ่ม devices ใหม่
        if (pairs.length > 0) {
          for (const p of pairs) {
            for (const did of p.device_ids) {
              if (contractDeviceHasSLid) {
                await conn.execute(
                  'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                  [contractId, did, p.site_id]
                );
              } else {
                await conn.execute(
                  'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
                  [contractId, did]
                );
              }
            }
          }
        } else if (deviceIdList.length > 0) {
          if (contractDeviceHasSLid) {
            const placeholders = deviceIdList.map(() => '?').join(',');
            const [deviceRows] = await conn.execute(
              `SELECT Did, SLid FROM devices WHERE Did IN (${placeholders})`,
              deviceIdList
            );
            const deviceSLidMap = new Map();
            (deviceRows || []).forEach((row) => deviceSLidMap.set(row.Did, row.SLid));
            for (const did of deviceIdList) {
              const deviceSLid = deviceSLidMap.get(did) ?? null;
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                [contractId, did, deviceSLid]
              );
            }
          } else {
            for (const did of deviceIdList) {
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
                [contractId, did]
              );
            }
          }
        }

        // อัพเดท contract_site
        await conn.execute(
          'DELETE FROM contract_site WHERE contract_id = ?',
          [contractId]
        );
        if (siteIdList.length > 0) {
          for (const slid of siteIdList) {
            await conn.execute(
              'INSERT INTO contract_site (contract_id, SLid) VALUES (?, ?)',
              [contractId, slid]
            );
          }
        }

        // บันทึกประวัติการต่อสัญญา (ใช้ contract_id เดิม)
        try {
          await conn.execute(
            'INSERT INTO contract_history (contract_id, old_contract_id, old_sof, new_sof, renewed_at) VALUES (?, ?, ?, ?, NOW())',
            [contractId, contractId, oldSofFromDb, sofValue]
          );
        } catch (historyErr) {
          console.error('Error saving contract history:', historyErr);
        }
      } else {
        // สร้างสัญญาใหม่ (ไม่มี old_contract_id)
        // 1. INSERT contract
        const [result] = await conn.execute(insertContractSql, insertParams);
        contractId = result.insertId;

        // 2. บันทึก contract_site (ทุก site ที่เลือก)
        if (siteIdList.length > 0) {
          for (const slid of siteIdList) {
            await conn.execute(
              'INSERT IGNORE INTO contract_site (contract_id, SLid) VALUES (?, ?)',
              [contractId, slid]
            );
          }
        }

        // 3. บันทึก contract_device (รองรับทั้งมี SLid และไม่มี SLid ตาม TccStock (7))
        if (pairs.length > 0) {
          for (const p of pairs) {
            for (const did of p.device_ids) {
              if (contractDeviceHasSLid) {
                await conn.execute(
                  'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                  [contractId, did, p.site_id]
                );
              } else {
                await conn.execute(
                  'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
                  [contractId, did]
                );
              }
            }
          }
        } else if (deviceIdList.length > 0) {
          if (contractDeviceHasSLid) {
            const placeholders = deviceIdList.map(() => '?').join(',');
            const [deviceRows] = await conn.execute(
              `SELECT Did, SLid FROM devices WHERE Did IN (${placeholders})`,
              deviceIdList
            );
            const deviceSLidMap = new Map();
            (deviceRows || []).forEach((row) => deviceSLidMap.set(row.Did, row.SLid));
            for (const did of deviceIdList) {
              const deviceSLid = deviceSLidMap.get(did) ?? null;
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                [contractId, did, deviceSLid]
              );
            }
          } else {
            for (const did of deviceIdList) {
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
                [contractId, did]
              );
            }
          }
        }
      }

      await conn.commit();
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); } catch (e) { /* ignore */ }
      }
      throw err;
    } finally {
      if (conn) conn.release();
    }

    res.status(201).json({
      success: true,
      message: oldContractIdVal ? 'ต่อสัญญาสำเร็จ' : 'สร้าง Contract สำเร็จ',
      data: { contract_id: contractId }
    });
  } catch (error) {
    console.error('Error creating contract:', error);

    let message = 'Error creating contract';
    if (error.code === 'ER_NO_SUCH_TABLE') {
      if (String(error.message || '').includes('contract_site')) {
        message = 'contract_site table does not exist, please run add_contract_site.sql';
      } else if (String(error.message || '').includes('contract_device')) {
        message = 'contract_device table does not exist, please run add_contract_device_table.sql';
      } else if (String(error.message || '').includes('contract')) {
        message = 'contract table does not exist, please run SQL to create the table in the database';
      }
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      const errMsg = String(error.message || '');
      if (errMsg.includes('file_paths') || errMsg.includes('image_paths')) {
        message = 'file_paths or image_paths column does not exist, please run add_contract_file_image_paths.sql';
      } else if (errMsg.includes('coverage_scope')) {
        message = 'coverage_scope column does not exist, please run: ALTER TABLE contract ADD COLUMN coverage_scope TEXT DEFAULT NULL;';
      } else if (errMsg.includes('contract_device') && errMsg.includes('SLid')) {
        message = 'ตาราง contract_device ยังไม่มีคอลัมน์ SLid — รัน migrations/apply_tccstock7_compat.sql หรือ ALTER TABLE contract_device ADD COLUMN SLid INT(11) DEFAULT NULL AFTER device_id;';
      } else {
        message = `คอลัมน์ในตารางไม่ตรงกับที่ระบบใช้: ${errMsg}`;
      }
    }

    res.status(500).json({
      success: false,
      message,
      error: error.message
    });
  }
};

// GET - ดึง Contracts: ไม่ส่ง site_id = ดึงทั้งหมด; ส่ง site_id = กรองตาม site
const getContractsBySite = async (req, res) => {
  try {
    const siteId = req.query.site_id;

    // TccStock (7): contract.site_id = sites_location.SLid; site name มาจาก sites ผ่าน sites_location
    const baseSelect = `
      SELECT DISTINCT
        c.contract_id,
        c.contract_name,
        c.start_date,
        c.end_date,
        c.site_id,
        c.sla_term,
        c.sale_account,
        c.sof_name,
        s.Name AS site_name
      FROM contract c
      LEFT JOIN sites_location sl ON c.site_id = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN contract_device cd ON c.contract_id = cd.contract_id
      LEFT JOIN devices d ON cd.device_id = d.Did
      LEFT JOIN contract_site cs ON c.contract_id = cs.contract_id
    `;

    let sql;
    let params = [];

    if (siteId) {
      const siteIdNum = parseInt(siteId, 10);
      sql = `${baseSelect} WHERE c.site_id = ? OR d.SLid = ? OR cs.SLid = ? ORDER BY c.contract_id DESC`;
      params = [siteIdNum, siteIdNum, siteIdNum];
    } else {
      sql = `${baseSelect} ORDER BY c.contract_id DESC`;
    }

    const [rows] = await db.execute(sql, params);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting contracts by site:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Contracts ตาม Site',
      error: error.message
    });
  }
};

// GET - ดึง Devices ที่ไม่มี Contract (แสดงเฉพาะ device ที่ไม่มี contract ใน contract_device)
// รองรับ site_id (optional) เพื่อกรองตาม site
const getAvailableDevices = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    
    let whereCondition = 'WHERE d.Did NOT IN (SELECT DISTINCT device_id FROM contract_device WHERE device_id IS NOT NULL)';
    const params = [];

    if (siteId) {
      whereCondition += ' AND d.SLid = ?';
      params.push(parseInt(siteId, 10));
    }

    // TccStock (7): devices.SLid = sites_location.SLid; site name จาก sites ผ่าน sites_location
    const sql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        d.SLid,
        s.Name AS SiteName
      FROM devices d
      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      ${whereCondition}
      ORDER BY d.CI_Name ASC, d.Asset_Number ASC;
    `;

    const [rows] = await db.execute(sql, params);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting available devices:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Devices ที่ไม่มี Contract',
      error: error.message
    });
  }
};

// GET - ดึง Devices ที่ผูกกับ Contract (จาก contract_device)
const getDevicesByContract = async (req, res) => {
  try {
    const contractId = req.params.id;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ contract_id'
      });
    }

    // TccStock (7): SLid = sites_location.SLid; site name จาก sites ผ่าน sites_location
    const sql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        d.SLid,
        d.Dtypeid,
        d.DeRoleid,
        s.Name AS SiteName
      FROM contract_device cd
      INNER JOIN devices d ON cd.device_id = d.Did
      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      WHERE cd.contract_id = ?
      ORDER BY d.CI_Name ASC, d.Asset_Number ASC;
    `;

    const [rows] = await db.execute(sql, [parseInt(contractId, 10)]);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting devices by contract:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Devices ตาม Contract',
      error: error.message
    });
  }
};

// GET - ดึง Vendor Statistics จาก Devices ที่มี Contract
const getVendorStatistics = async (req, res) => {
  try {
    const sql = `
      SELECT 
        d.Vendor,
        COUNT(DISTINCT cd.contract_id) as contract_count,
        COUNT(DISTINCT cd.device_id) as device_count,
        COUNT(DISTINCT d.SLid) as site_count
      FROM contract_device cd
      INNER JOIN devices d ON cd.device_id = d.Did
      WHERE d.Vendor IS NOT NULL AND d.Vendor != ''
      GROUP BY d.Vendor
      ORDER BY contract_count DESC, d.Vendor ASC
    `;

    const [rows] = await db.execute(sql);

    // Format data for chart
    const vendorData = rows.map((row) => ({
      name: row.Vendor,
      value: row.contract_count,
      deviceCount: row.device_count,
      siteCount: row.site_count,
      total: row.contract_count, // For chart display, can be adjusted if needed
    }));

    res.status(200).json({
      success: true,
      data: vendorData
    });
  } catch (error) {
    console.error('Error getting vendor statistics:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Vendor Statistics',
      error: error.message
    });
  }
};

// GET - ดึงประวัติการต่อสัญญา (contract_history)
const getContractHistory = async (req, res) => {
  try {
    const contractId = req.params.id;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ contract_id'
      });
    }

    const sql = `
      SELECT 
        ch.history_id,
        ch.contract_id,
        ch.old_contract_id,
        ch.old_sof,
        ch.new_sof,
        ch.renewed_at,
        ch.created_at,
        c_old.sof_name AS old_contract_sof,
        c_old.contract_name AS old_contract_name,
        c_old.start_date AS old_start_date,
        c_old.end_date AS old_end_date,
        c_new.sof_name AS new_contract_sof,
        c_new.contract_name AS new_contract_name
      FROM contract_history ch
      LEFT JOIN contract c_old ON ch.old_contract_id = c_old.contract_id
      LEFT JOIN contract c_new ON ch.contract_id = c_new.contract_id
      WHERE ch.contract_id = ? OR ch.old_contract_id = ?
      ORDER BY ch.renewed_at DESC
    `;

    const [rows] = await db.execute(sql, [parseInt(contractId, 10), parseInt(contractId, 10)]);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting contract history:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงประวัติการต่อสัญญา',
      error: error.message
    });
  }
};

module.exports = { createContract, uploadContractFile, getContractsBySite, getAvailableDevices, getDevicesByContract, getVendorStatistics, getContractHistory };
