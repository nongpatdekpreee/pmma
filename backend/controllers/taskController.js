const db = require('../config/database');

// app_db tasks: id, task_type, contract_id, assets, replacement_device_id, site_id, site_name,
// vendor_name, coverage_scope, start_date, end_date, engineers, asset_binding,
// status, actually_went, notes, photos, created_at, updated_at

// Helper function - สร้าง task id ถัดไปโดยอัตโนมัติ (ใช้เลขที่ว่างก่อน)
const generateNextTaskId = async () => {
  try {
    // ดึง id ทั้งหมดจาก database
    const sql = `SELECT id FROM tasks ORDER BY id DESC`;
    const [rows] = await db.execute(sql);
    
    if (rows.length === 0) {
      // ถ้ายังไม่มีข้อมูลเลย ให้เริ่มที่ 1
      return 1;
    }
    
    // แปลง id ทั้งหมดเป็นตัวเลขและเก็บไว้ใน array
    const numericIds = [];
    for (const row of rows) {
      const taskId = row.id;
      // id เป็น INT แล้ว
      if (taskId != null && !isNaN(taskId)) {
        const num = parseInt(taskId, 10);
        if (!isNaN(num)) {
          numericIds.push(num);
        }
      }
    }
    
    if (numericIds.length === 0) {
      // ถ้าไม่มี id ที่เป็นตัวเลขเลย ให้เริ่มที่ 1
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
        console.log(`Found gap: using task id ${i} (max was: ${maxId})`);
        return i;
      }
    }
    
    // ถ้าไม่มีเลขว่างแล้ว ให้ใช้เลขถัดไปจาก max
    const nextId = maxId + 1;
    console.log(`No gaps found: using next task id ${nextId} (max was: ${maxId})`);
    return nextId;
  } catch (error) {
    console.error('Error generating next task id:', error);
    throw error;
  }
};

/** คืนค่า date เป็น string YYYY-MM-DD ตามที่เก็บใน DB (ส่งเป็น string เลย ไม่ให้ JSON serialize เป็น ISO แล้วเลื่อนวัน) */
const toDateOnlyString = (val) => {
  if (val == null) return null;
  if (typeof val === 'string') return val.trim().substring(0, 10) || null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
};

const mapTaskRow = (row) => {
  const slaVal = row.contract_sla_term;
  return {
  id: row.id,
  contractId: row.contract_id,
  replacementDeviceId: row.replacement_device_id,
  taskType: row.task_type,
  siteId: row.site_id,
  siteName: row.site_name,
  vendorName: row.vendor_name,
  vendorTel: row.vendor_tel,
  reporterName: row.reporter_name,
  reporterTel: row.reporter_tel,
  ticket: row.ticket,
  rootCause: row.root_cause,
  resolution: row.resolution,
  ...(slaVal != null && slaVal !== '' ? { slaTerm: slaVal } : {}),
  coverageScope: row.coverage_scope,
  startDate: toDateOnlyString(row.start_date),
  endDate: toDateOnlyString(row.end_date),
  engineers: row.engineers ? (typeof row.engineers === 'string' ? JSON.parse(row.engineers) : row.engineers) : [],
  assets: row.assets ? (typeof row.assets === 'string' ? JSON.parse(row.assets) : row.assets) : [],
  assetBinding: row.asset_binding,
  status: row.status || 'not-started',
  actuallyWent: !!row.actually_went,
  notes: row.notes,
  photos: row.photos ? (typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos) : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};
};
// devices_history is populated by DB trigger (trg_devices_update)
const updateDeviceAssetState = async (deviceId, newState) => {
  const [current] = await db.execute('SELECT Asset_State FROM devices WHERE Did = ?', [deviceId]);
  if (current.length === 0) throw new Error(`Device ${deviceId} not found`);
  if (current[0].Asset_State !== newState) {
    await db.execute('UPDATE devices SET Asset_State = ? WHERE Did = ?', [newState, deviceId]);
  }
};

