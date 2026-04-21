const db = require('../config/database');
const { DEFAULT_IN_STORE_SITE_NAME } = require('../config/inStoreSite');

const EMAIL_LINE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** หลายบรรทัด = หลายผู้ติดต่อ (คั่นด้วย \\n) — บรรทัดว่างข้ามได้ */
function validateMultilineEmails(emailAcc) {
  if (emailAcc == null || String(emailAcc).trim() === '') return { ok: true };
  const lines = String(emailAcc).split(/\n/).map((s) => s.trim());
  for (const line of lines) {
    if (!line) continue;
    if (!EMAIL_LINE_RE.test(line)) return { ok: false };
  }
  return { ok: true };
}

function validateMultilineTels(telAcc) {
  if (telAcc == null || String(telAcc).trim() === '') return { ok: true };
  const lines = String(telAcc).split(/\n/).map((s) => s.trim());
  for (const line of lines) {
    if (!line) continue;
    // รูปแบบ เบอร์หลัก-ต่อ (เช่น 0893444444-12345): หลัก 9–15 หลัก, ต่อ 1–5 หลัก
    const extForm = line.match(/^(\d{9,15})-(\d{1,5})$/);
    if (extForm) continue;
    const digitsOnly = line.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 15) return { ok: false };
  }
  return { ok: true };
}

/**
 * Snapshot สำหรับ contract_history.contract_snapshot — รูปแบบ:
 * { "contract": { ...แถว contract รวม contract_id }, "devices": [{ "device_id", "SLid" }, ...] }
 * devices มาจาก contract_device ณ เวลาเรียก (ก่อน renew / ก่อนอัปเดต)
 */
async function buildContractHistorySnapshot(conn, contractId) {
  const cid = parseInt(contractId, 10);
  if (Number.isNaN(cid)) return null;
  const [cRows] = await conn.execute('SELECT * FROM contract WHERE contract_id = ?', [cid]);
  if (!cRows || cRows.length === 0) return null;
  const contract = { ...cRows[0] };

  for (const k of Object.keys(contract)) {
    const v = contract[k];
    if (v instanceof Date) {
      const iso = v.toISOString();
      contract[k] = iso.length >= 10 ? iso.slice(0, 10) : iso;
    }
  }

  const [cdRows] = await conn.execute(
    `SELECT device_id, SLid FROM contract_device WHERE contract_id = ?
     ORDER BY COALESCE(device_id, 0), COALESCE(SLid, 0)`,
    [cid]
  );
  const devices = (cdRows || []).map((r) => ({
    device_id: r.device_id != null ? parseInt(String(r.device_id), 10) : null,
    SLid: r.SLid != null ? parseInt(String(r.SLid), 10) : null,
  }));

  const [primRows] = await conn.execute(
    `SELECT MIN(SLid) AS primary_slid FROM contract_device WHERE contract_id = ? AND SLid IS NOT NULL`,
    [cid]
  );
  const ps = primRows?.[0]?.primary_slid;
  if (ps != null && !Number.isNaN(parseInt(String(ps), 10))) {
    contract.site_id = parseInt(String(ps), 10);
  }
  if (Object.prototype.hasOwnProperty.call(contract, 'device_id')) {
    delete contract.device_id;
  }

  return JSON.stringify({ contract, devices });
}

/**
 * แยก contract + devices จาก contract_snapshot — รองรับรูปแบบใหม่ { contract, devices } และแบบเก่า
 */
function parseContractSnapshotJson(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { contract: null, devices: [] };
  }
  try {
    const j = JSON.parse(String(raw));
    if (Array.isArray(j)) {
      return {
        contract: null,
        devices: j.map((x) => ({
          device_id: null,
          SLid: null,
          CI_Name: x && x.CI_Name != null ? String(x.CI_Name) : null,
        })),
      };
    }
    if (j && typeof j === 'object') {
      if (j.contract && typeof j.contract === 'object') {
        return {
          contract: j.contract,
          devices: Array.isArray(j.devices) ? j.devices : [],
        };
      }
      const devArr = Array.isArray(j.devices) ? j.devices : [];
      const { devices: _d, ...rest } = j;
      const keys = Object.keys(rest).filter((k) => rest[k] !== undefined);
      return {
        contract: keys.length ? rest : null,
        devices: devArr,
      };
    }
  } catch (_) {
    /* ignore */
  }
  return { contract: null, devices: [] };
}

