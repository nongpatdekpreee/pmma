const db = require('../config/database');

// Ensure tasks table exists (MariaDB 10.4 compatible)
const ensureTaskTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_type ENUM('PM','MA') NOT NULL,
      contract_id INT NULL,
      replacement_device_id INT NULL,
      site_id INT NULL,
      site_name VARCHAR(255) NULL,
      vendor_name VARCHAR(255) NULL,
      duration INT NULL,
      sla_term VARCHAR(255) NULL,
      coverage_scope TEXT NULL,
      priority VARCHAR(50) NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      travel_method VARCHAR(100) NULL,
      travel_cost DECIMAL(12,2) NULL,
      engineers JSON NULL,
      assets JSON NULL,
      status ENUM('not-started','working','stuck','done') DEFAULT 'not-started',
      actually_went TINYINT(1) DEFAULT 0,
      notes TEXT NULL,
      photos JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  await db.execute(sql);
  
  // Add contract_id column if it doesn't exist (for existing tables)
  try {
    await db.execute('ALTER TABLE tasks ADD COLUMN contract_id INT NULL AFTER task_type');
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('Duplicate column name')) {
      console.warn('Error adding contract_id column:', error.message);
    }
  }
  
  // Add replacement_device_id column if it doesn't exist (for existing tables)
  try {
    await db.execute('ALTER TABLE tasks ADD COLUMN replacement_device_id INT NULL AFTER contract_id');
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('Duplicate column name')) {
      console.warn('Error adding replacement_device_id column:', error.message);
    }
  }
};

// Run table creation when controller is loaded
ensureTaskTable().catch((err) => {
  console.error('Error ensuring tasks table:', err.message);
});

