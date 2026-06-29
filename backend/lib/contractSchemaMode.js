const { tableColumnExists } = require('./taskContractJoin');

/**
 * true = ใช้ตาราง contract + contract_device
 * (sites_location ใน app_db มีแค่ SLid/Sid/lid ไม่มี status/SOF)
 */
async function usesLegacyContractTable() {
  if (await tableColumnExists('sites_location', 'status')) {
    return false;
  }
  if (await tableColumnExists('sites_location', 'SOF')) {
    return false;
  }
  return true;
}

module.exports = { usesLegacyContractTable };
