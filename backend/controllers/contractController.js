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
// ฟิลด์: contract_name, start_date, end_date, device_id, site_id(SLid), sof_name, sla_name, sla_detail, sale_account
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
      sla_name,
      sla_detail,
      sale_account,
      coverage_scope,
      file_paths,
      image_paths,
    } = req.body;

    if (!sla_name || !String(sla_name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter sla_name (required)'
      });
    }
    if (!sla_detail || !String(sla_detail).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter sla_detail (required)'
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
    if (deviceIdList.length > 0) {
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
          message: 'One or more devices are already under a contract',
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

    const [result] = await db.execute(
      `INSERT INTO contract (
        contract_name, start_date, end_date, device_id, site_id, sof_name, sla_name, sla_detail, sale_account, coverage_scope, file_paths, image_paths
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contract_name && String(contract_name).trim() ? contract_name.trim() : null,
        start_date || null,
        end_date || null,
        firstDeviceId,
        siteId && !isNaN(siteId) ? siteId : null,
        sof_name && String(sof_name).trim() ? sof_name.trim() : null,
        sla_name.trim(),
        sla_detail.trim(),
        sale_account && String(sale_account).trim() ? sale_account.trim() : null,
        coverage_scope && String(coverage_scope).trim() ? coverage_scope.trim() : null,
        filePathsJson,
        imagePathsJson,
      ]
    );

    const contractId = result.insertId;

    // บันทึกลง contract_device: แต่ละ device เก็บ SLid ของ site ที่ผู้ใช้เลือก
    // site_device_pairs: (contract_id, device_id, SLid) จาก site ที่เลือก
    // backward compat: ดึง SLid จาก Devices table
    if (pairs.length > 0) {
      for (const p of pairs) {
        for (const did of p.device_ids) {
          await db.execute(
            'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
            [contractId, did, p.site_id]
          );
        }
      }
    } else if (deviceIdList.length > 0) {
      const placeholders = deviceIdList.map(() => '?').join(',');
      const [deviceRows] = await db.execute(
        `SELECT Did, SLid FROM Devices WHERE Did IN (${placeholders})`,
        deviceIdList
      );
      const deviceSLidMap = new Map();
      deviceRows.forEach((row) => deviceSLidMap.set(row.Did, row.SLid));
      for (const did of deviceIdList) {
        const deviceSLid = deviceSLidMap.get(did) || null;
        await db.execute(
          'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
          [contractId, did, deviceSLid]
        );
      }
    }

    // บันทึกลง contract_site สำหรับทุก site ที่เลือก (1 contract มีได้หลาย site)
    // ต้องมีตาราง contract_site: รัน add_contract_site.sql ก่อน
    if (siteIdList.length > 0) {
      for (const slid of siteIdList) {
        await db.execute(
          'INSERT IGNORE INTO contract_site (contract_id, SLid) VALUES (?, ?)',
          [contractId, slid]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
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
    } else if (error.code === 'ER_BAD_FIELD_ERROR' && (String(error.message || '').includes('file_paths') || String(error.message || '').includes('image_paths'))) {
      message = 'file_paths or image_paths column does not exist, please run add_contract_file_image_paths.sql';
    } else if (error.code === 'ER_BAD_FIELD_ERROR' && String(error.message || '').includes('coverage_scope')) {
      message = 'coverage_scope column does not exist, please run: ALTER TABLE contract ADD COLUMN coverage_scope TEXT DEFAULT NULL;';
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      message = 'contract table does not match TccStock (must have sla_name, sla_detail, device_id, site_id)';
    }

    res.status(500).json({
      success: false,
      message,
      error: error.message
    });
  }
};

// GET - ดึง Contracts ตาม site_id
const getContractsBySite = async (req, res) => {
  try {
    const siteId = req.query.site_id;

    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ site_id'
      });
    }

    const sql = `
      SELECT DISTINCT
        c.contract_id,
        c.contract_name,
        c.start_date,
        c.end_date,
        c.site_id,
        c.sla_name,
        c.sla_detail,
        s.Name AS site_name
      FROM contract c
      LEFT JOIN Sites s ON c.site_id = s.Sid
      LEFT JOIN contract_device cd ON c.contract_id = cd.contract_id
      LEFT JOIN contract_site cs ON c.contract_id = cs.contract_id
      WHERE c.site_id = ? OR cd.SLid = ? OR cs.SLid = ?
      ORDER BY c.contract_id DESC
    `;

    const siteIdNum = parseInt(siteId, 10);
    const [rows] = await db.execute(sql, [siteIdNum, siteIdNum, siteIdNum]);

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

    const sql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        d.SLid,
        s.Name AS SiteName
      FROM Devices d
      LEFT JOIN sites s 
        ON d.SLid = s.Sid
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

    const sql = `
      SELECT 
        d.Did,
        d.CI_Name,
        d.Asset_Number,
        d.serial,
        d.Asset_State,
        COALESCE(cd.SLid, d.SLid) AS SLid,
        d.Dtypeid,
        d.DeRoleid,
        s.Name AS SiteName
      FROM contract_device cd
      INNER JOIN Devices d 
        ON cd.device_id = d.Did
      LEFT JOIN sites s 
        ON COALESCE(cd.SLid, d.SLid) = s.Sid
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
      INNER JOIN Devices d ON cd.device_id = d.Did
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

module.exports = { createContract, uploadContractFile, getContractsBySite, getAvailableDevices, getDevicesByContract, getVendorStatistics };