const mapTaskRow = (row) => ({
  id: row.id,
  contractId: row.contract_id,
  replacementDeviceId: row.replacement_device_id,
  taskType: row.task_type,
  siteId: row.site_id,
  siteName: row.site_name,
  vendorName: row.vendor_name,
  duration: row.duration,
  slaTerm: row.sla_term,
  coverageScope: row.coverage_scope,
  priority: row.priority,
  startDate: row.start_date,
  endDate: row.end_date,
  travelMethod: row.travel_method,
  travelCost: row.travel_cost,
  engineers: row.engineers ? JSON.parse(row.engineers) : [],
  assets: row.assets ? JSON.parse(row.assets) : [],
  status: row.status || 'not-started',
  actuallyWent: !!row.actually_went,
  notes: row.notes,
  photos: row.photos ? JSON.parse(row.photos) : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper function to update device asset state
const updateDeviceAssetState = async (deviceId, newState, user = null) => {
  try {
    // Get current state
    const [current] = await db.execute('SELECT Asset_State FROM devices WHERE Did = ?', [deviceId]);
    if (current.length === 0) {
      throw new Error(`Device ${deviceId} not found`);
    }
    const oldState = current[0].Asset_State;
    
    if (oldState !== newState) {
      // Update device
      await db.execute('UPDATE devices SET Asset_State = ? WHERE Did = ?', [newState, deviceId]);
      
      // Log history if devices_history table exists
      try {
        await db.execute(
          `INSERT INTO devices_history (Did, Action, Old_Value, New_Value, User, Created_At) 
           VALUES (?, 'ASSET_STATE_CHANGE', ?, ?, ?, NOW())`,
          [deviceId, oldState, newState, user]
        );
      } catch (error) {
        // devices_history table might not exist, ignore
        console.warn('Could not log device history:', error.message);
      }
    }
  } catch (error) {
    console.error(`Error updating device ${deviceId} asset state:`, error);
    throw error;
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
      duration,
      slaTerm,
      coverageScope,
      priority,
      startDate,
      endDate,
      travelMethod,
      travelCost,
      engineers = [],
      assets = [],
      status = 'not-started',
      actuallyWent = false,
      notes = null,
      photos = [],
    } = req.body;

    if (!taskType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ taskType, startDate, endDate',
      });
    }

    await ensureTaskTable();

    const insertSql = `
      INSERT INTO tasks (
        task_type, contract_id, replacement_device_id, site_id, site_name, vendor_name, 
        coverage_scope, priority, start_date, end_date, 
        travel_method, travel_cost, engineers, assets, status, actually_went, notes, photos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Helper function to safely parse integer
    const safeParseInt = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
      return isNaN(parsed) ? null : parsed;
    };

    // Helper function to safely parse float
    const safeParseFloat = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(parsed) ? null : parsed;
    };

    // Prepare values for insertion (must match SQL columns exactly)
    const insertValues = [
      taskType,                                                              // task_type
      safeParseInt(contractId),                                             // contract_id
      safeParseInt(replacementDeviceId),                                     // replacement_device_id
      safeParseInt(siteId),                                                 // site_id
      siteName || null,                                                     // site_name
      vendorName || null,                                                   // vendor_name
      coverageScope || null,                                                 // coverage_scope
      priority || null,                                                     // priority
      startDate,                                                            // start_date
      endDate,                                                              // end_date
      travelMethod || null,                                                  // travel_method
      safeParseFloat(travelCost),                                           // travel_cost
      (engineers && Array.isArray(engineers) && engineers.length > 0) ? JSON.stringify(engineers) : null, // engineers
      (assets && Array.isArray(assets) && assets.length > 0) ? JSON.stringify(assets) : null,             // assets
      status || 'not-started',                                              // status
      actuallyWent ? 1 : 0,                                                 // actually_went
      notes || null,                                                        // notes
      photos && Array.isArray(photos) && photos.length > 0 ? JSON.stringify(photos) : null, // photos
    ];

    const [result] = await db.execute(insertSql, insertValues);

    // Handle replacement device asset state changes and contract_device update
    if (replacementDeviceId && assets && Array.isArray(assets) && assets.length > 0 && taskType === 'MA') {
      try {
        // Get first asset ID (original device that will be replaced)
        const firstAsset = assets[0];
        let originalDeviceId;
        
        if (typeof firstAsset === 'object') {
          originalDeviceId = firstAsset.id || firstAsset.Did || firstAsset;
        } else {
          originalDeviceId = firstAsset;
        }
        
        // Convert to number if needed
        const replacementId = typeof replacementDeviceId === 'number' ? replacementDeviceId : parseInt(String(replacementDeviceId), 10);
        const originalId = typeof originalDeviceId === 'number' ? originalDeviceId : parseInt(String(originalDeviceId), 10);
        const contractIdNum = safeParseInt(contractId);
        
        if (!isNaN(replacementId)) {
          // Update replacement device: In Store -> In Use
          await updateDeviceAssetState(replacementId, 'In Use', req.user?.username || req.user?.id || null);
        }
        
        if (!isNaN(originalId)) {
          // Update original device: current state -> In Store
          await updateDeviceAssetState(originalId, 'In Store', req.user?.username || req.user?.id || null);
        }

        // Update contract_device: replace broken device with replacement device
        if (contractIdNum && !isNaN(originalId) && !isNaN(replacementId)) {
          try {
            // Check if the broken device exists in contract_device
            const [existing] = await db.execute(
              'SELECT * FROM contract_device WHERE contract_id = ? AND device_id = ?',
              [contractIdNum, originalId]
            );

            if (existing.length > 0) {
              // Get SLid of replacement device from Devices table
              const [replacementDevice] = await db.execute(
                'SELECT SLid FROM devices WHERE Did = ?',
                [replacementId]
              );
              const replacementSLid = replacementDevice.length > 0 ? replacementDevice[0].SLid : null;
              
              // Update: Delete old device and insert new device
              await db.execute(
                'DELETE FROM contract_device WHERE contract_id = ? AND device_id = ?',
                [contractIdNum, originalId]
              );
              
              // Insert replacement device (only if not already exists)
              const [checkExisting] = await db.execute(
                'SELECT * FROM contract_device WHERE contract_id = ? AND device_id = ?',
                [contractIdNum, replacementId]
              );
              
              if (checkExisting.length === 0) {
                await db.execute(
                  'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                  [contractIdNum, replacementId, replacementSLid]
                );
                console.log(`Updated contract_device: Replaced device ${originalId} with ${replacementId} (SLid: ${replacementSLid}) in contract ${contractIdNum}`);
              } else {
                console.log(`Device ${replacementId} already exists in contract ${contractIdNum}, skipping insert`);
              }
            } else {
              console.log(`Device ${originalId} not found in contract_device for contract ${contractIdNum}, skipping update`);
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
    }

    const [rows] = await db.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
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
    await ensureTaskTable();
    const [rows] = await db.execute('SELECT * FROM tasks ORDER BY start_date DESC, id DESC');
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(mapTaskRow),
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Task',
      error: error.message,
    });
  }
};

// GET /api/tasks/:id
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Task' });
    }
    res.status(200).json({ success: true, data: mapTaskRow(rows[0]) });
  } catch (error) {
    console.error('Error getting task by id:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึง Task',
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
      coverageScope,
      priority,
      startDate,
      endDate,
      travelMethod,
      travelCost,
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
      return res.status(404).json({ success: false, message: 'ไม่พบ Task สำหรับอัพเดท' });
    }

    // Helper function to safely parse integer
    const safeParseInt = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
      return isNaN(parsed) ? null : parsed;
    };

    const oldReplacementDeviceId = existing[0].replacement_device_id;
    const oldAssets = existing[0].assets ? JSON.parse(existing[0].assets) : [];

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
    
    if (coverageScope !== undefined) addUpdate('coverage_scope', coverageScope || null);
    if (priority !== undefined) addUpdate('priority', priority || null);
    if (startDate !== undefined) addUpdate('start_date', startDate);
    if (endDate !== undefined) addUpdate('end_date', endDate);
    if (travelMethod !== undefined) addUpdate('travel_method', travelMethod || null);
    if (travelCost !== undefined) addUpdate('travel_cost', travelCost !== '' ? travelCost : null);
    if (engineers !== undefined) addUpdate('engineers', engineers && engineers.length > 0 ? JSON.stringify(engineers) : null);
    if (assets !== undefined) addUpdate('assets', assets && assets.length > 0 ? JSON.stringify(assets) : null);
    if (status !== undefined) addUpdate('status', status || 'not-started');
    if (actuallyWent !== undefined) addUpdate('actually_went', actuallyWent ? 1 : 0);
    if (notes !== undefined) addUpdate('notes', notes || null);
    if (photos !== undefined) addUpdate('photos', photos && photos.length > 0 ? JSON.stringify(photos) : null);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลสำหรับอัพเดท' });
    }

    values.push(id);
    const updateSql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    await db.execute(updateSql, values);

    // Handle replacement device asset state changes and contract_device update
    const newReplacementDeviceId = replacementDeviceId !== undefined ? replacementDeviceId : oldReplacementDeviceId;
    const newAssets = assets !== undefined ? assets : oldAssets;
    const newContractId = contractId !== undefined ? contractId : existing[0].contract_id;
    const currentTaskType = taskType !== undefined ? taskType : existing[0].task_type;
    
    if (newReplacementDeviceId && newAssets && newAssets.length > 0 && currentTaskType === 'MA') {
      try {
        // Revert old replacement device if changed (In Use -> In Store)
        if (oldReplacementDeviceId && oldReplacementDeviceId !== newReplacementDeviceId) {
          await updateDeviceAssetState(oldReplacementDeviceId, 'In Store', req.user?.username || req.user?.id || null);
        }
        
        // Update new replacement device: In Store -> In Use
        if (newReplacementDeviceId !== oldReplacementDeviceId) {
          await updateDeviceAssetState(newReplacementDeviceId, 'In Use', req.user?.username || req.user?.id || null);
        }
        
        // Get new original device ID
        const newFirstAsset = newAssets[0];
        const newOriginalDeviceId = typeof newFirstAsset === 'object' ? (newFirstAsset.id || newFirstAsset.Did || newFirstAsset) : newFirstAsset;
        
        // Revert old original device if assets changed (In Store -> previous state, but we'll set to In Store anyway)
        if (JSON.stringify(oldAssets) !== JSON.stringify(newAssets) && oldAssets.length > 0) {
          const oldFirstAsset = oldAssets[0];
          const oldOriginalDeviceId = typeof oldFirstAsset === 'object' ? (oldFirstAsset.id || oldFirstAsset.Did || oldFirstAsset) : oldFirstAsset;
          if (oldOriginalDeviceId && oldOriginalDeviceId !== newOriginalDeviceId) {
            // Only revert if it's a different device
            await updateDeviceAssetState(oldOriginalDeviceId, 'In Store', req.user?.username || req.user?.id || null);
          }
        }
        
        // Update new original device: current state -> In Store
        if (newOriginalDeviceId) {
          await updateDeviceAssetState(newOriginalDeviceId, 'In Store', req.user?.username || req.user?.id || null);
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
              
              // Insert replacement device (only if not already exists)
              const [checkExisting] = await db.execute(
                'SELECT * FROM contract_device WHERE contract_id = ? AND device_id = ?',
                [contractIdNum, replacementIdNum]
              );
              
              if (checkExisting.length === 0) {
                await db.execute(
                  'INSERT INTO contract_device (contract_id, device_id, SLid) VALUES (?, ?, ?)',
                  [contractIdNum, replacementIdNum, replacementSLid]
                );
                console.log(`Updated contract_device: Replaced device ${originalIdNum} with ${replacementIdNum} (SLid: ${replacementSLid}) in contract ${contractIdNum}`);
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
    } else if (oldReplacementDeviceId && (!newReplacementDeviceId || newAssets.length === 0)) {
      // If replacement device is removed, revert it back to In Store
      try {
        await updateDeviceAssetState(oldReplacementDeviceId, 'In Store', req.user?.username || req.user?.id || null);
      } catch (error) {
        console.error('Error reverting replacement device:', error);
      }
    }

    const [rows] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    res.status(200).json({
      success: true,
      message: 'อัพเดท Task สำเร็จ',
      data: mapTaskRow(rows[0]),
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดท Task',
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
      return res.status(404).json({ success: false, message: 'ไม่พบ Task สำหรับลบ' });
    }

    // Delete the task
    await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
    
    res.status(200).json({
      success: true,
      message: 'ลบ Task สำเร็จ',
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Task',
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
};