/** แปลงรายการจาก snapshot เป็นรูปแบบ devices ใน GET history detail (ดึงชื่อเครื่องจาก DB เมื่อมี device_id) */
async function enrichSnapshotDevicesForHistoryDetail(db, snapDevEntries) {
  const entries = Array.isArray(snapDevEntries) ? snapDevEntries : [];
  if (entries.length === 0) return [];

  const ids = [
    ...new Set(
      entries
        .map((e) => (e.device_id != null ? parseInt(String(e.device_id), 10) : NaN))
        .filter((n) => !Number.isNaN(n))
    ),
  ];

  const deviceByDid = new Map();
  if (ids.length > 0) {
    const ph = ids.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT d.Did, d.CI_Name, d.Asset_Number, d.serial, d.Asset_State, d.SLid,
              dt.model AS type_name, dr.name AS roleName
       FROM devices d
       LEFT JOIN device_type dt ON d.Dtypeid = dt.Dtypeid
       LEFT JOIN device_role dr ON d.DeRoleid = dr.DeRoleid
       WHERE d.Did IN (${ph})`,
      ids
    );
    for (const r of rows || []) {
      deviceByDid.set(Number(r.Did), r);
    }
  }

  const slids = [
    ...new Set(
      entries
        .map((e) => (e.SLid != null ? parseInt(String(e.SLid), 10) : null))
        .filter((n) => n != null && !Number.isNaN(n))
    ),
  ];
  const siteBySlid = new Map();
  if (slids.length > 0) {
    const ph2 = slids.map(() => '?').join(',');
    const [slRows] = await db.execute(
      `SELECT sl.SLid, s.Name AS SiteName, IFNULL(l.Location2, '') AS Location2
       FROM sites_location sl
       LEFT JOIN sites s ON sl.Sid = s.Sid
       LEFT JOIN location l ON sl.lid = l.lid
       WHERE sl.SLid IN (${ph2})`,
      slids
    );
    for (const r of slRows || []) {
      siteBySlid.set(Number(r.SLid), {
        SiteName: r.SiteName != null ? String(r.SiteName) : null,
        Location2: r.Location2 != null ? String(r.Location2) : '',
      });
    }
  }

  let neg = 1;
  const out = [];
  for (const e of entries) {
    const slid = e.SLid != null ? parseInt(String(e.SLid), 10) : null;
    const site =
      slid != null && !Number.isNaN(slid) ? siteBySlid.get(slid) : undefined;
    const didNum = e.device_id != null ? parseInt(String(e.device_id), 10) : NaN;

    if (!Number.isNaN(didNum)) {
      const r = deviceByDid.get(didNum);
      if (r) {
        out.push({
          Did: r.Did,
          CI_Name: r.CI_Name ?? null,
          Asset_Number: r.Asset_Number ?? null,
          serial: r.serial ?? null,
          Asset_State: r.Asset_State ?? null,
          SLid: r.SLid != null ? Number(r.SLid) : null,
          contract_SLid: slid != null && !Number.isNaN(slid) ? slid : null,
          SiteName: site?.SiteName ?? null,
          Location2: site?.Location2 ?? null,
          type_name: r.type_name ?? null,
          roleName: r.roleName ?? null,
        });
      } else {
        out.push({
          Did: -(neg++),
          CI_Name: e.CI_Name != null ? String(e.CI_Name) : `Device #${didNum}`,
          Asset_Number: null,
          serial: null,
          Asset_State: null,
          SLid: null,
          contract_SLid: slid != null && !Number.isNaN(slid) ? slid : null,
          SiteName: site?.SiteName ?? null,
          Location2: site?.Location2 ?? null,
          type_name: null,
          roleName: null,
        });
      }
    } else {
      const ci = e.CI_Name != null ? String(e.CI_Name) : null;
      out.push({
        Did: -(neg++),
        CI_Name: ci,
        Asset_Number: null,
        serial: null,
        Asset_State: null,
        SLid: slid != null && !Number.isNaN(slid) ? slid : null,
        contract_SLid: slid != null && !Number.isNaN(slid) ? slid : null,
        SiteName: site?.SiteName ?? null,
        Location2: site?.Location2 ?? null,
        type_name: null,
        roleName: null,
      });
    }
  }
  return out;
}

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
      return res.status(400).json({ success: false, message: 'File not found' });
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

