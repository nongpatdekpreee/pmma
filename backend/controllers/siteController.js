const db = require('../config/database');
const { applyReferSofToSiteLocation, syncSofRenameOnSiteLocations } = require('../config/deviceSof');
const { resolveSlSofSchema } = require('../lib/slSofSchema');

// POST - สร้าง Site ใหม่
const createSite = async (req, res) => {
  try {
    const { name, slug, status } = req.body;
    if (!name || !slug || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete data (Name, Slug, Status)'
      });
    }
    // SQL Query
    const sql = 'INSERT INTO sites (Name, Slug, Status) VALUES (?, ?, ?)';
    const [result] = await db.execute(sql, [name, slug, status]);

    res.status(201).json({
      success: true,
      message: 'Site created successfully',
      data: {
        id: result.insertId,
        name,
        slug,
        status
      }
    });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating site',
      error: error.message
    });
  }
};

// GET - ดึง Sites_Location (สำหรับ contract.site_id = SLid, dropdown Site)
const getSitesLocation = async (req, res) => {
  try {
    const slSof = await resolveSlSofSchema();
    const sql = `
      SELECT SL.SLid, SL.Sid, SL.lid, ${slSof.locationSofSelect('SL')},
             S.Name AS SiteName, L.Location2, IFNULL(L.Province, '') AS Province
      FROM sites_location SL
      JOIN sites S ON SL.Sid = S.Sid
      JOIN location L ON SL.lid = L.lid
      ORDER BY S.Name, L.Location2
    `;
    const [rows] = await db.execute(sql);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting sites-location:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sites-location',
      error: error.message
    });
  }
};

// GET - ดึง Sites_Location ที่มี SOF ตรงกับ sites_location.SOF (schema ใหม่)
const getSitesLocationBySOF = async (req, res) => {
  try {
    const referSOF = req.query.refer_sof;
    if (!referSOF) {
      return res.status(400).json({
        success: false,
        message: 'Please provide refer_sof'
      });
    }
    const referSOFTrim = String(referSOF).replace(/^0+/, '') || '0';
    const slSof = await resolveSlSofSchema();
    const sql = `
      SELECT DISTINCT SL.SLid, SL.Sid, SL.lid, S.Name AS SiteName, L.Location2, IFNULL(L.Province, '') AS Province
      FROM sites_location SL
      JOIN sites S ON SL.Sid = S.Sid
      JOIN location L ON SL.lid = L.lid
      WHERE ${slSof.sofMatchWhere('SL')}
      ORDER BY S.Name, L.Location2
    `;
    const [rows] = await db.execute(sql, slSof.sofMatchParams(referSOF, referSOFTrim));
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting sites-location by SOF:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sites-location by SOF',
      error: error.message
    });
  }
};

// GET - ดึง Sites_Location เฉพาะที่มี contract ที่ยังไม่หมดอายุ (end_date >= วันนี้ หรือ end_date เป็น NULL)
const getSitesLocationWithContracts = async (req, res) => {
  try {
    let siteIds = [];

    try {
      const slSof = await resolveSlSofSchema();
      const { sql: contractSlSql, params } = await slSof.activeContractSlidsQuery();
      const [contractSlRows] = await db.execute(contractSlSql, params);
      siteIds = contractSlRows.map((row) => row.SLid);
    } catch (err) {
      console.log('sites_location contract query failed:', err.message);
    }

    if (siteIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No sites with contracts that are not expired'
      });
    }

    const placeholders = siteIds.map(() => '?').join(',');
    const sql = `
      SELECT DISTINCT SL.SLid, SL.Sid, SL.lid, S.Name AS SiteName, L.Location2, IFNULL(L.Province, '') AS Province
      FROM sites_location SL
      JOIN sites S ON SL.Sid = S.Sid
      JOIN location L ON SL.lid = L.lid
      WHERE SL.SLid IN (${placeholders})
      ORDER BY S.Name, L.Location2
    `;
    const [rows] = await db.execute(sql, siteIds);
    const list = rows || [];
    /** หนึ่งแถวต่อที่ตั้งจริง (Sid+lid) — ใช้ SLid ล่าสุดเป็นตัวแทน */
    const byPhysical = new Map();
    for (const row of list) {
      const key = `${row.Sid}:${row.lid}`;
      const prev = byPhysical.get(key);
      if (!prev || row.SLid > prev.SLid) {
        byPhysical.set(key, row);
      }
    }
    res.status(200).json({ success: true, data: [...byPhysical.values()] });
  } catch (error) {
    console.error('Error getting sites-location with contracts:', error);
    res.status(200).json({
      success: true,
      data: [],
      message: 'Error getting sites with contracts',
      error: error.message
    });
  }
};