// POST /api/tasks
const createTask = async (req, res) => {
  try {
    const {
      taskType,
      contractId,
      replacementDeviceId,
      siteId,
      siteName,
      vendorName,
      vendorTel,
      reporterName,
      reporterTel,
      ticket,
      rootCause,
      resolution,
      coverageScope,
      startDate,
      endDate,
      engineers = [],
      assets = [],
      assetBinding,
      status = 'not-started',
      actuallyWent = false,
      notes = null,
      photos = [],
    } = req.body;

    if (!taskType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please specify taskType, startDate, endDate',
      });
    }

    // สร้าง task id ใหม่โดยอัตโนมัติ (ใช้เลขที่ว่างก่อน)
    const newTaskId = await generateNextTaskId();
    
    // ตรวจสอบว่า task id นี้มีอยู่แล้วหรือไม่ (ป้องกัน race condition)
    const checkSql = `SELECT id FROM tasks WHERE id = ?`;
    const [existing] = await db.execute(checkSql, [newTaskId]);
    
    let finalTaskId = newTaskId;
    if (existing.length > 0) {
      // ถ้ามีแล้ว (อาจเกิดจาก race condition) ให้ลองหาใหม่
      finalTaskId = await generateNextTaskId();
      const [retryExisting] = await db.execute(checkSql, [finalTaskId]);
      if (retryExisting.length > 0) {
        throw new Error('ไม่สามารถสร้าง task id ที่ไม่ซ้ำได้ กรุณาลองใหม่อีกครั้ง');
      }
    }

    const insertSql = `
      INSERT INTO tasks (
        id, task_type, contract_id, replacement_device_id, site_id, site_name, vendor_name, vendor_tel
        , reporter_name, reporter_tel, ticket
        , root_cause, resolution
        , coverage_scope, start_date, end_date, engineers, assets, asset_binding, status, actually_went, notes, photos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const safeParseInt = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
      return isNaN(parsed) ? null : parsed;
    };

    const insertValues = [
      finalTaskId,
      taskType,
      safeParseInt(contractId),
      safeParseInt(replacementDeviceId),
      safeParseInt(siteId),
      siteName || null,
      vendorName || null,
      vendorTel || null,
      reporterName || null,
      reporterTel || null,
      ticket || null,
      rootCause || null,
      resolution || null,
      coverageScope || null,
      startDate,
      endDate,
      (engineers && Array.isArray(engineers) && engineers.length > 0) ? JSON.stringify(engineers) : null,
      (assets && Array.isArray(assets) && assets.length > 0) ? JSON.stringify(assets) : null,
      assetBinding || null,
      status || 'not-started',
      actuallyWent ? 1 : 0,
      notes || null,
      photos && Array.isArray(photos) && photos.length > 0 ? JSON.stringify(photos) : null,
    ];

    await db.execute(insertSql, insertValues);

    // MA: Asset_State และ SLid จะถูกอัปเดตเมื่อกด Done ใน detail เท่านั้น (ไม่ทำที่นี่)

    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term FROM tasks t LEFT JOIN contract c ON t.contract_id = c.contract_id WHERE t.id = ?`,
      [finalTaskId]
    );
    return res.status(201).json({
      success: true,
      message: 'สร้าง Task สำเร็จ',
      data: mapTaskRow(rows[0]),
    });
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง Task',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// GET /api/tasks
const getTasks = async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term
       FROM tasks t
       LEFT JOIN contract c ON t.contract_id = c.contract_id
       ORDER BY t.start_date DESC, t.id DESC`
    );
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(mapTaskRow),
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tasks',
      error: error.message,
    });
  }
};


const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term
       FROM tasks t
       LEFT JOIN contract c ON t.contract_id = c.contract_id
       WHERE t.id = ?`,
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({ success: true, data: mapTaskRow(rows[0]) });
  } catch (error) {
    console.error('Error getting task by id:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting task by id',
      error: error.message,
    });
  }
};

