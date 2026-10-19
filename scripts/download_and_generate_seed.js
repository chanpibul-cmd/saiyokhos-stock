const fs = require('fs');
const path = require('path');

const SHEET_ID = '1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o';
const DATA_DIR = path.join(__dirname, '..', 'data_sync');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TABS = {
  'items.csv': '0',
  'shops.csv': '907850828',
  'buys.csv': '840698544',
  'pays.csv': '567610446'
};

async function downloadCsvs() {
  console.log('--- ดาวน์โหลดข้อมูลล่าสุดจาก Google Sheet ---');
  for (const [file, gid] of Object.entries(TABS)) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    console.log(`Downloading ${file} (gid: ${gid})...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${file}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const filePath = path.join(DATA_DIR, file);
    fs.writeFileSync(filePath, text, 'utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).length;
    console.log(`Saved ${file} (${lines} lines, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
  }
}

// ฟังก์ชันแปลง CSV text เป็น Array of Objects
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
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j] || `col_${j}`;
      obj[h] = vals[j] !== undefined ? vals[j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function cleanSqlStr(str) {
  if (str === null || str === undefined) return "''";
  const s = String(str).trim().replace(/'/g, "''");
  return `'${s}'`;
}

function cleanNum(str) {
  if (!str) return 0;
  const s = String(str).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function convertDate(str) {
  if (!str) return '2025-10-01';
  const s = String(str).trim();
  const m = s.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '2025-10-01';
}

async function main() {
  await downloadCsvs();

  console.log('\n--- แปลงข้อมูล CSV เป็นคำสั่ง SQL สำหรับ Buys และ Pays ---');

  const buysCsv = fs.readFileSync(path.join(DATA_DIR, 'buys.csv'), 'utf8');
  const paysCsv = fs.readFileSync(path.join(DATA_DIR, 'pays.csv'), 'utf8');
  const itemsCsv = fs.readFileSync(path.join(DATA_DIR, 'items.csv'), 'utf8');
  const shopsCsv = fs.readFileSync(path.join(DATA_DIR, 'shops.csv'), 'utf8');

  const buys = parseCSV(buysCsv);
  const pays = parseCSV(paysCsv);
  const items = parseCSV(itemsCsv);
  const shops = parseCSV(shopsCsv);

  console.log(`Data count: Items=${items.length}, Shops=${shops.length}, Buys=${buys.length}, Pays=${pays.length}`);

  const buysSqlStatements = [];
  const paysSqlStatements = [];

  // BUYS
  for (const b of buys) {
    const code = (b['รหัสสินค้า'] || '').trim();
    const name = (b['รายการ'] || '').trim();
    if (code && name) {
      const docDate = convertDate(b['วันที่']);
      const docNo = b['เลขที่เอกสาร'] && b['เลขที่เอกสาร'].trim() ? cleanSqlStr(b['เลขที่เอกสาร']) : cleanSqlStr('-');
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name);
      const cat = cleanSqlStr(b['กลุ่มสินค้า'] || 'ทั่วไป');
      const u = cleanSqlStr(b['หน่วยนับ'] || 'หน่วย');
      const price = cleanNum(b['ราคา']);
      const qty = cleanNum(b['จำนวนที่ซื้อ']);
      let total = cleanNum(b['มูลค่ารวม']);
      if (total <= 0 && qty > 0 && price > 0) {
        total = Math.round(qty * price * 100) / 100;
      }
      const shop = b['ร้านค้า'] && b['ร้านค้า'].trim() ? cleanSqlStr(b['ร้านค้า']) : cleanSqlStr('ยอดยกมา');
      const rem = cleanSqlStr(b['หมายเหตุ'] || '');
      const ym = b['ปี-เดือน'] && b['ปี-เดือน'].trim() ? cleanSqlStr(b['ปี-เดือน']) : cleanSqlStr(docDate.slice(0, 7));

      buysSqlStatements.push(`INSERT INTO buys (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, shop_name, remark, ym_period, created_by) VALUES ('${docDate}', ${docNo}, ${c}, ${n}, ${cat}, ${u}, ${price}, ${qty}, ${total}, ${shop}, ${rem}, ${ym}, 'google_sheet_sync');`);
    }
  }

  // PAYS
  for (const p of pays) {
    const code = (p['รหัสสินค้า'] || '').trim();
    const name = (p['รายการ'] || '').trim();
    if (code && name) {
      const rawDate = p[''] || p['col_0'] || p['วันที่'] || Object.values(p)[0];
      const docDate = convertDate(rawDate);
      const docNo = p['เลขที่เอกสาร'] && p['เลขที่เอกสาร'].trim() ? cleanSqlStr(p['เลขที่เอกสาร']) : cleanSqlStr('-');
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name);
      const cat = cleanSqlStr(p['กลุ่มสินค้า'] || 'ทั่วไป');
      const u = cleanSqlStr(p['หน่วยนับ'] || 'หน่วย');
      const price = cleanNum(p['ราคา']);
      const qty = cleanNum(p['จำนวนที่จ่าย']);
      let total = cleanNum(p['มูลค่ารวม']);
      if (total <= 0 && qty > 0 && price > 0) {
        total = Math.round(qty * price * 100) / 100;
      }
      const dept = p['หน่วยงานที่เบิก'] && p['หน่วยงานที่เบิก'].trim() ? cleanSqlStr(p['หน่วยงานที่เบิก']) : cleanSqlStr('หน่วยงานทั่วไป');
      const rem = cleanSqlStr(p['หมายเหตุ'] || '');
      const ym = p['ปี-เดือน'] && p['ปี-เดือน'].trim() ? cleanSqlStr(p['ปี-เดือน']) : cleanSqlStr(docDate.slice(0, 7));

      paysSqlStatements.push(`INSERT INTO pays (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, department, remark, ym_period, created_by) VALUES ('${docDate}', ${docNo}, ${c}, ${n}, ${cat}, ${u}, ${price}, ${qty}, ${total}, ${dept}, ${rem}, ${ym}, 'google_sheet_sync');`);
    }
  }

  console.log(`Generated SQL: Buys=${buysSqlStatements.length}, Pays=${paysSqlStatements.length}`);

  // บันทึกไฟล์ SQL แยกชุดละ 500-1000 เพื่อความรวดเร็วและปลอดภัยในการรันบน D1
  const BATCH_SIZE = 500;

  // 1. Buys batches
  let buyBatchIdx = 1;
  const buyFiles = [];
  for (let i = 0; i < buysSqlStatements.length; i += BATCH_SIZE) {
    const chunk = buysSqlStatements.slice(i, i + BATCH_SIZE);
    const fname = `seed_buys_part_${buyBatchIdx}.sql`;
    const fpath = path.join(DATA_DIR, fname);
    fs.writeFileSync(fpath, chunk.join('\n'), 'utf8');
    buyFiles.push(fname);
    buyBatchIdx++;
  }

  // 2. Pays batches
  let payBatchIdx = 1;
  const payFiles = [];
  for (let i = 0; i < paysSqlStatements.length; i += BATCH_SIZE) {
    const chunk = paysSqlStatements.slice(i, i + BATCH_SIZE);
    const fname = `seed_pays_part_${payBatchIdx}.sql`;
    const fpath = path.join(DATA_DIR, fname);
    fs.writeFileSync(fpath, chunk.join('\n'), 'utf8');
    payFiles.push(fname);
    payBatchIdx++;
  }

  console.log(`Created ${buyFiles.length} buy files and ${payFiles.length} pay files in ${DATA_DIR}`);
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
