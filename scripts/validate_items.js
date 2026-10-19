const fs = require('fs');
const path = require('path');

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

const items = parseCSV(fs.readFileSync('data_sync/items.csv', 'utf8'));
const itemCodes = new Set(items.map(i => (i['รหัส'] || '').trim()).filter(Boolean));

const buys = parseCSV(fs.readFileSync('data_sync/buys.csv', 'utf8'));
const pays = parseCSV(fs.readFileSync('data_sync/pays.csv', 'utf8'));

const missingInBuys = buys.filter(b => {
  const c = (b['รหัสสินค้า'] || '').trim();
  return c && !itemCodes.has(c);
});
const missingInPays = pays.filter(p => {
  const c = (p['รหัสสินค้า'] || '').trim();
  return c && !itemCodes.has(c);
});

console.log('Total items in items.csv:', itemCodes.size);
console.log('Missing items in buys:', missingInBuys.length);
if (missingInBuys.length > 0) console.log('Sample missing buys:', missingInBuys.slice(0, 3));
console.log('Missing items in pays:', missingInPays.length);
if (missingInPays.length > 0) console.log('Sample missing pays:', missingInPays.slice(0, 3));