// PUT /api/tasks/:id
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      taskType,
      contractId,
      replacementDeviceId,
      siteId,
      siteName,
      vendorName,
      vendorTel,
      reporterName,
      reporterTel,
      ticket,
      rootCause,
      resolution,
      coverageScope,
      startDate,
      endDate,
      engineers,
      assets,
      assetBinding,
      status,
      actuallyWent,
      notes,
      photos,
    } = req.body;

    const [existing] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing[0]) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Helper function to safely parse integer
    const safeParseInt = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
      return isNaN(parsed) ? null : parsed;
    };

    const oldReplacementDeviceId = existing[0].replacement_device_id;
    const oldAssets = existing[0].assets
      ? (typeof existing[0].assets === 'string' ? JSON.parse(existing[0].assets) : existing[0].assets)
      : [];

    const updates = [];
    const values = [];

    const addUpdate = (field, value) => {
      updates.push(`${field} = ?`);
      values.push(value);
    };

    if (taskType !== undefined) addUpdate('task_type', taskType);
    if (contractId !== undefined) addUpdate('contract_id', contractId || null);
    if (replacementDeviceId !== undefined) addUpdate('replacement_device_id', replacementDeviceId || null);
    if (siteId !== undefined) addUpdate('site_id', siteId || null);
    if (siteName !== undefined) addUpdate('site_name', siteName || null);
    if (vendorName !== undefined) addUpdate('vendor_name', vendorName || null);
    if (vendorTel !== undefined) addUpdate('vendor_tel', vendorTel || null);
    if (reporterName !== undefined) addUpdate('reporter_name', reporterName || null);
    if (reporterTel !== undefined) addUpdate('reporter_tel', reporterTel || null);
    if (ticket !== undefined) addUpdate('ticket', ticket || null);
    if (rootCause !== undefined) addUpdate('root_cause', rootCause || null);
    if (resolution !== undefined) addUpdate('resolution', resolution || null);
    if (coverageScope !== undefined) addUpdate('coverage_scope', coverageScope || null);
    // Task ที่เป็น Done แล้วไม่สามารถแก้ไขวันที่ได้
    if (existing[0].status !== 'done') {
      if (startDate !== undefined) addUpdate('start_date', startDate);
      if (endDate !== undefined) addUpdate('end_date', endDate);
    }
    if (engineers !== undefined) addUpdate('engineers', engineers && engineers.length > 0 ? JSON.stringify(engineers) : null);
    if (assets !== undefined) addUpdate('assets', assets && assets.length > 0 ? JSON.stringify(assets) : null);
    if (assetBinding !== undefined) addUpdate('asset_binding', assetBinding || null);
    if (status !== undefined) addUpdate('status', status || 'not-started');
    if (actuallyWent !== undefined) addUpdate('actually_went', actuallyWent ? 1 : 0);
    if (notes !== undefined) addUpdate('notes', notes || null);
    if (photos !== undefined) addUpdate('photos', photos && photos.length > 0 ? JSON.stringify(photos) : null);

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No data to update' });
    }

    values.push(id);
    const updateSql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    await db.execute(updateSql, values);

    // Handle replacement device asset state changes and contract_device update
    // MA: อัปเดต Asset_State และ SLid เฉพาะเมื่อ status = 'done' (กด Done ใน detail)
    const newStatus = status !== undefined ? (status || 'not-started') : existing[0].status;
    const newReplacementDeviceId = replacementDeviceId !== undefined ? replacementDeviceId : oldReplacementDeviceId;
    const newAssets = assets !== undefined ? assets : oldAssets;
    const newContractId = contractId !== undefined ? contractId : existing[0].contract_id;
    const currentTaskType = taskType !== undefined ? taskType : existing[0].task_type;

    if (newStatus === 'done' && newReplacementDeviceId && newAssets && newAssets.length > 0 && currentTaskType === 'MA') {
      try {
        const isBecomingDone = existing[0].status !== 'done' && newStatus === 'done';

        // Revert old replacement device if changed (In Use -> In Store, เคลียร์ SLid)
        if (oldReplacementDeviceId && oldReplacementDeviceId !== newReplacementDeviceId) {
          await updateDeviceAssetState(oldReplacementDeviceId, 'In Store');
          await db.execute('UPDATE devices SET SLid = NULL WHERE Did = ?', [oldReplacementDeviceId]);
        }

        // Update new replacement device: In Store -> In Use, อัปเดต SLid เป็น site ของ task
        const taskSiteId = siteId !== undefined ? safeParseInt(siteId) : existing[0].site_id;
        if (isBecomingDone || newReplacementDeviceId !== oldReplacementDeviceId) {
          await updateDeviceAssetState(newReplacementDeviceId, 'In Use');
        }
        if (taskSiteId && newReplacementDeviceId) {
          await db.execute('UPDATE devices SET SLid = ? WHERE Did = ?', [taskSiteId, newReplacementDeviceId]);
        }

        // Get new original device ID
        const newFirstAsset = newAssets[0];
        const newOriginalDeviceId = typeof newFirstAsset === 'object' ? (newFirstAsset.id || newFirstAsset.Did || newFirstAsset) : newFirstAsset;
        
        // Revert old original device if assets changed (In Store -> previous state, but we'll set to In Store anyway)
        if (JSON.stringify(oldAssets) !== JSON.stringify(newAssets) && oldAssets.length > 0) {
          const oldFirstAsset = oldAssets[0];
          const oldOriginalDeviceId = typeof oldFirstAsset === 'object' ? (oldFirstAsset.id || oldFirstAsset.Did || oldFirstAsset) : oldFirstAsset;
          if (oldOriginalDeviceId && oldOriginalDeviceId !== newOriginalDeviceId) {
            await updateDeviceAssetState(oldOriginalDeviceId, 'In Store');
            await db.execute('UPDATE devices SET SLid = 2 WHERE Did = ?', [oldOriginalDeviceId]);
          }
        }
        
        // Update new original device: current state -> In Store, ย้ายไป SLid = 2 (คลัง)
        if (newOriginalDeviceId) {
          await updateDeviceAssetState(newOriginalDeviceId, 'In Store');
          await db.execute('UPDATE devices SET SLid = 2 WHERE Did = ?', [newOriginalDeviceId]);
        }

        // Update contract_device: replace broken device with replacement device
        const contractIdNum = safeParseInt(newContractId);
        const replacementIdNum = typeof newReplacementDeviceId === 'number' ? newReplacementDeviceId : parseInt(String(newReplacementDeviceId), 10);
        const originalIdNum = typeof newOriginalDeviceId === 'number' ? newOriginalDeviceId : parseInt(String(newOriginalDeviceId), 10);

        if (contractIdNum && !isNaN(originalIdNum) && !isNaN(replacementIdNum)) {
          try {
            // Check if the broken device exists in contract_device
            const [existingContractDevice] = await db.execute(
              'SELECT * FROM contract_device WHERE contract_id = ? AND device_id = ?',
              [contractIdNum, originalIdNum]
            );

            if (existingContractDevice.length > 0) {
              // Get SLid of replacement device from Devices table
              const [replacementDevice] = await db.execute(
                'SELECT SLid FROM devices WHERE Did = ?',
                [replacementIdNum]
              );
              const replacementSLid = replacementDevice.length > 0 ? replacementDevice[0].SLid : null;
              
              // Update: Delete old device and insert new device
              await db.execute(
                'DELETE FROM contract_device WHERE contract_id = ? AND device_id = ?',
                [contractIdNum, originalIdNum]
              );
              
              const [checkExisting] = await db.execute(
                'SELECT * FROM contract_device WHERE contract_id = ? AND device_id = ?',
                [contractIdNum, replacementIdNum]
              );
              
              if (checkExisting.length === 0) {
                const slidToUse = taskSiteId != null ? taskSiteId : replacementSLid;
                if (slidToUse != null) {
                  await db.execute(
                    'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                    [contractIdNum, replacementIdNum, slidToUse]
                  ).catch(() => db.execute(
                    'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
                    [contractIdNum, replacementIdNum]
                  ));
                } else {
                  await db.execute(
                    'INSERT INTO contract_device (contract_id, device_id) VALUES (?, ?)',
                    [contractIdNum, replacementIdNum]
                  );
                }
                console.log(`Updated contract_device: Replaced device ${originalIdNum} with ${replacementIdNum} in contract ${contractIdNum}`);
              } else {
                console.log(`Device ${replacementIdNum} already exists in contract ${contractIdNum}, skipping insert`);
              }
            } else {
              console.log(`Device ${originalIdNum} not found in contract_device for contract ${contractIdNum}, skipping update`);
            }
          } catch (error) {
            console.error('Error updating contract_device:', error);
            // Continue even if contract_device update fails
          }
        }
      } catch (error) {
        console.error('Error updating device asset states:', error);
        // Continue even if asset state update fails
      }
    } else if (existing[0].status === 'done' && oldReplacementDeviceId && (!newReplacementDeviceId || !newAssets || newAssets.length === 0)) {
      // Revert: เคยเป็น done แล้วลบ replacement/assets ออก ให้ revert อุปกรณ์กลับ
      try {
        await updateDeviceAssetState(oldReplacementDeviceId, 'In Store');
        await db.execute('UPDATE devices SET SLid = NULL WHERE Did = ?', [oldReplacementDeviceId]);
      } catch (error) {
        console.error('Error reverting replacement device:', error);
      }
    }

    const [rows] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: mapTaskRow(rows[0]),
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message,
    });
  }
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if task exists
    const [existing] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing[0]) {
      return res.status(404).json({ success: false, message: ' Task not found' });
    }

    // ลบ report ที่ผูกกับ task นี้ก่อน (FK report.id -> tasks.id) เพื่อไม่ให้ constraint กันการลบ
    await db.execute('DELETE FROM report WHERE id = ?', [id]);

    // Delete the task
    await db.execute('DELETE FROM tasks WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message,
    });
  }
};

