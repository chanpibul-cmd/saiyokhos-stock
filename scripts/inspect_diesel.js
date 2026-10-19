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

['ช0001', 'ช0002'].forEach(code => {
  const bList = buys.filter(b => b['รหัสสินค้า'] === code);
  const pList = pays.filter(p => p['รหัสสินค้า'] === code);

  const totalBuyQty = bList.reduce((s, b) => s + parseFloat(String(b['จำนวนที่ซื้อ']).replace(/,/g, '') || 0), 0);
  const totalPayQty = pList.reduce((s, p) => s + parseFloat(String(p['จำนวนที่จ่าย']).replace(/,/g, '') || 0), 0);
  
  let totalCalcPayQty = 0;
  pList.forEach(p => {
    const rawQty = parseFloat(String(p['จำนวนที่จ่าย']).replace(/,/g, '') || 0);
    const total = parseFloat(String(p['มูลค่ารวม']).replace(/,/g, '') || 0);
    const price = parseFloat(String(p['ราคา']).replace(/,/g, '') || 0);
    const calcQty = (total > 0 && price > 0) ? Math.round((total / price) * 100) / 100 : rawQty;
    totalCalcPayQty += calcQty;
  });

  console.log(`\n=== Item ${code} ===`);
  console.log('Buys count:', bList.length, 'Pays count:', pList.length);
  console.log('Total Buy Qty:           ', totalBuyQty.toFixed(4));
  console.log('Total Raw Pay Qty:       ', totalPayQty.toFixed(4));
  console.log('Difference (Buy - Raw):  ', (totalBuyQty - totalPayQty).toFixed(4));
  console.log('Total Calc Pay Qty:      ', totalCalcPayQty.toFixed(4));
  console.log('Difference (Buy - Calc): ', (totalBuyQty - totalCalcPayQty).toFixed(4));
});
