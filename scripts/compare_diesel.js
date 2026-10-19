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

const buys = parseCSV(fs.readFileSync('data_sync/buys.csv', 'utf8')).filter(b => b['รหัสสินค้า'] === 'ช0001');
const pays = parseCSV(fs.readFileSync('data_sync/pays.csv', 'utf8')).filter(p => p['รหัสสินค้า'] === 'ช0001');

console.log('Comparing 57 buy vs 57 pay records for ช0001:\n');

let totalCalculatedPayQty = 0;
let totalBuyQty = 0;

for (let i = 0; i < buys.length; i++) {
  const b = buys[i];
  const p = pays[i];

  const bQty = parseFloat(String(b['จำนวนที่ซื้อ']).replace(/,/g, ''));
  const bTotal = parseFloat(String(b['มูลค่ารวม']).replace(/,/g, ''));
  const bPrice = parseFloat(String(b['ราคา']).replace(/,/g, ''));

  const pRawQty = parseFloat(String(p['จำนวนที่จ่าย']).replace(/,/g, ''));
  const pTotal = parseFloat(String(p['มูลค่ารวม']).replace(/,/g, ''));
  const pPrice = parseFloat(String(p['ราคา']).replace(/,/g, ''));

  const pCalcQty = (pTotal > 0 && pPrice > 0) ? Math.round((pTotal / pPrice) * 100) / 100 : pRawQty;

  totalBuyQty += bQty;
  totalCalculatedPayQty += pCalcQty;

  const diff = bQty - pCalcQty;
  if (Math.abs(diff) > 0.001) {
    console.log(`Row ${i + 1}: BuyDate=${b['วันที่']} PayDate=${p['วันที่'] || p['']} | BuyQty=${bQty} vs PayRaw=${pRawQty} vs PayCalc=${pCalcQty} | Diff=${diff.toFixed(3)} | BuyTotal=${bTotal} PayTotal=${pTotal}`);
  }
}

console.log('\nTotal Buy Qty:           ', totalBuyQty.toFixed(4));
console.log('Total Calculated Pay Qty:', totalCalculatedPayQty.toFixed(4));
console.log('Difference (Buy - Calc): ', (totalBuyQty - totalCalculatedPayQty).toFixed(4));