// POST - สร้าง Contract ใหม่ — device/site อยู่ที่ contract_device เท่านั้น (ไม่เก็บ device_id/site_id บน contract)
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
    // ดักรูปแบบ Email และ Telephone (รองรับหลายบรรทัด)
    if (!validateMultilineEmails(email_acc).ok) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email address(es); one per line (e.g. example@domain.com)'
      });
    }
    if (!validateMultilineTels(tel_acc).ok) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid phone number(s); one per line (9–15 digits each)'
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
        .filter((p) => p.site_id != null && !isNaN(p.site_id) && (p.device_ids.length > 0 || contractStatus === 'draft'));
      if (pairs.length === 0 && contractStatus !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one site and device in each site (site_id and device_ids must not be empty)',
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
    // เช็คว่า device ที่เลือกมี contract อยู่แล้วหรือยัง (contract_device)
    // แต่ถ้าเป็นการต่อสัญญา (มี old_contract_id) ให้ข้ามการตรวจสอบนี้
    if (deviceIdList.length > 0 && !old_contract_id) {
      const placeholders = deviceIdList.map(() => '?').join(',');
      const [inContractDevice] = await db.execute(
        `SELECT DISTINCT device_id FROM contract_device WHERE device_id IN (${placeholders})`,
        deviceIdList
      );
      const alreadyInContract = [
        ...new Set([
          ...(Array.isArray(inContractDevice) ? inContractDevice : []).map((r) => r.device_id),
        ]),
      ].filter((id) => id != null);
      if (alreadyInContract.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some devices are already associated with other contracts, please select only devices that are not already associated',
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
        throw new Error('Cannot create contract_id that does not exist, please try again');
      }
    }

    const insertCols =
      'contract_id, contract_name, start_date, end_date, sof_name, sla_term, Assigned_Service, sale_account, tel_acc, email_acc, coverage_scope, file_paths, image_paths';
    const insertVals = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
    const insertParams = [
      finalContractId,
      contract_name && String(contract_name).trim() ? contract_name.trim() : null,
      start_date || null,
      end_date || null,
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
            message: 'Old contract not found'
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

        if (
          status !== undefined &&
          (status === 'draft' || status === 'official' || status === 'not_renewing')
        ) {
          updateFields.push('status = ?');
          updateValues.push(status);
        }

        if (updateFields.length === 0) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: 'No data to update'
          });
        }

        // Snapshot ก่อนแก้ contract + contract_device — เก็บแถวสัญญาและเครื่องชุดเก่า (ก่อนเปลี่ยน SOF / ก่อนรีเฟรช device)
        let contractSnapshotForHistory = null;
        try {
          contractSnapshotForHistory = await buildContractHistorySnapshot(conn, oldContractIdVal);
        } catch (snapErr) {
          console.error('Error building contract history snapshot (pre-renew):', snapErr);
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

        // บันทึกประวัติการต่อสัญญา (ใช้ contract_id เดิม) + snapshot ที่สร้างไว้ก่อน UPDATE/รีเฟรช device
        try {
          await conn.execute(
            'INSERT INTO contract_history (contract_id, old_contract_id, old_sof, new_sof, renewed_at, contract_snapshot, status_history) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
            [contractId, contractId, oldSofFromDb, sofValue, contractSnapshotForHistory, 'Renew']
          );
        } catch (historyErr) {
          console.error('Error saving contract history:', historyErr);
        }

        // หลัง renew SOF: อัปเดต Refer_SOF บน devices — ทุกเครื่องที่ยังอ้าง SOF เก่า + เครื่องในรายการผูกสัญญา (กรณี Refer_SOF ว่าง)
        if (contractStatus !== 'draft' && sofValue) {
          const newSofTrim = String(sofValue).trim();
          if (newSofTrim) {
            const oldSofTrim =
              oldSofFromDb != null && String(oldSofFromDb).trim() !== '' ? String(oldSofFromDb).trim() : '';
            if (oldSofTrim && oldSofTrim !== newSofTrim) {
              await conn.execute(
                `UPDATE devices SET Refer_SOF = ? WHERE Refer_SOF IS NOT NULL AND TRIM(Refer_SOF) = ?`,
                [newSofTrim, oldSofTrim]
              );
            }
            if (deviceIdList.length > 0) {
              const ph = deviceIdList.map(() => '?').join(',');
              await conn.execute(`UPDATE devices SET Refer_SOF = ? WHERE Did IN (${ph})`, [newSofTrim, ...deviceIdList]);
            }
          }
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

      // อัปเดต devices: Refer_SOF เท่านั้นเมื่อไม่ใช่ draft — Assigned_Service เก็บที่ contract เท่านั้น
      if (contractStatus !== 'draft' && sofValue && deviceIdList.length > 0) {
        const placeholders = deviceIdList.map(() => '?').join(',');
        await conn.execute(
          `UPDATE devices SET Refer_SOF = ? WHERE Did IN (${placeholders})`,
          [sofValue, ...deviceIdList]
        );
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
      message: oldContractIdVal ? 'Contract renewed successfully' : 'Contract created successfully',
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
        message = `Column in the table does not match the system used: ${errMsg}`;
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
/** Subqueries: แถว contract_history ล่าสุดที่เป็น Renew (หรือ legacy ไม่มี status_history แต่มี old/new SOF) */
const RENEW_HIST_SUBQUERIES = `
        (SELECT ch.old_sof FROM contract_history ch
          WHERE ch.contract_id = c.contract_id
            AND (ch.status_history = 'Renew' OR (ch.status_history IS NULL AND ch.old_sof IS NOT NULL AND ch.new_sof IS NOT NULL))
          ORDER BY ch.history_id DESC LIMIT 1) AS renew_hist_old_sof,
        (SELECT ch.new_sof FROM contract_history ch
          WHERE ch.contract_id = c.contract_id
            AND (ch.status_history = 'Renew' OR (ch.status_history IS NULL AND ch.old_sof IS NOT NULL AND ch.new_sof IS NOT NULL))
          ORDER BY ch.history_id DESC LIMIT 1) AS renew_hist_new_sof,
        (SELECT ch.renewed_at FROM contract_history ch
          WHERE ch.contract_id = c.contract_id
            AND (ch.status_history = 'Renew' OR (ch.status_history IS NULL AND ch.old_sof IS NOT NULL AND ch.new_sof IS NOT NULL))
          ORDER BY ch.history_id DESC LIMIT 1) AS renew_hist_at`;

const getContractsBySite = async (req, res) => {
  try {
    const siteId = req.query.site_id;
    const expandSites = req.query.expand === 'sites';

    if (expandSites) {
      // หนึ่งแถวต่อ contract-site: contract_id, contract_name, start_date, end_date, status, site_name, site_location, device_count
      // รวมสัญญาที่เลยวันสิ้นสุดแล้ว — หน้า contract ใช้กรอง/แสดงสถานะฝั่ง client
      let sql = `
        SELECT c.contract_id, c.contract_name, c.start_date, c.end_date, c.status,
          s.Name AS site_name, l.Location2 AS site_location,
          COUNT(cd.device_id) AS device_count,
          (SELECT ch.status_history FROM contract_history ch WHERE ch.contract_id = c.contract_id ORDER BY ch.history_id DESC LIMIT 1) AS history_status,
          ${RENEW_HIST_SUBQUERIES}
        FROM contract c
        INNER JOIN contract_device cd ON c.contract_id = cd.contract_id AND cd.SLid IS NOT NULL
        INNER JOIN sites_location sl ON cd.SLid = sl.SLid
        LEFT JOIN sites s ON sl.Sid = s.Sid
        LEFT JOIN location l ON sl.lid = l.lid
        WHERE c.status <> 'not_renewing'
      `;
      const params = [];
      if (siteId) {
        const siteIdNum = parseInt(siteId, 10);
        if (!isNaN(siteIdNum)) {
          sql += ' AND cd.SLid = ?';
          params.push(siteIdNum);
        }
      }
      sql += ` GROUP BY c.contract_id, c.contract_name, c.start_date, c.end_date, c.status, sl.SLid, s.Name, l.Location2
        UNION ALL
        SELECT c.contract_id, c.contract_name, c.start_date, c.end_date, c.status,
          NULL AS site_name, NULL AS site_location, 0 AS device_count,
          (SELECT ch.status_history FROM contract_history ch WHERE ch.contract_id = c.contract_id ORDER BY ch.history_id DESC LIMIT 1) AS history_status,
          ${RENEW_HIST_SUBQUERIES}
        FROM contract c
        LEFT JOIN (SELECT DISTINCT contract_id FROM contract_device WHERE SLid IS NOT NULL) cd ON c.contract_id = cd.contract_id
        WHERE cd.contract_id IS NULL AND c.status <> 'not_renewing'
      `;
      if (siteId) {
        const siteIdNum = parseInt(siteId, 10);
        if (!isNaN(siteIdNum)) {
          sql +=
            ' AND EXISTS (SELECT 1 FROM contract_device cdx WHERE cdx.contract_id = c.contract_id AND cdx.SLid = ?)';
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
        prim.primary_slid AS site_id,
        c.sla_term,
        c.sale_account,
        c.sof_name,
        c.status,
        s_c.Name AS contract_site_name,
        IFNULL(l_c.Location2, '') AS contract_site_location,
        agg.site_name AS site_name,
        agg.site_location AS site_location,
        COALESCE(cnt.device_count, 0) AS device_count,
        COALESCE(slim.devices_slid_aligned, 1) AS devices_slid_aligned,
        (SELECT ch.status_history FROM contract_history ch WHERE ch.contract_id = c.contract_id ORDER BY ch.history_id DESC LIMIT 1) AS history_status,
        ${RENEW_HIST_SUBQUERIES}
      FROM contract c
      LEFT JOIN (
        SELECT contract_id, MIN(SLid) AS primary_slid
        FROM contract_device
        WHERE SLid IS NOT NULL
        GROUP BY contract_id
      ) prim ON c.contract_id = prim.contract_id
      LEFT JOIN sites_location sl_c ON prim.primary_slid IS NOT NULL AND sl_c.SLid = prim.primary_slid
      LEFT JOIN sites s_c ON sl_c.Sid = s_c.Sid
      LEFT JOIN location l_c ON sl_c.lid = l_c.lid
      LEFT JOIN (
        SELECT contract_id,
          GROUP_CONCAT(site_name ORDER BY slid SEPARATOR ', ') AS site_name,
          GROUP_CONCAT(site_location ORDER BY slid SEPARATOR ', ') AS site_location
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
      LEFT JOIN (
        SELECT cd2.contract_id,
          CASE
            WHEN SUM(CASE WHEN d2.SLid IS NULL OR cd2.SLid IS NULL OR d2.SLid <> cd2.SLid THEN 1 ELSE 0 END) = 0 THEN 1
            ELSE 0
          END AS devices_slid_aligned
        FROM contract_device cd2
        INNER JOIN devices d2 ON cd2.device_id = d2.Did
        WHERE cd2.device_id IS NOT NULL
        GROUP BY cd2.contract_id
      ) slim ON c.contract_id = slim.contract_id
      LEFT JOIN contract_device cd ON c.contract_id = cd.contract_id
      LEFT JOIN devices d ON cd.device_id = d.Did
    `;
    let params = [];
    let sql;

    if (siteId) {
      const siteIdNum = parseInt(siteId, 10);
      // Client ส่ง site_id = SLid (sites_location). สัญญาหลายฉบับอาจผูกคนละ SLid แต่ Sid เดียวกัน — รวมทุกสัญญาใน site นั้น
      if (!isNaN(siteIdNum)) {
        sql = `${baseSelect} WHERE (
          prim.primary_slid IN (
            SELECT slb.SLid FROM sites_location slb
            WHERE slb.Sid = (SELECT sl0.Sid FROM sites_location sl0 WHERE sl0.SLid = ? LIMIT 1)
          )
          OR c.contract_id IN (
            SELECT DISTINCT cd4.contract_id FROM contract_device cd4
            WHERE cd4.SLid IN (
              SELECT sl1.SLid FROM sites_location sl1
              WHERE sl1.Sid = (SELECT sl0.Sid FROM sites_location sl0 WHERE sl0.SLid = ? LIMIT 1)
            )
          )
          OR d.SLid IN (
            SELECT sl1.SLid FROM sites_location sl1
            WHERE sl1.Sid = (SELECT sl0.Sid FROM sites_location sl0 WHERE sl0.SLid = ? LIMIT 1)
          )
          OR (
            (SELECT sl0.Sid FROM sites_location sl0 WHERE sl0.SLid = ? LIMIT 1) IS NULL
            AND (prim.primary_slid = ? OR d.SLid = ? OR cd.SLid = ?)
          )
        ) AND c.status <> 'not_renewing' ORDER BY c.contract_id DESC`;
        params = [siteIdNum, siteIdNum, siteIdNum, siteIdNum, siteIdNum, siteIdNum, siteIdNum];
      } else {
        sql = `${baseSelect} WHERE c.status <> 'not_renewing' ORDER BY c.contract_id DESC`;
        params = [];
      }
    } else {
      sql = `${baseSelect} WHERE c.status <> 'not_renewing' ORDER BY c.contract_id DESC`;
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
// เมื่อส่ง contract_id (edit contract): เฉพาะ device ที่ยังไม่มี SOF (Refer_SOF ว่าง) และ sites_location.Sid = คลัง default
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

    // ตอน edit contract: เฉพาะ device ที่ยังไม่มี SOF และอยู่ใต้คลัง (ชื่อบริษัทตรง in-store canonical)
    if (contractId) {
      whereCondition += ` AND (d.Refer_SOF IS NULL OR d.Refer_SOF = '') AND LOWER(TRIM(COALESCE(s.Name, ''))) = LOWER(TRIM(?))`;
      params.push(DEFAULT_IN_STORE_SITE_NAME);
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
      message: 'Error getting available devices',
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
        message: 'Please provide contract_id'
      });
    }

    const cid = parseInt(contractId, 10);
    if (isNaN(cid)) {
      return res.status(400).json({
        success: false,
        message: 'contract_id is not valid'
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
      message: 'Error getting sites by contract',
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
        message: 'Please provide contract_id'
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
        cd.contract_id,
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
      message: 'Error getting devices by contract',
      error: error.message
    });
  }
};

/**
 * POST body: { contract_ids: number[], include_history_for_not_renewing_contracts?: boolean }
 * — แถวประวัติจาก contract_history สำหรับรายการสัญญา
 * — ถ้า include_history_for_not_renewing_contracts !== false: ดึงเพิ่มแถว Renew/Terminated (รวม Renew แบบ legacy ที่ status_history เป็น NULL แต่มี old/new SOF) ของสัญญาที่ status = not_renewing
 *   (ไม่ถูกส่งใน GET /api/contracts) เพื่อให้โชว์ snapshot ประวัติได้
 */
const postContractHistoryDisplayRows = async (req, res) => {
  try {
    const rawIds = req.body && Array.isArray(req.body.contract_ids) ? req.body.contract_ids : [];
    const includeNrHistory =
      req.body == null ||
      req.body.include_history_for_not_renewing_contracts === undefined ||
      req.body.include_history_for_not_renewing_contracts === true;
    const contractIds = [
      ...new Set(
        rawIds
          .map((x) => parseInt(String(x), 10))
          .filter((n) => !Number.isNaN(n) && n > 0)
      ),
    ];

    const historySelectCols = `
        history_id,
        contract_id,
        old_contract_id,
        old_sof,
        new_sof,
        renewed_at,
        created_at,
        contract_snapshot,
        status_history`;
    /** เหมือน historySelectCols แต่มี alias ch. — ใช้เมื่อ JOIN กับ contract (กัน contract_id ซ้ำซ้อน) */
    const historySelectColsJoined = `
        ch.history_id,
        ch.contract_id,
        ch.old_contract_id,
        ch.old_sof,
        ch.new_sof,
        ch.renewed_at,
        ch.created_at,
        ch.contract_snapshot,
        ch.status_history`;

    let histRows = [];
    if (contractIds.length > 0) {
      const placeholders = contractIds.map(() => '?').join(',');
      const sql = `
      SELECT ${historySelectCols}
      FROM contract_history
      WHERE contract_id IN (${placeholders})
      ORDER BY COALESCE(renewed_at, created_at) DESC, history_id DESC
    `;
      const [rowsMain] = await db.execute(sql, contractIds);
      histRows = rowsMain || [];
    }

    if (includeNrHistory) {
      const [rowsNr] = await db.execute(
        `
        SELECT ${historySelectColsJoined}
        FROM contract_history ch
        INNER JOIN contract c ON c.contract_id = ch.contract_id AND c.status = 'not_renewing'
        WHERE (
          ch.status_history IN ('Renew', 'Terminated')
          OR (ch.status_history IS NULL AND ch.old_sof IS NOT NULL AND ch.new_sof IS NOT NULL)
        )
        ORDER BY COALESCE(ch.renewed_at, ch.created_at) DESC, ch.history_id DESC
        `
      );
      const seen = new Set((histRows || []).map((r) => Number(r.history_id)));
      for (const row of rowsNr || []) {
        const hid = Number(row.history_id);
        if (!seen.has(hid)) {
          seen.add(hid);
          histRows.push(row);
        }
      }
    }

    if (!histRows || histRows.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const slidsNeeded = new Set();
    const cidsNeedContractFallback = new Set();

    const parsed = (histRows || []).map((row) => {
      const { contract: snap, devices } = parseContractSnapshotJson(row.contract_snapshot);
      const devicesLen = devices.length;
      let slid = null;
      if (snap && snap.site_id != null && String(snap.site_id).trim() !== '') {
        const n = parseInt(String(snap.site_id), 10);
        if (!Number.isNaN(n)) slid = n;
      }
      if (slid != null) slidsNeeded.add(slid);
      else cidsNeedContractFallback.add(Number(row.contract_id));

      return { row, snap, devicesLen, snapSlid: slid };
    });

    if (cidsNeedContractFallback.size > 0) {
      const cids = [...cidsNeedContractFallback];
      const ph = cids.map(() => '?').join(',');
      const [cRows] = await db.execute(
        `SELECT c.contract_id,
          (SELECT MIN(cd.SLid) FROM contract_device cd WHERE cd.contract_id = c.contract_id AND cd.SLid IS NOT NULL) AS site_id
         FROM contract c WHERE c.contract_id IN (${ph})`,
        cids
      );
      const siteByCid = new Map();
      for (const cr of cRows || []) {
        siteByCid.set(Number(cr.contract_id), cr.site_id != null ? parseInt(String(cr.site_id), 10) : NaN);
      }
      for (const p of parsed) {
        if (p.snapSlid != null) continue;
        const sid = siteByCid.get(Number(p.row.contract_id));
        if (sid != null && !Number.isNaN(sid)) {
          p.snapSlid = sid;
          slidsNeeded.add(sid);
        }
      }
    }

    const slidList = [...slidsNeeded].filter((n) => !Number.isNaN(n));
    const siteBySlid = new Map();
    if (slidList.length > 0) {
      const ph2 = slidList.map(() => '?').join(',');
      const [slRows] = await db.execute(
        `
        SELECT sl.SLid, s.Name AS site_name, IFNULL(l.Location2, '') AS site_location
        FROM sites_location sl
        LEFT JOIN sites s ON sl.Sid = s.Sid
        LEFT JOIN location l ON sl.lid = l.lid
        WHERE sl.SLid IN (${ph2})
        `,
        slidList
      );
      for (const r of slRows || []) {
        siteBySlid.set(Number(r.SLid), {
          site_name: r.site_name != null ? String(r.site_name) : '',
          site_location: r.site_location != null ? String(r.site_location) : '',
        });
      }
    }

    const data = parsed.map(({ row, snap, devicesLen, snapSlid }) => {
      const sl = snapSlid != null ? siteBySlid.get(snapSlid) : undefined;
      const site_name = sl?.site_name ?? null;
      const site_location = sl?.site_location ?? null;

      const start_date = snap && snap.start_date != null ? String(snap.start_date).slice(0, 10) : null;
      const end_date = snap && snap.end_date != null ? String(snap.end_date).slice(0, 10) : null;
      const contract_name = snap && snap.contract_name != null ? String(snap.contract_name) : null;
      const rawSof = snap && snap.sof_name != null ? String(snap.sof_name).trim() : '';
      const sof_name =
        rawSof !== ''
          ? rawSof
          : row.new_sof != null && String(row.new_sof).trim() !== ''
            ? String(row.new_sof).trim()
            : row.old_sof != null && String(row.old_sof).trim() !== ''
              ? String(row.old_sof).trim()
              : null;
      const status = snap && snap.status != null ? String(snap.status) : 'official';
      const sale_account = snap && snap.sale_account != null ? String(snap.sale_account) : null;

      return {
        row_type: 'history',
        history_id: row.history_id,
        contract_id: row.contract_id,
        contract_name,
        start_date,
        end_date,
        sale_account,
        sof_name,
        site_id: snapSlid,
        contract_site_name: site_name && site_name.trim() !== '' ? site_name : null,
        contract_site_location: site_location && site_location.trim() !== '' ? site_location : null,
        site_name,
        site_location,
        device_count: devicesLen,
        status,
        devices_slid_aligned: 1,
        history_status: row.status_history,
        renew_hist_old_sof: row.old_sof,
        renew_hist_new_sof: row.new_sof,
        renew_hist_at: row.renewed_at ?? row.created_at,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error getting contract history display rows:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting contract history display rows',
      error: error.message,
    });
  }
};

/**
 * GET /api/contracts/history/:historyId — รายละเอียดจากแถว contract_history เดียว (contract_snapshot) สำหรับ modal แถวประวัติ
 */
const getContractHistoryDetailByHistoryId = async (req, res) => {
  try {
    const hid = parseInt(String(req.params.historyId), 10);
    if (Number.isNaN(hid) || hid <= 0) {
      return res.status(400).json({ success: false, message: 'history_id is not valid' });
    }

    const [rows] = await db.execute(
      `SELECT history_id, contract_id, old_contract_id, old_sof, new_sof, renewed_at, created_at, contract_snapshot, status_history
       FROM contract_history WHERE history_id = ?`,
      [hid]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contract history not found' });
    }

    const histRow = rows[0];
    const cid = parseInt(String(histRow.contract_id), 10);

    const { contract: snap, devices: snapDevEntries } = parseContractSnapshotJson(histRow.contract_snapshot);

    let siteIdVal = null;
    if (snap && snap.site_id != null && String(snap.site_id).trim() !== '') {
      const n = parseInt(String(snap.site_id), 10);
      if (!Number.isNaN(n)) siteIdVal = n;
    }
    if (siteIdVal == null && Array.isArray(snapDevEntries) && snapDevEntries.length > 0) {
      const sls = snapDevEntries
        .map((e) => e.SLid)
        .filter((x) => x != null && String(x).trim() !== '')
        .map((x) => parseInt(String(x), 10))
        .filter((n) => !Number.isNaN(n));
      if (sls.length > 0) siteIdVal = Math.min(...sls);
    }
    if (siteIdVal == null) {
      const [cRows] = await db.execute(
        `SELECT (
          SELECT MIN(cd.SLid) FROM contract_device cd WHERE cd.contract_id = c.contract_id AND cd.SLid IS NOT NULL
        ) AS site_id
         FROM contract c WHERE c.contract_id = ?`,
        [cid]
      );
      if (cRows && cRows[0] && cRows[0].site_id != null) {
        const sv = parseInt(String(cRows[0].site_id), 10);
        if (!Number.isNaN(sv)) siteIdVal = sv;
      }
    }

    let site_name = null;
    let site_location = null;
    if (siteIdVal != null) {
      const [slRows] = await db.execute(
        `SELECT s.Name AS site_name, IFNULL(l.Location2, '') AS site_location
         FROM sites_location sl
         LEFT JOIN sites s ON sl.Sid = s.Sid
         LEFT JOIN location l ON sl.lid = l.lid
         WHERE sl.SLid = ?`,
        [siteIdVal]
      );
      if (slRows && slRows[0]) {
        site_name = slRows[0].site_name != null ? String(slRows[0].site_name) : null;
        site_location = slRows[0].site_location != null ? String(slRows[0].site_location) : '';
      }
    }

    const toDateStr = (v) => {
      if (v == null) return null;
      if (v instanceof Date) {
        const iso = v.toISOString();
        return iso.length >= 10 ? iso.slice(0, 10) : null;
      }
      const s = String(v).trim();
      return s.length >= 10 ? s.slice(0, 10) : s || null;
    };

    const snapStr = (k) => {
      if (!snap || snap[k] == null || snap[k] === '') return null;
      return String(snap[k]);
    };

    const rawSof = snapStr('sof_name');
    const sofName =
      rawSof && rawSof.trim() !== ''
        ? rawSof.trim()
        : histRow.new_sof != null && String(histRow.new_sof).trim() !== ''
          ? String(histRow.new_sof).trim()
          : histRow.old_sof != null && String(histRow.old_sof).trim() !== ''
            ? String(histRow.old_sof).trim()
            : null;

    const devicesMapped = await enrichSnapshotDevicesForHistoryDetail(db, snapDevEntries);

    let sitesRows = [];
    if (siteIdVal != null) {
      sitesRows = [
        {
          SLid: siteIdVal,
          SiteName: site_name,
          Location2: site_location || null,
        },
      ];
    }

    const contractBase = {
      contract_id: cid,
      history_id: histRow.history_id,
      history_detail: true,
      status: snapStr('status') || 'official',
      contract_name: snapStr('contract_name'),
      start_date: snap ? toDateStr(snap.start_date) : null,
      end_date: snap ? toDateStr(snap.end_date) : null,
      site_id: siteIdVal,
      sla_term:
        snap && snap.sla_term != null && String(snap.sla_term).trim() !== ''
          ? parseFloat(String(snap.sla_term))
          : null,
      sale_account: snapStr('sale_account'),
      email_acc: snapStr('email_acc'),
      tel_acc: snapStr('tel_acc'),
      sof_name: sofName,
      Assigned_Service: snapStr('Assigned_Service'),
      coverage_scope: snapStr('coverage_scope'),
      file_paths: snapStr('file_paths'),
      image_paths: snapStr('image_paths'),
      pm_time_per_year:
        snap && snap.pm_time_per_year != null && String(snap.pm_time_per_year).trim() !== ''
          ? parseInt(String(snap.pm_time_per_year), 10)
          : null,
      contract_sign_date: snap ? toDateStr(snap.contract_sign_date) : null,
      remark: snapStr('remark'),
      site_name,
      site_location: site_location || null,
    };

    const historyOne = [
      {
        history_id: histRow.history_id,
        contract_id: histRow.contract_id,
        old_contract_id: histRow.old_contract_id,
        old_sof: histRow.old_sof,
        new_sof: histRow.new_sof,
        renewed_at: histRow.renewed_at,
        created_at: histRow.created_at,
        contract_snapshot: histRow.contract_snapshot,
        status_history: histRow.status_history,
      },
    ];

    const result = {
      ...contractBase,
      devices: devicesMapped,
      sites: sitesRows,
      history: historyOne,
    };

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting contract history detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting contract history detail',
      error: error.message,
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
        message: 'Please provide contract_id'
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
        created_at,
        contract_snapshot,
        status_history
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
      message: 'Error getting contract history',
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
      message: 'Error getting vendor statistics',
      error: error.message
    });
  }
};

// GET /api/contracts/statistics/top-sites — Top sites จาก contract_device (devices + contracts ต่อ SLid)
// Optional query: period_start, period_end_exclusive (YYYY-MM-DD) — กรองสัญญาที่วันเริ่มสัญญา start_date ∈ [start, endExclusive)
const getTopSitesByContractDevice = async (req, res) => {
  try {
    const lim = parseInt(String(req.query.limit ?? '8'), 10);
    const limit = Number.isNaN(lim) ? 8 : Math.min(Math.max(lim, 1), 25);

    const ps = req.query.period_start;
    const pe = req.query.period_end_exclusive;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const usePeriod =
      ps && pe && dateRe.test(String(ps).trim()) && dateRe.test(String(pe).trim());
    const periodStart = usePeriod ? String(ps).trim() : null;
    const periodEndEx = usePeriod ? String(pe).trim() : null;
    const contractJoin = usePeriod
      ? `
      INNER JOIN contract c ON c.contract_id = cd.contract_id
        AND c.start_date IS NOT NULL
        AND DATE(c.start_date) >= ?
        AND DATE(c.start_date) < ?
    `
      : `
      LEFT JOIN contract c ON c.contract_id = cd.contract_id
    `;
    const periodBindFirst = usePeriod ? [periodStart, periodEndEx] : [];

    const [rows] = await db.execute(
      `
      SELECT
        cd.SLid AS slid,
        s.Name AS site_name,
        IFNULL(l.Location2, '') AS location2,
        COUNT(DISTINCT cd.device_id) AS device_count,
        COUNT(DISTINCT cd.contract_id) AS contract_count,
        COUNT(DISTINCT CASE
          WHEN c.end_date IS NOT NULL
            AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
            AND c.end_date >= CURDATE()
          THEN c.contract_id END) AS contracts_expiring_soon
      FROM contract_device cd
      ${contractJoin}
      INNER JOIN sites_location sl ON sl.SLid = cd.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE cd.SLid IS NOT NULL AND cd.device_id IS NOT NULL
      GROUP BY cd.SLid, s.Name, l.Location2
      ORDER BY device_count DESC, contract_count DESC
      LIMIT ?
      `,
      [...periodBindFirst, limit]
    );

    const [totalRows] = await db.execute(
      `
      SELECT COUNT(DISTINCT cd.device_id) AS total
      FROM contract_device cd
      ${contractJoin}
      WHERE cd.SLid IS NOT NULL AND cd.device_id IS NOT NULL
      `,
      [...periodBindFirst]
    );
    const totalDevices = Number(totalRows[0]?.total || 0);

    const data = rows.map((r, idx) => {
      const dc = Number(r.device_count || 0);
      const pct = totalDevices > 0 ? Math.round((dc / totalDevices) * 1000) / 10 : 0;
      return {
        rank: idx + 1,
        slid: r.slid,
        site_name: r.site_name || '—',
        location2: r.location2 || '',
        device_count: dc,
        contract_count: Number(r.contract_count || 0),
        contracts_expiring_soon: Number(r.contracts_expiring_soon || 0),
        pct_of_total: pct,
      };
    });

    res.status(200).json({
      success: true,
      total_devices: totalDevices,
      data,
      ...(usePeriod
        ? {
            period: {
              period_start: periodStart,
              period_end_exclusive: periodEndEx,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error('Error getting top sites by contract/device:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting top sites statistics',
      error: error.message,
    });
  }
};

// GET /api/contracts/statistics/top-sites-heatmap — เมทริกซ์ site × contract (จำนวน device ต่อเซลล์)
// Optional: period_start & period_end_exclusive (YYYY-MM-DD) — นับเฉพาะสัญญาที่วันเริ่มสัญญา start_date ∈ [start, endExclusive)
const getTopSitesHeatmap = async (req, res) => {
  try {
    const parseLim = (v, fb, min, max) => {
      const n = parseInt(String(v ?? ''), 10);
      if (Number.isNaN(n)) return fb;
      return Math.min(max, Math.max(min, n));
    };
    const siteLimit = parseLim(req.query.site_limit, 8, 3, 15);
    const contractLimit = parseLim(req.query.contract_limit, 5, 2, 10);

    const ps = req.query.period_start;
    const pe = req.query.period_end_exclusive;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const usePeriod =
      ps && pe && dateRe.test(String(ps).trim()) && dateRe.test(String(pe).trim());
    const periodStart = usePeriod ? String(ps).trim() : null;
    const periodEndEx = usePeriod ? String(pe).trim() : null;

    /** JOIN กรองสัญญาที่วันเริ่มสัญญาอยู่ในช่วง [period_start, period_end_exclusive) — ตรงกับ dashboard / PM period */
    const contractPeriodJoin = usePeriod
      ? `
      INNER JOIN contract c ON c.contract_id = cd.contract_id
        AND c.start_date IS NOT NULL
        AND DATE(c.start_date) >= ?
        AND DATE(c.start_date) < ?
    `
      : '';

    const periodBindFirst = usePeriod ? [periodStart, periodEndEx] : [];

    const [siteRows] = await db.execute(
      `
      SELECT
        cd.SLid AS slid,
        s.Name AS site_name,
        IFNULL(l.Location2, '') AS location2,
        COUNT(DISTINCT cd.device_id) AS total_devices
      FROM contract_device cd
      ${contractPeriodJoin}
      INNER JOIN sites_location sl ON sl.SLid = cd.SLid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l ON sl.lid = l.lid
      WHERE cd.SLid IS NOT NULL AND cd.device_id IS NOT NULL
      GROUP BY cd.SLid, s.Name, l.Location2
      ORDER BY total_devices DESC
      LIMIT ?
      `,
      [...periodBindFirst, siteLimit]
    );

    if (!siteRows.length) {
      return res.status(200).json({
        success: true,
        sites: [],
        contracts: [],
        matrix: [],
        max_value: 0,
        ...(usePeriod
          ? {
              period: {
                period_start: periodStart,
                period_end_exclusive: periodEndEx,
              },
            }
          : {}),
      });
    }

    const slids = siteRows.map((r) => r.slid);
    const slph = slids.map(() => '?').join(',');

    // ทุกคู่ (SLid, contract) ที่มี device — ใช้สร้าง sites[].contracts (แค่สัญญาที่มีจริงต่อไซต์)
    const [allPairRows] = await db.execute(
      `
      SELECT cd.SLid AS slid, cd.contract_id, COUNT(DISTINCT cd.device_id) AS cnt
      FROM contract_device cd
      ${contractPeriodJoin}
      WHERE cd.SLid IN (${slph}) AND cd.device_id IS NOT NULL
      GROUP BY cd.SLid, cd.contract_id
      `,
      [...periodBindFirst, ...slids]
    );

    const pairList = Array.isArray(allPairRows) ? allPairRows : [];
    const contractTotals = new Map();
    for (const row of pairList) {
      const cid = row.contract_id;
      contractTotals.set(cid, (contractTotals.get(cid) || 0) + Number(row.cnt || 0));
    }
    const contractIds = [...contractTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, contractLimit)
      .map(([cid]) => cid);

    const allCids = [...new Set(pairList.map((r) => r.contract_id))];
    let titleByContractId = {};
    if (allCids.length > 0) {
      const acph = allCids.map(() => '?').join(',');
      const [crowsAll] = await db.execute(
        `SELECT contract_id, contract_name, sof_name FROM contract WHERE contract_id IN (${acph})`,
        allCids
      );
      for (const c of crowsAll) {
        const name = (c.contract_name || '').toString().trim();
        const sof = (c.sof_name || '').toString().trim();
        titleByContractId[c.contract_id] = name || (sof ? `SOF ${sof}` : `สัญญา #${c.contract_id}`);
      }
    }

    let contractMeta = [];
    if (contractIds.length > 0) {
      contractMeta = contractIds.map((cid, j) => ({
        contract_id: cid,
        short_id: String(j + 1).padStart(3, '0'),
        title: titleByContractId[cid] || `สัญญา #${cid}`,
      }));
    }

    const si = Object.fromEntries(slids.map((id, idx) => [Number(id), idx]));
    const ci = Object.fromEntries(contractIds.map((id, idx) => [id, idx]));

    let matrix = siteRows.map(() => contractIds.map(() => 0));
    for (const row of pairList) {
      const i = si[Number(row.slid)];
      const j = ci[row.contract_id];
      if (i != null && j != null) matrix[i][j] = Number(row.cnt || 0);
    }

    const flat = matrix.flat();
    const totals = siteRows.map((r) => Number(r.total_devices || 0));
    const maxVal = Math.max(1, ...flat, ...totals);

    const sites = siteRows.map((r, idx) => {
      const slidNum = Number(r.slid);
      const contractsHere = pairList
        .filter((row) => Number(row.slid) === slidNum)
        .map((row) => ({
          contract_id: row.contract_id,
          cnt: Number(row.cnt || 0),
        }))
        .sort((a, b) => b.cnt - a.cnt)
        .map((row, k) => ({
          contract_id: row.contract_id,
          short_id: String(k + 1).padStart(3, '0'),
          title: titleByContractId[row.contract_id] || `สัญญา #${row.contract_id}`,
          devices: row.cnt,
        }));
      return {
        slid: r.slid,
        site_name: r.site_name || '—',
        location2: r.location2 || '',
        total_devices: Number(r.total_devices || 0),
        rank: idx + 1,
        contracts: contractsHere,
      };
    });

    res.status(200).json({
      success: true,
      sites,
      contracts: contractMeta,
      matrix,
      max_value: maxVal,
      ...(usePeriod
        ? {
            period: {
              period_start: periodStart,
              period_end_exclusive: periodEndEx,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error('Error getting top sites heatmap:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting top sites heatmap',
      error: error.message,
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
        message: 'Please provide contract_id'
      });
    }

    const cid = parseInt(contractId, 10);
    if (isNaN(cid)) {
      return res.status(400).json({
        success: false,
        message: 'contract_id is not valid'
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
      'prim.primary_slid AS site_id',
      'c.sla_term',
      'c.sale_account',
      'c.sof_name',
      'c.Assigned_Service',
      's.Name AS site_name',
      "IFNULL(l_site.Location2, '') AS site_location"
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
      LEFT JOIN (
        SELECT contract_id, MIN(SLid) AS primary_slid
        FROM contract_device
        WHERE SLid IS NOT NULL
        GROUP BY contract_id
      ) prim ON c.contract_id = prim.contract_id
      LEFT JOIN sites_location sl ON prim.primary_slid IS NOT NULL AND sl.SLid = prim.primary_slid
      LEFT JOIN sites s ON sl.Sid = s.Sid
      LEFT JOIN location l_site ON sl.lid = l_site.lid
      WHERE c.contract_id = ?
    `;

    const [contractRows] = await db.execute(contractSql, [cid]);
    
    if (contractRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
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
        created_at,
        contract_snapshot,
        status_history
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
      message: 'Error getting contract by id',
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
        message: 'contract_id is not valid'
      });
    }

    const {
      contract_name,
      start_date,
      end_date,
      site_id,
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

    // ตรวจสอบว่ามี contract นี้หรือไม่ + สถานะเดิม (สำหรับบันทึก Terminated เมื่อเปลี่ยนเป็น not_renewing)
    const [existingContract] = await conn.execute(
      'SELECT contract_id, status FROM contract WHERE contract_id = ?',
      [cid]
    );

    if (existingContract.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const prevDbStatus = existingContract[0].status;

    // Validate SLA Term
    const contractStatus =
      status === 'draft' || status === 'official' || status === 'not_renewing'
        ? status
        : undefined;
    if (sla_term !== undefined && sla_term !== null) {
      const slaTermStr = String(sla_term).trim();
      // ถ้าไม่ใช่ draft และส่งค่า sla_term มา ต้องไม่ว่าง
      if (!slaTermStr && contractStatus !== 'draft') {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: 'Please provide sla_term (required)'
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

    // ดักรูปแบบ Email และ Telephone (รองรับหลายบรรทัด)
    if (email_acc !== undefined && email_acc !== null && !validateMultilineEmails(email_acc).ok) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email address(es); one per line (e.g. example@domain.com)'
      });
    }
    if (tel_acc !== undefined && tel_acc !== null && !validateMultilineTels(tel_acc).ok) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Please provide valid phone number(s); one per line (9–15 digits each)'
      });
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

    if (
      status !== undefined &&
      (status === 'draft' || status === 'official' || status === 'not_renewing')
    ) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    // ไซต์หลักอยู่ที่ contract_device.SLid เท่านั้น — ไม่อัปเดต site_id บนตาราง contract

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

    // อัปเดต Refer_SOF ใน devices เฉพาะเมื่อไม่ใช่ draft — Assigned_Service เก็บที่ contract เท่านั้น
    if (status !== 'draft' && deviceIdList.length > 0 && sof_name != null && String(sof_name).trim() !== '') {
      const placeholders = deviceIdList.map(() => '?').join(',');
      await conn.execute(
        `UPDATE devices SET Refer_SOF = ? WHERE Did IN (${placeholders})`,
        [sof_name.trim(), ...deviceIdList]
      );
    }

    // บันทึกประวัติ Terminated เมื่อกด "Do not renew" (เปลี่ยนเป็น not_renewing ครั้งแรก)
    if (
      status !== undefined &&
      status === 'not_renewing' &&
      prevDbStatus != null &&
      String(prevDbStatus).toLowerCase() !== 'not_renewing'
    ) {
      try {
        const contractSnapshot = await buildContractHistorySnapshot(conn, cid);
        await conn.execute(
          `INSERT INTO contract_history (contract_id, old_contract_id, old_sof, new_sof, renewed_at, contract_snapshot, status_history)
           VALUES (?, NULL, NULL, NULL, NOW(), ?, ?)`,
          [cid, contractSnapshot, 'Terminated']
        );
      } catch (histErr) {
        console.error('Error saving contract history (terminated):', histErr);
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: 'Contract updated successfully',
      data: { contract_id: cid }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error updating contract:', error);
    let message = 'Error updating contract';
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
module.exports = {
  createContract,
  uploadContractFile,
  getContractsBySite,
  postContractHistoryDisplayRows,
  getContractHistoryDetailByHistoryId,
  getAvailableDevices,
  getSitesByContract,
  getDevicesByContract,
  getVendorStatistics,
  getTopSitesByContractDevice,
  getTopSitesHeatmap,
  getContractHistory,
  getContractById,
  updateContract,
};