// GET /api/tasks/check-conflict - เช็คว่า engineer มีงานซ้อนทับหรือไม่
const checkEngineerConflict = async (req, res) => {
  try {
    const { engineerId, startDate, endDate, excludeTaskId } = req.query;

    if (!engineerId || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Please specify engineerId and startDate',
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    
    // Format dates as YYYY-MM-DD for SQL comparison
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const startDateStr = formatDate(start);
    const endDateStr = formatDate(end);

    // Query tasks ที่ engineer คนนี้มีงานและ overlap กับวันที่ที่ระบุ
    // engineers เก็บเป็น JSON array เช่น [{"id":"9","name":"Chainarin","lastName":"Phosai"}]
    // ใช้ JSON_SEARCH เพื่อหา engineer ID ใน array โดยเช็คทั้ง id property และ value โดยตรง
    // Overlap condition: (newStart <= existingEnd AND newEnd >= existingStart)
    let sql = `
      SELECT t.id, t.site_name, t.start_date, t.end_date, t.engineers
      FROM tasks t
      WHERE t.start_date IS NOT NULL
        AND t.engineers IS NOT NULL
        AND (
          JSON_SEARCH(t.engineers, 'one', ?, NULL, '$[*].id') IS NOT NULL
          OR JSON_CONTAINS(t.engineers, JSON_QUOTE(?))
        )
        AND (
          (t.start_date <= ? AND COALESCE(t.end_date, t.start_date) >= ?)
        )
    `;
    
    const params = [String(engineerId), String(engineerId), endDateStr, startDateStr];

    // ถ้ามี excludeTaskId (เช่น ตอน edit) ให้ข้าม task นั้น
    if (excludeTaskId) {
      sql += ` AND t.id != ?`;
      params.push(excludeTaskId);
    }

    sql += ` ORDER BY t.start_date ASC LIMIT 1`;

    const [rows] = await db.execute(sql, params);

    if (rows.length > 0) {
      const conflictingTask = mapTaskRow(rows[0]);
      return res.status(200).json({
        success: true,
        hasConflict: true,
        conflictingTask: {
          id: conflictingTask.id,
          siteName: conflictingTask.siteName,
          startDate: conflictingTask.startDate,
          endDate: conflictingTask.endDate,
        },
      });
    }

    return res.status(200).json({
      success: true,
      hasConflict: false,
      conflictingTask: null,
    });
  } catch (error) {
    console.error('Error checking engineer conflict:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking engineer conflict',
      error: error.message,
    });
  }
};

