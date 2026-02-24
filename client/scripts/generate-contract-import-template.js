/**
 * Generate contract_upload_template.xlsx with 2 sheets:
 * Sheet 1 = Contracts
 * Sheet 2 = Contract Name (คอลัมน์เดียว): แถวที่เป็นชื่อสัญญา ตามด้วยแถว serial device ที่จะ add เข้าสัญญานั้น
 * Run: node scripts/generate-contract-import-template.js
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'public');
const outPath = path.join(outDir, 'contract_upload_template.xlsx');

const sheet1Data = [
  ['Contract Name', 'SOF', 'Service', 'Site', 'Location', 'Start Date', 'End Date', 'SLA Term', 'Sale Account', 'Email', 'Tel', 'Coverage Scope'],
  ['Sample Contract A', 'Refer SOF Name A', 'Device Network Manage Service', 'Site Name A', 'Location A', '2026-01-01', '2026-12-31', '12', 'Account A', 'email@example.com', '02-1234567', 'Full coverage'],
];

// Sheet 2: คอลัมน์เดียว "Contract Name" — แถวแรกหลังหัวคอลัมน์เป็นชื่อสัญญา แถวถัดไปเป็น serial device ที่จะ add เข้าสัญญานั้น
const sheet2Data = [
  ['Contract Name'],
  ['Sample Contract A'],
  ['FGL2314A91L'],
  ['FGL2314A92L'],
  ['FGL2314A93L'],
];

const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
XLSX.utils.book_append_sheet(wb, ws1, 'Contracts');
XLSX.utils.book_append_sheet(wb, ws2, 'Devices');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
XLSX.writeFile(wb, outPath);
console.log('Written:', outPath);
