const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const rows = [
  ['Contract Name', 'SOF', 'Site', 'Location', 'Start Date', 'End Date', 'SLA Term', 'Sale Account', 'Contract Value', 'Coverage Scope', 'Devices'],
  ['สัญญาทดสอบ Import 1', 'Refer SOF A', 'Site Name A', 'Location A', '2026-01-01', '2026-12-31', '12', 'Account A', '150000', 'Full coverage', 'FGL2314A91L,FGL2314A92L,FGL2314A93L'],
  ['สัญญาทดสอบ Import 2', 'Refer SOF B', 'Site Name B', 'Location B', '2026-02-01', '2027-01-31', '12', 'Account B', '200000', '', 'FGL2314B01L;FGL2314B02L'],
  ['Test Contract 3', 'SOF C', 'Site C', '', '2026-03-15', '2027-03-14', '12', '', '50000', 'PM only', ''],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, 'Contracts');

const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'contract_import_test.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Written:', outPath);