// GET /api/tasks/overdue?task_type=MA | PM — ดึงงานเกินกำหนด: status='not-started', end_date < CURRENT_DATE, แยกตาม task_type
const getOverdueTasks = async (req, res) => {
  try {
    const taskType = (req.query.task_type || '').toUpperCase();
    const sid = req.query.sid != null && req.query.sid !== '' ? Number(req.query.sid) : null;
    const lid = req.query.lid != null && req.query.lid !== '' ? Number(req.query.lid) : null;
    if (taskType !== 'MA' && taskType !== 'PM') {
      return res.status(400).json({
        success: false,
        message: 'Please specify task_type as MA or PM',
      });
    }
    if ((sid != null && Number.isNaN(sid)) || (lid != null && Number.isNaN(lid))) {
      return res.status(400).json({
        success: false,
        message: 'Please specify sid/lid as a number',
      });
    }
    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term
       FROM tasks t
       LEFT JOIN contract c ON t.contract_id = c.contract_id
       LEFT JOIN sites_location sl ON sl.SLid = t.site_id
       WHERE t.status = 'not-started' AND t.end_date < CURRENT_DATE AND t.task_type = ?
         AND (? IS NULL OR sl.Sid = ?)
         AND (? IS NULL OR sl.lid = ?)
       ORDER BY t.end_date ASC, t.id ASC`,
      [taskType, sid, sid, lid, lid]
    );
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(mapTaskRow),
    });
  } catch (error) {
    console.error('Error getting overdue tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting overdue tasks',
      error: error.message,
    });
  }
};

// GET /api/tasks/completed?task_type=MA | PM — ดึงงานที่เสร็จแล้ว: status='done', แยกตาม task_type
const getCompletedTasks = async (req, res) => {
  try {
    const taskType = (req.query.task_type || '').toUpperCase();
    const sid = req.query.sid != null && req.query.sid !== '' ? Number(req.query.sid) : null;
    const lid = req.query.lid != null && req.query.lid !== '' ? Number(req.query.lid) : null;
    if (taskType !== 'MA' && taskType !== 'PM') {
      return res.status(400).json({
        success: false,
        message: 'Please specify task_type as MA or PM',
      });
    }
    if ((sid != null && Number.isNaN(sid)) || (lid != null && Number.isNaN(lid))) {
      return res.status(400).json({
        success: false,
        message: 'Please specify sid/lid as a number',
      });
    }
    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term
       FROM tasks t
       LEFT JOIN contract c ON t.contract_id = c.contract_id
       LEFT JOIN sites_location sl ON sl.SLid = t.site_id
       WHERE t.status = 'done' AND t.task_type = ?
         AND (? IS NULL OR sl.Sid = ?)
         AND (? IS NULL OR sl.lid = ?)
       ORDER BY t.end_date DESC, t.id DESC`,
      [taskType, sid, sid, lid, lid]
    );
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(mapTaskRow),
    });
  } catch (error) {
    console.error('Error getting completed tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting completed tasks',
      error: error.message,
    });
  }
};

