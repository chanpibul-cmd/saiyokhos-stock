const fs = require('fs');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  function splitLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim()); cur = '';
      } else { cur += char; }
    }
    result.push(cur.trim());
    return result;
  }
  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j] || ('col_' + j)] = vals[j] !== undefined ? vals[j] : '';
    rows.push(obj);
  }
  return rows;
}

const pays = parseCSV(fs.readFileSync('data_sync/pays.csv', 'utf8'));
const dieselPays = pays.filter(p => p['รหัสสินค้า'] === 'ช0001');

console.log(`Diesel pays total rows: ${dieselPays.length}`);

let totalRaw = 0;
let totalFixed = 0;

dieselPays.forEach((p, idx) => {
  const rawQty = parseFloat(String(p['จำนวนที่จ่าย']).replace(/,/g, '') || 0);
  const total = parseFloat(String(p['มูลค่ารวม']).replace(/,/g, '') || 0);
  const price = parseFloat(String(p['ราคา']).replace(/,/g, '') || 0);
  const fixedQty = (total > 0 && price > 0) ? Math.round((total / price) * 100) / 100 : rawQty;

  totalRaw += rawQty;
  totalFixed += fixedQty;

  if (rawQty !== fixedQty) {
    console.log(`Row ${idx + 1} (${p['วันที่'] || p['']}): Raw=${rawQty} -> Fixed=${fixedQty} (price=${price}, total=${total})`);
  }
});

console.log('\nTotal Raw:  ', totalRaw.toFixed(2));
console.log('Total Fixed:', totalFixed.toFixed(2));
