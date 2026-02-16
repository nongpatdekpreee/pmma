const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Excel serial date: days since 1899-12-30 (Excel epoch)
function toExcelSerial(date) {
  const excelEpoch = new Date(1899, 11, 30);
  return Math.round((date - excelEpoch) / 86400000);
}

const dateFormat = 'dddd, mmmm d, yyyy'; // e.g. Wednesday, March 14, 2012

const rows = [
  ['Site', 'Location', 'Plan Start', 'Plan End', 'Engineer', 'SOF', 'Coverage Scope'],
  ['Sample Site A', 'Building 1 - Room 101', new Date(2026, 1, 16), new Date(2026, 1, 20), 'John Doe', 'Contract SOF Name', ''],
  ['Sample Site B', 'Building 2 - Floor 3', new Date(2026, 1, 17), new Date(2026, 1, 21), '', 'Another SOF', 'Sample coverage scope'],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

// Plan Start = col C (2), Plan End = col D (3) - set Excel date format for date cells
const planStartCol = 2;
const planEndCol = 3;
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const dateStart = row[planStartCol];
  const dateEnd = row[planEndCol];
  if (dateStart instanceof Date && !isNaN(dateStart)) {
    const addrStart = XLSX.utils.encode_cell({ r, c: planStartCol });
    ws[addrStart] = { t: 'n', v: toExcelSerial(dateStart), z: dateFormat };
  }
  if (dateEnd instanceof Date && !isNaN(dateEnd)) {
    const addrEnd = XLSX.utils.encode_cell({ r, c: planEndCol });
    ws[addrEnd] = { t: 'n', v: toExcelSerial(dateEnd), z: dateFormat };
  }
}

XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'task_upload_template.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Written:', outPath);