// GET /api/tasks/inprocess?task_type=MA | PM — นิยามตาม analytics:
// - inprocess = status='working' OR (status='done' AND ไม่มี report)
const getInprocessTasks = async (req, res) => {
  try {
    const taskType = (req.query.task_type || '').toUpperCase();
    const sid = req.query.sid != null && req.query.sid !== '' ? Number(req.query.sid) : null;
    const lid = req.query.lid != null && req.query.lid !== '' ? Number(req.query.lid) : null;
    if (taskType !== 'MA' && taskType !== 'PM') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ task_type เป็น MA หรือ PM',
      });
    }
    if ((sid != null && Number.isNaN(sid)) || (lid != null && Number.isNaN(lid))) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ sid/lid เป็นตัวเลข',
      });
    }
    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term
       FROM tasks t
       LEFT JOIN contract c ON t.contract_id = c.contract_id
       LEFT JOIN report r ON r.id = t.id
       LEFT JOIN sites_location sl ON sl.SLid = t.site_id
       WHERE t.task_type = ?
         AND (LOWER(t.status) = 'working' OR (LOWER(t.status) = 'done' AND r.id IS NULL))
         AND (? IS NULL OR sl.Sid = ?)
         AND (? IS NULL OR sl.lid = ?)
       ORDER BY t.end_date ASC, t.id ASC`,
      [taskType, sid, sid, lid, lid]
    );
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(mapTaskRow),
    });
  } catch (error) {
    console.error('Error getting inprocess tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting inprocess tasks',
      error: error.message,
    });
  }
};

// GET /api/tasks/pending?task_type=MA | PM — นิยามตาม analytics:
// - pending = status NOT IN ('done','working') AND (end_date IS NULL OR end_date >= CURRENT_DATE)
const getPendingTasks = async (req, res) => {
  try {
    const taskType = (req.query.task_type || '').toUpperCase();
    const sid = req.query.sid != null && req.query.sid !== '' ? Number(req.query.sid) : null;
    const lid = req.query.lid != null && req.query.lid !== '' ? Number(req.query.lid) : null;
    if (taskType !== 'MA' && taskType !== 'PM') {
      return res.status(400).json({
        success: false,
        message: 'Please specify task_type as MA or PM',
      });
    }
    if ((sid != null && Number.isNaN(sid)) || (lid != null && Number.isNaN(lid))) {
      return res.status(400).json({
        success: false,
        message: 'Please specify sid/lid as a number',
      });
    }
    const [rows] = await db.execute(
      `SELECT t.*, c.sla_term AS contract_sla_term
       FROM tasks t
       LEFT JOIN contract c ON t.contract_id = c.contract_id
       LEFT JOIN sites_location sl ON sl.SLid = t.site_id
       WHERE t.task_type = ?
         AND LOWER(t.status) NOT IN ('done', 'working')
         AND (t.end_date IS NULL OR t.end_date >= CURRENT_DATE)
         AND (? IS NULL OR sl.Sid = ?)
         AND (? IS NULL OR sl.lid = ?)
       ORDER BY (t.end_date IS NULL) ASC, t.end_date ASC, t.id ASC`,
      [taskType, sid, sid, lid, lid]
    );
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(mapTaskRow),
    });
  } catch (error) {
    console.error('Error getting pending tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pending tasks',
      error: error.message,
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  checkEngineerConflict,
  getOverdueTasks,
  getCompletedTasks,
  getInprocessTasks,
  getPendingTasks,
};
