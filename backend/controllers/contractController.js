const db = require('../config/database');

// Helper function - สร้าง contract_id ถัดไปโดยอัตโนมัติ (ใช้เลขที่ว่างก่อน)
const generateNextContractId = async () => {
  try {
    // ดึง contract_id ทั้งหมดจาก database
    const sql = `SELECT contract_id FROM contract ORDER BY contract_id DESC`;
    const [rows] = await db.execute(sql);
    
    if (rows.length === 0) {
      // ถ้ายังไม่มีข้อมูลเลย ให้เริ่มที่ 1
      return 1;
    }
    
    // แปลง contract_id ทั้งหมดเป็นตัวเลขและเก็บไว้ใน array
    const numericIds = [];
    for (const row of rows) {
      const contractId = row.contract_id;
      // contract_id เป็น INT แล้ว
      if (contractId != null && !isNaN(contractId)) {
        const num = parseInt(contractId, 10);
        if (!isNaN(num)) {
          numericIds.push(num);
        }
      }
    }
    
    if (numericIds.length === 0) {
      // ถ้าไม่มี contract_id ที่เป็นตัวเลขเลย ให้เริ่มที่ 1
      return 1;
    }
    
    // เรียงลำดับตัวเลขจากน้อยไปมาก
    numericIds.sort((a, b) => a - b);
    
    // หาเลขที่ว่างที่น้อยที่สุด (gap filling)
    // เริ่มจาก 1 ไปจนถึง max + 1
    const maxId = Math.max(...numericIds);
    
    // สร้าง Set เพื่อหาง่ายขึ้น
    const idSet = new Set(numericIds);
    
    // หาเลขที่ว่างที่น้อยที่สุด
    for (let i = 1; i <= maxId; i++) {
      if (!idSet.has(i)) {
        console.log(`Found gap: using contract_id ${i} (max was: ${maxId})`);
        return i;
      }
    }
    
    // ถ้าไม่มีเลขว่างแล้ว ให้ใช้เลขถัดไปจาก max
    const nextId = maxId + 1;
    console.log(`No gaps found: using next contract_id ${nextId} (max was: ${maxId})`);
    return nextId;
  } catch (error) {
    console.error('Error generating next contract_id:', error);
    throw error;
  }
};

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
// ฟิลด์: contract_name, start_date, end_date, device_id, site_id(SLid), sof_name, sla_term, sla_detail, sale_account
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
      email_acc,
      tel_acc,
      status,
    } = req.body;

    const contractStatus = (status === 'draft' || status === 'official') ? status : 'official';

    // ถ้าไม่ใช่ draft ต้องกรอก sla_term เสมอ
    if (contractStatus !== 'draft') {
      if (!sla_term || !String(sla_term).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please enter sla_term (required)'
        });
      }
    }

    // ดักรูปแบบ Email และ Telephone
    const emailVal = email_acc != null ? String(email_acc).trim() : '';
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรูปแบบ Email ให้ถูกต้อง (เช่น example@domain.com)'
      });
    }
    const telVal = tel_acc != null ? String(tel_acc).trim() : '';
    if (telVal) {
      const digitsOnly = telVal.replace(/\D/g, '');
      if (digitsOnly.length < 9 || digitsOnly.length > 15) {
        return res.status(400).json({
          success: false,
          message: 'กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง (อย่างน้อย 9 หลัก)'
        });
      }
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
        .filter((p) => p.site_id != null && !isNaN(p.site_id) && (p.device_ids.length > 0 || contractStatus === 'draft'));
      if (pairs.length === 0 && contractStatus !== 'draft') {
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
    const signDate = contract_sign_date || null;
    const assignedServiceVal = assigned_service && String(assigned_service).trim() ? assigned_service.trim() : '';
    const pmTimeVal = pm_time_per_year != null && String(pm_time_per_year).trim() !== '' ? String(pm_time_per_year).trim() : null;
    const pmTimeEnum = pmTimeVal && ['1', '2', '3', '4', '5'].includes(pmTimeVal) ? pmTimeVal : '2';
    const pmTime = pmTimeEnum ? parseInt(pmTimeEnum, 10) : null;
    const remarkVal = remark && String(remark).trim() ? remark.trim() : null;
    const oldContractIdVal = old_contract_id != null && old_contract_id !== '' ? parseInt(old_contract_id, 10) : null;
    const oldSofVal = old_sof && String(old_sof).trim() ? old_sof.trim() : null;

    // app_db: contract มี sla_term int(255) NOT NULL, ไม่มี sla_detail
    const slaTermInt = (() => {
      const v = sla_term != null && String(sla_term).trim() !== '' ? parseInt(String(sla_term).trim(), 10) : NaN;
      return isNaN(v) ? 2 : v;
    })();

    // สร้าง contract_id ใหม่โดยอัตโนมัติ (ใช้เลขที่ว่างก่อน)
    const newContractId = await generateNextContractId();
    
    // ตรวจสอบว่า contract_id นี้มีอยู่แล้วหรือไม่ (ป้องกัน race condition)
    const checkSql = `SELECT contract_id FROM contract WHERE contract_id = ?`;
    const [existing] = await db.execute(checkSql, [newContractId]);
    
    let finalContractId = newContractId;
    if (existing.length > 0) {
      // ถ้ามีแล้ว (อาจเกิดจาก race condition) ให้ลองหาใหม่
      finalContractId = await generateNextContractId();
      const [retryExisting] = await db.execute(checkSql, [finalContractId]);
      if (retryExisting.length > 0) {
        throw new Error('ไม่สามารถสร้าง contract_id ที่ไม่ซ้ำได้ กรุณาลองใหม่อีกครั้ง');
      }
    }

    const insertCols = 'contract_id, contract_name, start_date, end_date, device_id, site_id, sof_name, sla_term, Assigned_Service, sale_account, tel_acc, email_acc, coverage_scope, file_paths, image_paths';
    const insertVals = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
    const insertParams = [
      finalContractId,
      contract_name && String(contract_name).trim() ? contract_name.trim() : null,
      start_date || null,
      end_date || null,
      firstDeviceId,
      siteId && !isNaN(siteId) ? siteId : null,
      sofValue,
      slaTermInt,
      (assignedServiceVal && String(assignedServiceVal).trim()) ? assignedServiceVal.trim() : '',
      sale_account && String(sale_account).trim() ? sale_account.trim() : null,
      tel_acc != null && String(tel_acc).trim() !== '' ? String(tel_acc).trim() : null,
      email_acc != null && String(email_acc).trim() !== '' ? String(email_acc).trim() : '',
      coverage_scope && String(coverage_scope).trim() ? coverage_scope.trim() : null,
      filePathsJson,
      imagePathsJson
    ];

    // app_db: มี pm_time_per_year enum('1','2','3','4','5') NOT NULL DEFAULT '2'
    // contract_sign_date, remark อาจไม่มี (จาก add_contract_pm_sign_remark.sql)
    let insertContractSql = `INSERT INTO contract (${insertCols}) VALUES (${insertVals})`;
    try {
      const [pmCols] = await db.execute("SHOW COLUMNS FROM contract LIKE 'pm_time_per_year'");
      if (pmCols && pmCols.length > 0) {
        insertContractSql = `INSERT INTO contract (${insertCols}, pm_time_per_year) VALUES (${insertVals}, ?)`;
        insertParams.push(pmTimeEnum || '2');
      }
    } catch (_) { /* column ไม่มี ข้าม */ }
    try {
      const [statusCols] = await db.execute("SHOW COLUMNS FROM contract LIKE 'status'");
      if (statusCols && statusCols.length > 0) {
        insertContractSql = insertContractSql.replace(/\)\s*VALUES\s*\(/, ', status) VALUES (').replace(/\)\s*$/, ', ?)');
        insertParams.push(contractStatus);
      }
    } catch (_) { /* column ไม่มี ข้าม */ }


    // app_db: contract_device มีแค่ (contract_id, device_id) ไม่มี SLid
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
        if (sla_term != null && String(sla_term).trim() !== '') {
          const st = parseInt(String(sla_term).trim(), 10);
          if (!isNaN(st)) {
            updateFields.push('sla_term = ?');
            updateValues.push(st);
          }
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
        if (pmTimeEnum) {
          updateFields.push('pm_time_per_year = ?');
          updateValues.push(pmTimeEnum);
        }

        // เพิ่ม contract_sign_date และ remark ถ้ามี column
        try {
          const [cols] = await conn.execute("SHOW COLUMNS FROM contract LIKE 'contract_sign_date'");
          if (cols && cols.length > 0) {
            if (signDate !== null && signDate !== undefined) {
              updateFields.push('contract_sign_date = ?');
              updateValues.push(signDate);
            }
            if (remarkVal != null) {
              updateFields.push('remark = ?');
              updateValues.push(remarkVal);
            }
          }
        } catch (_) { /* ข้าม */ }

        if (status !== undefined && (status === 'draft' || status === 'official')) {
          updateFields.push('status = ?');
          updateValues.push(status);
        }

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

        // เพิ่ม devices ใหม่ (SLid อยู่ใน contract_device เท่านั้น)
        // draft: อนุญาต site โดยไม่มี device → insert (contract_id, NULL, SLid)
        if (pairs.length > 0) {
          for (const p of pairs) {
            const slid = p.site_id != null ? p.site_id : null;
            if (p.device_ids && p.device_ids.length > 0) {
              for (const did of p.device_ids) {
                await conn.execute(
                  'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                  [contractId, did, slid]
                );
              }
            } else if (status === 'draft' && slid != null) {
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, NULL, ?)',
                [contractId, slid]
              );
            }
          }
        } else if (deviceIdList.length > 0) {
          const defaultSlid = siteIdList.length > 0 ? siteIdList[0] : null;
          for (const did of deviceIdList) {
            await conn.execute(
              'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
              [contractId, did, defaultSlid]
            ).catch(() => conn.execute(
              'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
              [contractId, did]
            ));
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
        // 1. INSERT contract (ใช้ contract_id ที่สร้างไว้แล้ว)
        await conn.execute(insertContractSql, insertParams);
        contractId = finalContractId;

      // 2. บันทึก contract_device เท่านั้น (SLid อยู่ใน contract_device)
      // draft: อนุญาต site โดยไม่มี device → insert (contract_id, NULL, SLid)
      if (pairs.length > 0) {
        for (const p of pairs) {
          const slid = p.site_id != null ? p.site_id : null;
          if (p.device_ids && p.device_ids.length > 0) {
            for (const did of p.device_ids) {
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                [contractId, did, slid]
              );
            }
          } else if (contractStatus === 'draft' && slid != null) {
            await conn.execute(
              'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, NULL, ?)',
              [contractId, slid]
            );
          }
        }
      } else if (deviceIdList.length > 0) {
        const defaultSlid = siteIdList.length > 0 ? siteIdList[0] : null;
        for (const did of deviceIdList) {
          await conn.execute(
            'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
            [contractId, did, defaultSlid]
          ).catch(() => conn.execute(
            'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
            [contractId, did]
          ));
        }
      }

      // 4. & 5. อัปเดต devices (Assigned_Service, Refer_SOF) เฉพาะเมื่อไม่ใช่ draft — draft ยังไม่บันทึกลง devices
      if (contractStatus !== 'draft') {
        const assignedServiceValue = assigned_service && String(assigned_service).trim() ? assigned_service.trim() : null;
        if (assignedServiceValue && deviceIdList.length > 0) {
          const placeholders = deviceIdList.map(() => '?').join(',');
          await conn.execute(
            `UPDATE devices SET Assigned_Service = ? WHERE Did IN (${placeholders})`,
            [assignedServiceValue, ...deviceIdList]
          );
        }

        // SOF: บันทึก Refer_SOF ลง devices ของสัญญานี้เสมอเมื่อไม่ใช่ draft
        if (sofValue && deviceIdList.length > 0) {
          const placeholders = deviceIdList.map(() => '?').join(',');
          await conn.execute(
            `UPDATE devices SET Refer_SOF = ? WHERE Did IN (${placeholders})`,
            [sofValue, ...deviceIdList]
          );
        }
      }

      } // end else (สร้างสัญญาใหม่)

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
    if (String(error.message || '').includes('contract_device')) {
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
// ถ้า expand=sites คืนหนึ่งแถวต่อ (contract, site) สำหรับหน้า contract แบบตาราง
const getContractsBySite = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    const expandSites = req.query.expand === 'sites';

    if (expandSites) {
      // หนึ่งแถวต่อ contract-site: contract_id, contract_name, start_date, end_date, status, site_name, site_location, device_count
      const notExpired = ' (c.end_date IS NULL OR c.end_date >= CURDATE()) ';
      let sql = `
        SELECT c.contract_id, c.contract_name, c.start_date, c.end_date, c.status,
          s.Name AS site_name, l.Location2 AS site_location,
          COUNT(cd.device_id) AS device_count
        FROM contract c
        INNER JOIN contract_device cd ON c.contract_id = cd.contract_id AND cd.SLid IS NOT NULL
        INNER JOIN sites_location sl ON cd.SLid = sl.SLid
        LEFT JOIN sites s ON sl.Sid = s.Sid
        LEFT JOIN location l ON sl.lid = l.lid
        WHERE ${notExpired}
      `;
      const params = [];
      if (siteId) {
        const siteIdNum = parseInt(siteId, 10);
        if (!isNaN(siteIdNum)) {
          sql += ' AND (c.site_id = ? OR cd.SLid = ?)';
          params.push(siteIdNum, siteIdNum);
        }
      }
      sql += ` GROUP BY c.contract_id, c.contract_name, c.start_date, c.end_date, c.status, sl.SLid, s.Name, l.Location2
        UNION ALL
        SELECT c.contract_id, c.contract_name, c.start_date, c.end_date, c.status,
          NULL AS site_name, NULL AS site_location, 0 AS device_count
        FROM contract c
        LEFT JOIN (SELECT DISTINCT contract_id FROM contract_device WHERE SLid IS NOT NULL) cd ON c.contract_id = cd.contract_id
        WHERE ${notExpired}
        AND cd.contract_id IS NULL
      `;
      if (siteId) {
        const siteIdNum = parseInt(siteId, 10);
        if (!isNaN(siteIdNum)) {
          sql += ' AND c.site_id = ?';
          params.push(siteIdNum);
        }
      }
      sql += ' ORDER BY contract_id DESC, site_name IS NULL, site_name ASC';
      const [rows] = await db.execute(sql, params);
      return res.status(200).json({ success: true, data: rows });
    }

    // รูปแบบเดิม: หนึ่งแถวต่อ contract (site_name, site_location รวมหลาย site) — ใช้ JOIN แทน correlated subquery
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
        c.status,
        agg.site_name,
        agg.site_location,
        COALESCE(cnt.device_count, 0) AS device_count
      FROM contract c
      LEFT JOIN (
        SELECT contract_id,
          GROUP_CONCAT(site_name ORDER BY slid SEPARATOR '; ') AS site_name,
          GROUP_CONCAT(site_location ORDER BY slid SEPARATOR '; ') AS site_location
        FROM (
          SELECT DISTINCT cd.contract_id, sl.SLid AS slid, s.Name AS site_name, IFNULL(l.Location2, '') AS site_location
          FROM contract_device cd
          INNER JOIN sites_location sl ON cd.SLid = sl.SLid
          LEFT JOIN sites s ON sl.Sid = s.Sid
          LEFT JOIN location l ON sl.lid = l.lid
          WHERE cd.SLid IS NOT NULL
        ) x
        GROUP BY contract_id
      ) agg ON c.contract_id = agg.contract_id
      LEFT JOIN (SELECT contract_id, COUNT(*) AS device_count FROM contract_device GROUP BY contract_id) cnt ON c.contract_id = cnt.contract_id
      LEFT JOIN contract_device cd ON c.contract_id = cd.contract_id
      LEFT JOIN devices d ON cd.device_id = d.Did
    `;
    let params = [];
    let sql;

    const notExpiredCondition = ' (c.end_date IS NULL OR c.end_date >= CURDATE()) ';
    if (siteId) {
      const siteIdNum = parseInt(siteId, 10);
      sql = `${baseSelect} WHERE (c.site_id = ? OR d.SLid = ? OR cd.SLid = ?) AND ${notExpiredCondition} ORDER BY c.contract_id DESC`;
      params = [siteIdNum, siteIdNum, siteIdNum];
    } else {
      sql = `${baseSelect} WHERE ${notExpiredCondition} ORDER BY c.contract_id DESC`;
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
      message: 'No have any Contract',
      error: error.message
    });
  }
};

// GET - ดึง Devices ที่ไม่มี Contract (แสดงเฉพาะ device ที่ไม่มี contract ใน contract_device)
// รองรับ site_id (optional) เพื่อกรองตาม site
// เมื่อส่ง contract_id (edit contract): เฉพาะ device ที่ยังไม่มี SOF (Refer_SOF ว่าง) และอยู่ที่ SLid = 2
const getAvailableDevices = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    const contractId = req.query.contract_id; // สำหรับกรณี edit contract
    
    // กรอง devices ที่มี contract อื่น (แต่ไม่รวม contract ปัจจุบันถ้ามี contract_id)
    let excludeContractCondition = 'SELECT DISTINCT device_id FROM contract_device WHERE device_id IS NOT NULL';
    const params = [];
    
    if (contractId) {
      const cid = parseInt(contractId, 10);
      if (!isNaN(cid)) {
        excludeContractCondition += ' AND contract_id != ?';
        params.push(cid);
      }
    }
    
    let whereCondition = `WHERE d.Did NOT IN (${excludeContractCondition})`;

    // ตอน edit contract: เฉพาะ device ที่ยังไม่มี SOF และอยู่ที่ SLid = 2 (ไม่กรอง site_id)
    if (contractId) {
      whereCondition += ' AND (d.Refer_SOF IS NULL OR d.Refer_SOF = \'\') AND d.SLid = 2';
    } else if (siteId) {
      const sid = parseInt(siteId, 10);
      if (!isNaN(sid)) {
        whereCondition += ' AND d.SLid = ?';
        params.push(sid);
      }
    }

    // TccStock (7): devices.SLid = sites_location.SLid; ดึง type (model) และ role จาก database
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
        s.Name AS SiteName,
        dt.model AS model,
        dt.model AS type,
        dr.name AS roleName
      FROM devices d
      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
      LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid
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

// GET - ดึง Sites ที่ผูกกับ Contract (จาก contract_device.SLid เท่านั้น)
const getSitesByContract = async (req, res) => {
  try {
    const contractId = req.params.id;
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ contract_id'
      });
    }

    const cid = parseInt(contractId, 10);
    if (isNaN(cid)) {
      return res.status(400).json({
        success: false,
        message: 'contract_id ไม่ถูกต้อง'
      });
    }

    // ดึง sites จาก contract_device.SLid เท่านั้น (ไม่ใช้ contract_site)
    const sql = `
      SELECT DISTINCT sl.SLid, s.Name AS SiteName, l.Location2
      FROM contract_device cd
      INNER JOIN sites_location sl ON cd.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE cd.contract_id = ? AND cd.SLid IS NOT NULL
      ORDER BY s.Name, l.Location2
    `;

    const [rows] = await db.execute(sql, [cid]);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting sites by contract:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Sites ตามสัญญา',
      error: error.message
    });
  }
};

// GET - ดึง Devices ที่ผูกกับ Contract (จาก contract_device)
// รองรับ query site_id (= SLid) เพื่อกรองเฉพาะ devices ที่ผูกกับ site นี้ในสัญญา (cd.SLid) หรืออยู่ที่ site นี้ (d.SLid)
const getDevicesByContract = async (req, res) => {
  try {
    const contractId = req.params.id;
    const siteId = req.query.site_id ? parseInt(req.query.site_id, 10) : null;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ contract_id'
      });
    }

    // TccStock (7): SLid = sites_location.SLid; ดึง type (model) และ role จาก database
    // เมื่อส่ง site_id มา: กรองเฉพาะ device ที่ผูกกับ site นี้ในสัญญา (cd.SLid) หรือ device อยู่ที่ site นี้ (d.SLid)
    let whereClause = 'WHERE cd.contract_id = ?';
    const params = [parseInt(contractId, 10)];
    if (siteId != null && !isNaN(siteId)) {
      whereClause += ' AND (cd.SLid = ? OR d.SLid = ?)';
      params.push(siteId, siteId);
    }

    const sql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        d.SLid,
        cd.SLid AS contract_SLid,
        d.Dtypeid,
        d.DeRoleid,
        s.Name AS SiteName,
        dt.model AS model,
        dt.model AS type,
        dr.name AS roleName
      FROM contract_device cd
      INNER JOIN devices d ON cd.device_id = d.Did
      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
      LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid
      ${whereClause}
      ORDER BY d.CI_Name ASC, d.Asset_Number ASC
    `;

    const [rows] = await db.execute(sql, params);

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
        history_id,
        contract_id,
        old_contract_id,
        old_sof,
        new_sof,
        renewed_at,
        created_at
      FROM contract_history
      WHERE contract_id = ? OR old_contract_id = ?
      ORDER BY renewed_at DESC, created_at DESC
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

// GET - ดึงข้อมูล Contract ทั้งหมดตาม contract_id (รวม devices, sites, และข้อมูลอื่นๆ)
const getContractById = async (req, res) => {
  try {
    const contractId = req.params.id;
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ contract_id'
      });
    }

    const cid = parseInt(contractId, 10);
    if (isNaN(cid)) {
      return res.status(400).json({
        success: false,
        message: 'contract_id ไม่ถูกต้อง'
      });
    }

    // ตรวจสอบว่ามี columns ที่อาจไม่มีหรือไม่
    const checkColumn = async (columnName) => {
      try {
        const [cols] = await db.execute(`SHOW COLUMNS FROM contract LIKE '${columnName}'`);
        return cols && cols.length > 0;
      } catch {
        return false;
      }
    };

    const hasCoverageScope = await checkColumn('coverage_scope');
    const hasFilePaths = await checkColumn('file_paths');
    const hasImagePaths = await checkColumn('image_paths');
    const hasPmTimePerYear = await checkColumn('pm_time_per_year');
    const hasSignDate = await checkColumn('contract_sign_date');
    const hasRemark = await checkColumn('remark');

    const contractFields = [
      'c.contract_id',
      'c.contract_name',
      'c.start_date',
      'c.end_date',
      'c.site_id',
      'c.sla_term',
      'c.sale_account',
      'c.sof_name',
      'c.Assigned_Service',
      's.Name AS site_name'
    ];
    
    const hasStatus = await checkColumn('status');
    if (hasStatus) contractFields.push('c.status');
    const hasTelAcc = await checkColumn('tel_acc');
    if (hasTelAcc) contractFields.push('c.tel_acc');
    const hasEmailAcc = await checkColumn('email_acc');
    if (hasEmailAcc) contractFields.push('c.email_acc');
    if (hasCoverageScope) contractFields.push('c.coverage_scope');
    if (hasFilePaths) contractFields.push('c.file_paths');
    if (hasImagePaths) contractFields.push('c.image_paths');
    if (hasPmTimePerYear) contractFields.push('c.pm_time_per_year');
    if (hasSignDate) contractFields.push('c.contract_sign_date');
    if (hasRemark) contractFields.push('c.remark');

    const contractSql = `
      SELECT 
        ${contractFields.join(',\n        ')}
      FROM contract c
      LEFT JOIN sites_location sl ON c.site_id = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      WHERE c.contract_id = ?
    `;

    const [contractRows] = await db.execute(contractSql, [cid]);
    
    if (contractRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสัญญา'
      });
    }

    const contract = contractRows[0];

    // ดึง devices (ใช้ cd.SLid = site ตอนทำสัญญาจาก contract_device ไม่ใช่ site ปัจจุบันของ device)
    const devicesSql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        d.SLid,
        cd.SLid AS contract_SLid,
        COALESCE(s_contract.Name, s.Name) AS SiteName,
        COALESCE(l_contract.Location2, l.Location2) AS Location2,
        d.Dtypeid,
        d.DeRoleid,
        dt.model AS type_name,
        dr.name AS roleName
      FROM contract_device cd
      INNER JOIN devices d ON cd.device_id = d.Did
      LEFT JOIN sites_location sl_contract ON cd.SLid = sl_contract.SLid
      LEFT JOIN sites s_contract ON sl_contract.Sid = s_contract.Sid
      LEFT JOIN location l_contract ON sl_contract.lid = l_contract.lid
      LEFT JOIN sites_location sl ON d.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      LEFT JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
      LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid
      WHERE cd.contract_id = ?
      ORDER BY COALESCE(cd.SLid, 999999), d.CI_Name ASC, d.Asset_Number ASC
    `;

    const [devicesRows] = await db.execute(devicesSql, [cid]);

    // ดึง sites จาก contract_device.SLid เท่านั้น
    const sitesSql = `
      SELECT DISTINCT sl.SLid, s.Name AS SiteName, l.Location2
      FROM contract_device cd
      INNER JOIN sites_location sl ON cd.SLid = sl.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE cd.contract_id = ? AND cd.SLid IS NOT NULL
      ORDER BY s.Name, l.Location2
    `;

    const [sitesRows] = await db.execute(sitesSql, [cid]);

    // ดึงประวัติการต่อสัญญา
    const historySql = `
      SELECT 
        history_id,
        contract_id,
        old_contract_id,
        old_sof,
        new_sof,
        renewed_at,
        created_at
      FROM contract_history
      WHERE contract_id = ? OR old_contract_id = ?
      ORDER BY renewed_at DESC, created_at DESC
    `;

    const [historyRows] = await db.execute(historySql, [cid, cid]);

    // รวมข้อมูลทั้งหมด
    const result = {
      ...contract,
      devices: devicesRows,
      sites: sitesRows,
      history: historyRows
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting contract by id:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสัญญา',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// PUT - อัปเดต Contract
const updateContract = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const contractId = req.params.id;
    const cid = parseInt(contractId, 10);
    if (isNaN(cid)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'contract_id ไม่ถูกต้อง'
      });
    }

    const {
      contract_name,
      start_date,
      end_date,
      site_device_pairs,
      sof_name,
      assigned_service,
      sla_term,
      sale_account,
      coverage_scope,
      file_paths,
      image_paths,
      pm_time_per_year,
      contract_sign_date,
      remark,
      status,
      email_acc,
      tel_acc,
    } = req.body;

    // ตรวจสอบว่ามี contract นี้หรือไม่
    const [existingContract] = await conn.execute(
      'SELECT contract_id FROM contract WHERE contract_id = ?',
      [cid]
    );

    if (existingContract.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสัญญา'
      });
    }

    // Validate SLA Term
    const contractStatus = (status === 'draft' || status === 'official') ? status : undefined;
    if (sla_term !== undefined && sla_term !== null) {
      const slaTermStr = String(sla_term).trim();
      // ถ้าไม่ใช่ draft และส่งค่า sla_term มา ต้องไม่ว่าง
      if (!slaTermStr && contractStatus !== 'draft') {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: 'Please enter sla_term (required)'
        });
      }
      if (slaTermStr) {
        const slaTermNum = parseFloat(slaTermStr);
        if (isNaN(slaTermNum) || slaTermNum < 0 || slaTermNum > 100) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: 'SLA Term must be a number between 0 and 100'
          });
        }
      }
    }

    // ดักรูปแบบ Email และ Telephone
    if (email_acc !== undefined && email_acc !== null) {
      const emailVal = String(email_acc).trim();
      if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: 'กรุณากรอกรูปแบบ Email ให้ถูกต้อง (เช่น example@domain.com)'
        });
      }
    }
    if (tel_acc !== undefined && tel_acc !== null) {
      const telVal = String(tel_acc).trim();
      if (telVal) {
        const digitsOnly = telVal.replace(/\D/g, '');
        if (digitsOnly.length < 9 || digitsOnly.length > 15) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: 'กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง (อย่างน้อย 9 หลัก)'
          });
        }
      }
    }

    // จัดการ site_device_pairs
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
      deviceIdList = [...new Set(pairs.flatMap((p) => p.device_ids))];
      siteIdList = [...new Set(pairs.map((p) => p.site_id))];
    }

    // สร้าง UPDATE statement
    const updateFields = [];
    const updateValues = [];

    if (contract_name !== undefined) {
      updateFields.push('contract_name = ?');
      updateValues.push(contract_name ? contract_name.trim() : null);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date || null);
    }
    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(end_date || null);
    }
    if (sof_name !== undefined) {
      updateFields.push('sof_name = ?');
      updateValues.push(sof_name ? sof_name.trim() : null);
    }
    if (sla_term !== undefined && sla_term !== null) {
      const st = parseFloat(String(sla_term).trim());
      if (!isNaN(st)) {
        updateFields.push('sla_term = ?');
        updateValues.push(st);
      }
    }
    if (assigned_service !== undefined) {
      updateFields.push('Assigned_Service = ?');
      updateValues.push(assigned_service ? assigned_service.trim() : null);
    }
    if (sale_account !== undefined) {
      updateFields.push('sale_account = ?');
      updateValues.push(sale_account ? sale_account.trim() : null);
    }
    if (tel_acc !== undefined) {
      updateFields.push('tel_acc = ?');
      updateValues.push(tel_acc != null && String(tel_acc).trim() !== '' ? String(tel_acc).trim() : null);
    }
    if (email_acc !== undefined) {
      updateFields.push('email_acc = ?');
      updateValues.push(email_acc != null && String(email_acc).trim() !== '' ? String(email_acc).trim() : '');
    }
    if (coverage_scope !== undefined) {
      updateFields.push('coverage_scope = ?');
      updateValues.push(coverage_scope ? coverage_scope.trim() : null);
    }
    if (file_paths !== undefined) {
      const filePathsJson = file_paths ? (typeof file_paths === 'string' ? file_paths : JSON.stringify(file_paths)) : null;
      updateFields.push('file_paths = ?');
      updateValues.push(filePathsJson);
    }
    if (image_paths !== undefined) {
      const imagePathsJson = image_paths ? (typeof image_paths === 'string' ? image_paths : JSON.stringify(image_paths)) : null;
      updateFields.push('image_paths = ?');
      updateValues.push(imagePathsJson);
    }
    if (pm_time_per_year !== undefined) {
      const pmTimeEnum = pm_time_per_year ? parseInt(String(pm_time_per_year), 10) : null;
      if (pmTimeEnum !== null && !isNaN(pmTimeEnum) && pmTimeEnum >= 1 && pmTimeEnum <= 5) {
        updateFields.push('pm_time_per_year = ?');
        updateValues.push(pmTimeEnum);
      }
    }

    // เพิ่ม contract_sign_date และ remark ถ้ามี column
    try {
      const [cols] = await conn.execute("SHOW COLUMNS FROM contract LIKE 'contract_sign_date'");
      if (cols && cols.length > 0) {
        if (contract_sign_date !== undefined) {
          updateFields.push('contract_sign_date = ?');
          updateValues.push(contract_sign_date || null);
        }
        if (remark !== undefined) {
          updateFields.push('remark = ?');
          updateValues.push(remark ? remark.trim() : null);
        }
      }
    } catch (_) { /* ข้าม */ }

    if (status !== undefined && (status === 'draft' || status === 'official')) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    // อัปเดต contract
    if (updateFields.length > 0) {
      updateValues.push(cid);
      const updateSql = `UPDATE contract SET ${updateFields.join(', ')} WHERE contract_id = ?`;
      await conn.execute(updateSql, updateValues);
    }

    // อัปเดต contract_device เท่านั้น (SLid อยู่ใน contract_device)
    if (site_device_pairs !== undefined) {
      if (pairs.length > 0) {
        await conn.execute(
          'DELETE FROM contract_device WHERE contract_id = ?',
          [cid]
        );
        for (const p of pairs) {
          const slid = p.site_id != null ? p.site_id : null;
          if (p.device_ids && p.device_ids.length > 0) {
            for (const did of p.device_ids) {
              await conn.execute(
                'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                [cid, did, slid]
              );
            }
          } else if (status === 'draft' && slid != null) {
            await conn.execute(
              'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, NULL, ?)',
              [cid, slid]
            );
          }
        }
      } else {
        await conn.execute(
          'DELETE FROM contract_device WHERE contract_id = ?',
          [cid]
        );
      }
    }

    // อัปเดต Assigned_Service และ Refer_SOF ใน devices เฉพาะเมื่อไม่ใช่ draft
    if (status !== 'draft' && deviceIdList.length > 0) {
      const placeholders = deviceIdList.map(() => '?').join(',');
      if (assigned_service != null && String(assigned_service).trim() !== '') {
        await conn.execute(
          `UPDATE devices SET Assigned_Service = ? WHERE Did IN (${placeholders})`,
          [assigned_service.trim(), ...deviceIdList]
        );
      }
      if (sof_name != null && String(sof_name).trim() !== '') {
        await conn.execute(
          `UPDATE devices SET Refer_SOF = ? WHERE Did IN (${placeholders})`,
          [sof_name.trim(), ...deviceIdList]
        );
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: 'อัปเดตสัญญาสำเร็จ',
      data: { contract_id: cid }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error updating contract:', error);
    let message = 'เกิดข้อผิดพลาดในการอัปเดตสัญญา';
    const errMsg = String(error.message || '');
    if (errMsg.includes('file_paths') || errMsg.includes('image_paths')) {
      message = 'file_paths or image_paths column does not exist';
    } else if (errMsg.includes('coverage_scope')) {
      message = 'coverage_scope column does not exist';
    } 
    res.status(500).json({
      success: false,
      message,
      error: error.message
    });
  } finally {
    conn.release();
  }
};
//
module.exports = { createContract, uploadContractFile, getContractsBySite, getAvailableDevices, getSitesByContract, getDevicesByContract, getVendorStatistics, getContractHistory, getContractById, updateContract };
