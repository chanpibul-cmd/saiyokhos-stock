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

const buys = parseCSV(fs.readFileSync('data_sync/buys.csv', 'utf8'));
const pays = parseCSV(fs.readFileSync('data_sync/pays.csv', 'utf8'));

const buyMap = new Map();
buys.forEach(b => {
  const code = (b['รหัสสินค้า'] || '').trim();
  const qty = parseFloat(String(b['จำนวนที่ซื้อ']).replace(/,/g, '') || 0);
  buyMap.set(code, (buyMap.get(code) || 0) + qty);
});

const payMap = new Map();
pays.forEach(p => {
  const code = (p['รหัสสินค้า'] || '').trim();
  const qty = parseFloat(String(p['จำนวนที่จ่าย']).replace(/,/g, '') || 0);
  payMap.set(code, (payMap.get(code) || 0) + qty);
});

console.log('--- Checking all negative balances with raw quantities ---');
const negativeItems = [];
payMap.forEach((payQty, code) => {
  const buyQty = buyMap.get(code) || 0;
  const balance = Math.round((buyQty - payQty) * 100) / 100;
  if (balance < 0) {
    const it = buys.find(b => b['รหัสสินค้า'] === code) || pays.find(p => p['รหัสสินค้า'] === code);
    negativeItems.push({ code, name: it?.['รายการ'], buyQty, payQty, balance });
  }
});

console.log('Negative items count:', negativeItems.length);
negativeItems.forEach(n => console.log(`${n.code} ${n.name}: Buy=${n.buyQty} Pay=${n.payQty} Balance=${n.balance}`));