// GET - ดึงข้อมูล Sites
const getSites = async (req, res) => {
  try {
    // app_db: devices.SLid = sites_location.SLid, sites_location.Sid = sites.Sid
    const sql = `
      SELECT 
        s.Sid, 
        s.Name, 
        s.Slug, 
        s.Status,
        COUNT(d.Did) AS device_count
      FROM sites s
      LEFT JOIN sites_location sl ON sl.Sid = s.Sid
      LEFT JOIN devices d ON d.SLid = sl.SLid
      GROUP BY s.Sid, s.Name, s.Slug, s.Status
      ORDER BY s.Sid DESC
    `;
    const [rows] = await db.execute(sql);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error getting sites:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sites',
      error: error.message
    });
  }
};

// PUT - แก้ไขข้อมูล Site
const updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, Slug, Status } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดทหรือไม่
    if (!Name && !Slug && !Status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide data to update'
      });
    }

    // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Sid FROM sites WHERE Sid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }

    // สร้าง SQL query แบบ dynamic
    const updates = [];
    const values = [];

    if (Name) {
      updates.push('Name = ?');
      values.push(Name);
    }
    if (Slug) {
      updates.push('Slug = ?');
      values.push(Slug);
    }
    if (Status) {
      updates.push('Status = ?');
      values.push(Status);
    }

    values.push(id);

    const sql = `UPDATE sites SET ${updates.join(', ')} WHERE Sid = ?`;
    await db.execute(sql, values);

    // ดึงข้อมูลที่อัพเดทแล้วมาแสดง
    const [updated] = await db.execute('SELECT Sid, Name, Slug, Status FROM sites WHERE Sid = ?', [id]);

    res.status(200).json({
      success: true,
            message: 'Site updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating site',
      error: error.message
    });
  }
};

// DELETE - ลบ Site
const deleteSite = async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่า Site มีอยู่จริงหรือไม่
    const checkSql = 'SELECT Sid, Name FROM sites WHERE Sid = ?';
    const [existing] = await db.execute(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }

    // ลบข้อมูล
    const sql = 'DELETE FROM sites WHERE Sid = ?';
    await db.execute(sql, [id]);

    res.status(200).json({
      success: true,
      message: 'Site deleted successfully',
      data: {
        id: existing[0].Sid,
        Name: existing[0].Name
      }
    });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting site',
      error: error.message
    });
  }
};

/** PATCH — อัปเดต SOF ของ sites_location (schema ใหม่) */
const updateSitesLocationSof = async (req, res) => {
  try {
    const slid = parseInt(req.params.slid, 10);
    const { SOF, Refer_SOF, sof, refer_sof } = req.body || {};
    const sofValue = SOF ?? Refer_SOF ?? sof ?? refer_sof;

    if (isNaN(slid)) {
      return res.status(400).json({ success: false, message: 'Invalid SLid' });
    }
    if (sofValue === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide SOF' });
    }

    const [rows] = await db.execute('SELECT SLid, SOF FROM sites_location WHERE SLid = ?', [slid]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Site location not found' });
    }

    const oldSof = rows[0].SOF != null ? String(rows[0].SOF).trim() : '';
    const newSof = sofValue != null ? String(sofValue).trim() : '';
    const renameAllPeers = Boolean(req.body && req.body.rename_all_peers);
    if (renameAllPeers && oldSof && newSof && oldSof !== newSof) {
      await syncSofRenameOnSiteLocations(db, oldSof, newSof);
    } else {
      await applyReferSofToSiteLocation(db, slid, sofValue);
    }

    const [updated] = await db.execute(
      `SELECT SL.SLid, SL.Sid, SL.lid, SL.SOF, SL.SOF AS Refer_SOF,
              S.Name AS SiteName, L.Location2, IFNULL(L.Province, '') AS Province
       FROM sites_location SL
       JOIN sites S ON SL.Sid = S.Sid
       JOIN location L ON SL.lid = L.lid
       WHERE SL.SLid = ?`,
      [slid]
    );

    res.status(200).json({
      success: true,
      message: 'SOF updated successfully',
      data: updated[0],
    });
  } catch (error) {
    console.error('Error updating sites_location SOF:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sites_location SOF',
      error: error.message,
    });
  }
};

/** GET — จำนวน Site (ตาราง sites) และ Location (ตาราง sites_location) จาก DB */
const getSiteRegistryCounts = async (req, res) => {
  try {
    const [[siteRow]] = await db.execute('SELECT COUNT(*) AS c FROM sites');
    const [[locRow]] = await db.execute('SELECT COUNT(*) AS c FROM sites_location');
    res.status(200).json({
      success: true,
      data: {
        siteCount: Number(siteRow?.c ?? 0),
        locationCount: Number(locRow?.c ?? 0),
      },
    });
  } catch (error) {
    console.error('Error getting site registry counts:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting site registry counts',
      error: error.message,
    });
  }
};

module.exports = {
  createSite,                    // POST
  getSites,                      // GET
  getSitesLocation,              // GET /locations
  getSitesLocationBySOF,         // GET /locations-by-sof?refer_sof=XXX
  getSitesLocationWithContracts, // GET /locations-with-contracts
  getSiteRegistryCounts,         // GET /registry-counts
  updateSitesLocationSof,        // PATCH /locations/:slid/sof
  updateSite,                    // PUT
  deleteSite                     // DELETE
};

