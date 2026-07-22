'use strict';
// One-off: dump each sheet as a grid so we can see the real layout.
const XLSX = require('xlsx');
const wb = XLSX.readFile(__dirname + '/source-2023.xlsx');
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  console.log('\n==================== SHEET: ' + name + ' (' + rows.length + ' rows) ====================');
  rows.slice(0, 40).forEach((r, i) => {
    const cells = r.map(c => String(c).replace(/\s+/g, ' ').trim()).filter(x => x !== '');
    if (cells.length) console.log(i + ' | ' + cells.join(' || '));
  });
}
