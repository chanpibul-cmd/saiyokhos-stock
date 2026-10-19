const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fetching remote item_codes from D1...');
const output = execSync('npx wrangler d1 execute saiyok_stock_db --remote --command="SELECT item_code FROM items;" --json', {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024
});

const json = JSON.parse(output);
const remoteCodes = new Set(json[0].results.map(r => r.item_code.trim()));
console.log(`Found ${remoteCodes.size} item_codes in remote D1 items table.`);

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

const buys = parseCSV(fs.readFileSync('data_sync/buys.csv', 'utf8'));
const pays = parseCSV(fs.readFileSync('data_sync/pays.csv', 'utf8'));

const missingBuys = new Map();
for (const b of buys) {
  const code = (b['รหัสสินค้า'] || '').trim();
  if (code && !remoteCodes.has(code)) {
    missingBuys.set(code, b['รายการ'] || '');
  }
}

const missingPays = new Map();
for (const p of pays) {
  const code = (p['รหัสสินค้า'] || '').trim();
  if (code && !remoteCodes.has(code)) {
    missingPays.set(code, p['รายการ'] || '');
  }
}

console.log(`Missing item codes in remote D1:`);
console.log(`From buys: ${missingBuys.size} items:`, Object.fromEntries(missingBuys));
console.log(`From pays: ${missingPays.size} items:`, Object.fromEntries(missingPays));
